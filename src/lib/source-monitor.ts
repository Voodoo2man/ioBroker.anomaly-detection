import { AdvancedDetectors, type ChangePointData, type TrendData } from "./advanced-detectors";
import { detectMadDeviation, detectRateDeviation, detectStuck, type DetectorResult } from "./detectors";
import type { HistorySample } from "./history-provider";
import { ContextualModel, type ContextualModelData } from "./model/contextual-model";
import { median, MODEL_SCHEMA_VERSION } from "./model/statistics";
import { TemporalModel, type TemporalModelData } from "./model/temporal-model";
import type { PredictiveSettings } from "./predictive";
import { scoreDetectors, type DetectorDiagnostic } from "./scoring";

export const DEFAULTS = {
	minimumSamples: 30,
	bucketMinutes: 60,
	sensitivity: 3.5,
	anomalyThreshold: 70,
	minimumAnomalyDurationMinutes: 5,
	hysteresis: 10,
	stuckDurationMinutes: 120,
	maxHistoryGapMinutes: 360,
	maxContextModels: 32,
} as const;
/**
 *
 */
export interface ContextStateSettings {
	/**
	 *
	 */
	id: string;
	/**
	 *
	 */
	bucketWidth?: number;
}

/**
 *
 */
export interface SourceSettings {
	/**
	 *
	 */
	predictive?: PredictiveSettings;
	/**
	 *
	 */
	predictiveEnabled?: boolean;
	/**
	 *
	 */
	predictiveHorizonMinutes?: number;
	/**
	 *
	 */
	predictiveUpdateIntervalMinutes?: number;
	/**
	 *
	 */
	predictiveMinimumTrainingSamples?: number;
	/**
	 *
	 */
	predictiveMaximumTrainingPoints?: number;
	/**
	 *
	 */
	predictiveSeasonalPeriodMinutes?: number;
	/**
	 *
	 */
	predictiveSeasonalityMode?: "off" | "auto" | "manual";
	/**
	 *
	 */
	enabled: boolean;
	/**
	 *
	 */
	id: string;
	/**
	 *
	 */
	name?: string;
	/**
	 *
	 */
	minimumSamples?: number;
	/**
	 *
	 */
	bucketMinutes?: number;
	/**
	 *
	 */
	sensitivity?: number;
	/**
	 *
	 */
	anomalyThreshold?: number;
	/**
	 *
	 */
	minimumAnomalyDurationMinutes?: number;
	/**
	 *
	 */
	enableMad?: boolean;
	/**
	 *
	 */
	enableRate?: boolean;
	/**
	 *
	 */
	enableStuck?: boolean;
	/**
	 *
	 */
	stuckDurationMinutes?: number;
	/**
	 *
	 */
	timeContext?: boolean;
	/**
	 *
	 */
	weekdayContext?: boolean;
	/**
	 *
	 */
	initialTraining?: "live" | "history";
	/**
	 *
	 */
	historyInstance?: string;
	/**
	 *
	 */
	trainingDays?: number;
	/**
	 *
	 */
	maxHistorySamples?: number;
	/**
	 *
	 */
	autoStartMonitoringAfterImport?: boolean;
	/**
	 *
	 */
	enableContext?: boolean;
	/**
	 *
	 */
	contextStates?: ContextStateSettings[];
	/**
	 *
	 */
	enableChangePoint?: boolean;
	/**
	 *
	 */
	enableTrend?: boolean;
}

/**
 *
 */
export interface BootstrapMetadata {
	/**
	 *
	 */
	completed: boolean;
	/**
	 *
	 */
	provider?: string;
	/**
	 *
	 */
	historySourceId?: string;
	/**
	 *
	 */
	configKey?: string;
	/**
	 *
	 */
	start?: number;
	/**
	 *
	 */
	end?: number;
	/**
	 *
	 */
	importedSamples: number;
}

/**
 *
 */
export interface SourceModelData {
	/**
	 *
	 */
	schemaVersion: number;
	/**
	 *
	 */
	configuredSourceId?: string;
	/**
	 *
	 */
	value: TemporalModelData;
	/**
	 *
	 */
	rate: TemporalModelData;
	/**
	 *
	 */
	lastValue?: number;
	/**
	 *
	 */
	lastTimestamp?: number;
	/**
	 *
	 */
	lastContextKey?: string;
	/**
	 *
	 */
	repeatedSince?: number;
	/**
	 *
	 */
	anomalySince?: number;
	/**
	 *
	 */
	lastNormal?: number;
	/**
	 *
	 */
	detected?: boolean;
	/**
	 *
	 */
	bootstrap?: BootstrapMetadata;
	/**
	 *
	 */
	context?: ContextualModelData;
	/** Context-specific rates. Older persisted models may not have this field. */
	contextualRate?: ContextualModelData;
	/** Bounded detector/latch state for active and recently used scopes. */
	scopedStates?: Record<string, PersistedScopedDetectorState>;
	/** Scope whose state was active when the model was saved. */
	activeStateScope?: string;
	/**
	 *
	 */
	changePoint?: ChangePointData;
	/**
	 *
	 */
	trend?: TrendData;
	/**
	 *
	 */
	diagnostics?: DiagnosticSnapshot[];
}

interface ScopedDetectorState {
	advanced: AdvancedDetectors;
	lastUsed: number;
	anomalySince?: number;
	detected: boolean;
}

interface PersistedScopedDetectorState {
	advanced: { changePoint: ChangePointData; trend: TrendData };
	lastUsed: number;
	anomalySince?: number;
	detected: boolean;
}

/**
 *
 */
export interface DiagnosticSnapshot {
	/**
	 *
	 */
	timestamp: number;
	/**
	 *
	 */
	actual: number;
	/**
	 *
	 */
	expected?: number;
	/**
	 *
	 */
	decisionLow?: number;
	/**
	 *
	 */
	decisionHigh?: number;
	/**
	 *
	 */
	score: number;
	/**
	 *
	 */
	detected: boolean;
	/** Current evaluation classification; older persisted snapshots may omit this. */
	statusCode?: ExplainabilityStatus;
	/**
	 *
	 */
	reasonCode: string;
	/**
	 *
	 */
	baselineScope: BaselineScope;
	/**
	 *
	 */
	baselineSampleCount: number;
	/**
	 *
	 */
	activeContext: string;
}

export type BaselineScope = "context" | "time" | "global" | "insufficient";

export type ExplainabilityStatus =
	"learning" | "normal" | "deviating" | "anomaly" | "insufficient_data" | "unavailable";
export type Severity = "normal" | "noticeable" | "high";

/**
 *
 */
export interface ObservationResult {
	/**
	 *
	 */
	actual?: number;
	/**
	 *
	 */
	expected?: number;
	/**
	 *
	 */
	deviation?: number;
	/**
	 *
	 */
	score: number;
	/**
	 *
	 */
	detected: boolean;
	/**
	 *
	 */
	status: "learning" | "monitoring" | "insufficientData";
	/**
	 *
	 */
	reason: string;
	/**
	 *
	 */
	sampleCount: number;
	/**
	 *
	 */
	lastAnomaly?: number;
	/**
	 *
	 */
	baselineScope: BaselineScope;
	/**
	 *
	 */
	activeContext: string;
	/**
	 *
	 */
	baselineSampleCount: number;
	/**
	 *
	 */
	contextSampleCount: number;
	/** Number of samples in the baseline that is relevant for this evaluation. */
	relevantSampleCount: number;
	/** Scope of the baseline whose sample count is relevant for this evaluation. */
	relevantSampleScope: BaselineScope;
	/** Whether the relevant baseline is mature enough for a rating. */
	evaluationAvailable: boolean;
	/**
	 *
	 */
	requiredSamples: number;
	/**
	 *
	 */
	statusCode: ExplainabilityStatus;
	/**
	 *
	 */
	severity: Severity;
	/**
	 *
	 */
	reasonCode: string;
	/**
	 *
	 */
	detectors: DetectorDiagnostic[];
	/**
	 *
	 */
	lastEvaluated: number;
	/**
	 *
	 */
	anomalySince?: number;
	/**
	 *
	 */
	lastNormal?: number;
	/**
	 *
	 */
	expectedLow?: number;
	/**
	 *
	 */
	expectedHigh?: number;
	/**
	 *
	 */
	decisionLow?: number;
	/**
	 *
	 */
	decisionHigh?: number;
	/**
	 *
	 */
	timeBucket?: string;
}

/**
 * Creates a non-detected result without inventing a current sensor value.
 *
 * @param sampleCount Number of samples currently retained by the monitor.
 * @param requiredSamples Minimum samples required for evaluation.
 * @param timestamp Time the unavailable evaluation was created.
 */
export function unavailableObservation(
	sampleCount: number,
	requiredSamples: number,
	timestamp: number,
): ObservationResult {
	return {
		score: 0,
		detected: false,
		status: "learning",
		reason: "Current source value unavailable after model reset",
		sampleCount,
		baselineScope: "insufficient",
		activeContext: "",
		baselineSampleCount: 0,
		contextSampleCount: 0,
		relevantSampleCount: 0,
		relevantSampleScope: "insufficient",
		evaluationAvailable: false,
		requiredSamples,
		statusCode: "unavailable",
		severity: "normal",
		reasonCode: "source_value_unavailable",
		detectors: [],
		lastEvaluated: timestamp,
	};
}

/**
 * Evaluates a retrain-time source state or returns unavailable without learning it.
 *
 * @param monitor Monitor to evaluate against.
 * @param value Current source value, when available.
 * @param timestamp Source state's timestamp, when available.
 * @param contextKey Context used to select an appropriate baseline.
 * @param requiredSamples Minimum samples required for evaluation.
 * @param evaluatedAt Timestamp to assign to an unavailable result.
 */
export function evaluateCurrentSourceValue(
	monitor: SourceMonitor,
	value: unknown,
	timestamp: number | undefined,
	contextKey: string | undefined,
	requiredSamples: number,
	evaluatedAt: number,
): ObservationResult {
	if (
		timestamp !== undefined &&
		Number.isFinite(timestamp) &&
		!monitor.isStaleTimestamp(timestamp) &&
		typeof value === "number" &&
		Number.isFinite(value)
	) {
		const result = monitor.evaluateCurrent(value, timestamp, contextKey);
		if (result) {
			return result;
		}
	}
	return unavailableObservation(monitor.sampleCount, requiredSamples, evaluatedAt);
}

/** Framework-independent lifecycle and learning policy for one source state. */
export class SourceMonitor {
	private valueModel: TemporalModel;
	private rateModel: TemporalModel;
	private contextualRateModel: ContextualModel;
	private contextualModel: ContextualModel;
	private readonly scopedStates = new Map<string, ScopedDetectorState>();
	private activeStateScope = "global";
	private lastValue: number | undefined;
	private lastTimestamp: number | undefined;
	private lastContextKey: string | undefined;
	private repeatedSince: number | undefined;
	private lastNormal: number | undefined;
	private bootstrap?: BootstrapMetadata;
	private diagnostics: DiagnosticSnapshot[];

	/**
	 *
	 * @param settings
	 * @param data
	 */
	public constructor(
		private readonly settings: SourceSettings,
		data?: SourceModelData,
	) {
		const bucketMinutes = settings.bucketMinutes ?? DEFAULTS.bucketMinutes;
		this.valueModel = new TemporalModel(bucketMinutes, undefined, data?.value);
		this.rateModel = new TemporalModel(bucketMinutes, undefined, data?.rate);
		this.contextualRateModel = new ContextualModel(
			bucketMinutes,
			DEFAULTS.maxContextModels,
			undefined,
			data?.contextualRate,
		);
		this.contextualModel = new ContextualModel(bucketMinutes, DEFAULTS.maxContextModels, undefined, data?.context);
		for (const [scope, saved] of Object.entries(data?.scopedStates ?? {})) {
			if (scope === "global") {
				continue;
			}
			this.scopedStates.set(scope, {
				advanced: new AdvancedDetectors(saved.advanced.changePoint, saved.advanced.trend),
				lastUsed: saved.lastUsed,
				anomalySince: saved.anomalySince,
				detected: saved.detected,
			});
		}
		const savedGlobal = data?.scopedStates?.global;
		this.scopedStates.set("global", {
			advanced: new AdvancedDetectors(
				savedGlobal?.advanced.changePoint ?? data?.changePoint,
				savedGlobal?.advanced.trend ?? data?.trend,
			),
			lastUsed: savedGlobal?.lastUsed ?? 0,
			anomalySince: savedGlobal?.anomalySince ?? data?.anomalySince,
			detected: savedGlobal?.detected ?? data?.detected ?? false,
		});
		this.activeStateScope =
			data?.activeStateScope && this.scopedStates.has(data.activeStateScope) ? data.activeStateScope : "global";
		this.lastValue = data?.lastValue;
		this.lastTimestamp = data?.lastTimestamp;
		this.lastContextKey = data?.lastContextKey;
		this.repeatedSince = data?.repeatedSince;
		this.lastNormal = data?.lastNormal;
		this.bootstrap = data?.bootstrap;
		this.diagnostics = (data?.diagnostics ?? []).slice(-500);
	}

	/**
	 *
	 * @param value
	 * @param timestamp
	 * @param contextKey
	 * @param learn Whether the observation updates training and timestamp state.
	 */
	public observe(
		value: unknown,
		timestamp: number,
		contextKey?: string,
		learn = true,
	): ObservationResult | undefined {
		if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
			return undefined;
		}
		const isNewSample = learn && this.isNewTimestamp(timestamp);
		const minSamples = this.settings.minimumSamples ?? DEFAULTS.minimumSamples;
		const sensitivity = this.settings.sensitivity ?? DEFAULTS.sensitivity;
		const threshold = this.settings.anomalyThreshold ?? DEFAULTS.anomalyThreshold;
		const timeContext = this.settings.timeContext ?? true;
		const weekdayContext = this.settings.weekdayContext ?? false;
		const hasActiveContext = this.settings.enableContext === true && contextKey !== undefined;
		const contextSampleCountBefore = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
		const contextIsLearning = hasActiveContext && contextSampleCountBefore < minSamples;
		const standardBaseline = this.valueModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
		const contextBaseline = contextIsLearning
			? undefined
			: this.settings.enableContext
				? this.contextualModel.baseline(contextKey, timestamp, minSamples, timeContext, weekdayContext)
				: undefined;
		const baseline = contextBaseline ?? standardBaseline;
		const stateScope =
			contextBaseline && contextKey
				? contextKey
				: this.settings.enableContext
					? `fallback:${baseline.scope}`
					: "global";
		const state = isNewSample
			? this.getScopedState(stateScope, timestamp)
			: (this.scopedStates.get(stateScope) ?? {
					advanced: new AdvancedDetectors(),
					lastUsed: timestamp,
					detected: false,
				});
		if (isNewSample && stateScope !== this.activeStateScope) {
			state.anomalySince = undefined;
			state.detected = false;
			this.activeStateScope = stateScope;
		}
		const baselineScope: BaselineScope = contextBaseline
			? "context"
			: contextIsLearning
				? "insufficient"
				: baseline.scope === "global"
					? "global"
					: "time";
		const baselineSampleCount = contextIsLearning ? 0 : baseline.series.count;
		const expected = contextIsLearning ? undefined : baseline.series.median();
		const expectedRange =
			expected === undefined ? undefined : expectedRangeFor(expected, baseline.series.mad(), sensitivity);
		const decisionRange =
			expected === undefined
				? undefined
				: decisionRangeFor(expected, baseline.series.mad(), sensitivity, threshold);
		const contextChanged = this.settings.enableContext === true && contextKey !== this.lastContextKey;
		const rate = contextChanged ? undefined : this.calculateRate(value, timestamp);
		const results: DetectorResult[] = [];
		if ((this.settings.enableMad ?? true) && !contextIsLearning) {
			const result = detectMadDeviation(value, baseline.series, minSamples, sensitivity);
			if (result) {
				results.push(
					contextBaseline
						? {
								...result,
								name: "context",
								reason: "Value is significantly outside the normal range for the current context",
								reasonCode: "context_deviation",
							}
						: { ...result, reason: valueDeviationReason(baselineScope) },
				);
			}
		}
		// A context must be mature before its separately learned rate baseline is used.
		if ((this.settings.enableRate ?? true) && !contextIsLearning) {
			const rateBaseline = hasActiveContext
				? this.contextualRateModel.baseline(contextKey, timestamp, minSamples, timeContext, weekdayContext)
				: this.rateModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
			const result = rateBaseline
				? detectRateDeviation(rate, rateBaseline.series, minSamples, sensitivity)
				: undefined;
			if (result) {
				results.push(result);
			}
		}
		if (isNewSample) {
			this.updateRepeated(value, timestamp);
		}
		if (this.settings.enableStuck ?? false) {
			const result = detectStuck(
				this.repeatedSince,
				timestamp,
				this.settings.stuckDurationMinutes ?? DEFAULTS.stuckDurationMinutes,
			);
			if (result) {
				results.push(result);
			}
		}
		const advanced = isNewSample
			? state.advanced.observe(
					expected === undefined ? undefined : value - expected,
					timestamp,
					0,
					baseline.series.mad(),
					this.settings.enableChangePoint === true,
					this.settings.enableTrend === true,
					sensitivity,
				)
			: undefined;
		if (advanced?.changePoint) {
			results.push(advanced.changePoint);
		}
		if (advanced?.trend) {
			results.push(advanced.trend);
		}
		const scoring = scoreDetectors(results);
		if (isNewSample) {
			this.updatePersistentDetection(state, scoring.score, timestamp, threshold);
		}
		const isStrongAnomaly = scoring.score >= threshold;
		const learningNewContext = contextIsLearning;
		if (isNewSample && (!isStrongAnomaly || advanced?.adapt || learningNewContext)) {
			this.valueModel.add(value, timestamp, timeContext, weekdayContext);
			if (this.settings.enableContext) {
				this.contextualModel.add(contextKey, value, timestamp, timeContext, weekdayContext);
			}
			if (rate !== undefined) {
				if (hasActiveContext) {
					this.contextualRateModel.add(contextKey, rate, timestamp, timeContext, weekdayContext);
				} else {
					this.rateModel.add(rate, timestamp, timeContext, weekdayContext);
				}
			}
		}
		if (isNewSample) {
			this.lastValue = value;
			this.lastTimestamp = timestamp;
			if (!isStrongAnomaly) {
				this.lastNormal = timestamp;
			}
			this.lastContextKey = this.settings.enableContext === true ? contextKey : undefined;
		}
		const sufficient = this.valueModel.sampleCount >= minSamples;
		const contextSampleCount = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
		const relevantSampleScope: BaselineScope = hasActiveContext ? "context" : baselineScope;
		const relevantSampleCount = hasActiveContext ? contextSampleCount : baseline.series.count;
		const statusCode: ExplainabilityStatus = contextIsLearning
			? "learning"
			: !sufficient
				? "insufficient_data"
				: isStrongAnomaly
					? state.detected
						? "anomaly"
						: "deviating"
					: "normal";
		const observation: ObservationResult = {
			actual: value,
			expected,
			deviation: expected === undefined ? undefined : finiteOrUndefined(value - expected),
			score: scoring.score,
			detected: state.detected,
			status: contextIsLearning
				? "learning"
				: sufficient
					? "monitoring"
					: this.valueModel.sampleCount === 0
						? "insufficientData"
						: "learning",
			reason:
				contextIsLearning && results.length === 0
					? "Insufficient data for the current context"
					: scoring.reason,
			sampleCount: this.valueModel.sampleCount,
			lastAnomaly: isStrongAnomaly ? timestamp : undefined,
			baselineScope,
			activeContext: formatContextKey(contextKey),
			baselineSampleCount,
			contextSampleCount,
			relevantSampleCount,
			relevantSampleScope,
			evaluationAvailable: !contextIsLearning && sufficient,
			requiredSamples: minSamples,
			statusCode,
			severity: statusCode === "anomaly" ? (scoring.score >= 85 ? "high" : "noticeable") : "normal",
			reasonCode: contextIsLearning ? "insufficient_training_data" : scoring.reasonCode,
			detectors: scoring.detectors,
			lastEvaluated: timestamp,
			anomalySince: this.scopedStates.get(this.activeStateScope)?.anomalySince,
			lastNormal: this.lastNormal,
			expectedLow: expectedRange?.low,
			expectedHigh: expectedRange?.high,
			decisionLow: decisionRange?.low,
			decisionHigh: decisionRange?.high,
			timeBucket:
				baseline.scope === "global"
					? undefined
					: String(
							Math.floor(
								(new Date(timestamp).getHours() * 60 + new Date(timestamp).getMinutes()) /
									(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes),
							),
						),
		};
		if (isNewSample) {
			this.diagnostics.push({
				timestamp,
				actual: observation.actual!,
				expected: observation.expected,
				decisionLow: observation.decisionLow,
				decisionHigh: observation.decisionHigh,
				score: observation.score,
				detected: observation.detected,
				statusCode: observation.statusCode,
				reasonCode: observation.reasonCode,
				baselineScope: observation.baselineScope,
				baselineSampleCount: observation.baselineSampleCount,
				activeContext: observation.activeContext,
			});
			if (this.diagnostics.length > 500) {
				this.diagnostics.splice(0, this.diagnostics.length - 500);
			}
		}
		return observation;
	}

	/**
	 *
	 */
	public toJSON(): SourceModelData {
		return {
			schemaVersion: MODEL_SCHEMA_VERSION,
			value: this.valueModel.toJSON(),
			rate: this.rateModel.toJSON(),
			lastValue: this.lastValue,
			lastTimestamp: this.lastTimestamp,
			lastContextKey: this.lastContextKey,
			repeatedSince: this.repeatedSince,
			// Preserve legacy global fields while also persisting the bounded scoped state.
			anomalySince: this.scopedStates.get("global")?.anomalySince,
			lastNormal: this.lastNormal,
			detected: this.scopedStates.get("global")?.detected ?? false,
			bootstrap: this.bootstrap,
			context: this.contextualModel.toJSON(),
			contextualRate: this.contextualRateModel.toJSON(),
			scopedStates: Object.fromEntries(
				[...this.scopedStates].map(([scope, state]) => [
					scope,
					{
						advanced: state.advanced.toJSON(),
						lastUsed: state.lastUsed,
						anomalySince: state.anomalySince,
						detected: state.detected,
					},
				]),
			),
			activeStateScope: this.activeStateScope,
			...(this.scopedStates.get("global")?.advanced.toJSON() ?? {
				changePoint: { recent: [], candidateCount: 0 },
				trend: { recent: [] },
			}),
			diagnostics: [...this.diagnostics],
		};
	}

	/**
	 *
	 */
	public get hasSufficientData(): boolean {
		return this.valueModel.sampleCount >= (this.settings.minimumSamples ?? DEFAULTS.minimumSamples);
	}

	/** Whether a timestamp is newer than the last learned sample. */
	public isNewTimestamp(timestamp: number): boolean {
		return Number.isFinite(timestamp) && (this.lastTimestamp === undefined || timestamp > this.lastTimestamp);
	}

	/** Whether a timestamp predates the last learned sample. */
	public isStaleTimestamp(timestamp: number): boolean {
		return Number.isFinite(timestamp) && this.lastTimestamp !== undefined && timestamp < this.lastTimestamp;
	}

	/** Number of retained global value-model samples, capped at the model capacity. */
	public get sampleCount(): number {
		return this.valueModel.sampleCount;
	}

	/**
	 * Evaluates a current value against the model without treating it as a new training event.
	 *
	 * @param value Current value to evaluate.
	 * @param timestamp Timestamp associated with the current value.
	 * @param contextKey Optional context used to select the baseline.
	 */
	public evaluateCurrent(value: unknown, timestamp: number, contextKey?: string): ObservationResult | undefined {
		return this.observe(value, timestamp, contextKey, false);
	}

	/**
	 *
	 */
	public get diagnosticSnapshots(): readonly DiagnosticSnapshot[] {
		return this.diagnostics;
	}

	/**
	 * Imports sanitized historical observations into the same temporal and rate models used by live updates.
	 *
	 * @param samples Ordered, sanitized historical samples.
	 * @param provider Configured history adapter instance.
	 * @param historySourceId Effective source queried from the history provider.
	 * @param start Start timestamp of the requested range.
	 * @param end End timestamp of the requested range.
	 * @param configKey Import-relevant source configuration.
	 */
	public bootstrapFromHistory(
		samples: readonly HistorySample[],
		provider: string,
		historySourceId: string,
		start: number,
		end: number,
		configKey: string,
	): number {
		const retained = this.rejectExtremeOutliers(samples);
		const timeContext = this.settings.timeContext ?? true;
		const weekdayContext = this.settings.weekdayContext ?? false;
		let previous: HistorySample | undefined;
		for (const sample of retained) {
			this.valueModel.add(sample.value, sample.timestamp, timeContext, weekdayContext);
			if (previous && sample.timestamp > previous.timestamp) {
				const gap = sample.timestamp - previous.timestamp;
				if (gap <= DEFAULTS.maxHistoryGapMinutes * 60_000) {
					this.rateModel.add(
						(sample.value - previous.value) / (gap / 1000),
						sample.timestamp,
						timeContext,
						weekdayContext,
					);
				}
			}
			previous = sample;
		}
		if (previous) {
			this.lastValue = previous.value;
			this.lastTimestamp = previous.timestamp;
			// Historical gaps do not prove that the source was stuck. Start this detector with live updates only.
			this.repeatedSince = undefined;
		}
		this.bootstrap = {
			completed: true,
			provider,
			historySourceId,
			configKey,
			start,
			end,
			importedSamples: retained.length,
		};
		return retained.length;
	}

	/**
	 * Replaces this model only when the history contains enough usable samples.
	 *
	 * @param samples Sanitized historical observations.
	 * @param provider Configured history adapter instance.
	 * @param historySourceId Effective state ID queried from history.
	 * @param start Requested history start timestamp.
	 * @param end Requested history end timestamp.
	 * @param configKey Import-relevant source configuration.
	 */
	public replaceFromHistory(
		samples: readonly HistorySample[],
		provider: string,
		historySourceId: string,
		start: number,
		end: number,
		configKey: string,
	): number {
		const replacement = new SourceMonitor(this.settings);
		const imported = replacement.bootstrapFromHistory(samples, provider, historySourceId, start, end, configKey);
		if (imported === 0) {
			return 0;
		}
		if (this.hasSufficientData && !replacement.hasSufficientData) {
			return 0;
		}
		this.valueModel = replacement.valueModel;
		this.rateModel = replacement.rateModel;
		// Generic history cannot reconstruct arbitrary live context values.
		this.scopedStates.clear();
		for (const [key, state] of replacement.scopedStates) {
			this.scopedStates.set(key, state);
		}
		this.activeStateScope = replacement.activeStateScope;
		this.lastValue = replacement.lastValue;
		this.lastTimestamp = replacement.lastTimestamp;
		this.lastContextKey = replacement.lastContextKey;
		this.repeatedSince = replacement.repeatedSince;
		this.lastNormal = replacement.lastNormal;
		this.bootstrap = replacement.bootstrap;
		this.diagnostics = replacement.diagnostics;
		return imported;
	}

	/**
	 *
	 */
	public reset(): void {
		this.valueModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
		this.rateModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
		this.contextualRateModel = new ContextualModel(
			this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes,
			DEFAULTS.maxContextModels,
		);
		this.contextualModel = new ContextualModel(
			this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes,
			DEFAULTS.maxContextModels,
		);
		this.scopedStates.clear();
		this.scopedStates.set("global", { advanced: new AdvancedDetectors(), lastUsed: 0, detected: false });
		this.activeStateScope = "global";
		this.lastValue = undefined;
		this.lastTimestamp = undefined;
		this.lastContextKey = undefined;
		this.repeatedSince = undefined;
		this.lastNormal = undefined;
		this.bootstrap = undefined;
		this.diagnostics = [];
	}

	/** @param configKey Import-relevant source configuration. */
	public bootstrapMatches(configKey: string): boolean {
		return this.bootstrap?.completed === true && this.bootstrap.configKey === configKey;
	}

	private rejectExtremeOutliers(samples: readonly HistorySample[]): HistorySample[] {
		if (samples.length < 5) {
			return [...samples];
		}
		const values = samples.map(sample => sample.value);
		const center = median(values);
		if (center === undefined) {
			return [];
		}
		const mad = median(values.map(value => Math.abs(value - center))) ?? 0;
		if (mad === 0) {
			return samples.filter(sample => sample.value === center);
		}
		return samples.filter(sample => (0.6745 * Math.abs(sample.value - center)) / mad <= 7);
	}

	private calculateRate(value: number, timestamp: number): number | undefined {
		if (this.lastValue === undefined || this.lastTimestamp === undefined || timestamp <= this.lastTimestamp) {
			return undefined;
		}
		return (value - this.lastValue) / ((timestamp - this.lastTimestamp) / 1000);
	}

	private updateRepeated(value: number, timestamp: number): void {
		if (this.lastValue === undefined || this.lastValue !== value) {
			this.repeatedSince = timestamp;
		}
	}

	private updatePersistentDetection(
		state: ScopedDetectorState,
		score: number,
		timestamp: number,
		threshold: number,
	): void {
		if (state.detected) {
			if (score < Math.max(0, threshold - DEFAULTS.hysteresis)) {
				state.detected = false;
				state.anomalySince = undefined;
			}
			return;
		}
		if (score < threshold) {
			state.anomalySince = undefined;
			return;
		}
		state.anomalySince ??= timestamp;
		const requiredDuration =
			(this.settings.minimumAnomalyDurationMinutes ?? DEFAULTS.minimumAnomalyDurationMinutes) * 60_000;
		if (state.anomalySince !== undefined && timestamp - state.anomalySince >= requiredDuration) {
			state.detected = true;
		}
	}

	private getScopedState(scope: string, timestamp: number): ScopedDetectorState {
		let state = this.scopedStates.get(scope);
		if (!state) {
			if (this.scopedStates.size >= DEFAULTS.maxContextModels + 1) {
				const removable = [...this.scopedStates.entries()]
					.filter(([key]) => key !== "global" && key !== this.activeStateScope)
					.sort(([, left], [, right]) => left.lastUsed - right.lastUsed)[0];
				if (removable) {
					this.scopedStates.delete(removable[0]);
				}
			}
			state = { advanced: new AdvancedDetectors(), lastUsed: timestamp, detected: false };
			this.scopedStates.set(scope, state);
		}
		state.lastUsed = timestamp;
		return state;
	}
}

/**
 * Builds the value-deviation reason for the selected non-context baseline.
 *
 * @param scope Actual baseline scope.
 */
function valueDeviationReason(scope: BaselineScope): string {
	if (scope === "global") {
		return "Value is significantly outside the learned global normal range";
	}
	return "Value is significantly outside the normal range for this time period";
}

/**
 * Converts the internal normalized context key to a stable readable diagnostic value.
 *
 * @param key Internal normalized context key.
 */
function formatContextKey(key: string | undefined): string {
	if (!key) {
		return "";
	}
	return key
		.replace(/=boolean:/g, "=")
		.replace(/=string:/g, "=")
		.replace(/=number:([^:|]+):([^|]+)/g, "=$1–$2");
}

function expectedRangeFor(
	medianValue: number,
	mad: number | undefined,
	sensitivity: number,
): { low: number; high: number } | undefined {
	if (!Number.isFinite(medianValue) || !Number.isFinite(mad) || mad === undefined || mad < 0) {
		return undefined;
	}
	const halfWidth = (sensitivity * mad) / 0.6745;
	const low = medianValue - halfWidth;
	const high = medianValue + halfWidth;
	return Number.isFinite(low) && Number.isFinite(high) ? { low, high } : undefined;
}

/**
 * Inverse of detectMadDeviation at the configured anomaly threshold.
 *
 * @param medianValue
 * @param mad
 * @param sensitivity
 * @param threshold
 */
export function decisionRangeFor(
	medianValue: number,
	mad: number | undefined,
	sensitivity: number,
	threshold: number,
): { low: number; high: number } | undefined {
	if (!Number.isFinite(medianValue) || !Number.isFinite(mad) || mad === undefined || mad < 0 || sensitivity <= 0) {
		return undefined;
	}
	const halfWidth = (sensitivity * (threshold / 100) * mad) / 0.6745;
	const low = medianValue - halfWidth;
	const high = medianValue + halfWidth;
	return Number.isFinite(low) && Number.isFinite(high) ? { low, high } : undefined;
}

function finiteOrUndefined(value: number): number | undefined {
	return Number.isFinite(value) ? value : undefined;
}

/**
 *
 * @param value
 */
export function parseStoredModel(value: unknown): Record<string, SourceModelData> {
	if (typeof value !== "string") {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== "object") {
			return {};
		}
		return Object.fromEntries(
			Object.entries(parsed as Record<string, unknown>).filter(([, model]) => isSourceModelData(model)),
		) as Record<string, SourceModelData>;
	} catch {
		return {};
	}
}

function isSourceModelData(value: unknown): value is SourceModelData {
	if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== MODEL_SCHEMA_VERSION)) {
		return false;
	}
	if (!isTemporalModelData(value.value) || !isTemporalModelData(value.rate)) {
		return false;
	}
	if (
		!isOptional(value, "context", isContextualModelData) ||
		!isOptional(value, "contextualRate", isContextualModelData) ||
		!isOptional(value, "changePoint", isChangePointData) ||
		!isOptional(value, "trend", isTrendData) ||
		!isOptional(value, "activeStateScope", isString)
	) {
		return false;
	}
	if (!isOptional(value, "scopedStates", isScopedStateRecord)) {
		return false;
	}
	if (
		isString(value.activeStateScope) &&
		isRecord(value.scopedStates) &&
		!Object.hasOwn(value.scopedStates, value.activeStateScope)
	) {
		return false;
	}
	if (
		!isOptional(value, "lastValue", isFiniteNumber) ||
		!isOptional(value, "lastTimestamp", isFiniteNumber) ||
		!isOptional(value, "repeatedSince", isFiniteNumber) ||
		!isOptional(value, "anomalySince", isFiniteNumber) ||
		!isOptional(value, "lastNormal", isFiniteNumber) ||
		!isOptional(value, "detected", isBoolean) ||
		!isOptional(value, "lastContextKey", isString) ||
		!isOptional(value, "configuredSourceId", isString) ||
		!isOptional(value, "bootstrap", isBootstrapMetadata)
	) {
		return false;
	}
	return isOptional(value, "diagnostics", isDiagnosticSnapshotArray);
}

function isScopedStateRecord(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	const scopes = Object.entries(value);
	return (
		Object.hasOwn(value, "global") &&
		scopes.length <= DEFAULTS.maxContextModels + 1 &&
		scopes.every(([, state]) => isPersistedScopedState(state))
	);
}

function isContextualModelData(value: unknown): value is ContextualModelData {
	if (!isRecord(value) || !isRecord(value.contexts)) {
		return false;
	}
	const entries = Object.values(value.contexts);
	if (entries.length > DEFAULTS.maxContextModels) {
		return false;
	}
	for (const entry of entries) {
		if (!isRecord(entry) || !isFiniteNumber(entry.lastUsed) || !isTemporalModelData(entry.model)) {
			return false;
		}
	}
	return true;
}

function isTemporalModelData(value: unknown): value is TemporalModelData {
	if (!isRecord(value) || !isSampleSeriesData(value.global)) {
		return false;
	}
	if (!isOptional(value, "timeBuckets", isSampleSeriesRecord)) {
		return false;
	}
	return isOptional(value, "contextBuckets", isSampleSeriesRecord);
}

function isSampleSeriesRecord(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return Object.values(value).every(series => isSampleSeriesData(series));
}

function isSampleSeriesData(value: unknown): boolean {
	return isRecord(value) && Array.isArray(value.values) && value.values.every(isFiniteNumber);
}

function isChangePointData(value: unknown): value is ChangePointData {
	if (!isRecord(value) || !Array.isArray(value.recent) || !value.recent.every(isTimedResidual)) {
		return false;
	}
	if (
		value.candidateDirection !== undefined &&
		value.candidateDirection !== "upward" &&
		value.candidateDirection !== "downward"
	) {
		return false;
	}
	return isFiniteNumber(value.candidateCount) && Number.isInteger(value.candidateCount) && value.candidateCount >= 0;
}

function isTrendData(value: unknown): value is TrendData {
	if (!isRecord(value) || !Array.isArray(value.recent)) {
		return false;
	}
	return value.recent.every(isTimedResidual);
}

function isTimedResidual(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return isFiniteNumber(value.value) && isFiniteNumber(value.timestamp);
}

function isPersistedScopedState(value: unknown): value is PersistedScopedDetectorState {
	if (!isRecord(value) || !isRecord(value.advanced)) {
		return false;
	}
	if (!isChangePointData(value.advanced.changePoint) || !isTrendData(value.advanced.trend)) {
		return false;
	}
	return (
		isFiniteNumber(value.lastUsed) && isBoolean(value.detected) && isOptional(value, "anomalySince", isFiniteNumber)
	);
}

function isBootstrapMetadata(value: unknown): value is BootstrapMetadata {
	if (!isRecord(value) || !isBoolean(value.completed) || !isFiniteNumber(value.importedSamples)) {
		return false;
	}
	if (!isOptional(value, "provider", isString) || !isOptional(value, "historySourceId", isString)) {
		return false;
	}
	if (!isOptional(value, "configKey", isString) || !isOptional(value, "start", isFiniteNumber)) {
		return false;
	}
	return isOptional(value, "end", isFiniteNumber);
}

function isDiagnosticSnapshot(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	if (!isFiniteNumber(value.timestamp) || !isFiniteNumber(value.actual) || !isFiniteNumber(value.score)) {
		return false;
	}
	if (!isOptional(value, "expected", isFiniteNumber) || !isOptional(value, "decisionLow", isFiniteNumber)) {
		return false;
	}
	if (
		!isOptional(value, "decisionHigh", isFiniteNumber) ||
		!isBoolean(value.detected) ||
		!isString(value.reasonCode)
	) {
		return false;
	}
	if (!isString(value.activeContext) || !isFiniteNumber(value.baselineSampleCount)) {
		return false;
	}
	if (!["context", "time", "global", "insufficient"].includes(value.baselineScope as string)) {
		return false;
	}
	return (
		value.statusCode === undefined ||
		["learning", "normal", "deviating", "anomaly", "insufficient_data", "unavailable"].includes(
			value.statusCode as string,
		)
	);
}

function isDiagnosticSnapshotArray(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.every(entry => isDiagnosticSnapshot(entry));
}

function isOptional(value: Record<string, unknown>, key: string, guard: (value: unknown) => boolean): boolean {
	return value[key] === undefined || guard(value[key]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}
