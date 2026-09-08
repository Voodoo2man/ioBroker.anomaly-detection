/* Created with @iobroker/create-adapter v3.1.5 */
import * as utils from "@iobroker/adapter-core";
import { sanitizeHistory, type HistoryProvider } from "./lib/history-provider";
import { HistorySourceResolver, selectHistorySource, type HistorySource } from "./lib/history-source-resolver";
import { cleanupStaleSources } from "./lib/source-cleanup";
import { SourceMonitor, parseStoredModel, type ObservationResult, type SourceSettings } from "./lib/source-monitor";
import { createContextPart } from "./lib/context-value";

const MODEL_STATE_ID = "models";
const PERSIST_DELAY_MS = 30_000;
const HISTORY_TIMEOUT_MS = 30_000;
const HISTORY_CONCURRENCY = 2;
interface ConfiguredSource extends SourceSettings {
	name: string;
}

class IoBrokerHistoryProvider implements HistoryProvider {
	public constructor(
		private readonly adapter: ioBroker.Adapter,
		private readonly instance: string,
	) {}

	public async getHistory(sourceId: string, start: number, end: number, limit: number): Promise<unknown> {
		const response = await this.adapter.sendToAsync(this.instance, "getHistory", {
			id: sourceId,
			options: { start, end, aggregate: "none", count: limit, returnNewestEntries: false },
		});
		return response;
	}
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
	private persistTimer: ioBroker.Timeout | undefined;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: "anomaly-detection" });
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		await this.ensureModelState();
		const persistedValue = (await this.getStateAsync(MODEL_STATE_ID))?.val;
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
		const configuredIds = new Set<string>();
		const bootstrapTasks: Array<() => Promise<void>> = [];
		for (const source of this.config.sources ?? []) {
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
			if (!object) {
				this.log.warn(`Configured source state does not exist yet: ${id}`);
			} else if (object.type !== "state" || object.common.type !== "number") {
				this.log.warn(`Configured source is not a numerical state: ${id}`);
				continue;
			}
			const safeId = this.createSourceId(id);
			this.sourceIds.set(id, safeId);
			const monitor = new SourceMonitor(source, stored[safeId]);
			this.monitors.set(id, monitor);
			this.sources.set(safeId, source);
			if (object?.common.unit) {
				this.sourceUnits.set(id, object.common.unit);
			}
			for (const context of source.contextStates ?? []) {
				const contextId = context && typeof context.id === "string" ? context.id.trim() : "";
				if (!contextId) {
					continue;
				}
				const contextObject = await this.getForeignObjectAsync(contextId);
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
			await this.ensureSourceObjects(safeId, source, object?.common.unit);
			this.subscribeForeignStates(id);
			if (this.shouldBootstrap(source, monitor)) {
				bootstrapTasks.push(() => this.bootstrapSource(id, safeId, source, monitor));
			}
		}
		this.subscribeStates("sources.*.retrain");
		await this.runWithConcurrency(bootstrapTasks, HISTORY_CONCURRENCY);
		this.log.info(`Monitoring ${this.monitors.size} numerical state${this.monitors.size === 1 ? "" : "s"}`);
	}

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (!state) {
			return;
		}
		for (const sourceId of this.contextSources.get(id) ?? []) {
			this.contextValues.get(sourceId)?.set(id, state.val);
		}
		const retrainMatch = id.match(/sources\.([^.]+)\.retrain$/);
		if (retrainMatch && state.ack === false && state.val === true) {
			const safeId = retrainMatch[1];
			const sourceId = [...this.sourceIds].find(([, value]) => value === safeId)?.[0];
			const source = this.sources.get(safeId);
			const monitor = sourceId ? this.monitors.get(sourceId) : undefined;
			if (sourceId && source && monitor) {
				void this.retrainSource(sourceId, safeId, source, monitor);
			}
			return;
		}
		const monitor = this.monitors.get(id);
		const safeId = this.sourceIds.get(id);
		if (monitor && safeId) {
			void this.processState(id, safeId, monitor, state);
		}
	}

	private onMessage(message: ioBroker.Message): void {
		if (!message.callback) {
			return;
		}
		if (message.command === "getHistoryProviders") {
			void this.replyWithHistoryProviders(message);
		} else if (message.command === "tab") {
			void this.replyWithAnomalyTab(message);
		} else if (message.command === "chartData") {
			void this.replyWithChartData(message);
		}
	}

	private async replyWithChartData(message: ioBroker.Message): Promise<void> {
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
			const historySource = await this.resolveConfiguredHistorySource(sourceId, source.historyInstance.trim());
			const provider = new IoBrokerHistoryProvider(this, source.historyInstance.trim());
			const raw = await provider.getHistory(historySource.sourceId, start, end, limit);
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
							limit,
							diagnostics.map(diagnostic => diagnostic.timestamp),
						),
						diagnostics,
						available: true,
					},
				},
				message.callback,
			);
		} catch {
			this.sendTo(
				message.from,
				message.command,
				{ data: { samples: [], diagnostics: [], available: false } },
				message.callback,
			);
		}
	}

	private replyWithAnomalyTab(message: ioBroker.Message): void {
		const sources = [...this.sourceIds.entries()].map(([sourceId, safeId]) => ({
			id: sourceId,
			safeId,
			name: this.sources.get(safeId)?.name || sourceId,
			unit: this.sourceUnits.get(sourceId),
			contextLabels: Object.fromEntries(
				(this.sources.get(safeId)?.contextStates ?? [])
					.filter(context => context && typeof context.id === "string" && context.id.trim())
					.map(context => {
						const contextId = context.id.trim();
						return [contextId, this.contextNames.get(contextId) || contextId];
					}),
			),
			evaluation: this.evaluations.get(sourceId) ?? {
				statusCode: this.monitors.get(sourceId)?.hasSufficientData ? "normal" : "learning",
				severity: "normal",
				sampleCount: this.monitors.get(sourceId)?.sampleCount ?? 0,
				requiredSamples: this.sources.get(safeId)?.minimumSamples ?? 30,
			},
		}));
		this.sendTo(message.from, message.command, { data: { sources } }, message.callback);
	}

	private async replyWithHistoryProviders(message: ioBroker.Message): Promise<void> {
		const sourceId = typeof message.message?.sourceId === "string" ? message.message.sourceId.trim() : "";
		const sources = await this.historySourcesForAdmin(sourceId);
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
		try {
			const result = monitor.observe(
				state.val,
				typeof state.ts === "number" ? state.ts : Date.now(),
				this.contextKey(id),
			);
			if (!result) {
				if (!this.invalidValueWarnings.has(id)) {
					this.invalidValueWarnings.add(id);
					this.log.warn(`Ignoring invalid non-numerical value from ${id}`);
				}
				return;
			}
			this.invalidValueWarnings.delete(id);
			this.evaluations.set(id, result);
			await this.writeResult(safeId, result);
			this.schedulePersistence();
		} catch (error) {
			this.log.error(`Could not process source state ${id}: ${(error as Error).message}`);
		}
	}

	private async registerContexts(sourceId: string, source: ConfiguredSource): Promise<void> {
		if (!source.enableContext) {
			return;
		}
		if ((source.contextStates?.length ?? 0) > 3) {
			this.warnContext(`Only the first 3 context states are used for ${sourceId}`);
		}
		for (const context of (source.contextStates ?? [])
			.filter(item => item && typeof item.id === "string" && item.id.trim())
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
			.filter(item => item && typeof item.id === "string" && item.id.trim())
			.slice(0, 3)
			.map(context => {
				const value = values?.get(context.id.trim());
				if (typeof value === "string" && value.trim() && value.length <= 96) {
					const categoryKey = `${sourceId}\u0000${context.id}`;
					let categories = this.contextCategories.get(categoryKey);
					if (!categories) {
						categories = new Set();
						this.contextCategories.set(categoryKey, categories);
					}
					if (!categories.has(value) && categories.size >= 16) {
						this.warnContext(`Ignoring additional categorical values for ${context.id}; limit is 16`);
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
			common: { name: "Persisted models", type: "string", role: "json", read: true, write: false, def: "" },
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
		const base = `sources.${safeId}`;
		await this.setObjectNotExistsAsync(base, {
			type: "device",
			common: { name: source.name || source.id },
			native: { sourceId: source.id },
		});
		await this.setObjectNotExistsAsync(`${base}.analysis`, {
			type: "channel",
			common: { name: "Anomaly analysis" },
			native: {},
		});
		const numberState = (
			name: string,
			role: string,
			extra: Partial<ioBroker.StateCommon> = {},
		): ioBroker.SettableObject => ({
			type: "state",
			common: { name, type: "number", role, read: true, write: false, ...extra },
			native: {},
		});
		await this.setObjectNotExistsAsync(
			`${base}.analysis.actual`,
			numberState("Actual value", "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.expected`,
			numberState("Expected value", "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.deviation`,
			numberState("Deviation", "value", unit ? { unit } : {}),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.score`,
			numberState("Anomaly score", "value", { min: 0, max: 100, unit: "%" }),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.sampleCount`,
			numberState("Learned sample count", "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.analysis.baselineScope`, {
			type: "state",
			common: { name: "Active baseline scope", type: "string", role: "info.status", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.activeContext`, {
			type: "state",
			common: { name: "Active context", type: "string", role: "text", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(
			`${base}.analysis.baselineSampleCount`,
			numberState("Active baseline sample count", "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.analysis.contextSampleCount`,
			numberState("Active context sample count", "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.analysis.detected`, {
			type: "state",
			common: {
				name: "Persistent anomaly detected",
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
			common: { name: "Model status", type: "string", role: "info.status", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.reason`, {
			type: "state",
			common: { name: "Anomaly reason", type: "string", role: "text", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.lastAnomaly`, {
			type: "state",
			common: { name: "Last high-score anomaly", type: "string", role: "date", read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.retrain`, {
			type: "state",
			common: { name: "Retrain model", type: "boolean", role: "button", read: false, write: true, def: false },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.analysis.bootstrapStatus`, {
			type: "state",
			common: {
				name: "Historical bootstrap status",
				type: "string",
				role: "info.status",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.ensureExplainabilityObjects(base, numberState);
	}

	private async ensureExplainabilityObjects(
		base: string,
		numberState: (name: string, role: string, extra?: Partial<ioBroker.StateCommon>) => ioBroker.SettableObject,
	): Promise<void> {
		await this.setObjectNotExistsAsync(`${base}.anomaly`, {
			type: "channel",
			common: { name: "Current anomaly assessment" },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.evaluation`, {
			type: "channel",
			common: { name: "Evaluation details" },
			native: {},
		});
		await this.setObjectNotExistsAsync(`${base}.detectors`, {
			type: "channel",
			common: { name: "Detector scores" },
			native: {},
		});
		const textState = (name: string, role = "text"): ioBroker.SettableObject => ({
			type: "state",
			common: { name, type: "string", role, read: true, write: false },
			native: {},
		});
		const booleanState: ioBroker.SettableObject = {
			type: "state",
			common: {
				name: "Anomaly active",
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
			numberState("Overall anomaly score", "value", { min: 0, max: 100, unit: "%" }),
		);
		await this.setObjectNotExistsAsync(`${base}.anomaly.severity`, textState("Severity", "info.status"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.reasonCode`, textState("Reason code"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.reason`, textState("Human-readable reason"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.since`, textState("Anomaly since", "date"));
		await this.setObjectNotExistsAsync(`${base}.anomaly.lastNormal`, textState("Last normal evaluation", "date"));
		await this.setObjectNotExistsAsync(`${base}.evaluation.status`, textState("Evaluation status", "info.status"));
		await this.setObjectNotExistsAsync(`${base}.evaluation.currentValue`, numberState("Current value", "value"));
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.expectedLow`,
			numberState("Expected range lower bound", "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.expectedHigh`,
			numberState("Expected range upper bound", "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.decisionLow`,
			numberState("Decision range lower bound", "value"),
		);
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.decisionHigh`,
			numberState("Decision range upper bound", "value"),
		);
		await this.setObjectNotExistsAsync(`${base}.evaluation.baselineType`, textState("Baseline type"));
		await this.setObjectNotExistsAsync(
			`${base}.evaluation.baselineSamples`,
			numberState("Baseline samples", "value"),
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
				numberState(label, "value", { min: 0, max: 100 }),
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

	private async bootstrapSource(
		sourceId: string,
		safeId: string,
		source: ConfiguredSource,
		monitor: SourceMonitor,
	): Promise<void> {
		const providerName = source.historyInstance!.trim();
		const end = Date.now();
		const start = end - Math.max(7, source.trainingDays ?? 30) * 24 * 60 * 60 * 1000;
		await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "importingHistory", ack: true });
		await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
			val: "Importing historical data",
			ack: true,
		});
		try {
			const historySource = await this.resolveConfiguredHistorySource(sourceId, providerName);
			await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
				val: `Importing history from ${historySource.sourceId} via ${providerName}`,
				ack: true,
			});
			const provider = new IoBrokerHistoryProvider(this, providerName);
			const raw = await this.withHistoryTimeout(
				provider.getHistory(historySource.sourceId, start, end, source.maxHistorySamples ?? 1000),
			);
			const samples = sanitizeHistory(raw, source.maxHistorySamples ?? 1000);
			if (samples.length === 0) {
				throw new Error("History provider returned no valid samples");
			}
			monitor.reset();
			const imported = monitor.bootstrapFromHistory(
				samples,
				providerName,
				historySource.sourceId,
				start,
				end,
				this.bootstrapConfigKey(source),
			);
			if (imported === 0) {
				throw new Error("No usable samples remained after historical outlier filtering");
			}
			await this.persistModels();
			await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, { val: monitor.sampleCount, ack: true });
			const status =
				monitor.hasSufficientData && (source.autoStartMonitoringAfterImport ?? true)
					? "monitoring"
					: "learning";
			await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: status, ack: true });
			await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
				val: `Historical training completed (${imported} samples)`,
				ack: true,
			});
		} catch (error) {
			this.log.warn(`Historical bootstrap failed for ${sourceId}: ${(error as Error).message}`);
			await this.persistModels();
			await this.setStateAsync(`sources.${safeId}.analysis.status`, {
				val: monitor.hasSufficientData ? "monitoring" : "learning",
				ack: true,
			});
			await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
				val: "Insufficient historical data, continuing live learning",
				ack: true,
			});
		}
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
		try {
			monitor.reset();
			if (source.initialTraining === "history" && source.historyInstance?.trim()) {
				await this.bootstrapSource(sourceId, safeId, source, monitor);
			} else {
				await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "learning", ack: true });
				await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
					val: "Model reset; learning live values",
					ack: true,
				});
				await this.persistModels();
			}
		} finally {
			await this.setStateAsync(`sources.${safeId}.retrain`, { val: false, ack: true });
		}
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
		return new Promise<T>((resolve, reject) => {
			const timer = this.setTimeout(() => reject(new Error("History request timed out")), HISTORY_TIMEOUT_MS);
			operation.then(
				value => {
					this.clearTimeout(timer);
					resolve(value);
				},
				error => {
					this.clearTimeout(timer);
					reject(error instanceof Error ? error : new Error(String(error)));
				},
			);
		});
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
			actual: result.actual,
			score: result.score,
			detected: result.detected,
			status: result.status,
			reason: result.reason,
			sampleCount: result.sampleCount,
			baselineScope: result.baselineScope,
			activeContext: result.activeContext,
			baselineSampleCount: result.baselineSampleCount,
			contextSampleCount: result.contextSampleCount,
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
			"evaluation.currentValue": result.actual,
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
		await Promise.all(
			[...Object.entries(values), ...Object.entries(explainability)].map(([key, value]) =>
				this.setStateAsync(`${key.includes(".") ? `sources.${safeId}` : base}.${key}`, {
					val: value,
					ack: true,
				}),
			),
		);
	}

	private schedulePersistence(): void {
		if (this.persistTimer) {
			return;
		}
		this.persistTimer = this.setTimeout(() => {
			this.persistTimer = undefined;
			void this.persistModels();
		}, PERSIST_DELAY_MS);
	}

	private async persistModels(): Promise<void> {
		try {
			const models = Object.fromEntries(
				[...this.monitors].map(([sourceId, monitor]) => [
					this.sourceIds.get(sourceId)!,
					{ ...monitor.toJSON(), configuredSourceId: sourceId },
				]),
			);
			await this.setStateAsync(MODEL_STATE_ID, { val: JSON.stringify(models), ack: true });
		} catch (error) {
			this.log.error(`Could not persist anomaly models: ${(error as Error).message}`);
		}
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
		if (this.persistTimer) {
			this.clearTimeout(this.persistTimer);
		}
		void this.persistModels().finally(callback);
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AnomalyDetection(options);
} else {
	(() => new AnomalyDetection())();
}
