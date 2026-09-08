/** Lightweight, bounded seasonal forecast model for numeric states. */
export type PredictiveStatus = "disabled" | "learning" | "ready" | "unreliable" | "error";
export type PredictiveQualityClass = "unknown" | "good" | "limited" | "poor";
export type PredictiveLearningReason = "insufficientSamples" | "waitingForTraining";
export type PredictiveSeasonalityMode = "off" | "auto" | "manual";
export type PredictiveModelType = "levelTrend" | "seasonal" | "timeOfDay";
export type PredictiveSelectionReason =
	| "seasonal-better"
	| "level-trend-better"
	| "no-periodicity"
	| "insufficient-cycles"
	| "insufficient-seasonal-data"
	| "seasonality-disabled"
	| "manual-seasonality"
	| "seasonal-backtest-failed"
	| "seasonal-not-better-enough"
	| "time-of-day-better";
export type PredictiveTrainingSource = "history" | "persisted" | "live" | "mixed";
export type PredictiveBootstrapReason =
	"initial" | "missing-model" | "config-changed" | "legacy-model" | "algorithm-changed" | "incomplete-model";
export const PREDICTIVE_ALGORITHM_VERSION = 6;
export const PREDICTIVE_HISTORY_RAW_LIMIT = 100_000;

/**
 *
 */
export interface PredictiveBacktestResult {
	/**
	 *
	 */
	available: boolean;
	/**
	 *
	 */
	mae?: number;
	/**
	 *
	 */
	normalizedError?: number;
	/**
	 *
	 */
	holdoutSamples?: number;
	/**
	 *
	 */
	trainingSamples?: number;
	/**
	 *
	 */
	trainingStart?: number;
	/**
	 *
	 */
	trainingEnd?: number;
	/**
	 *
	 */
	holdoutStart?: number;
	/**
	 *
	 */
	holdoutEnd?: number;
	/**
	 *
	 */
	actualMin?: number;
	/**
	 *
	 */
	actualMax?: number;
	/**
	 *
	 */
	actualMean?: number;
	/**
	 *
	 */
	predictedMin?: number;
	/**
	 *
	 */
	predictedMax?: number;
	/**
	 *
	 */
	predictedMean?: number;
	/**
	 *
	 */
	firstComparison?: PredictiveComparison;
	/**
	 *
	 */
	lastComparison?: PredictiveComparison;
	/**
	 *
	 */
	maxError?: PredictiveComparison;
	/**
	 *
	 */
	qualityScale?: number;
	/**
	 *
	 */
	qualityScaleSource?: "IQR";
	/**
	 *
	 */
	qualityScaleNearZero?: boolean;
	/**
	 *
	 */
	scaleSource?: "iqr" | "p95-p05" | "mad" | "range" | "none";
}

/**
 *
 */
export interface PredictiveQualityClassification {
	/**
	 *
	 */
	class: PredictiveQualityClass;
	/**
	 *
	 */
	relativeError?: number;
	/**
	 *
	 */
	scale?: number;
	/**
	 *
	 */
	scaleSource: "iqr" | "p95-p05" | "mad" | "range" | "none";
	/**
	 *
	 */
	evidenceSamples: number;
}

/**
 *
 */
export interface PredictiveComparison {
	/**
	 *
	 */
	timestamp?: number;
	/**
	 *
	 */
	actual: number;
	/**
	 *
	 */
	predicted: number;
	/**
	 *
	 */
	absoluteError: number;
}

/**
 * Returns the mean absolute error for aligned forecast and actual values.
 *
 * @param actual
 * @param predicted
 */
export function meanAbsoluteError(actual: readonly number[], predicted: readonly number[]): number {
	if (actual.length === 0 || actual.length !== predicted.length) {
		return Number.NaN;
	}
	return actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / actual.length;
}

/**
 *
 */
export interface PredictiveDiagnostics {
	/**
	 *
	 */
	model: {
		/**
		 *
		 */
		selectedType?: PredictiveModelType;
		/**
		 *
		 */
		intervalMinutes?: number;
		/**
		 *
		 */
		trainingSampleCount: number;
		/**
		 *
		 */
		lastTrainingAt?: number;
		/**
		 *
		 */
		rawSampleCount?: number;
		/**
		 *
		 */
		rawIntervalMinutes?: number;
		/**
		 *
		 */
		historySpanMinutes?: number;
		requestedHistorySpanMinutes?: number;
		timeOfDayAvailable?: boolean;
		timeOfDayDaysCovered?: number;
		timeOfDayBucketCount?: number;
		timeOfDayBucketCoverage?: number;
		/**
		 *
		 */
		selectionReason?: PredictiveSelectionReason;
		algorithmVersion?: number;
	};
	/**
	 *
	 */
	seasonality: {
		/**
		 *
		 */
		mode: PredictiveSeasonalityMode;
		/**
		 *
		 */
		used?: boolean;
		/**
		 *
		 */
		periodicityDetected?: boolean;
		/**
		 *
		 */
		detectedPeriodMinutes?: number;
		/**
		 *
		 */
		periodicityScore?: number;
		peakProminence?: number;
		harmonicPeaks?: number;
		candidateScores?: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
		atLowerBoundary?: boolean;
		harmonicScores?: Array<{ lag: number; score: number }>;
		secondBestPeriodMinutes?: number;
		secondBestPeriodicityScore?: number;
		detrended?: boolean;
		/**
		 *
		 */
		completePeriods?: number;
	};
	/**
	 *
	 */
	quality: {
		/**
		 *
		 */
		mae?: number;
		/**
		 *
		 */
		normalizedError?: number;
		/**
		 *
		 */
		holdoutSamples?: number;
		/**
		 *
		 */
		levelTrend: PredictiveBacktestResult;
		/**
		 *
		 */
		seasonal: PredictiveBacktestResult;
		timeOfDay: PredictiveBacktestResult;
		qualityScale?: number;
		qualityScaleSource?: "IQR";
		qualityScaleNearZero?: boolean;
		qualityClassification?: PredictiveQualityClassification;
	};
}

/**
 *
 */
export interface PredictiveSettings {
	/**
	 *
	 */
	enabled?: boolean;
	/**
	 *
	 */
	horizonMinutes?: number;
	/**
	 *
	 */
	updateIntervalMinutes?: number;
	/**
	 *
	 */
	minimumTrainingSamples?: number;
	/**
	 *
	 */
	maximumTrainingPoints?: number;
	/**
	 *
	 */
	seasonalPeriodMinutes?: number;
	/**
	 *
	 */
	seasonalityMode?: PredictiveSeasonalityMode;
}

/**
 *
 */
export interface ForecastPoint {
	/**
	 *
	 */
	timestamp: number;
	/**
	 *
	 */
	value: number;
}

/**
 *
 */
export interface PredictiveResult {
	/**
	 *
	 */
	status: PredictiveStatus;
	/**
	 *
	 */
	generatedAt?: number;
	/**
	 *
	 */
	horizonMinutes: number;
	/**
	 *
	 */
	points: ForecastPoint[];
	/**
	 *
	 */
	qualityMetric?: "mae";
	/**
	 *
	 */
	qualityValue?: number;
	/**
	 *
	 */
	qualityNormalized?: number;
	/**
	 *
	 */
	qualityClass?: PredictiveQualityClass;
	/**
	 *
	 */
	qualityClassification?: PredictiveQualityClassification;
	/**
	 *
	 */
	testPointCount?: number;
	/**
	 *
	 */
	seasonalityUsed?: boolean;
	/**
	 *
	 */
	seasonalPeriodMinutes?: number;
	/**
	 *
	 */
	seasonalPeriodSteps?: number;
	/**
	 *
	 */
	completeSeasonalPeriods?: number;
	/**
	 *
	 */
	periodicityDetected?: boolean;
	/**
	 *
	 */
	detectedPeriodMinutes?: number;
	/**
	 *
	 */
	periodicityScore?: number;
	/**
	 *
	 */
	peakProminence?: number;
	/**
	 *
	 */
	harmonicPeaks?: number;
	/**
	 *
	 */
	candidateScores?: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
	/**
	 *
	 */
	atLowerBoundary?: boolean;
	/**
	 *
	 */
	harmonicScores?: Array<{ lag: number; score: number }>;
	/**
	 *
	 */
	secondBestPeriodMinutes?: number;
	/**
	 *
	 */
	secondBestPeriodicityScore?: number;
	/**
	 *
	 */
	detrended?: boolean;
	/**
	 *
	 */
	selectedModelType?: PredictiveModelType;
	/**
	 *
	 */
	selectionReason?: PredictiveSelectionReason;
	/**
	 *
	 */
	algorithmVersion?: number;
	/**
	 *
	 */
	trainingSource?: PredictiveTrainingSource;
	/**
	 *
	 */
	bootstrapReason?: PredictiveBootstrapReason;
	/**
	 *
	 */
	diagnostics?: PredictiveDiagnostics;
	/**
	 *
	 */
	modelType: "seasonal-exponential-smoothing";
	/**
	 *
	 */
	trainingSampleCount: number;
	/**
	 *
	 */
	minimumTrainingSamples: number;
	/**
	 *
	 */
	learningReason?: PredictiveLearningReason;
	/**
	 *
	 */
	lastTrainingAt?: number;
	/**
	 *
	 */
	rawSampleCount?: number;
	/**
	 *
	 */
	rawIntervalMinutes?: number;
	/**
	 *
	 */
	historySpanMinutes?: number;
	/**
	 *
	 */
	requestedHistorySpanMinutes?: number;
}

/**
 *
 */
export interface PredictiveModelData {
	/**
	 *
	 */
	version: 1;
	/**
	 *
	 */
	level: number;
	/**
	 *
	 */
	trend: number;
	/**
	 *
	 */
	seasonal: number[];
	/**
	 *
	 */
	timeOfDay?: number[];
	/**
	 *
	 */
	timeOfDayBucketMinutes?: number;
	/**
	 *
	 */
	timeOfDayDaysCovered?: number;
	/**
	 *
	 */
	timeOfDayBucketCoverage?: number;
	/**
	 *
	 */
	period: number;
	/**
	 *
	 */
	intervalMs: number;
	/**
	 *
	 */
	trainingSampleCount: number;
	/**
	 *
	 */
	lastTrainingAt: number;
	/**
	 *
	 */
	qualityValue?: number;
	/**
	 *
	 */
	qualityNormalized?: number;
	/**
	 *
	 */
	qualityClass?: PredictiveQualityClass;
	/**
	 *
	 */
	qualityClassification?: PredictiveQualityClassification;
	/**
	 *
	 */
	testPointCount?: number;
	/**
	 *
	 */
	seasonalityUsed?: boolean;
	/**
	 *
	 */
	seasonalPeriodMinutes?: number;
	/**
	 *
	 */
	seasonalPeriodSteps?: number;
	/**
	 *
	 */
	completeSeasonalPeriods?: number;
	/**
	 *
	 */
	periodicityDetected?: boolean;
	/**
	 *
	 */
	detectedPeriodMinutes?: number;
	/**
	 *
	 */
	periodicityScore?: number;
	/**
	 *
	 */
	peakProminence?: number;
	/**
	 *
	 */
	harmonicPeaks?: number;
	/**
	 *
	 */
	secondBestPeriodMinutes?: number;
	/**
	 *
	 */
	secondBestPeriodicityScore?: number;
	/**
	 *
	 */
	detrended?: boolean;
	/**
	 *
	 */
	candidateScores?: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
	/**
	 *
	 */
	atLowerBoundary?: boolean;
	/**
	 *
	 */
	harmonicScores?: Array<{ lag: number; score: number }>;
	/**
	 *
	 */
	selectedModelType?: PredictiveModelType;
	/**
	 *
	 */
	selectionReason?: PredictiveSelectionReason;
	/**
	 *
	 */
	trainingSource?: PredictiveTrainingSource;
	/**
	 *
	 */
	bootstrapReason?: PredictiveBootstrapReason;
	/**
	 *
	 */
	diagnostics?: PredictiveDiagnostics;
	/**
	 *
	 */
	status?: "ready" | "unreliable";
	/**
	 *
	 */
	configFingerprint?: string;
	/** Internal version of the predictive algorithm used to create this model. */
	algorithmVersion?: number;
	/** Bounded, regularized training basis used by the active model. */
	trainingBasis?: ForecastPoint[];
	/**
	 *
	 */
	rawSampleCount?: number;
	/**
	 *
	 */
	rawIntervalMinutes?: number;
	/**
	 *
	 */
	historySpanMinutes?: number;
}

const MAX_HORIZON_MINUTES = 360;
const MAX_POINTS = 10_000;
const MAX_FORECAST_POINTS = 480;

/**
 *
 * @param settings
 */
export function normalizePredictiveSettings(settings?: PredictiveSettings): Required<PredictiveSettings> {
	const seasonalPeriodMinutes = Math.max(0, settings?.seasonalPeriodMinutes ?? 1440);
	return {
		enabled: settings?.enabled === true,
		horizonMinutes: Math.min(MAX_HORIZON_MINUTES, Math.max(1, settings?.horizonMinutes ?? 60)),
		updateIntervalMinutes: Math.max(5, settings?.updateIntervalMinutes ?? 30),
		minimumTrainingSamples: Math.max(10, settings?.minimumTrainingSamples ?? 120),
		maximumTrainingPoints: Math.min(MAX_POINTS, Math.max(20, settings?.maximumTrainingPoints ?? 2000)),
		seasonalPeriodMinutes,
		seasonalityMode: settings?.seasonalityMode ?? (seasonalPeriodMinutes > 0 ? "manual" : "off"),
	};
}

/**
 * Determines a bounded history window for predictive training.
 *
 * @param settings
 * @param configuredDays
 */
export function predictiveHistorySpanMinutes(settings: PredictiveSettings | undefined, configuredDays = 30): number {
	const normalized = normalizePredictiveSettings(settings);
	const configuredMinutes = Math.max(7, configuredDays) * 24 * 60;
	const seasonalMinimum =
		normalized.seasonalityMode === "off"
			? 0
			: normalized.seasonalityMode === "manual" && normalized.seasonalPeriodMinutes > 0
				? normalized.seasonalPeriodMinutes * 3
				: 7 * 24 * 60;
	return Math.max(configuredMinutes, normalized.horizonMinutes * 3, seasonalMinimum);
}

function predictiveConfigFingerprint(settings: Required<PredictiveSettings>): string {
	return [
		settings.enabled,
		settings.horizonMinutes,
		settings.updateIntervalMinutes,
		settings.minimumTrainingSamples,
		settings.maximumTrainingPoints,
		settings.seasonalityMode,
		settings.seasonalPeriodMinutes,
	].join("|");
}

/**
 * Serializes predictive training while allowing later tasks to continue after an error.
 *
 */
export class PredictiveTrainingQueue {
	private tail: Promise<void> = Promise.resolve();

	/**
	 * Enqueue one predictive task.
	 *
	 * @param task
	 */
	public enqueue(task: () => Promise<void> | void): Promise<void> {
		const run = this.tail.then(() => task());
		this.tail = run.catch(() => undefined);
		return run;
	}
}

/**
 *
 */
export class PredictiveModel {
	private data?: PredictiveModelData;
	private samples: ForecastPoint[] = [];
	private trainingBasisSource: PredictiveTrainingSource | undefined;
	private pendingLiveSamples = 0;
	private historyBootstrapRequired: boolean;
	private readonly initialBootstrapReason?: PredictiveBootstrapReason;

	/**
	 *
	 * @param settings
	 * @param data
	 */
	public constructor(
		private readonly settings: Required<PredictiveSettings>,
		data?: PredictiveModelData,
	) {
		const fingerprint = predictiveConfigFingerprint(settings);
		const algorithmMatches = data?.algorithmVersion === PREDICTIVE_ALGORITHM_VERSION;
		const persistedTrainingSamples = data?.trainingSampleCount;
		const persistedModelIsComplete =
			typeof persistedTrainingSamples === "number" &&
			Number.isFinite(persistedTrainingSamples) &&
			persistedTrainingSamples >= settings.minimumTrainingSamples;
		this.data =
			data?.version === 1 &&
			algorithmMatches &&
			data.configFingerprint === fingerprint &&
			persistedModelIsComplete
				? data
				: undefined;
		const persistedBasis = this.data?.trainingBasis;
		if (
			Array.isArray(persistedBasis) &&
			persistedBasis.length > 0 &&
			persistedBasis.length <= settings.maximumTrainingPoints &&
			persistedBasis.every(sample => Number.isFinite(sample?.value) && Number.isFinite(sample?.timestamp))
		) {
			this.samples = deduplicateSamples(persistedBasis);
			this.trainingBasisSource = this.data?.trainingSource;
		}
		this.initialBootstrapReason = this.data
			? undefined
			: data
				? !algorithmMatches
					? "algorithm-changed"
					: data.configFingerprint
						? data.configFingerprint !== fingerprint
							? "config-changed"
							: !persistedModelIsComplete
								? "incomplete-model"
								: "config-changed"
						: "legacy-model"
				: "missing-model";
		this.historyBootstrapRequired = this.data === undefined;
	}

	/**
	 *
	 * @param value
	 * @param timestamp
	 * @param sampleSource
	 */
	public add(value: number, timestamp: number, sampleSource: "live" | "history" = "live"): void {
		if (!Number.isFinite(value) || !Number.isFinite(timestamp)) {
			return;
		}
		if (sampleSource === "live") {
			this.pendingLiveSamples++;
		}
		const existingIndex = this.samples.findIndex(sample => sample.timestamp === timestamp);
		if (existingIndex >= 0) {
			if (sampleSource === "live") {
				this.samples[existingIndex] = { value, timestamp };
			}
		} else {
			this.samples.push({ value, timestamp });
		}
		const rawBufferLimit = Math.min(200_000, this.settings.maximumTrainingPoints * 100);
		if (this.samples.length > rawBufferLimit) {
			this.samples = resample(this.samples, rawBufferLimit);
		}
	}

	/**
	 *
	 * @param now
	 * @param trainingSource
	 */
	public train(now = Date.now(), trainingSource: PredictiveTrainingSource = "live"): PredictiveResult {
		if (!this.settings.enabled) {
			return this.result("disabled");
		}
		const insufficientSamples =
			this.samples.length < this.settings.minimumTrainingSamples ||
			(!!this.data &&
				trainingSource !== "history" &&
				this.pendingLiveSamples < this.settings.minimumTrainingSamples);
		if (insufficientSamples) {
			// Keep a valid persisted model active while the fresh live buffer is
			// still being collected for a future retraining.  In particular, do
			// not downgrade the active model to "learning" merely because the
			// non-persisted buffer starts empty after a restart.
			if (this.data) {
				return this.result(this.data.status ?? "unreliable", now);
			}
			return this.result("learning", undefined, "insufficientSamples");
		}
		const rawIntervalMs = medianInterval(this.samples) || 60_000;
		const intervalMs = selectModelInterval(this.samples, rawIntervalMs, this.settings);
		const values = regularizeSamples(this.samples, intervalMs, this.settings.maximumTrainingPoints);
		const basisStart = regularizedStartTimestamp(this.samples, intervalMs, values.length);
		const trainingBasis = values.map((value, index) => ({
			value,
			timestamp: (basisStart ?? now) + index * intervalMs,
		}));
		const effectiveTrainingSource: PredictiveTrainingSource =
			trainingSource === "history"
				? "history"
				: this.trainingBasisSource === "history" || this.trainingBasisSource === "mixed"
					? this.pendingLiveSamples > 0
						? "mixed"
						: this.trainingBasisSource
					: "live";
		const manualPeriod =
			this.settings.seasonalityMode === "manual"
				? seasonalPeriodSteps(this.settings.seasonalPeriodMinutes, intervalMs, values.length)
				: 0;
		const detection = this.settings.seasonalityMode === "auto" ? detectPeriod(values) : undefined;
		const candidatePeriod = manualPeriod || detection?.steps || 0;
		const regularizedStart = regularizedStartTimestamp(this.samples, intervalMs, values.length);
		const baselineQuality = backtest(values, 0, intervalMs, regularizedStart);
		const seasonalQuality =
			candidatePeriod > 0 ? backtest(values, candidatePeriod, intervalMs, regularizedStart) : undefined;
		const timeOfDayProfile = buildTimeOfDayProfile(values, intervalMs, regularizedStart);
		const timeOfDayQuality = timeOfDayProfile
			? backtest(values, 0, intervalMs, regularizedStart, timeOfDayProfile)
			: undefined;
		const completePeriods = candidatePeriod > 0 ? Math.floor(values.length / candidatePeriod) : 0;
		let selectionReason: PredictiveSelectionReason;
		const useSeasonal =
			candidatePeriod > 0 &&
			(this.settings.seasonalityMode === "manual" ||
				(seasonalQuality?.normalized !== undefined &&
					baselineQuality.normalized !== undefined &&
					seasonalQuality.normalized < baselineQuality.normalized * 0.95));
		if (useSeasonal) {
			selectionReason = this.settings.seasonalityMode === "manual" ? "manual-seasonality" : "seasonal-better";
		} else if (this.settings.seasonalityMode === "off") {
			selectionReason = "seasonality-disabled";
		} else if (this.settings.seasonalityMode === "manual" && manualPeriod === 0) {
			selectionReason = "insufficient-seasonal-data";
		} else if (this.settings.seasonalityMode === "auto" && !detection) {
			selectionReason = values.length < 30 ? "insufficient-cycles" : "no-periodicity";
		} else if (!seasonalQuality?.available) {
			selectionReason = "seasonal-backtest-failed";
		} else {
			selectionReason = "seasonal-not-better-enough";
		}
		const period = useSeasonal ? candidatePeriod : 0;
		const useTimeOfDay =
			!useSeasonal &&
			timeOfDayQuality?.available === true &&
			timeOfDayQuality.normalized !== undefined &&
			baselineQuality.normalized !== undefined &&
			timeOfDayQuality.normalized < baselineQuality.normalized * 0.95;
		const fitted = fitModel(values, period, useTimeOfDay ? timeOfDayProfile : undefined);
		const quality =
			useSeasonal && seasonalQuality
				? seasonalQuality
				: useTimeOfDay && timeOfDayQuality
					? timeOfDayQuality
					: baselineQuality;
		const qualityClassification = classifyQuality(quality);
		const status =
			quality.mae !== undefined && quality.normalized !== undefined && quality.normalized <= 1.5
				? "ready"
				: "unreliable";
		this.data = {
			version: 1,
			algorithmVersion: PREDICTIVE_ALGORITHM_VERSION,
			configFingerprint: predictiveConfigFingerprint(this.settings),
			trainingSource: effectiveTrainingSource,
			bootstrapReason: this.initialBootstrapReason ?? (trainingSource === "history" ? "initial" : undefined),
			level: fitted.level,
			trend: fitted.trend,
			seasonal: fitted.seasonal,
			timeOfDay: fitted.timeOfDay,
			timeOfDayBucketMinutes: timeOfDayProfile?.bucketMinutes,
			timeOfDayDaysCovered: timeOfDayProfile?.daysCovered,
			timeOfDayBucketCoverage: timeOfDayProfile?.coverage,
			period: fitted.period,
			intervalMs,
			trainingSampleCount: values.length,
			trainingBasis,
			lastTrainingAt: now,
			qualityValue: quality.mae,
			qualityNormalized: quality.normalized,
			qualityClass: qualityClassification.class,
			qualityClassification,
			testPointCount: quality.testPointCount,
			status,
			seasonalityUsed: period > 0,
			seasonalPeriodMinutes: this.settings.seasonalPeriodMinutes,
			seasonalPeriodSteps: period,
			completeSeasonalPeriods: period > 0 ? Math.floor(values.length / period) : 0,
			periodicityDetected: detection?.steps !== undefined || manualPeriod > 0,
			detectedPeriodMinutes: detection ? Math.round((detection.steps * intervalMs) / 60_000) : undefined,
			periodicityScore: detection?.score,
			peakProminence: detection?.peakProminence,
			harmonicPeaks: detection?.harmonicPeaks,
			secondBestPeriodMinutes: detection
				? Math.round((detection.secondBestSteps * intervalMs) / 60_000)
				: undefined,
			secondBestPeriodicityScore: detection?.secondBestScore,
			detrended: detection ? true : undefined,
			candidateScores: detection?.candidateScores,
			atLowerBoundary: detection?.atLowerBoundary,
			harmonicScores: detection?.harmonicScores,
			selectedModelType: period > 0 ? "seasonal" : useTimeOfDay ? "timeOfDay" : "levelTrend",
			selectionReason: useTimeOfDay ? "time-of-day-better" : selectionReason,
			diagnostics: buildDiagnostics({
				settings: this.settings,
				selectedType: period > 0 ? "seasonal" : useTimeOfDay ? "timeOfDay" : "levelTrend",
				intervalMs,
				trainingSampleCount: values.length,
				lastTrainingAt: now,
				rawSampleCount: this.samples.length,
				rawIntervalMinutes: rawIntervalMs / 60_000,
				historySpanMinutes: historySpan(this.samples) / 60_000,
				requestedHistorySpanMinutes: predictiveHistorySpanMinutes(this.settings, 30),
				selectionReason: useTimeOfDay ? "time-of-day-better" : selectionReason,
				periodicityDetected: detection?.steps !== undefined || manualPeriod > 0,
				detectedPeriodMinutes: detection ? Math.round((detection.steps * intervalMs) / 60_000) : undefined,
				periodicityScore: detection?.score,
				peakProminence: detection?.peakProminence,
				harmonicPeaks: detection?.harmonicPeaks,
				secondBestPeriodMinutes: detection
					? Math.round((detection.secondBestSteps * intervalMs) / 60_000)
					: undefined,
				secondBestPeriodicityScore: detection?.secondBestScore,
				detrended: detection ? true : undefined,
				candidateScores: detection?.candidateScores,
				atLowerBoundary: detection?.atLowerBoundary,
				harmonicScores: detection?.harmonicScores,
				seasonalityUsed: period > 0,
				completePeriods,
				baselineQuality,
				seasonalQuality,
				timeOfDayQuality,
				timeOfDayDaysCovered: timeOfDayProfile?.daysCovered,
				timeOfDayBucketCount: timeOfDayProfile?.buckets.length,
				timeOfDayBucketCoverage: timeOfDayProfile?.coverage,
				quality,
				qualityClassification,
			}),
			rawSampleCount: this.samples.length,
			rawIntervalMinutes: rawIntervalMs / 60_000,
			historySpanMinutes: historySpan(this.samples) / 60_000,
		};
		this.samples = trainingBasis;
		this.trainingBasisSource = effectiveTrainingSource;
		this.pendingLiveSamples = 0;
		this.historyBootstrapRequired = false;
		return this.result(status, now);
	}

	/**
	 *
	 * @param now
	 */
	public forecast(now = Date.now()): PredictiveResult {
		if (!this.settings.enabled) {
			return this.result("disabled");
		}
		if (!this.data) {
			return this.result(
				this.samples.length < this.settings.minimumTrainingSamples ? "learning" : "error",
				undefined,
				this.samples.length < this.settings.minimumTrainingSamples ? "insufficientSamples" : undefined,
			);
		}
		if (this.samples.length === 0) {
			return this.result(this.data.status ?? "unreliable", now);
		}
		const status =
			this.samples.length === 0
				? (this.data.status ?? "unreliable")
				: this.data.qualityNormalized !== undefined && this.data.qualityNormalized <= 1.5
					? "ready"
					: "unreliable";
		return this.result(status, now);
	}

	/**
	 *
	 */
	public toJSON(): PredictiveModelData | undefined {
		return this.data;
	}

	/**
	 *
	 */
	public get needsHistoryBootstrap(): boolean {
		return this.historyBootstrapRequired;
	}

	/** Indicates a legacy valid model whose bounded training basis is missing. */
	public get needsTrainingBasisBootstrap(): boolean {
		return !!this.data && !Array.isArray(this.data.trainingBasis);
	}

	/**
	 *
	 */
	public get bootstrapReason(): PredictiveBootstrapReason | undefined {
		return this.initialBootstrapReason;
	}
	/**
	 *
	 */
	public get trainingSampleCount(): number {
		return this.samples.length;
	}

	private result(
		status: PredictiveStatus,
		now?: number,
		learningReason?: PredictiveLearningReason,
	): PredictiveResult {
		const data = this.data;
		const points: ForecastPoint[] = [];
		if (data && (status === "ready" || status === "unreliable")) {
			const baseCount = Math.max(1, Math.ceil((this.settings.horizonMinutes * 60_000) / data.intervalMs));
			const step = Math.max(1, Math.ceil(baseCount / MAX_FORECAST_POINTS));
			const count = Math.ceil(baseCount / step);
			for (let index = 1; index <= count; index++) {
				const modelStep = index * step;
				const targetTimestamp = (now ?? Date.now()) + modelStep * data.intervalMs;
				const seasonal = data.period
					? (data.seasonal[(data.trainingSampleCount - 1 + modelStep) % data.period] ?? 0)
					: 0;
				const timeOfDay =
					data.selectedModelType === "timeOfDay" && data.timeOfDay?.length
						? timeOfDayPrediction(
								{
									bucketMinutes: data.timeOfDayBucketMinutes ?? 15,
									buckets: data.timeOfDay,
									daysCovered: data.timeOfDayDaysCovered ?? 0,
									coverage: data.timeOfDayBucketCoverage ?? 0,
								},
								targetTimestamp,
								0,
							)
						: undefined;
				points.push({
					timestamp: targetTimestamp,
					value: timeOfDay ?? data.level + boundedTrend(data.trend * modelStep, data) + seasonal,
				});
			}
		}
		return {
			status,
			generatedAt: now,
			horizonMinutes: this.settings.horizonMinutes,
			points,
			qualityMetric: data?.qualityValue === undefined ? undefined : "mae",
			qualityValue: data?.qualityValue,
			qualityNormalized: data?.qualityNormalized,
			qualityClass: data?.qualityClass,
			qualityClassification: data?.qualityClassification,
			testPointCount: data?.testPointCount,
			seasonalityUsed: data?.seasonalityUsed,
			seasonalPeriodMinutes: data?.seasonalPeriodMinutes,
			seasonalPeriodSteps: data?.seasonalPeriodSteps ?? data?.period,
			completeSeasonalPeriods: data?.completeSeasonalPeriods,
			periodicityDetected: data?.periodicityDetected,
			detectedPeriodMinutes: data?.detectedPeriodMinutes,
			periodicityScore: data?.periodicityScore,
			peakProminence: data?.peakProminence,
			harmonicPeaks: data?.harmonicPeaks,
			secondBestPeriodMinutes: data?.secondBestPeriodMinutes,
			secondBestPeriodicityScore: data?.secondBestPeriodicityScore,
			detrended: data?.detrended,
			selectedModelType: data?.selectedModelType,
			selectionReason: data?.selectionReason,
			algorithmVersion: data?.algorithmVersion,
			trainingSource: data?.trainingSource ?? (data ? "persisted" : undefined),
			bootstrapReason: data?.bootstrapReason,
			diagnostics:
				data?.diagnostics ??
				(status === "learning"
					? {
							model: { trainingSampleCount: this.samples.length },
							seasonality: { mode: this.settings.seasonalityMode },
							quality: {
								levelTrend: { available: false },
								seasonal: { available: false },
								timeOfDay: { available: false },
							},
						}
					: undefined),
			modelType: "seasonal-exponential-smoothing",
			trainingSampleCount:
				status === "learning" ? this.samples.length : (data?.trainingSampleCount ?? this.samples.length),
			minimumTrainingSamples: this.settings.minimumTrainingSamples,
			learningReason,
			lastTrainingAt: data?.lastTrainingAt,
			rawSampleCount: data?.rawSampleCount,
			rawIntervalMinutes: data?.rawIntervalMinutes,
			historySpanMinutes: data?.historySpanMinutes,
		};
	}
}

function medianInterval(samples: readonly ForecastPoint[]): number | undefined {
	const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
	const intervals = ordered
		.slice(1)
		.map((sample, index) => sample.timestamp - ordered[index].timestamp)
		.filter(value => value > 0);
	if (!intervals.length) {
		return undefined;
	}
	intervals.sort((a, b) => a - b);
	return intervals[Math.floor(intervals.length / 2)];
}

function historySpan(samples: readonly ForecastPoint[]): number {
	if (samples.length < 2) {
		return 0;
	}
	const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
	return ordered[ordered.length - 1].timestamp - ordered[0].timestamp;
}

function regularizedStartTimestamp(
	samples: readonly ForecastPoint[],
	intervalMs: number,
	count: number,
): number | undefined {
	if (!samples.length || count < 1) {
		return undefined;
	}
	const end = Math.max(...samples.map(sample => sample.timestamp));
	return end - (count - 1) * intervalMs;
}

function selectModelInterval(
	samples: readonly ForecastPoint[],
	rawIntervalMs: number,
	settings: Required<PredictiveSettings>,
): number {
	const span = historySpan(samples);
	const historyMinimum = span > 0 ? span / Math.max(1, settings.maximumTrainingPoints - 1) : rawIntervalMs;
	const horizonMinimum = (settings.horizonMinutes * 60_000) / 600;
	const minimumResolution = rawIntervalMs < 60_000 ? 60_000 : rawIntervalMs;
	const selected = Math.max(minimumResolution, historyMinimum, horizonMinimum);
	return Math.max(1, Math.round(selected));
}

function regularizeSamples(samples: readonly ForecastPoint[], intervalMs: number, limit: number): number[] {
	const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
	if (ordered.length === 0) {
		return [];
	}
	const end = ordered[ordered.length - 1].timestamp;
	const count = Math.min(limit, Math.max(1, Math.floor((end - ordered[0].timestamp) / intervalMs) + 1));
	const start = end - (count - 1) * intervalMs;
	const result: number[] = [];
	let right = 1;
	for (let index = 0; index < count; index++) {
		const timestamp = start + index * intervalMs;
		while (right < ordered.length - 1 && ordered[right].timestamp < timestamp) {
			right++;
		}
		const left = ordered[right - 1] ?? ordered[0];
		const next = ordered[right] ?? left;
		const span = next.timestamp - left.timestamp;
		const ratio = span > 0 ? Math.max(0, Math.min(1, (timestamp - left.timestamp) / span)) : 0;
		result.push(left.value + (next.value - left.value) * ratio);
	}
	return result;
}

function seasonalPeriodSteps(periodMinutes: number, intervalMs: number, sampleCount: number): number {
	if (periodMinutes <= 0) {
		return 0;
	}
	const steps = Math.max(2, Math.round((periodMinutes * 60_000) / intervalMs));
	return sampleCount >= steps * 2 ? steps : 0;
}

function detectPeriod(values: readonly number[]):
	| {
			steps: number;
			score: number;
			peakProminence: number;
			harmonicPeaks: number;
			secondBestSteps: number;
			secondBestScore: number;
			candidateScores: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
			atLowerBoundary: boolean;
			harmonicScores: Array<{ lag: number; score: number }>;
	  }
	| undefined {
	const minimum = 10;
	const maximum = Math.min(2880, Math.floor(values.length / 3));
	if (maximum < minimum || values.length < minimum * 3) {
		return undefined;
	}
	const rawSlope = regressionSlope(values, 0);
	const detrended = values.map((value, index) => value - rawSlope * index);
	const mean = detrended.reduce((sum, value) => sum + value, 0) / detrended.length;
	const variance = detrended.reduce((sum, value) => sum + (value - mean) ** 2, 0);
	if (variance <= 1e-9) {
		return undefined;
	}
	const scores = new Map<number, number>();
	for (let lag = Math.max(1, minimum - 2); lag <= maximum; lag++) {
		const pairs = values.length - lag;
		let covariance = 0;
		let lagVariance = 0;
		let currentVariance = 0;
		for (let index = lag; index < detrended.length; index++) {
			const current = detrended[index] - mean;
			const previous = detrended[index - lag] - mean;
			covariance += current * previous;
			lagVariance += previous * previous;
			currentVariance += current * current;
		}
		const score = covariance / Math.sqrt(Math.max(1e-9, lagVariance * currentVariance));
		if (pairs >= lag * 2 && Number.isFinite(score)) {
			scores.set(lag, score);
		}
	}
	const peaks = [...scores.entries()]
		.filter(([lag, score]) => {
			if (lag < minimum) {
				return false;
			}
			const previous = scores.get(lag - 1);
			const next = scores.get(lag + 1);
			return score >= 0.92 && previous !== undefined && next !== undefined && score > previous && score >= next;
		})
		.sort(([, left], [, right]) => right - left);
	const [bestEntry, secondEntry] = peaks;
	if (!bestEntry) {
		return undefined;
	}
	const [steps, score] = bestEntry;
	const neighbour = Math.max(scores.get(steps - 1) ?? -1, scores.get(steps + 1) ?? -1);
	const peakProminence = Math.max(0, score - neighbour);
	const harmonicPeaks = [2, 3, 4].filter(multiplier => {
		const harmonic = scores.get(steps * multiplier);
		return harmonic !== undefined && harmonic >= 0.92;
	}).length;
	const harmonicScores = [2, 3, 4]
		.map(multiplier => ({ lag: steps * multiplier, score: scores.get(steps * multiplier) }))
		.filter((entry): entry is { lag: number; score: number } => entry.score !== undefined);
	// A broad monotonic autocorrelation curve is smoothness, not repetition.
	if (peakProminence < 0.001) {
		return undefined;
	}
	return {
		steps,
		score,
		peakProminence,
		harmonicPeaks,
		secondBestSteps: secondEntry?.[0] ?? 0,
		secondBestScore: secondEntry?.[1] ?? 0,
		candidateScores: {
			minus2: scores.get(steps - 2),
			minus1: scores.get(steps - 1),
			candidate: score,
			plus1: scores.get(steps + 1),
			plus2: scores.get(steps + 2),
		},
		atLowerBoundary: steps === minimum,
		harmonicScores,
	};
}

function fitModel(
	values: readonly number[],
	period: number,
	timeOfDay?: TimeOfDayProfile,
): {
	level: number;
	trend: number;
	seasonal: number[];
	timeOfDay?: number[];
	period: number;
} {
	const levelValues = period > 0 ? values : values.slice(-Math.min(20, values.length));
	const level = levelValues.reduce((sum, value) => sum + value, 0) / Math.max(1, levelValues.length);
	const seasonal =
		period > 0
			? Array.from({ length: period }, (_, phase) => {
					const phaseValues = values.filter((_, index) => index % period === phase);
					return phaseValues.length
						? phaseValues.reduce((sum, value) => sum + value, 0) / phaseValues.length - level
						: 0;
				})
			: [];
	const trend = regressionSlope(values, period);
	return { level, trend: Number.isFinite(trend) ? trend : 0, seasonal, timeOfDay: timeOfDay?.buckets, period };
}

interface TimeOfDayProfile {
	bucketMinutes: number;
	buckets: number[];
	daysCovered: number;
	coverage: number;
}

function buildTimeOfDayProfile(
	values: readonly number[],
	intervalMs: number,
	start?: number,
): TimeOfDayProfile | undefined {
	if (start === undefined || values.length < 1) {
		return undefined;
	}
	const bucketMinutes = Math.max(5, Math.min(60, Math.round(intervalMs / 60_000)));
	const bucketCount = Math.max(1, Math.floor((24 * 60) / bucketMinutes));
	const buckets: number[] = Array.from({ length: bucketCount }, () => 0);
	const counts: number[] = Array.from({ length: bucketCount }, () => 0);
	const days = new Set<string>();
	for (let index = 0; index < values.length; index++) {
		const timestamp = start + index * intervalMs;
		const date = new Date(timestamp);
		const minute = date.getHours() * 60 + date.getMinutes();
		const bucket = Math.min(bucketCount - 1, Math.floor(minute / bucketMinutes));
		buckets[bucket] += values[index];
		counts[bucket]++;
		days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
	}
	const covered = counts.filter(count => count > 0).length;
	if (days.size < 3 || covered < Math.max(4, Math.floor(bucketCount * 0.1))) {
		return undefined;
	}
	for (let index = 0; index < buckets.length; index++) {
		buckets[index] = counts[index] ? buckets[index] / counts[index] : 0;
	}
	return { bucketMinutes, buckets, daysCovered: days.size, coverage: covered / bucketCount };
}

function timeOfDayPrediction(profile: TimeOfDayProfile, timestamp: number, offset: number): number {
	const date = new Date(timestamp);
	const minute = date.getHours() * 60 + date.getMinutes();
	const index = Math.min(profile.buckets.length - 1, Math.floor(minute / profile.bucketMinutes));
	return profile.buckets[index] + offset;
}

function regressionSlope(values: readonly number[], period: number): number {
	const points =
		period > 0
			? Array.from({ length: Math.floor(values.length / period) }, (_, cycle) => {
					const slice = values.slice(cycle * period, (cycle + 1) * period);
					return slice.reduce((sum, value) => sum + value, 0) / slice.length;
				})
			: [...values];
	if (points.length < 2) {
		return 0;
	}
	const meanX = (points.length - 1) / 2;
	const meanY = points.reduce((sum, value) => sum + value, 0) / points.length;
	const denominator = points.reduce((sum, _, index) => sum + (index - meanX) ** 2, 0);
	const slopePerPoint =
		points.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0) / denominator;
	return period > 0 ? slopePerPoint / period : slopePerPoint;
}

function boundedTrend(trend: number, data: PredictiveModelData): number {
	const scale = Math.max(0.001, Math.abs(data.level) * 0.5);
	return Math.max(-scale, Math.min(scale, trend));
}

function resample(samples: readonly ForecastPoint[], limit: number): ForecastPoint[] {
	if (samples.length <= limit) {
		return [...samples];
	}
	const result: ForecastPoint[] = [];
	const step = (samples.length - 1) / (limit - 1);
	for (let index = 0; index < limit; index++) {
		result.push(samples[Math.round(index * step)]);
	}
	return result;
}

function deduplicateSamples(samples: readonly ForecastPoint[]): ForecastPoint[] {
	const byTimestamp = new Map<number, ForecastPoint>();
	for (const sample of samples) {
		if (Number.isFinite(sample.value) && Number.isFinite(sample.timestamp)) {
			byTimestamp.set(sample.timestamp, { value: sample.value, timestamp: sample.timestamp });
		}
	}
	return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function backtest(
	values: readonly number[],
	period: number,
	intervalMs?: number,
	startTimestamp?: number,
	timeOfDay?: TimeOfDayProfile,
): {
	available: boolean;
	mae?: number;
	normalized?: number;
	testPointCount?: number;
	trainingSamples?: number;
	trainingStart?: number;
	trainingEnd?: number;
	holdoutStart?: number;
	holdoutEnd?: number;
	actualMin?: number;
	actualMax?: number;
	actualMean?: number;
	predictedMin?: number;
	predictedMax?: number;
	predictedMean?: number;
	firstComparison?: PredictiveComparison;
	lastComparison?: PredictiveComparison;
	maxError?: PredictiveComparison;
	scale: number;
	scaleNearZero: boolean;
	scaleSource: "iqr" | "p95-p05" | "mad" | "range" | "none";
} {
	if (values.length < 20) {
		return { available: false, scale: 0, scaleNearZero: true, scaleSource: "none" };
	}
	const holdout = Math.max(5, Math.floor(values.length * 0.2));
	const start = values.length - holdout;
	const training = values.slice(0, start);
	const fitted = fitModel(training, period > 0 && training.length >= period * 2 ? period : 0);
	const profile = timeOfDay ? buildTimeOfDayProfile(training, intervalMs ?? 60_000, startTimestamp) : undefined;
	const offset =
		profile && startTimestamp !== undefined ? values[0] - timeOfDayPrediction(profile, startTimestamp, 0) : 0;
	const comparisons: PredictiveComparison[] = [];
	for (let index = start; index < values.length; index++) {
		const seasonal = fitted.period ? (fitted.seasonal[index % fitted.period] ?? 0) : 0;
		const timestamp =
			startTimestamp !== undefined && intervalMs !== undefined ? startTimestamp + index * intervalMs : undefined;
		const predicted =
			profile && timestamp !== undefined
				? timeOfDayPrediction(profile, timestamp, offset * 0.5)
				: fitted.level +
					boundedTrend(fitted.trend * index, { level: fitted.level } as PredictiveModelData) +
					seasonal;
		comparisons.push({
			timestamp,
			actual: values[index],
			predicted,
			absoluteError: Math.abs(values[index] - predicted),
		});
	}
	const mae = meanAbsoluteError(
		comparisons.map(comparison => comparison.actual),
		comparisons.map(comparison => comparison.predicted),
	);
	const sorted = [...training].sort((a, b) => a - b);
	const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
	const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
	const iqr = q3 - q1;
	const p05 = quantile(training, 0.05);
	const p95 = quantile(training, 0.95);
	const p95p05 = p95 - p05;
	const median = quantile(training, 0.5);
	const mad =
		quantile(
			training.map(value => Math.abs(value - median)),
			0.5,
		) * 1.4826;
	const range = sorted[sorted.length - 1] - sorted[0];
	const scaleInfo =
		iqr >= 0.01
			? { scale: iqr, source: "iqr" as const }
			: p95p05 >= 0.001
				? { scale: p95p05, source: "p95-p05" as const }
				: mad >= 0.001
					? { scale: mad, source: "mad" as const }
					: range >= 0.001
						? { scale: range, source: "range" as const }
						: { scale: 0, source: "none" as const };
	const scale = scaleInfo.scale;
	const actual = comparisons.map(comparison => comparison.actual);
	const predicted = comparisons.map(comparison => comparison.predicted);
	return {
		available: true,
		mae,
		normalized: mae / Math.max(0.001, iqr),
		testPointCount: holdout,
		trainingSamples: training.length,
		trainingStart: startTimestamp,
		trainingEnd:
			startTimestamp !== undefined && intervalMs !== undefined
				? startTimestamp + (start - 1) * intervalMs
				: undefined,
		holdoutStart:
			startTimestamp !== undefined && intervalMs !== undefined ? startTimestamp + start * intervalMs : undefined,
		holdoutEnd:
			startTimestamp !== undefined && intervalMs !== undefined
				? startTimestamp + (values.length - 1) * intervalMs
				: undefined,
		actualMin: Math.min(...actual),
		actualMax: Math.max(...actual),
		actualMean: actual.reduce((sum, value) => sum + value, 0) / actual.length,
		predictedMin: Math.min(...predicted),
		predictedMax: Math.max(...predicted),
		predictedMean: predicted.reduce((sum, value) => sum + value, 0) / predicted.length,
		firstComparison: comparisons[0],
		lastComparison: comparisons.at(-1),
		maxError: comparisons.reduce(
			(max, comparison) => (comparison.absoluteError > max.absoluteError ? comparison : max),
			comparisons[0],
		),
		scale,
		scaleNearZero: iqr < 0.01,
		scaleSource: scaleInfo.source,
	};
}

function quantile(values: readonly number[], fraction: number): number {
	if (!values.length) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) {
		return sorted[lower];
	}
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function buildDiagnostics(input: {
	settings: Required<PredictiveSettings>;
	selectedType: PredictiveModelType;
	intervalMs: number;
	trainingSampleCount: number;
	lastTrainingAt: number;
	rawSampleCount: number;
	rawIntervalMinutes: number;
	historySpanMinutes: number;
	requestedHistorySpanMinutes?: number;
	selectionReason: PredictiveSelectionReason;
	periodicityDetected: boolean;
	detectedPeriodMinutes?: number;
	periodicityScore?: number;
	peakProminence?: number;
	harmonicPeaks?: number;
	secondBestPeriodMinutes?: number;
	secondBestPeriodicityScore?: number;
	detrended?: boolean;
	candidateScores?: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
	atLowerBoundary?: boolean;
	harmonicScores?: Array<{ lag: number; score: number }>;
	seasonalityUsed: boolean;
	completePeriods: number;
	baselineQuality: ReturnType<typeof backtest>;
	seasonalQuality?: ReturnType<typeof backtest>;
	timeOfDayQuality?: ReturnType<typeof backtest>;
	timeOfDayDaysCovered?: number;
	timeOfDayBucketCount?: number;
	timeOfDayBucketCoverage?: number;
	quality: ReturnType<typeof backtest>;
	qualityClassification: PredictiveQualityClassification;
}): PredictiveDiagnostics {
	return {
		model: {
			selectedType: input.selectedType,
			intervalMinutes: input.intervalMs / 60_000,
			trainingSampleCount: input.trainingSampleCount,
			lastTrainingAt: input.lastTrainingAt,
			rawSampleCount: input.rawSampleCount,
			rawIntervalMinutes: input.rawIntervalMinutes,
			historySpanMinutes: input.historySpanMinutes,
			requestedHistorySpanMinutes: input.requestedHistorySpanMinutes,
			timeOfDayAvailable: input.timeOfDayQuality?.available,
			timeOfDayDaysCovered: input.timeOfDayDaysCovered,
			timeOfDayBucketCount: input.timeOfDayBucketCount,
			timeOfDayBucketCoverage: input.timeOfDayBucketCoverage,
			selectionReason: input.selectionReason,
			algorithmVersion: PREDICTIVE_ALGORITHM_VERSION,
		},
		seasonality: {
			mode: input.settings.seasonalityMode,
			used: input.seasonalityUsed,
			periodicityDetected: input.periodicityDetected,
			detectedPeriodMinutes: input.detectedPeriodMinutes,
			periodicityScore: input.periodicityScore,
			peakProminence: input.peakProminence,
			harmonicPeaks: input.harmonicPeaks,
			secondBestPeriodMinutes: input.secondBestPeriodMinutes,
			secondBestPeriodicityScore: input.secondBestPeriodicityScore,
			detrended: input.detrended,
			candidateScores: input.candidateScores,
			atLowerBoundary: input.atLowerBoundary,
			harmonicScores: input.harmonicScores,
			completePeriods: input.completePeriods,
		},
		quality: {
			mae: input.quality.mae,
			normalizedError: input.quality.normalized,
			holdoutSamples: input.quality.testPointCount,
			qualityScale: input.quality.scale,
			qualityScaleSource: "IQR",
			qualityScaleNearZero: input.quality.scaleNearZero,
			qualityClassification: input.qualityClassification,
			levelTrend: toDiagnosticBacktest(input.baselineQuality),
			seasonal: toDiagnosticBacktest(input.seasonalQuality),
			timeOfDay: toDiagnosticBacktest(input.timeOfDayQuality),
		},
	};
}

/**
 *
 * @param input
 * @param input.mae
 * @param input.scale
 * @param input.evidenceSamples
 * @param input.scaleSource
 */
export function classifyPredictiveQuality(input: {
	/**
	 *
	 */
	mae?: number;
	/**
	 *
	 */
	scale: number;
	/**
	 *
	 */
	evidenceSamples: number;
	/**
	 *
	 */
	scaleSource?: "iqr" | "p95-p05" | "mad" | "range" | "none";
}): PredictiveQualityClassification {
	const evidenceSamples = input.evidenceSamples;
	const scaleSource = input.scaleSource ?? "none";
	if (evidenceSamples < 10) {
		return {
			class: "unknown",
			relativeError: undefined,
			scale: input.scale || undefined,
			scaleSource,
			evidenceSamples,
		};
	}
	if (input.scale <= 0 || input.mae === undefined) {
		return {
			class: input.mae === 0 ? "good" : "unknown",
			relativeError: undefined,
			scale: undefined,
			scaleSource: "none",
			evidenceSamples,
		};
	}
	const relativeError = input.mae / input.scale;
	const baseClass: PredictiveQualityClass = relativeError <= 0.5 ? "good" : relativeError <= 1 ? "limited" : "poor";
	return {
		class: evidenceSamples < 30 && baseClass === "good" ? "limited" : baseClass,
		relativeError,
		scale: input.scale,
		scaleSource,
		evidenceSamples,
	};
}

function classifyQuality(result: ReturnType<typeof backtest>): PredictiveQualityClassification {
	return classifyPredictiveQuality({
		mae: result.mae,
		scale: result.scale,
		evidenceSamples: result.testPointCount ?? 0,
		scaleSource: result.scaleSource,
	});
}

function toDiagnosticBacktest(result: ReturnType<typeof backtest> | undefined): PredictiveBacktestResult {
	return result
		? {
				available: result.available,
				mae: result.mae,
				normalizedError: result.normalized,
				holdoutSamples: result.testPointCount,
				trainingSamples: result.trainingSamples,
				trainingStart: result.trainingStart,
				trainingEnd: result.trainingEnd,
				holdoutStart: result.holdoutStart,
				holdoutEnd: result.holdoutEnd,
				actualMin: result.actualMin,
				actualMax: result.actualMax,
				actualMean: result.actualMean,
				predictedMin: result.predictedMin,
				predictedMax: result.predictedMax,
				predictedMean: result.predictedMean,
				firstComparison: result.firstComparison,
				lastComparison: result.lastComparison,
				maxError: result.maxError,
				qualityScale: result.scale,
				qualityScaleSource: "IQR",
				qualityScaleNearZero: result.scaleNearZero,
				scaleSource: result.scaleSource,
			}
		: { available: false };
}
