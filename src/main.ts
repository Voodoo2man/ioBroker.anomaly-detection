/* Created with @iobroker/create-adapter v3.1.5 */
import * as utils from "@iobroker/adapter-core";
import {
	anomalyBootstrapStateUpdate,
	manualRetrainBootstrapNeeds,
	shouldBootstrapPredictiveHistory,
} from "./lib/bootstrap-policy";
import { createContextPart } from "./lib/context-value";
import { HistoryLoadBudget, HistorySampleSampler } from "./lib/history-budget";
import {
	sanitizeHistory,
	sanitizeHistoryWithDiagnostics,
	createHistoryRequestOptions,
	type HistoryAggregation,
	type HistoryProvider,
	type HistorySample,
} from "./lib/history-provider";
import { withAbortableTimeout } from "./lib/history-request";
import { HistorySourceResolver, selectHistorySource, type HistorySource } from "./lib/history-source-resolver";
import { mergeStartupModels } from "./lib/model-persistence";
import { objectName } from "./lib/object-names";
import { SOURCES_OBJECT_ID, ensureStateUnit, sourcesObject } from "./lib/object-structure";
import {
	acquireExclusiveWork,
	drainPendingWork,
	enqueueSerializedWork,
	settleIndependentTasks,
} from "./lib/pending-work";
import {
	PREDICTIVE_ALGORITHM_VERSION,
	PREDICTIVE_HISTORY_RAW_LIMIT,
	PredictiveModel,
	PredictiveTrainingQueue,
	normalizePredictiveSettings,
	predictiveHistorySpanMinutes,
	type PredictiveModelData,
	type PredictiveResult,
} from "./lib/predictive";
import { cleanupStaleSources } from "./lib/source-cleanup";
import {
	SourceMonitor,
	evaluateCurrentSourceValue,
	parseStoredModel,
	type ObservationResult,
	type SourceModelData,
	type SourceSettings,
} from "./lib/source-monitor";
import { writeStateValues } from "./lib/state-write";
import { observeWithTimestampCache } from "./lib/timestamp-cache";

const MODEL_STATE_ID = "models";
const PREDICTIVE_MODEL_STATE_ID = "predictiveModels";
const PERSIST_DELAY_MS = 30_000;
const HISTORY_TIMEOUT_MS = 30_000;
const HISTORY_CONCURRENCY = 2;
const MAX_PROCESSED_TIMESTAMP_ENTRIES = 512;
interface ConfiguredSource extends SourceSettings {
	name: string;
}

function predictiveSettingsFor(source: ConfiguredSource): SourceSettings["predictive"] {
	const legacy = source.predictive;
	const flatEnabled = source.predictiveEnabled;
	const enabledValue = flatEnabled !== undefined ? flatEnabled : legacy?.enabled;
	if (enabledValue !== true && (enabledValue as unknown) !== "true" && (enabledValue as unknown) !== 1) {
		return undefined;
	}
	return {
		...legacy,
		enabled: true,
		horizonMinutes: source.predictiveHorizonMinutes ?? legacy?.horizonMinutes,
		updateIntervalMinutes: source.predictiveUpdateIntervalMinutes ?? legacy?.updateIntervalMinutes,
		minimumTrainingSamples: source.predictiveMinimumTrainingSamples ?? legacy?.minimumTrainingSamples,
		maximumTrainingPoints: source.predictiveMaximumTrainingPoints ?? legacy?.maximumTrainingPoints,
		seasonalPeriodMinutes: source.predictiveSeasonalPeriodMinutes ?? legacy?.seasonalPeriodMinutes,
		seasonalityMode: source.predictiveSeasonalityMode ?? legacy?.seasonalityMode,
	};
}

function parsePredictiveModels(value: ioBroker.StateValue | undefined): Record<string, PredictiveModelData> {
	if (typeof value !== "string") {
		return {};
	}
	try {
		const parsed = JSON.parse(value) as Record<string, PredictiveModelData>;
		return Object.fromEntries(Object.entries(parsed).filter(([, model]) => model?.version === 1));
	} catch {
		return {};
	}
}

class IoBrokerHistoryProvider implements HistoryProvider {
	public constructor(
		private readonly adapter: ioBroker.Adapter,
		private readonly instance: string,
	) {}

	public async getHistory(
		sourceId: string,
		start: number,
		end: number,
		limit: number,
		aggregate: HistoryAggregation = "none",
	): Promise<unknown> {
		const response = await this.adapter.sendToAsync(this.instance, "getHistory", {
			id: sourceId,
			options: createHistoryRequestOptions(start, end, limit, aggregate),
		});
		return response;
	}
}

interface SegmentedHistoryResult {
	samples: HistorySample[];
	anomalySamples: HistorySample[];
	providerCalls: number;
	segmentQueries: number;
	coverageProbes: number;
	segmentSplits: number;
	queryLimitSplits: number;
	coverageProbeSplits: number;
	acceptedSegments: number;
	providerSamplesTotal: number;
	maxProviderResponse: number;
	adaptiveSegments: number;
	densityEstimates: number;
	adaptiveTargetSamples: number;
	minAdaptiveSegmentDuration: number | undefined;
	maxAdaptiveSegmentDuration: number | undefined;
	fallbackSplits: number;
	densityRecalculations: number;
	adaptiveDownscales: number;
	initialAdaptiveSegmentDuration: number | undefined;
	finalAdaptiveSegmentDuration: number | undefined;
	adaptiveLimitHits: number;
	finalRawSamples: number;
	deduplicatedSamples: number;
	duplicateSamplesRemoved: number;
}

class AnomalyDetection extends utils.Adapter {
	private readonly monitors = new Map<string, SourceMonitor>();
	private readonly sourceIds = new Map<string, string>();
	private readonly sources = new Map<string, ConfiguredSource>();
	private readonly sourceUnits = new Map<string, string>();
	private readonly contextNames = new Map<string, string>();
	private readonly invalidValueWarnings = new Set<string>();
	private readonly invalidHistoryConfigurationWarnings = new Set<string>();
	private readonly contextValues = new Map<string, Map<string, ioBroker.StateValue>>();
	private readonly contextSources = new Map<string, Set<string>>();
	private readonly contextCategories = new Map<string, Set<string>>();
	private readonly contextWarnings = new Set<string>();
	private readonly evaluations = new Map<string, ObservationResult>();
	private readonly historySourceResolver = new HistorySourceResolver(this);
	private readonly predictiveModels = new Map<string, PredictiveModel>();
	private readonly predictiveResults = new Map<string, PredictiveResult>();
	private readonly predictiveTrainingQueue = new PredictiveTrainingQueue();
	/** Sources are subscribed before bootstrap so state changes can arrive during import. */
	private readonly bootstrappingSources = new Set<string>();
	/** Last processed source timestamps; prevents duplicate delivery of one physical sample. */
	private readonly lastProcessedTimestamps = new Map<string, number>();
	/** Startup, retrain, and state processing that must finish before shutdown persistence. */
	private readonly pendingAdapterWork = new Set<Promise<void>>();
	private readonly resultWriteQueues = new Map<string, Promise<void>>();
	private readonly persistenceQueues = new Map<string, Promise<void>>();
	private readonly historyAbortController = new AbortController();
	private restoredModels: Record<string, SourceModelData> = {};
	private restoredPredictiveModels: Record<string, PredictiveModelData> = {};
	private startupModelsLoaded = false;
	private startupComplete = false;
	private unloading = false;
	private persistTimer: ioBroker.Timeout | undefined;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: "anomaly-detection" });
		this.on("ready", () => this.trackAdapterWork(this.onReady(), "Adapter startup"));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		await this.ensureModelState();
		if (this.unloading) {
			return;
		}
		// The source container is a real parent of every generated source device.
		// Creating it on every startup also repairs existing installations.
		await this.setObjectNotExistsAsync(SOURCES_OBJECT_ID, sourcesObject);
		if (this.unloading) {
			return;
		}
		const predictiveStored = parsePredictiveModels((await this.getStateAsync(PREDICTIVE_MODEL_STATE_ID))?.val);
		if (this.unloading) {
			return;
		}
		const persistedValue = (await this.getStateAsync(MODEL_STATE_ID))?.val;
		if (this.unloading) {
			return;
		}
		let stored = parseStoredModel(persistedValue);
		if (
			typeof persistedValue === "string" &&
			persistedValue !== "" &&
			persistedValue !== "{}" &&
			Object.keys(stored).length === 0
		) {
			this.log.warn("Ignoring corrupt or incompatible persisted anomaly models");
		}
		const configuredSourceIds = new Set(
			(this.config.sources ?? []).flatMap(source => (source.id?.trim() ? [source.id.trim()] : [])),
		);
		stored = await this.cleanupStaleSources(configuredSourceIds, stored);
		if (this.unloading) {
			return;
		}
		this.restoredModels = stored;
		this.restoredPredictiveModels = predictiveStored;
		this.startupModelsLoaded = true;
		const configuredIds = new Set<string>();
		const bootstrapTasks: Array<() => Promise<void>> = [];
		for (const source of this.config.sources ?? []) {
			if (this.unloading) {
				return;
			}
			if (!source.enabled || !source.id?.trim()) {
				continue;
			}
			const id = source.id.trim();
			if (configuredIds.has(id)) {
				this.log.warn(`Ignoring duplicate configured source state: ${id}`);
				continue;
			}
			configuredIds.add(id);
			const object = await this.getForeignObjectAsync(id);
			if (this.unloading) {
				return;
			}
			if (!object) {
				this.log.warn(`Configured source state does not exist yet: ${id}`);
			} else if (object.type !== "state" || object.common.type !== "number") {
				this.log.warn(`Configured source is not a numerical state: ${id}`);
				continue;
			}
			const safeId = this.createSourceId(id);
			const predictive = predictiveSettingsFor(source);
			if (predictive && source.predictive !== predictive) {
				source.predictive = predictive;
			}
			this.sourceIds.set(id, safeId);
			const monitor = new SourceMonitor(source, stored[safeId]);
			this.monitors.set(id, monitor);
			this.sources.set(safeId, source);
			if (predictive?.enabled === true) {
				const predictiveModel = new PredictiveModel(
					normalizePredictiveSettings(predictive),
					predictiveStored[safeId],
				);
				this.predictiveModels.set(safeId, predictiveModel);
				if (predictiveStored[safeId]) {
					this.log.debug(
						`Predictive training basis restore: source=${id} ` +
							`status=${predictiveModel.trainingBasisRestoreStatus} ` +
							`reason=${predictiveModel.trainingBasisRestoreReason}`,
					);
				}
				if (predictiveModel.needsHistoryBootstrap) {
					const reason = predictiveModel.bootstrapReason ?? "missing-model";
					this.log.debug(`Predictive model reset for ${id}: ${reason}`);
					if (reason === "incomplete-model") {
						this.log.debug(
							`Predictive model incomplete: source=${id}, ` +
								`stored trainingSampleCount=${predictiveStored[safeId]?.trainingSampleCount ?? "missing"}, ` +
								`required minimumTrainingSamples=${normalizePredictiveSettings(predictive).minimumTrainingSamples}, ` +
								`bootstrapReason=${reason}`,
						);
					}
					if (reason === "algorithm-changed") {
						this.log.debug(
							`Predictive model invalidated: algorithm version mismatch, source=${id}, ` +
								`stored=${predictiveStored[safeId]?.algorithmVersion ?? "missing"}, current=${PREDICTIVE_ALGORITHM_VERSION}`,
						);
					}
				}
				const restoredResult = predictiveModel.forecast();
				if (restoredResult.status !== "learning" || predictiveStored[safeId]) {
					this.predictiveResults.set(safeId, restoredResult);
				}
			}
			if (object?.common.unit) {
				this.sourceUnits.set(id, object.common.unit);
			}
			for (const context of source.contextStates ?? []) {
				const contextId = context.id?.trim();
				if (!contextId) {
					continue;
				}
				const contextObject = await this.getForeignObjectAsync(contextId);
				if (this.unloading) {
					return;
				}
				const name = contextObject?.common?.name;
				if (typeof name === "string") {
					this.contextNames.set(contextId, name);
				} else if (name && typeof name === "object") {
					const localized = name as Record<string, unknown>;
					const value = localized.de ?? localized.en ?? Object.values(localized)[0];
					if (typeof value === "string") {
						this.contextNames.set(contextId, value);
					}
				}
			}
			await this.registerContexts(id, source);
			if (this.unloading) {
				return;
			}
			await this.ensureSourceObjects(safeId, source, object?.common.unit);
			if (this.unloading) {
				return;
			}
			this.subscribeForeignStates(id);
			const predictiveModel = this.predictiveModels.get(safeId);
			const anomalyBootstrap = this.shouldBootstrap(source, monitor);
			const predictiveBootstrap = this.shouldBootstrapPredictive(source, predictiveModel);
			const initialTrainingIsHistory = source.initialTraining === "history";
			const hasHistoryInstance = typeof source.historyInstance === "string" && !!source.historyInstance.trim();
			const predictiveEnabled = predictive?.enabled === true;
			const storedPredictive = predictiveStored[safeId];
			const minimumTrainingSamples = predictive
				? normalizePredictiveSettings(predictive).minimumTrainingSamples
				: undefined;
			const failedConditions = [
				!predictiveEnabled ? "predictiveEnabled" : undefined,
				!initialTrainingIsHistory ? "initialTrainingIsHistory" : undefined,
				!hasHistoryInstance ? "hasHistoryInstance" : undefined,
				!predictiveModel?.needsHistoryBootstrap ? "needsHistoryBootstrap" : undefined,
			].filter((condition): condition is string => condition !== undefined);
			const decisionDetails = [
				`enabled=${predictiveEnabled}`,
				`initialTraining=${source.initialTraining ?? "undefined"}`,
				`historyInstance=${source.historyInstance ?? "undefined"}`,
				`persistedModel=${storedPredictive !== undefined}`,
				`storedSamples=${storedPredictive?.trainingSampleCount ?? "undefined"}`,
				`minimumSamples=${minimumTrainingSamples ?? "undefined"}`,
				`needsHistoryBootstrap=${predictiveModel?.needsHistoryBootstrap ?? false}`,
				`initialTrainingIsHistory=${initialTrainingIsHistory}`,
				`hasHistoryInstance=${hasHistoryInstance}`,
				`shouldBootstrap=${predictiveBootstrap}`,
				...(!predictiveBootstrap ? [`failedConditions=${failedConditions.join(",") || "none"}`] : []),
			].join(" ");
			this.log.debug(`Predictive bootstrap decision: source=${id} safeId=${safeId} ${decisionDetails}`);
			if (anomalyBootstrap || predictiveBootstrap) {
				if (predictiveBootstrap) {
					this.log.debug(`Predictive bootstrap scheduled from history for ${id}`);
				}
				bootstrapTasks.push(async () => {
					const release = acquireExclusiveWork(this.bootstrappingSources, id);
					if (!release) {
						return;
					}
					try {
						await this.bootstrapSource(id, safeId, source, monitor, {
							anomaly: anomalyBootstrap,
							predictive: predictiveBootstrap,
						});
					} finally {
						release();
						if (!this.unloading) {
							await this.setStateChangedAsync(`sources.${safeId}.retrain`, { val: false, ack: true });
						}
					}
				});
			}
		}
		this.subscribeStates("sources.*.retrain");
		await this.runWithConcurrency(bootstrapTasks, HISTORY_CONCURRENCY);
		// Evaluate the current value once after startup. A state may not emit a
		// change event after a restart, but the dashboard must still receive the
		// current evaluation (including the valid numeric value 0).
		for (const [sourceId, safeId] of this.sourceIds) {
			if (this.unloading) {
				return;
			}
			const state = await this.getForeignStateAsync(sourceId);
			if (this.unloading) {
				return;
			}
			if (state) {
				const monitor = this.monitors.get(sourceId);
				if (monitor) {
					await this.processState(sourceId, safeId, monitor, state);
				}
			}
		}
		this.log.info(`Monitoring ${this.monitors.size} numerical state${this.monitors.size === 1 ? "" : "s"}`);
		this.startupComplete = true;
	}

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (!state || this.unloading) {
			return;
		}
		// Foreign states are authoritative only after their owning adapter has
		// acknowledged the write. Keep unacknowledged retrain commands below.
		if (state.ack === true) {
			for (const sourceId of this.contextSources.get(id) ?? []) {
				this.contextValues.get(sourceId)?.set(id, state.val);
			}
		}
		const retrainMatch = id.match(/sources\.([^.]+)\.retrain$/);
		if (retrainMatch && state.ack === false && state.val === true) {
			const safeId = retrainMatch[1];
			const sourceId = [...this.sourceIds].find(([, value]) => value === safeId)?.[0];
			const source = this.sources.get(safeId);
			const monitor = sourceId ? this.monitors.get(sourceId) : undefined;
			if (sourceId && source && monitor) {
				this.trackAdapterWork(this.retrainSource(sourceId, safeId, source, monitor), "Source retraining");
			}
			return;
		}
		const monitor = this.monitors.get(id);
		const safeId = this.sourceIds.get(id);
		if (monitor && safeId) {
			if (state.ack !== true) {
				return;
			}
			if (this.bootstrappingSources.has(id)) {
				return;
			}
			this.trackAdapterWork(this.processState(id, safeId, monitor, state), "State-change processing");
		}
	}

	private trackAdapterWork(task: Promise<void>, description: string): void {
		const tracked = task.catch(error => {
			const reason = error instanceof Error ? error.message : String(error);
			this.log.error(`${description} failed: ${reason}`);
		});
		this.pendingAdapterWork.add(tracked);
		void tracked.then(() => this.pendingAdapterWork.delete(tracked));
	}

	private onMessage(message: ioBroker.Message): void {
		if (this.unloading || !message.callback) {
			return;
		}
		if (message.command === "getHistoryProviders") {
			this.trackAdapterWork(this.replyWithHistoryProviders(message), "History-provider request");
		} else if (message.command === "tab") {
			void this.replyWithAnomalyTab(message);
		} else if (message.command === "chartData") {
			this.trackAdapterWork(this.replyWithChartData(message), "Chart history request");
		}
	}

	private async replyWithChartData(message: ioBroker.Message): Promise<void> {
		if (this.unloading) {
			return;
		}
		const sourceId = typeof message.message?.sourceId === "string" ? message.message.sourceId.trim() : "";
		const start = Number(message.message?.start) || Date.now() - 24 * 60 * 60 * 1000;
		const end = Number(message.message?.end) || Date.now();
		const limit = Math.min(1000, Math.max(50, Number(message.message?.limit) || 500));
		const safeId = this.sourceIds.get(sourceId);
		const source = safeId ? this.sources.get(safeId) : undefined;
		const monitor = this.monitors.get(sourceId);
		if (!source || !monitor || !source.historyInstance?.trim()) {
			this.sendTo(
				message.from,
				message.command,
				{ data: { samples: [], diagnostics: [], available: false } },
				message.callback,
			);
			return;
		}
		try {
			const historySource = await this.withHistoryTimeout(
				this.resolveConfiguredHistorySource(sourceId, source.historyInstance.trim()),
			);
			if (this.unloading) {
				return;
			}
			const provider = new IoBrokerHistoryProvider(this, source.historyInstance.trim());
			const raw = await this.withHistoryTimeout(
				provider.getHistory(historySource.sourceId, start, end, limit, "minmax"),
			);
			if (this.unloading) {
				return;
			}
			const diagnostics = monitor.diagnosticSnapshots.filter(
				diagnostic => diagnostic.timestamp >= start && diagnostic.timestamp <= end,
			);
			this.sendTo(
				message.from,
				message.command,
				{
					data: {
						samples: sanitizeHistory(
							raw,
							limit * 4,
							diagnostics.map(diagnostic => diagnostic.timestamp),
						),
						diagnostics,
						available: true,
					},
				},
				message.callback,
			);
		} catch {
			if (this.unloading) {
				return;
			}
			this.sendTo(
				message.from,
				message.command,
				{ data: { samples: [], diagnostics: [], available: false } },
				message.callback,
			);
		}
	}

	private replyWithAnomalyTab(message: ioBroker.Message): void {
		const sources = [...this.sourceIds.entries()].map(([sourceId, safeId]) => {
			const source = this.sources.get(safeId);
			const predictiveSettings = source?.predictive;
			const predictiveModel = this.predictiveModels.get(safeId);
			const predictive =
				this.predictiveResults.get(safeId) ??
				(predictiveSettings?.enabled === true
					? {
							status: "learning" as const,
							horizonMinutes: normalizePredictiveSettings(predictiveSettings).horizonMinutes,
							points: [],
							modelType: "seasonal-exponential-smoothing" as const,
							trainingSampleCount: predictiveModel?.trainingSampleCount ?? 0,
							minimumTrainingSamples:
								normalizePredictiveSettings(predictiveSettings).minimumTrainingSamples,
							learningReason: "insufficientSamples" as const,
						}
					: undefined);
			return {
				id: sourceId,
				safeId,
				name: source?.name || sourceId,
				unit: this.sourceUnits.get(sourceId),
				predictive,
				contextLabels: Object.fromEntries(
					(source?.contextStates ?? [])
						.filter(context => typeof context?.id === "string" && context.id.trim())
						.map(context => {
							const contextId = context.id.trim();
							return [contextId, this.contextNames.get(contextId) || contextId];
						}),
				),
				evaluation: this.evaluations.get(sourceId) ?? {
					statusCode: "unavailable",
					severity: "normal",
					sampleCount: this.monitors.get(sourceId)?.sampleCount ?? 0,
					requiredSamples: source?.minimumSamples ?? 30,
				},
			};
		});
		this.sendTo(message.from, message.command, { data: { sources } }, message.callback);
	}

	private async replyWithHistoryProviders(message: ioBroker.Message): Promise<void> {
		if (this.unloading) {
			return;
		}
		const sourceId = typeof message.message?.sourceId === "string" ? message.message.sourceId.trim() : "";
		let sources: HistorySource[];
		try {
			sources = await this.withHistoryTimeout(this.historySourcesForAdmin(sourceId));
		} catch {
			if (this.unloading) {
				return;
			}
			sources = [];
		}
		if (this.unloading) {
			return;
		}
		this.sendTo(
			message.from,
			message.command,
			sources.map(source => ({ value: source.instanceId, label: source.instanceId })),
			message.callback,
		);
	}

	private async historySourcesForAdmin(sourceId: string): Promise<HistorySource[]> {
		if (!sourceId) {
			return [];
		}
		try {
			return await this.historySourceResolver.resolve(sourceId);
		} catch (error) {
			this.log.warn(`Could not resolve history sources for ${sourceId}: ${(error as Error).message}`);
			return [];
		}
	}

	private async processState(
		id: string,
		safeId: string,
		monitor: SourceMonitor,
		state: ioBroker.State,
	): Promise<void> {
		if (this.unloading || state.ack !== true) {
			return;
		}
		try {
			const sourceTimestamp = typeof state.ts === "number" && Number.isFinite(state.ts) ? state.ts : undefined;
			const timestamp = sourceTimestamp ?? Date.now();
			if (monitor.isStaleTimestamp(timestamp)) {
				return;
			}
			const isNewSample = monitor.isNewTimestamp(timestamp);
			const observation = observeWithTimestampCache(
				this.lastProcessedTimestamps,
				id,
				sourceTimestamp,
				() => monitor.observe(state.val, timestamp, this.contextKey(id)),
				MAX_PROCESSED_TIMESTAMP_ENTRIES,
			);
			if (observation.duplicate) {
				return;
			}
			const result = observation.result;
			if (!result) {
				if (!this.invalidValueWarnings.has(id)) {
					this.invalidValueWarnings.add(id);
					this.log.warn(`Ignoring invalid non-numerical value from ${id}`);
				}
				return;
			}
			this.invalidValueWarnings.delete(id);
			this.evaluations.set(id, result);
			this.schedulePersistence();
			const independentTasks = [
				enqueueSerializedWork(this.resultWriteQueues, safeId, () => this.writeResult(safeId, result)),
				isNewSample ? this.updatePredictive(safeId, state.val, timestamp) : Promise.resolve(),
			];
			const outcomes = await settleIndependentTasks(independentTasks);
			for (const outcome of outcomes) {
				if (outcome.status === "rejected") {
					this.log.error(`Could not process source state ${id}: ${(outcome.reason as Error).message}`);
				}
			}
		} catch (error) {
			this.log.error(`Could not process source state ${id}: ${(error as Error).message}`);
		}
	}

	private async updatePredictive(safeId: string, value: ioBroker.StateValue, timestamp: number): Promise<void> {
		await this.predictiveTrainingQueue.enqueue(async () => {
			try {
				const model = this.predictiveModels.get(safeId);
				if (!model || typeof value !== "number" || !Number.isFinite(value)) {
					return;
				}
				model.add(value, Number.isFinite(timestamp) ? timestamp : Date.now());
				const current = this.predictiveResults.get(safeId);
				const interval =
					normalizePredictiveSettings(this.sources.get(safeId)?.predictive).updateIntervalMinutes * 60_000;
				if (current?.lastTrainingAt && Date.now() - current.lastTrainingAt < interval) {
					const refreshed = model.forecast(Date.now());
					this.predictiveResults.set(safeId, refreshed);
					await this.setStateAsync(`sources.${safeId}.predictive.result`, {
						val: JSON.stringify(refreshed),
						ack: true,
					});
					return;
				}
				const result = model.train();
				this.predictiveResults.set(safeId, result);
				await this.setStateAsync(`sources.${safeId}.predictive.status`, { val: result.status, ack: true });
				await this.setStateAsync(`sources.${safeId}.predictive.result`, {
					val: JSON.stringify(result),
					ack: true,
				});
				await this.persistPredictiveModels();
			} catch (error) {
				this.log.warn(`Predictive update failed for ${safeId}: ${(error as Error).message}`);
			}
		});
	}

	private async registerContexts(sourceId: string, source: ConfiguredSource): Promise<void> {
		if (!source.enableContext) {
			return;
		}
		if ((source.contextStates?.length ?? 0) > 3) {
			this.warnContext(`Only the first 3 context states are used for ${sourceId}`);
		}
		for (const context of (source.contextStates ?? [])
			.filter(item => typeof item?.id === "string" && item.id.trim())
			.slice(0, 3)) {
			const id = context.id.trim();
			let sources = this.contextSources.get(id);
			if (!sources) {
				sources = new Set();
				this.contextSources.set(id, sources);
				this.subscribeForeignStates(id);
			}
			sources.add(sourceId);
			const state = await this.getForeignStateAsync(id);
			if (state) {
				let values = this.contextValues.get(sourceId);
				if (!values) {
					values = new Map();
					this.contextValues.set(sourceId, values);
				}
				values.set(id, state.val);
			}
		}
	}

	private contextKey(sourceId: string): string | undefined {
		const safeId = this.sourceIds.get(sourceId);
		const source = safeId ? this.sources.get(safeId) : undefined;
		if (!source?.enableContext) {
			return undefined;
		}
		const values = this.contextValues.get(sourceId);
		const parts = (source.contextStates ?? [])
			.filter(item => item.id?.trim())
			.slice(0, 3)
			.map(context => {
				const contextId = context.id.trim();
				const value = values?.get(contextId);
				if (typeof value === "string" && value.trim() && value.length <= 96) {
					const categoryKey = `${sourceId}\u0000${contextId}`;
					let categories = this.contextCategories.get(categoryKey);
					if (!categories) {
						categories = new Set();
						this.contextCategories.set(categoryKey, categories);
					}
					if (!categories.has(value) && categories.size >= 16) {
						this.warnContext(`Ignoring additional categorical values for ${contextId}; limit is 16`);
						return undefined;
					}
					categories.add(value);
				}
				return createContextPart(context.id, value, context.bucketWidth);
			});
		return parts.length > 0 && parts.every(Boolean) ? parts.join("|") : undefined;
	}

	private warnContext(message: string): void {
		if (!this.contextWarnings.has(message)) {
			this.contextWarnings.add(message);
			this.log.warn(message);
		}
	}

	private async ensureModelState(): Promise<void> {
		await this.setObjectNotExistsAsync(MODEL_STATE_ID, {
			type: "state",
			common: {
				name: objectName("Persisted models"),
				type: "string",
				role: "json",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(PREDICTIVE_MODEL_STATE_ID, {
			type: "state",
			common: {
				name: objectName("Persisted predictive models"),
				type: "string",
				role: "json",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});
	}

	private async cleanupStaleSources(
		configuredSourceIds: ReadonlySet<string>,
		storedModels: ReturnType<typeof parseStoredModel>,
	): Promise<ReturnType<typeof parseStoredModel>> {
		try {
			const result = await cleanupStaleSources(
				{
					listGeneratedSourceDevices: async () => {
						const devices = await this.getForeignObjectsAsync(`${this.namespace}.sources.*`, "device");
						return Object.entries(devices).map(([id, device]) => ({
							id,
							sourceId: typeof device.native?.sourceId === "string" ? device.native.sourceId : undefined,
						}));
					},
					deleteGeneratedSourceTree: relativeId => this.delObjectAsync(relativeId, { recursive: true }),
				},
				this.namespace,
				configuredSourceIds,
				storedModels,
				this.createSourceId.bind(this),
			);
			if (result.modelsChanged) {
				await this.setStateAsync(MODEL_STATE_ID, { val: JSON.stringify(result.models), ack: true });
			}
			for (const sourceId of result.removedSourceIds) {
				this.log.info(`Removed generated anomaly objects and model for deleted source: ${sourceId}`);
			}
			return result.models;
		} catch (error) {
			this.log.error(`Could not clean up stale monitored sources: ${(error as Error).message}`);
			return storedModels;
		}
	}

	private async ensureSourceObjects(safeId: string, source: ConfiguredSource, unit?: string): Promise<void> {
		const base = `${SOURCES_OBJECT_ID}.${safeId}`;
		await this.setObjectNotExistsAsync(base, {
			type: "device",
			common: { name: source.name || source.id },
			native: { sourceId: source.id },
		});
		await this.setObjectNotExistsAsync(`${base}.analysis`, {
			type: "channel",
			common: { name: objectName("Anomaly analysis") },
			native: {},
		});
		if (predictiveSettingsFor(source)?.enabled === true) {
			await this.setObjectNotExistsAsync(`${base}.predictive`, {
				type: "channel",
				common: { name: objectName("Predictive forecast") },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.predictive.result`, {
				type: "state",
				common: { name: objectName("Forecast result"), type: "string", role: "json", read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.predictive.status`, {
				type: "state",
				common: {
					name: objectName("Forecast status"),
					type: "string",
					role: "info.status",
					read: true,
					write: false,
				},
				native: {},
			});
		}
		const numberState = (
			name: ioBroker.StringOrTranslated,
			role: string,
			extra: Partial<ioBroker.StateCommon> = {},
		): ioBroker.SettableObject => ({
			type: "state",
			common: { name, type: "number", role, read: true, write: false, ...extra },
			native: {},
		});
		await this.setObjectNotExistsAsync(
			`${base}.analysis.actual`,
			numberState(objectName("Actual value"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.expected`,
			numberState(objectName("Expected value"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.deviation`,
			numberState(objectName("Deviation"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.score`,
			numberState(objectName("Anomaly score"), "value", { min: 0, max: 100, unit: "%" }),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.sampleCount`,
			numberState(objectName("Learned sample count"), "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.analysis.baselineScope`, {
			type: "state",
			common: {
				name: objectName("Active baseline scope"),
				type: "string",
				role: "info.status",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.activeContext`, {
			type: "state",
			common: { name: objectName("Active context"), type: "string", role: "text", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(
			`${base}.analysis.baselineSampleCount`,
			numberState(objectName("Active baseline sample count"), "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.contextSampleCount`,
			numberState(objectName("Active context sample count"), "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.relevantSampleCount`,
			numberState(objectName("Relevant baseline sample count"), "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.analysis.relevantSampleScope`, {
			type: "state",
			common: {
				name: objectName("Relevant baseline scope"),
				type: "string",
				role: "info.status",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.evaluationAvailable`, {
			type: "state",
			common: {
				name: objectName("Evaluation available"),
				type: "boolean",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.detected`, {
			type: "state",
			common: {
				name: objectName("Persistent anomaly detected"),
				type: "boolean",
				role: "indicator",
				read: true,
				write: false,
				def: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.status`, {
			type: "state",
			common: { name: objectName("Model status"), type: "string", role: "info.status", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.reason`, {
			type: "state",
			common: { name: objectName("Anomaly reason"), type: "string", role: "text", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.lastAnomaly`, {
			type: "state",
			common: {
				name: objectName("Last high-score anomaly"),
				type: "string",
				role: "date",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.retrain`, {
			type: "state",
			common: {
				name: objectName("Retrain model"),
				type: "boolean",
				role: "button",
				read: false,
				write: true,
				def: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.bootstrapStatus`, {
			type: "state",
			common: {
				name: objectName("Historical bootstrap status"),
				type: "string",
				role: "info.status",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.ensureExplainabilityObjects(base, numberState, unit);
	}

	private async ensureExplainabilityObjects(
		base: string,
		numberState: (
			name: ioBroker.StringOrTranslated,
			role: string,
			extra?: Partial<ioBroker.StateCommon>,
		) => ioBroker.SettableObject,
		unit?: string,
	): Promise<void> {
		await this.setObjectNotExistsAsync(`${base}.anomaly`, {
			type: "channel",
			common: { name: objectName("Current anomaly assessment") },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.evaluation`, {
			type: "channel",
			common: { name: objectName("Evaluation details") },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.detectors`, {
			type: "channel",
			common: { name: objectName("Detector scores") },
			native: {},
		});
		const textState = (name: Parameters<typeof objectName>[0], role = "text"): ioBroker.SettableObject => ({
			type: "state",
			common: { name: objectName(name), type: "string", role, read: true, write: false },
			native: {},
		});
		const booleanState: ioBroker.SettableObject = {
			type: "state",
			common: {
				name: objectName("Anomaly active"),
				type: "boolean",
				role: "indicator",
				read: true,
				write: false,
				def: false,
			},
			native: {},
		};
		await this.setObjectNotExistsAsync(`${base}.anomaly.active`, booleanState);
		await this.setObjectNotExistsAsync(
			`${base}.anomaly.score`,
			numberState(objectName("Overall anomaly score"), "value", { min: 0, max: 100, unit: "%" }),
		);
		await this.setObjectNotExistsAsync(`${base}.anomaly.severity`, textState("Severity", "info.status"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.reasonCode`, textState("Reason code"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.reason`, textState("Human-readable reason"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.since`, textState("Anomaly since", "date"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.lastNormal`, textState("Last normal evaluation", "date"));
		await this.setObjectNotExistsAsync(`${base}.evaluation.status`, textState("Evaluation status", "info.status"));
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.currentValue`,
			numberState(objectName("Current value"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.expectedLow`,
			numberState(objectName("Expected range lower bound"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.expectedHigh`,
			numberState(objectName("Expected range upper bound"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.decisionLow`,
			numberState(objectName("Decision range lower bound"), "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.decisionHigh`,
			numberState(objectName("Decision range upper bound"), "value", unit ? { unit } : {}),
		);
		for (const id of [
			`${base}.evaluation.currentValue`,
			`${base}.evaluation.expectedLow`,
			`${base}.evaluation.expectedHigh`,
			`${base}.evaluation.decisionLow`,
			`${base}.evaluation.decisionHigh`,
		]) {
			await ensureStateUnit(this, id, unit);
		}
		await this.setObjectNotExistsAsync(`${base}.evaluation.baselineType`, textState("Baseline type"));
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.baselineSamples`,
			numberState(objectName("Baseline samples"), "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.evaluation.context`, textState("Used context"));
		await this.setObjectNotExistsAsync(`${base}.evaluation.timeBucket`, textState("Time bucket"));
		await this.setObjectNotExistsAsync(`${base}.evaluation.lastEvaluated`, textState("Last evaluation", "date"));
		await this.setObjectNotExistsAsync(`${base}.detectors.active`, textState("Active detectors"));
		for (const [id, label] of [
			["valueDeviation", "Value deviation score"],
			["rateOfChange", "Rate-of-change score"],
			["stuck", "Stuck-state score"],
			["levelShift", "Level-shift score"],
			["trend", "Trend score"],
		] as const) {
			await this.setObjectNotExistsAsync(
				`${base}.detectors.${id}`,
				numberState(objectName(label), "value", { min: 0, max: 100 }),
			);
		}
	}

	private shouldBootstrap(source: ConfiguredSource, monitor: SourceMonitor): boolean {
		return (
			source.initialTraining === "history" &&
			!!source.historyInstance?.trim() &&
			(!monitor.hasSufficientData || !monitor.bootstrapMatches(this.bootstrapConfigKey(source)))
		);
	}

	private shouldBootstrapPredictive(source: ConfiguredSource, model: PredictiveModel | undefined): boolean {
		return shouldBootstrapPredictiveHistory(
			source.initialTraining === "history",
			!!source.historyInstance?.trim(),
			!!model,
			!!model && (model.needsHistoryBootstrap || model.needsTrainingBasisBootstrap),
		);
	}

	private async bootstrapSource(
		sourceId: string,
		safeId: string,
		source: ConfiguredSource,
		monitor: SourceMonitor,
		needs: { anomaly: boolean; predictive: boolean },
	): Promise<void> {
		if (this.unloading) {
			return;
		}
		const providerName = source.historyInstance!.trim();
		const end = Date.now();
		const anomalyStart = end - Math.max(7, source.trainingDays ?? 30) * 24 * 60 * 60 * 1000;
		const startedState = anomalyBootstrapStateUpdate(needs, "started", monitor.hasSufficientData);
		if (startedState) {
			await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: startedState.status, ack: true });
			await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
				val: startedState.bootstrapStatus,
				ack: true,
			});
		}
		if (this.unloading) {
			return;
		}
		try {
			const historySource = await this.resolveConfiguredHistorySource(sourceId, providerName);
			if (this.unloading) {
				return;
			}
			if (needs.anomaly) {
				await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
					val: `Importing history from ${historySource.sourceId} via ${providerName}`,
					ack: true,
				});
			}
			const provider = new IoBrokerHistoryProvider(this, providerName);
			const predictiveSettings = needs.predictive ? normalizePredictiveSettings(source.predictive) : undefined;
			const predictiveStart = needs.predictive
				? end - predictiveHistorySpanMinutes(predictiveSettings, source.trainingDays ?? 30) * 60_000
				: anomalyStart;
			const start = Math.min(anomalyStart, predictiveStart);
			const historyLimit = PREDICTIVE_HISTORY_RAW_LIMIT;
			const memoryBefore = process.memoryUsage();
			const historyResult = await this.loadSegmentedHistory(
				provider,
				historySource.sourceId,
				start,
				end,
				historyLimit,
				anomalyStart,
				Math.min(10_000, Math.max(30, source.maxHistorySamples ?? 1000)),
				needs.predictive ? (predictiveSettings?.maximumTrainingPoints ?? 2000) : undefined,
			);
			if (this.unloading) {
				return;
			}
			const samples = historyResult.samples;
			const memoryAfter = process.memoryUsage();
			const mb = (value: number): string => (value / 1024 / 1024).toFixed(1);
			// `samples` is already normalized to HistorySample by the segmented
			// loader; do not pass it through sanitizeHistory again (that function
			// expects provider entries with `val`/`ts`).
			const anomalySamples = historyResult.anomalySamples;
			this.log.debug(
				`History load summary: source=${sourceId} mode=${needs.predictive ? "history" : "anomaly-only"} ` +
					`requestedDuration=${Math.round((end - start) / 60_000)}min ` +
					`providerCalls=${historyResult.providerCalls} segmentQueries=${historyResult.segmentQueries} ` +
					`coverageProbes=${historyResult.coverageProbes} segmentSplits=${historyResult.segmentSplits} ` +
					`queryLimitSplits=${historyResult.queryLimitSplits} coverageProbeSplits=${historyResult.coverageProbeSplits} ` +
					`acceptedSegments=${historyResult.acceptedSegments} providerSamplesTotal=${historyResult.providerSamplesTotal} ` +
					`maxProviderResponse=${historyResult.maxProviderResponse} finalRawSamples=${historyResult.finalRawSamples} ` +
					`adaptiveSegments=${historyResult.adaptiveSegments} densityEstimates=${historyResult.densityEstimates} ` +
					`adaptiveTargetSamples=${historyResult.adaptiveTargetSamples} ` +
					`minAdaptiveSegmentDuration=${historyResult.minAdaptiveSegmentDuration ?? "none"} ` +
					`maxAdaptiveSegmentDuration=${historyResult.maxAdaptiveSegmentDuration ?? "none"} ` +
					`fallbackSplits=${historyResult.fallbackSplits} ` +
					`densityRecalculations=${historyResult.densityRecalculations} ` +
					`adaptiveDownscales=${historyResult.adaptiveDownscales} ` +
					`initialAdaptiveSegmentDuration=${historyResult.initialAdaptiveSegmentDuration ?? "none"} ` +
					`finalAdaptiveSegmentDuration=${historyResult.finalAdaptiveSegmentDuration ?? "none"} ` +
					`adaptiveLimitHits=${historyResult.adaptiveLimitHits} ` +
					`deduplicatedSamples=${historyResult.deduplicatedSamples} ` +
					`duplicateSamplesRemoved=${historyResult.duplicateSamplesRemoved} ` +
					`rssBeforeMB=${mb(memoryBefore.rss)} rssAfterMB=${mb(memoryAfter.rss)} ` +
					`rssDeltaMB=${mb(memoryAfter.rss - memoryBefore.rss)} ` +
					`heapBeforeMB=${mb(memoryBefore.heapUsed)} heapAfterMB=${mb(memoryAfter.heapUsed)} ` +
					`heapDeltaMB=${mb(memoryAfter.heapUsed - memoryBefore.heapUsed)}`,
			);
			this.log.debug(
				`Predictive history loaded for ${sourceId}: raw=${historyResult.finalRawSamples}, ` +
					`unique=${historyResult.deduplicatedSamples}, retained=${samples.length}, ` +
					`oldest=${samples[0]?.timestamp ?? "none"}, newest=${samples.at(-1)?.timestamp ?? "none"}, ` +
					`source=${needs.predictive ? "history" : "anomaly-only"} ` +
					`requestedStart=${start} requestedEnd=${end} requestedDuration=${Math.round((end - start) / 60_000)}min ` +
					`segments=${historyResult.acceptedSegments} limitedSegments=${historyResult.queryLimitSplits}`,
			);
			if (samples.length === 0) {
				throw new Error("History provider returned no valid samples");
			}
			const imported = needs.anomaly
				? monitor.replaceFromHistory(
						anomalySamples,
						providerName,
						historySource.sourceId,
						start,
						end,
						this.bootstrapConfigKey(source),
					)
				: anomalySamples.length;
			if (needs.anomaly && imported === 0) {
				this.log.debug(
					`Historical outlier filtering for ${sourceId}: input=${anomalySamples.length} retained=0`,
				);
				throw new Error("No usable samples remained after historical outlier filtering");
			}
			if (needs.anomaly) {
				this.log.debug(
					`Historical outlier filtering for ${sourceId}: input=${anomalySamples.length} retained=${imported}`,
				);
			}
			const predictive = this.predictiveModels.get(safeId);
			if (predictive && needs.predictive) {
				for (const sample of samples) {
					predictive.add(sample.value, sample.timestamp, "history");
				}
				await this.predictiveTrainingQueue.enqueue(async () => {
					try {
						const predictiveResult = predictive.train(Date.now(), "history");
						this.log.debug(
							`Predictive bootstrap completed for ${sourceId}: ` +
								`raw=${samples.length}, modelInterval=${predictiveResult.diagnostics?.model.intervalMinutes ?? "unknown"} min, ` +
								`resampled=${predictiveResult.trainingSampleCount}, source=history, status=${predictiveResult.status}`,
						);
						this.predictiveResults.set(safeId, predictiveResult);
						await this.setStateAsync(`sources.${safeId}.predictive.status`, {
							val: predictiveResult.status,
							ack: true,
						});
						await this.setStateAsync(`sources.${safeId}.predictive.result`, {
							val: JSON.stringify(predictiveResult),
							ack: true,
						});
					} catch (error) {
						this.log.warn(`Predictive bootstrap failed for ${safeId}: ${(error as Error).message}`);
					}
				});
			}
			if (needs.anomaly) {
				await this.persistModels();
			}
			if (needs.predictive) {
				await this.persistPredictiveModels();
			}
			if (needs.anomaly) {
				await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, {
					val: monitor.sampleCount,
					ack: true,
				});
			}
			const completedState = anomalyBootstrapStateUpdate(
				needs,
				"completed",
				monitor.hasSufficientData,
				source.autoStartMonitoringAfterImport ?? true,
				imported,
			);
			if (completedState) {
				await this.setStateAsync(`sources.${safeId}.analysis.status`, {
					val: completedState.status,
					ack: true,
				});
				await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
					val: completedState.bootstrapStatus,
					ack: true,
				});
			}
		} catch (error) {
			if (this.unloading) {
				return;
			}
			this.log.warn(`Historical bootstrap failed for ${sourceId}: ${(error as Error).message}`);
			await this.persistModels();
			const failedState = anomalyBootstrapStateUpdate(needs, "failed", monitor.hasSufficientData);
			if (failedState) {
				await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: failedState.status, ack: true });
				await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
					val: failedState.bootstrapStatus,
					ack: true,
				});
			}
		}
	}

	private async loadSegmentedHistory(
		provider: HistoryProvider,
		sourceId: string,
		start: number,
		end: number,
		limit: number,
		anomalyStart: number,
		maximumAnomalySamples: number,
		maximumPredictiveSamples?: number,
	): Promise<SegmentedHistoryResult> {
		const predictiveSampler = maximumPredictiveSamples
			? new HistorySampleSampler(start, end, maximumPredictiveSamples)
			: undefined;
		const anomalySampler = new HistorySampleSampler(anomalyStart, end, maximumAnomalySamples);
		const budget = new HistoryLoadBudget();
		let segmentQueries = 0;
		let coverageProbes = 0;
		let segmentSplits = 0;
		let queryLimitSplits = 0;
		let coverageProbeSplits = 0;
		let acceptedSegments = 0;
		let providerSamplesTotal = 0;
		let maxProviderResponse = 0;
		let adaptiveSegments = 0;
		let densityEstimates = 0;
		let adaptiveTargetSamples = 0;
		let minAdaptiveSegmentDuration: number | undefined;
		let maxAdaptiveSegmentDuration: number | undefined;
		let fallbackSplits = 0;
		let densityRecalculations = 0;
		let adaptiveDownscales = 0;
		let initialAdaptiveSegmentDuration: number | undefined;
		let adaptiveDurationHint: number | undefined;
		let finalAdaptiveSegmentDuration: number | undefined;
		let adaptiveLimitHits = 0;
		let finalRawSamples = 0;
		let deduplicatedSamples = 0;
		let duplicateSamplesRemoved = 0;
		const load = async (segmentStart: number, segmentEnd: number, depth: number): Promise<void> => {
			if (this.unloading) {
				return;
			}
			budget.consumeCall();
			segmentQueries++;
			const raw = await this.withHistoryTimeout(provider.getHistory(sourceId, segmentStart, segmentEnd, limit));
			const entries = Array.isArray(raw)
				? raw.length
				: raw && typeof raw === "object" && Array.isArray((raw as { result?: unknown }).result)
					? (raw as { result: unknown[] }).result.length
					: 0;
			providerSamplesTotal += entries;
			maxProviderResponse = Math.max(maxProviderResponse, entries);
			const normalized = sanitizeHistoryWithDiagnostics(raw, limit, [], {
				start: segmentStart,
				end: segmentEnd,
			});
			const samples = normalized.samples;
			const oldest = samples[0]?.timestamp;
			const newest = samples.at(-1)?.timestamp;
			let splitReason: string | undefined;
			if (entries >= limit) {
				splitReason = "query-limit";
				adaptiveLimitHits++;
				if (samples.length >= 2) {
					const observedSpan = samples.at(-1)!.timestamp - samples[0].timestamp;
					if (observedSpan > 0) {
						const density = (samples.length - 1) / observedSpan;
						const targetSamples = Math.max(100, Math.floor(limit * 0.8));
						const estimatedDuration = Math.max(60_001, Math.floor(targetSamples / density));
						densityRecalculations++;
						densityEstimates++;
						adaptiveTargetSamples = targetSamples;
						if (adaptiveDurationHint === undefined) {
							adaptiveDurationHint = estimatedDuration;
							initialAdaptiveSegmentDuration = estimatedDuration;
						} else if (estimatedDuration < adaptiveDurationHint) {
							this.log.debug(
								`Adaptive history density adjusted: source=${sourceId} oldDuration=${adaptiveDurationHint} ` +
									`newDuration=${estimatedDuration} responseSamples=${entries} reason=query-limit`,
							);
							adaptiveDurationHint = estimatedDuration;
							adaptiveDownscales++;
						}
						finalAdaptiveSegmentDuration = adaptiveDurationHint;
						minAdaptiveSegmentDuration = Math.min(
							minAdaptiveSegmentDuration ?? estimatedDuration,
							estimatedDuration,
						);
						maxAdaptiveSegmentDuration = Math.max(
							maxAdaptiveSegmentDuration ?? estimatedDuration,
							estimatedDuration,
						);
					}
				}
			} else if (oldest !== undefined && newest !== undefined && newest < segmentEnd - 60 * 60_000) {
				const probeStart = Math.floor((segmentStart + segmentEnd) / 2);
				budget.consumeCall();
				coverageProbes++;
				const probeRaw = await this.withHistoryTimeout(
					provider.getHistory(sourceId, probeStart, segmentEnd, limit),
				);
				const probeEntries = Array.isArray(probeRaw)
					? probeRaw.length
					: probeRaw &&
						  typeof probeRaw === "object" &&
						  Array.isArray((probeRaw as { result?: unknown }).result)
						? (probeRaw as { result: unknown[] }).result.length
						: 0;
				providerSamplesTotal += probeEntries;
				maxProviderResponse = Math.max(maxProviderResponse, probeEntries);
				const probeSamples = sanitizeHistory(probeRaw, 1);
				if (probeSamples.length > 0) {
					splitReason = "coverage-probe";
				}
			}
			if (splitReason && segmentEnd - segmentStart > 60_000 && depth < 16) {
				segmentSplits++;
				if (splitReason === "query-limit") {
					queryLimitSplits++;
				}
				if (splitReason === "coverage-probe") {
					coverageProbeSplits++;
				}
				this.log.debug(
					`Predictive history segment split: source=${sourceId} reason=${splitReason} ` +
						`start=${segmentStart} end=${segmentEnd}`,
				);
				const totalDuration = segmentEnd - segmentStart;
				const halfDuration = Math.floor(totalDuration / 2);
				let childStart = segmentStart;
				let usedFallback = false;
				while (childStart <= segmentEnd) {
					const childDuration =
						splitReason === "query-limit" && adaptiveDurationHint !== undefined
							? Math.min(halfDuration, adaptiveDurationHint)
							: halfDuration;
					const childEnd = Math.min(segmentEnd, childStart + childDuration);
					if (childDuration === halfDuration) {
						usedFallback = true;
					} else {
						adaptiveSegments++;
					}
					await load(childStart, childEnd, depth + 1);
					childStart = childEnd + 1;
				}
				if (usedFallback) {
					fallbackSplits++;
				}
				return;
			}
			acceptedSegments++;
			finalRawSamples += normalized.validSamples;
			deduplicatedSamples += normalized.validSamples - normalized.duplicateSamplesRemoved;
			duplicateSamplesRemoved += normalized.duplicateSamplesRemoved;
			predictiveSampler?.add(samples);
			anomalySampler.add(samples.filter(sample => sample.timestamp >= anomalyStart));
		};
		await load(start, end, 0);
		const samples = predictiveSampler?.getSamples() ?? anomalySampler.getSamples();
		const anomalySamples = anomalySampler.getSamples();
		return {
			samples,
			anomalySamples,
			providerCalls: budget.providerCalls,
			segmentQueries,
			coverageProbes,
			segmentSplits,
			queryLimitSplits,
			coverageProbeSplits,
			acceptedSegments,
			providerSamplesTotal,
			maxProviderResponse,
			adaptiveSegments,
			densityEstimates,
			adaptiveTargetSamples,
			minAdaptiveSegmentDuration,
			maxAdaptiveSegmentDuration,
			fallbackSplits,
			densityRecalculations,
			adaptiveDownscales,
			initialAdaptiveSegmentDuration,
			finalAdaptiveSegmentDuration,
			adaptiveLimitHits,
			finalRawSamples,
			deduplicatedSamples,
			duplicateSamplesRemoved,
		};
	}

	private async resolveConfiguredHistorySource(sourceId: string, instanceId: string): Promise<HistorySource> {
		try {
			return selectHistorySource(sourceId, instanceId, await this.historySourceResolver.resolve(sourceId));
		} catch (error) {
			this.warnInvalidHistoryConfiguration((error as Error).message);
			throw error;
		}
	}

	private warnInvalidHistoryConfiguration(message: string): void {
		if (!this.invalidHistoryConfigurationWarnings.has(message)) {
			this.invalidHistoryConfigurationWarnings.add(message);
			this.log.warn(message);
		}
	}

	private async retrainSource(
		sourceId: string,
		safeId: string,
		source: ConfiguredSource,
		monitor: SourceMonitor,
	): Promise<void> {
		if (this.unloading) {
			return;
		}
		const release = acquireExclusiveWork(this.bootstrappingSources, sourceId);
		if (!release) {
			this.log.debug(`Ignoring retrain request while source is already training: ${sourceId}`);
			return;
		}
		try {
			if (source.initialTraining === "history" && source.historyInstance?.trim()) {
				const predictiveModel = this.predictiveModels.get(safeId);
				await this.bootstrapSource(sourceId, safeId, source, monitor, {
					...manualRetrainBootstrapNeeds(
						source.initialTraining === "history",
						!!source.historyInstance?.trim(),
						!!predictiveModel,
						!!predictiveModel &&
							(predictiveModel.needsHistoryBootstrap || predictiveModel.needsTrainingBasisBootstrap),
					),
				});
			} else {
				monitor.reset();
				await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, { val: 0, ack: true });
				await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "learning", ack: true });
				await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
					val: "Model reset; learning live values",
					ack: true,
				});
				await this.persistModels();
			}
			await this.refreshEvaluationAfterRetrain(sourceId, safeId, monitor);
		} finally {
			release();
			if (!this.unloading) {
				await this.setStateChangedAsync(`sources.${safeId}.retrain`, { val: false, ack: true });
			}
		}
	}

	private async refreshEvaluationAfterRetrain(
		sourceId: string,
		safeId: string,
		monitor: SourceMonitor,
	): Promise<void> {
		if (this.unloading) {
			return;
		}
		const state = await this.getForeignStateAsync(sourceId);
		if (this.unloading) {
			return;
		}
		const acknowledgedState = state?.ack === true ? state : undefined;
		const sourceTimestamp =
			typeof acknowledgedState?.ts === "number" && Number.isFinite(acknowledgedState.ts)
				? acknowledgedState.ts
				: undefined;
		const evaluation = evaluateCurrentSourceValue(
			monitor,
			acknowledgedState?.val,
			sourceTimestamp,
			this.contextKey(sourceId),
			this.sources.get(safeId)?.minimumSamples ?? 30,
			Date.now(),
		);
		this.evaluations.set(sourceId, evaluation);
		await enqueueSerializedWork(this.resultWriteQueues, safeId, () => this.writeResult(safeId, evaluation));
		await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, { val: monitor.sampleCount, ack: true });
	}

	private async runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
		const queue = [...tasks];
		await Promise.all(
			Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
				while (queue.length) {
					await queue.shift()!();
				}
			}),
		);
	}

	private async withHistoryTimeout<T>(operation: Promise<T>): Promise<T> {
		return withAbortableTimeout(
			operation,
			this.historyAbortController.signal,
			HISTORY_TIMEOUT_MS,
			this.setTimeout.bind(this),
			this.clearTimeout.bind(this),
		);
	}

	private bootstrapConfigKey(source: ConfiguredSource): string {
		return JSON.stringify({
			provider: source.historyInstance?.trim(),
			days: source.trainingDays ?? 30,
			limit: source.maxHistorySamples ?? 1000,
		});
	}

	private async writeResult(safeId: string, result: ObservationResult): Promise<void> {
		const base = `sources.${safeId}.analysis`;
		const values: Record<string, ioBroker.StateValue> = {
			actual: result.actual ?? null,
			score: result.score,
			detected: result.detected,
			status: result.status,
			reason: result.reason,
			sampleCount: result.sampleCount,
			baselineScope: result.baselineScope,
			activeContext: result.activeContext,
			baselineSampleCount: result.baselineSampleCount,
			contextSampleCount: result.contextSampleCount,
			relevantSampleCount: result.relevantSampleCount,
			relevantSampleScope: result.relevantSampleScope,
			evaluationAvailable: result.evaluationAvailable,
		};
		values.expected = result.expected ?? null;
		values.deviation = result.deviation ?? null;
		if (result.lastAnomaly !== undefined) {
			values.lastAnomaly = new Date(result.lastAnomaly).toISOString();
		}
		const explainability: Record<string, ioBroker.StateValue> = {
			"anomaly.active": result.statusCode === "anomaly",
			"anomaly.score": result.score,
			"anomaly.severity": result.severity,
			"anomaly.reasonCode": result.reasonCode,
			"anomaly.reason": result.reason,
			"anomaly.since": result.anomalySince ? new Date(result.anomalySince).toISOString() : null,
			"anomaly.lastNormal": result.lastNormal ? new Date(result.lastNormal).toISOString() : null,
			"evaluation.status": result.statusCode,
			"evaluation.currentValue": result.actual ?? null,
			"evaluation.expectedLow": result.expectedLow ?? null,
			"evaluation.expectedHigh": result.expectedHigh ?? null,
			"evaluation.decisionLow": result.decisionLow ?? null,
			"evaluation.decisionHigh": result.decisionHigh ?? null,
			"evaluation.baselineType": result.baselineScope,
			"evaluation.baselineSamples": result.baselineSampleCount,
			"evaluation.context": result.activeContext || null,
			"evaluation.timeBucket": result.timeBucket ?? null,
			"evaluation.lastEvaluated": new Date(result.lastEvaluated).toISOString(),
			"detectors.active": result.detectors.map(detector => detector.name).join(", ") || null,
			"detectors.valueDeviation": null,
			"detectors.rateOfChange": null,
			"detectors.stuck": null,
			"detectors.levelShift": null,
			"detectors.trend": null,
		};
		const detectorIds: Record<string, string> = {
			value: "valueDeviation",
			context: "valueDeviation",
			rate: "rateOfChange",
			stuck: "stuck",
			changePoint: "levelShift",
			trend: "trend",
		};
		for (const detector of result.detectors) {
			explainability[`detectors.${detectorIds[detector.name]}`] = detector.score;
		}
		const stateValues: Array<readonly [string, ioBroker.StateValue]> = [
			...Object.entries(values),
			...Object.entries(explainability),
		].map(([key, value]) => [`${key.includes(".") ? `sources.${safeId}` : base}.${key}`, value]);
		const alwaysWrite = new Set([
			`${base}.actual`,
			`sources.${safeId}.evaluation.currentValue`,
			`sources.${safeId}.evaluation.lastEvaluated`,
		]);
		await writeStateValues(
			stateValues,
			alwaysWrite,
			(id, value) => this.setStateAsync(id, { val: value, ack: true }),
			(id, value) => this.setStateChangedAsync(id, { val: value, ack: true }),
		);
	}

	private schedulePersistence(): void {
		if (this.unloading || this.persistTimer) {
			return;
		}
		this.persistTimer = this.setTimeout(() => {
			this.persistTimer = undefined;
			this.trackAdapterWork(this.persistModelSnapshots(), "Periodic model persistence");
		}, PERSIST_DELAY_MS);
	}

	private async persistModelSnapshots(): Promise<void> {
		await Promise.all([this.persistModels(), this.persistPredictiveModels()]);
	}

	private async persistModels(): Promise<void> {
		if (!this.startupModelsLoaded) {
			return;
		}
		await enqueueSerializedWork(this.persistenceQueues, MODEL_STATE_ID, async () => {
			try {
				const current = Object.fromEntries(
					[...this.monitors].map(([sourceId, monitor]) => [
						this.sourceIds.get(sourceId)!,
						{ ...monitor.toJSON(), configuredSourceId: sourceId },
					]),
				);
				const models = mergeStartupModels<SourceModelData>(this.restoredModels, current, this.startupComplete);
				await this.setStateAsync(MODEL_STATE_ID, { val: JSON.stringify(models), ack: true });
			} catch (error) {
				this.log.error(`Could not persist anomaly models: ${(error as Error).message}`);
			}
		});
	}

	private async persistPredictiveModels(): Promise<void> {
		if (!this.startupModelsLoaded) {
			return;
		}
		await enqueueSerializedWork(this.persistenceQueues, PREDICTIVE_MODEL_STATE_ID, async () => {
			try {
				const current = Object.fromEntries(
					[...this.predictiveModels].flatMap(([safeId, model]) => {
						const data = model.toPersistenceJSON();
						return data ? [[safeId, data]] : [];
					}),
				);
				const models = mergeStartupModels(this.restoredPredictiveModels, current, this.startupComplete);
				await this.setStateAsync(PREDICTIVE_MODEL_STATE_ID, { val: JSON.stringify(models), ack: true });
			} catch (error) {
				this.log.warn(`Could not persist predictive models: ${(error as Error).message}`);
			}
		});
	}

	private createSourceId(sourceId: string): string {
		const normalized =
			sourceId
				.replace(/[^A-Za-z0-9_-]+/g, "_")
				.replace(/^_+|_+$/g, "")
				.slice(0, 48) || "source";
		const hash = [...sourceId]
			.reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
			.toString(36);
		return `${normalized}_${hash}`;
	}

	private onUnload(callback: () => void): void {
		this.unloading = true;
		this.historyAbortController.abort();
		if (this.persistTimer) {
			this.clearTimeout(this.persistTimer);
			this.persistTimer = undefined;
		}
		void this.persistOnUnload().finally(callback);
	}

	private async persistOnUnload(): Promise<void> {
		// Finish state/retrain callbacks first: they can enqueue predictive work
		// only after their state writes or history reads have completed.
		await drainPendingWork(this.pendingAdapterWork);
		// Both persistence methods handle their own errors so shutdown still
		// reaches the ioBroker callback when a state write fails.
		await this.predictiveTrainingQueue.drain();
		await this.persistModelSnapshots();
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AnomalyDetection(options);
} else {
	(() => new AnomalyDetection())();
}
