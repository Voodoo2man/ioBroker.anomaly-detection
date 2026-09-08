import { detectMadDeviation, detectRateDeviation, detectStuck, type DetectorResult } from "./detectors";
import { AdvancedDetectors, type ChangePointData, type TrendData } from "./advanced-detectors";
import { ContextualModel, type ContextualModelData } from "./model/contextual-model";
import { TemporalModel, type TemporalModelData } from "./model/temporal-model";
import { median, MODEL_SCHEMA_VERSION } from "./model/statistics";
import { scoreDetectors, type DetectorDiagnostic } from "./scoring";
import type { HistorySample } from "./history-provider";
import type { PredictiveSettings } from "./predictive";

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
	actual: number;
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

/** Framework-independent lifecycle and learning policy for one source state. */
export class SourceMonitor {
	private valueModel: TemporalModel;
	private rateModel: TemporalModel;
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
		this.contextualModel = new ContextualModel(bucketMinutes, DEFAULTS.maxContextModels, undefined, data?.context);
		this.scopedStates.set("global", {
			advanced: new AdvancedDetectors(data?.changePoint, data?.trend),
			lastUsed: 0,
			anomalySince: data?.anomalySince,
			detected: data?.detected ?? false,
		});
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
	 */
	public observe(value: unknown, timestamp: number, contextKey?: string): ObservationResult | undefined {
		if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
			return undefined;
		}
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
		const state = this.getScopedState(stateScope, timestamp);
		if (stateScope !== this.activeStateScope) {
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
		if (this.settings.enableRate ?? true) {
			const rateBaseline = this.rateModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
			const result = detectRateDeviation(rate, rateBaseline.series, minSamples, sensitivity);
			if (result) {
				results.push(result);
			}
		}
		this.updateRepeated(value, timestamp);
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
		const advanced = state.advanced.observe(
			expected === undefined ? undefined : value - expected,
			timestamp,
			0,
			baseline.series.mad(),
			this.settings.enableChangePoint === true,
			this.settings.enableTrend === true,
			sensitivity,
		);
		if (advanced.changePoint) {
			results.push(advanced.changePoint);
		}
		if (advanced.trend) {
			results.push(advanced.trend);
		}
		const scoring = scoreDetectors(results);
		this.updatePersistentDetection(state, scoring.score, timestamp, threshold);
		const isStrongAnomaly = scoring.score >= threshold;
		const learningNewContext = contextIsLearning;
		if (!isStrongAnomaly || advanced.adapt || learningNewContext) {
			this.valueModel.add(value, timestamp, timeContext, weekdayContext);
			if (this.settings.enableContext) {
				this.contextualModel.add(contextKey, value, timestamp, timeContext, weekdayContext);
			}
			if (rate !== undefined) {
				this.rateModel.add(rate, timestamp, timeContext, weekdayContext);
			}
		}
		this.lastValue = value;
		this.lastTimestamp = timestamp;
		if (!isStrongAnomaly) {
			this.lastNormal = timestamp;
		}
		this.lastContextKey = this.settings.enableContext === true ? contextKey : undefined;
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
			deviation: expected === undefined ? undefined : value - expected,
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
		this.diagnostics.push({
			timestamp,
			actual: observation.actual,
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
			// Keep legacy persistence global; scoped pending/latch state is intentionally
			// not serialized into the global compatibility fields.
			anomalySince: this.scopedStates.get("global")?.anomalySince,
			lastNormal: this.lastNormal,
			detected: this.scopedStates.get("global")?.detected ?? false,
			bootstrap: this.bootstrap,
			context: this.contextualModel.toJSON(),
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

	/** Number of retained global value-model samples, capped at the model capacity. */
	public get sampleCount(): number {
		return this.valueModel.sampleCount;
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
	 *
	 */
	public reset(): void {
		this.valueModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
		this.rateModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
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
	return { low: medianValue - halfWidth, high: medianValue + halfWidth };
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
	return { low: medianValue - halfWidth, high: medianValue + halfWidth };
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
			Object.entries(parsed as Record<string, unknown>).filter(
				([, model]) =>
					!!model &&
					typeof model === "object" &&
					((model as SourceModelData).schemaVersion === 1 ||
						(model as SourceModelData).schemaVersion === MODEL_SCHEMA_VERSION),
			),
		) as Record<string, SourceModelData>;
	} catch {
		return {};
	}
}
