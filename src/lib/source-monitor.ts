import { detectMadDeviation, detectRateDeviation, detectStuck, type DetectorResult } from "./detectors";
import { AdvancedDetectors, type ChangePointData, type TrendData } from "./advanced-detectors";
import { ContextualModel, type ContextualModelData } from "./model/contextual-model";
import { TemporalModel, type TemporalModelData } from "./model/temporal-model";
import { median, MODEL_SCHEMA_VERSION } from "./model/statistics";
import { scoreDetectors } from "./scoring";
import type { HistorySample } from "./history-provider";

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
export interface ContextStateSettings {
	id: string;
	bucketWidth?: number;
}

export interface SourceSettings {
	enabled: boolean;
	id: string;
	name?: string;
	minimumSamples?: number;
	bucketMinutes?: number;
	sensitivity?: number;
	anomalyThreshold?: number;
	minimumAnomalyDurationMinutes?: number;
	enableMad?: boolean;
	enableRate?: boolean;
	enableStuck?: boolean;
	stuckDurationMinutes?: number;
	timeContext?: boolean;
	weekdayContext?: boolean;
	initialTraining?: "live" | "history";
	historyInstance?: string;
	trainingDays?: number;
	maxHistorySamples?: number;
	autoStartMonitoringAfterImport?: boolean;
	enableContext?: boolean;
	contextStates?: ContextStateSettings[];
	enableChangePoint?: boolean;
	enableTrend?: boolean;
}

export interface BootstrapMetadata {
	completed: boolean;
	provider?: string;
	historySourceId?: string;
	configKey?: string;
	start?: number;
	end?: number;
	importedSamples: number;
}

export interface SourceModelData {
	schemaVersion: number;
	configuredSourceId?: string;
	value: TemporalModelData;
	rate: TemporalModelData;
	lastValue?: number;
	lastTimestamp?: number;
	lastContextKey?: string;
	repeatedSince?: number;
	anomalySince?: number;
	detected?: boolean;
	bootstrap?: BootstrapMetadata;
	context?: ContextualModelData;
	changePoint?: ChangePointData;
	trend?: TrendData;
}

export type BaselineScope = "context" | "time" | "global" | "insufficient";

export interface ObservationResult {
	actual: number;
	expected?: number;
	deviation?: number;
	score: number;
	detected: boolean;
	status: "learning" | "monitoring" | "insufficientData";
	reason: string;
	sampleCount: number;
	lastAnomaly?: number;
	baselineScope: BaselineScope;
	activeContext: string;
	baselineSampleCount: number;
	contextSampleCount: number;
}

/** Framework-independent lifecycle and learning policy for one source state. */
export class SourceMonitor {
	private valueModel: TemporalModel;
	private rateModel: TemporalModel;
	private contextualModel: ContextualModel;
	private advanced: AdvancedDetectors;
	private lastValue: number | undefined;
	private lastTimestamp: number | undefined;
	private lastContextKey: string | undefined;
	private repeatedSince: number | undefined;
	private anomalySince: number | undefined;
	private detected: boolean;
	private bootstrap?: BootstrapMetadata;

	public constructor(
		private readonly settings: SourceSettings,
		data?: SourceModelData,
	) {
		const bucketMinutes = settings.bucketMinutes ?? DEFAULTS.bucketMinutes;
		this.valueModel = new TemporalModel(bucketMinutes, undefined, data?.value);
		this.rateModel = new TemporalModel(bucketMinutes, undefined, data?.rate);
		this.contextualModel = new ContextualModel(bucketMinutes, DEFAULTS.maxContextModels, undefined, data?.context);
		this.advanced = new AdvancedDetectors(data?.changePoint, data?.trend);
		this.lastValue = data?.lastValue;
		this.lastTimestamp = data?.lastTimestamp;
		this.lastContextKey = data?.lastContextKey;
		this.repeatedSince = data?.repeatedSince;
		this.anomalySince = data?.anomalySince;
		this.detected = data?.detected ?? false;
		this.bootstrap = data?.bootstrap;
	}

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
		const baselineScope: BaselineScope = contextBaseline
			? "context"
			: contextIsLearning
				? "insufficient"
				: baseline.scope === "global"
					? "global"
					: "time";
		const baselineSampleCount = contextIsLearning ? 0 : baseline.series.count;
		const expected = contextIsLearning ? undefined : baseline.series.median();
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
		const advanced = this.advanced.observe(
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
		this.updatePersistentDetection(scoring.score, timestamp, threshold);
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
		this.lastContextKey = this.settings.enableContext === true ? contextKey : undefined;
		const sufficient = this.valueModel.sampleCount >= minSamples;
		const contextSampleCount = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
		return {
			actual: value,
			expected,
			deviation: expected === undefined ? undefined : value - expected,
			score: scoring.score,
			detected: this.detected,
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
		};
	}

	public toJSON(): SourceModelData {
		return {
			schemaVersion: MODEL_SCHEMA_VERSION,
			value: this.valueModel.toJSON(),
			rate: this.rateModel.toJSON(),
			lastValue: this.lastValue,
			lastTimestamp: this.lastTimestamp,
			lastContextKey: this.lastContextKey,
			repeatedSince: this.repeatedSince,
			anomalySince: this.anomalySince,
			detected: this.detected,
			bootstrap: this.bootstrap,
			context: this.contextualModel.toJSON(),
			...this.advanced.toJSON(),
		};
	}

	public get hasSufficientData(): boolean {
		return this.valueModel.sampleCount >= (this.settings.minimumSamples ?? DEFAULTS.minimumSamples);
	}

	/** Number of retained global value-model samples, capped at the model capacity. */
	public get sampleCount(): number {
		return this.valueModel.sampleCount;
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

	public reset(): void {
		this.valueModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
		this.rateModel = new TemporalModel(this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes);
		this.contextualModel = new ContextualModel(
			this.settings.bucketMinutes ?? DEFAULTS.bucketMinutes,
			DEFAULTS.maxContextModels,
		);
		this.advanced = new AdvancedDetectors();
		this.lastValue = undefined;
		this.lastTimestamp = undefined;
		this.lastContextKey = undefined;
		this.repeatedSince = undefined;
		this.anomalySince = undefined;
		this.detected = false;
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

	private updatePersistentDetection(score: number, timestamp: number, threshold: number): void {
		if (this.detected) {
			if (score < Math.max(0, threshold - DEFAULTS.hysteresis)) {
				this.detected = false;
				this.anomalySince = undefined;
			}
			return;
		}
		if (score < threshold) {
			this.anomalySince = undefined;
			return;
		}
		this.anomalySince ??= timestamp;
		const requiredDuration =
			(this.settings.minimumAnomalyDurationMinutes ?? DEFAULTS.minimumAnomalyDurationMinutes) * 60_000;
		if (timestamp - this.anomalySince >= requiredDuration) {
			this.detected = true;
		}
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
