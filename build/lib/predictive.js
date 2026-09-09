"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var predictive_exports = {};
__export(predictive_exports, {
  PREDICTIVE_ALGORITHM_VERSION: () => PREDICTIVE_ALGORITHM_VERSION,
  PREDICTIVE_HISTORY_RAW_LIMIT: () => PREDICTIVE_HISTORY_RAW_LIMIT,
  PredictiveModel: () => PredictiveModel,
  PredictiveTrainingQueue: () => PredictiveTrainingQueue,
  classifyPredictiveQuality: () => classifyPredictiveQuality,
  meanAbsoluteError: () => meanAbsoluteError,
  normalizePredictiveSettings: () => normalizePredictiveSettings,
  predictiveHistorySpanMinutes: () => predictiveHistorySpanMinutes
});
module.exports = __toCommonJS(predictive_exports);
const PREDICTIVE_ALGORITHM_VERSION = 7;
const PREDICTIVE_HISTORY_RAW_LIMIT = 1e5;
function meanAbsoluteError(actual, predicted) {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return Number.NaN;
  }
  return actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / actual.length;
}
const MAX_HORIZON_MINUTES = 360;
const MAX_POINTS = 1e4;
const MAX_FORECAST_POINTS = 480;
function normalizePredictiveSettings(settings) {
  var _a, _b, _c, _d, _e, _f;
  const seasonalPeriodMinutes = Math.max(0, (_a = settings == null ? void 0 : settings.seasonalPeriodMinutes) != null ? _a : 1440);
  return {
    enabled: (settings == null ? void 0 : settings.enabled) === true,
    horizonMinutes: Math.min(MAX_HORIZON_MINUTES, Math.max(1, (_b = settings == null ? void 0 : settings.horizonMinutes) != null ? _b : 60)),
    updateIntervalMinutes: Math.max(5, (_c = settings == null ? void 0 : settings.updateIntervalMinutes) != null ? _c : 30),
    minimumTrainingSamples: Math.max(10, (_d = settings == null ? void 0 : settings.minimumTrainingSamples) != null ? _d : 120),
    maximumTrainingPoints: Math.min(MAX_POINTS, Math.max(20, (_e = settings == null ? void 0 : settings.maximumTrainingPoints) != null ? _e : 2e3)),
    seasonalPeriodMinutes,
    seasonalityMode: (_f = settings == null ? void 0 : settings.seasonalityMode) != null ? _f : seasonalPeriodMinutes > 0 ? "manual" : "off"
  };
}
function predictiveHistorySpanMinutes(settings, configuredDays = 30) {
  const normalized = normalizePredictiveSettings(settings);
  const configuredMinutes = Math.max(7, configuredDays) * 24 * 60;
  const seasonalMinimum = normalized.seasonalityMode === "off" ? 0 : normalized.seasonalityMode === "manual" && normalized.seasonalPeriodMinutes > 0 ? normalized.seasonalPeriodMinutes * 3 : 7 * 24 * 60;
  return Math.max(configuredMinutes, normalized.horizonMinutes * 3, seasonalMinimum);
}
function predictiveConfigFingerprint(settings) {
  return [
    settings.enabled,
    settings.horizonMinutes,
    settings.updateIntervalMinutes,
    settings.minimumTrainingSamples,
    settings.maximumTrainingPoints,
    settings.seasonalityMode,
    settings.seasonalPeriodMinutes
  ].join("|");
}
function restoreTrainingBasis(basis, maximumTrainingPoints) {
  if (!Array.isArray(basis)) {
    return { samples: [], reason: "missing" };
  }
  if (basis.length === 0) {
    return { samples: [], reason: "empty" };
  }
  if (basis.length > maximumTrainingPoints) {
    return { samples: [], reason: "exceeds-maximum-training-points" };
  }
  for (const sample of basis) {
    if (!Number.isFinite(sample == null ? void 0 : sample.value)) {
      return { samples: [], reason: "invalid-value" };
    }
    if (!Number.isFinite(sample == null ? void 0 : sample.timestamp)) {
      return { samples: [], reason: "invalid-timestamp" };
    }
  }
  return { samples: deduplicateSamples(basis), reason: "accepted" };
}
class PredictiveTrainingQueue {
  tail = Promise.resolve();
  /**
   * Enqueue one predictive task.
   *
   * @param task
   */
  enqueue(task) {
    const run = this.tail.then(() => task());
    this.tail = run.catch(() => void 0);
    return run;
  }
}
class PredictiveModel {
  /**
   *
   * @param settings
   * @param data
   */
  constructor(settings, data) {
    this.settings = settings;
    var _a, _b;
    const fingerprint = predictiveConfigFingerprint(settings);
    const algorithmMatches = (data == null ? void 0 : data.algorithmVersion) === PREDICTIVE_ALGORITHM_VERSION;
    const persistedTrainingSamples = data == null ? void 0 : data.trainingSampleCount;
    const persistedModelIsComplete = typeof persistedTrainingSamples === "number" && Number.isFinite(persistedTrainingSamples) && persistedTrainingSamples >= settings.minimumTrainingSamples;
    this.data = (data == null ? void 0 : data.version) === 1 && algorithmMatches && data.configFingerprint === fingerprint && persistedModelIsComplete ? data : void 0;
    const basisRestore = restoreTrainingBasis((_a = this.data) == null ? void 0 : _a.trainingBasis, settings.maximumTrainingPoints);
    this.trainingBasisRestoreReasonValue = basisRestore.reason;
    if (this.data && basisRestore.reason === "accepted") {
      this.samples = basisRestore.samples;
      this.trainingBasisSource = (_b = this.data) == null ? void 0 : _b.trainingSource;
      this.lastObservedValue = this.data.lastObservedValue;
      this.lastObservedTimestamp = this.data.lastObservedTimestamp;
      this.trainingBasisRestored = true;
    }
    this.initialBootstrapReason = this.data ? void 0 : data ? !algorithmMatches ? "algorithm-changed" : data.configFingerprint ? data.configFingerprint !== fingerprint ? "config-changed" : !persistedModelIsComplete ? "incomplete-model" : "config-changed" : "legacy-model" : "missing-model";
    this.historyBootstrapRequired = this.data === void 0;
  }
  data;
  samples = [];
  trainingBasisSource;
  pendingLiveSamples = 0;
  lastObservedValue;
  lastObservedTimestamp;
  historyBootstrapRequired;
  trainingBasisRestored = false;
  trainingBasisRestoreReasonValue = "missing";
  initialBootstrapReason;
  /**
   *
   * @param value
   * @param timestamp
   * @param sampleSource
   */
  add(value, timestamp, sampleSource = "live") {
    if (!Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return;
    }
    if (sampleSource === "live") {
      this.pendingLiveSamples++;
      this.lastObservedValue = value;
      this.lastObservedTimestamp = timestamp;
    }
    const existingIndex = this.samples.findIndex((sample) => sample.timestamp === timestamp);
    if (existingIndex >= 0) {
      if (sampleSource === "live") {
        this.samples[existingIndex] = { value, timestamp };
      }
    } else {
      this.samples.push({ value, timestamp });
    }
    const rawBufferLimit = Math.min(2e5, this.settings.maximumTrainingPoints * 100);
    if (this.samples.length > rawBufferLimit) {
      this.samples = resample(this.samples, rawBufferLimit);
    }
  }
  /**
   *
   * @param now
   * @param trainingSource
   */
  train(now = Date.now(), trainingSource = "live") {
    var _a, _b, _c, _d, _e;
    if (!this.settings.enabled) {
      return this.result("disabled");
    }
    const insufficientSamples = this.samples.length < this.settings.minimumTrainingSamples || !!this.data && trainingSource !== "history" && this.pendingLiveSamples < this.settings.minimumTrainingSamples;
    if (insufficientSamples) {
      if (this.data) {
        return this.result((_a = this.data.status) != null ? _a : "unreliable", now);
      }
      return this.result("learning", void 0, "insufficientSamples");
    }
    const historyBasedModel = ((_b = this.data) == null ? void 0 : _b.trainingSource) === "history" || ((_c = this.data) == null ? void 0 : _c.trainingSource) === "mixed";
    if (this.data && historyBasedModel && !this.trainingBasisRestored && trainingSource !== "history") {
      return this.result((_d = this.data.status) != null ? _d : "unreliable", now, "waitingForTraining");
    }
    const rawIntervalMs = medianInterval(this.samples) || 6e4;
    const intervalMs = selectModelInterval(this.samples, rawIntervalMs, this.settings);
    const values = regularizeSamples(this.samples, intervalMs, this.settings.maximumTrainingPoints);
    const basisStart = regularizedStartTimestamp(this.samples, intervalMs, values.length);
    const trainingBasis = values.map((value, index) => ({
      value,
      timestamp: (basisStart != null ? basisStart : now) + index * intervalMs
    }));
    const effectiveTrainingSource = trainingSource === "history" ? "history" : this.trainingBasisSource === "history" || this.trainingBasisSource === "mixed" ? this.pendingLiveSamples > 0 ? "mixed" : this.trainingBasisSource : "live";
    const manualPeriod = this.settings.seasonalityMode === "manual" ? seasonalPeriodSteps(this.settings.seasonalPeriodMinutes, intervalMs, values.length) : 0;
    const detection = this.settings.seasonalityMode === "auto" ? detectPeriod(values) : void 0;
    const candidatePeriod = manualPeriod || (detection == null ? void 0 : detection.steps) || 0;
    const regularizedStart = regularizedStartTimestamp(this.samples, intervalMs, values.length);
    const baselineQuality = backtest(values, 0, intervalMs, regularizedStart);
    const seasonalQuality = candidatePeriod > 0 ? backtest(values, candidatePeriod, intervalMs, regularizedStart) : void 0;
    const timeOfDayProfile = buildTimeOfDayProfile(values, intervalMs, regularizedStart);
    const timeOfDayQuality = timeOfDayProfile ? backtest(values, 0, intervalMs, regularizedStart, timeOfDayProfile) : void 0;
    const completePeriods = candidatePeriod > 0 ? Math.floor(values.length / candidatePeriod) : 0;
    let selectionReason;
    const useSeasonal = candidatePeriod > 0 && (this.settings.seasonalityMode === "manual" || (seasonalQuality == null ? void 0 : seasonalQuality.normalized) !== void 0 && baselineQuality.normalized !== void 0 && seasonalQuality.normalized < baselineQuality.normalized * 0.95);
    if (useSeasonal) {
      selectionReason = this.settings.seasonalityMode === "manual" ? "manual-seasonality" : "seasonal-better";
    } else if (this.settings.seasonalityMode === "off") {
      selectionReason = "seasonality-disabled";
    } else if (this.settings.seasonalityMode === "manual" && manualPeriod === 0) {
      selectionReason = "insufficient-seasonal-data";
    } else if (this.settings.seasonalityMode === "auto" && !detection) {
      selectionReason = values.length < 30 ? "insufficient-cycles" : "no-periodicity";
    } else if (!(seasonalQuality == null ? void 0 : seasonalQuality.available)) {
      selectionReason = "seasonal-backtest-failed";
    } else {
      selectionReason = "seasonal-not-better-enough";
    }
    const period = useSeasonal ? candidatePeriod : 0;
    const useTimeOfDay = !useSeasonal && (timeOfDayQuality == null ? void 0 : timeOfDayQuality.available) === true && timeOfDayQuality.normalized !== void 0 && baselineQuality.normalized !== void 0 && timeOfDayQuality.normalized < baselineQuality.normalized * 0.95;
    const fitted = fitModel(values, period, useTimeOfDay ? timeOfDayProfile : void 0);
    const quality = useSeasonal && seasonalQuality ? seasonalQuality : useTimeOfDay && timeOfDayQuality ? timeOfDayQuality : baselineQuality;
    const qualityClassification = classifyQuality(quality);
    const status = quality.mae !== void 0 && quality.normalized !== void 0 && quality.normalized <= 1.5 ? "ready" : "unreliable";
    this.data = {
      version: 1,
      algorithmVersion: PREDICTIVE_ALGORITHM_VERSION,
      configFingerprint: predictiveConfigFingerprint(this.settings),
      trainingSource: effectiveTrainingSource,
      bootstrapReason: (_e = this.initialBootstrapReason) != null ? _e : trainingSource === "history" ? "initial" : void 0,
      level: fitted.level,
      trend: fitted.trend,
      seasonal: fitted.seasonal,
      timeOfDay: fitted.timeOfDay,
      timeOfDayBucketMinutes: timeOfDayProfile == null ? void 0 : timeOfDayProfile.bucketMinutes,
      timeOfDayDaysCovered: timeOfDayProfile == null ? void 0 : timeOfDayProfile.daysCovered,
      timeOfDayBucketCoverage: timeOfDayProfile == null ? void 0 : timeOfDayProfile.coverage,
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
      periodicityDetected: (detection == null ? void 0 : detection.steps) !== void 0 || manualPeriod > 0,
      detectedPeriodMinutes: detection ? Math.round(detection.steps * intervalMs / 6e4) : void 0,
      periodicityScore: detection == null ? void 0 : detection.score,
      peakProminence: detection == null ? void 0 : detection.peakProminence,
      harmonicPeaks: detection == null ? void 0 : detection.harmonicPeaks,
      secondBestPeriodMinutes: detection ? Math.round(detection.secondBestSteps * intervalMs / 6e4) : void 0,
      secondBestPeriodicityScore: detection == null ? void 0 : detection.secondBestScore,
      detrended: detection ? true : void 0,
      candidateScores: detection == null ? void 0 : detection.candidateScores,
      atLowerBoundary: detection == null ? void 0 : detection.atLowerBoundary,
      harmonicScores: detection == null ? void 0 : detection.harmonicScores,
      selectedModelType: period > 0 ? "seasonal" : useTimeOfDay ? "timeOfDay" : "levelTrend",
      selectionReason: useTimeOfDay ? "time-of-day-better" : selectionReason,
      diagnostics: buildDiagnostics({
        settings: this.settings,
        selectedType: period > 0 ? "seasonal" : useTimeOfDay ? "timeOfDay" : "levelTrend",
        intervalMs,
        trainingSampleCount: values.length,
        lastTrainingAt: now,
        rawSampleCount: this.samples.length,
        rawIntervalMinutes: rawIntervalMs / 6e4,
        historySpanMinutes: historySpan(this.samples) / 6e4,
        requestedHistorySpanMinutes: predictiveHistorySpanMinutes(this.settings, 30),
        selectionReason: useTimeOfDay ? "time-of-day-better" : selectionReason,
        periodicityDetected: (detection == null ? void 0 : detection.steps) !== void 0 || manualPeriod > 0,
        detectedPeriodMinutes: detection ? Math.round(detection.steps * intervalMs / 6e4) : void 0,
        periodicityScore: detection == null ? void 0 : detection.score,
        peakProminence: detection == null ? void 0 : detection.peakProminence,
        harmonicPeaks: detection == null ? void 0 : detection.harmonicPeaks,
        secondBestPeriodMinutes: detection ? Math.round(detection.secondBestSteps * intervalMs / 6e4) : void 0,
        secondBestPeriodicityScore: detection == null ? void 0 : detection.secondBestScore,
        detrended: detection ? true : void 0,
        candidateScores: detection == null ? void 0 : detection.candidateScores,
        atLowerBoundary: detection == null ? void 0 : detection.atLowerBoundary,
        harmonicScores: detection == null ? void 0 : detection.harmonicScores,
        seasonalityUsed: period > 0,
        completePeriods,
        baselineQuality,
        seasonalQuality,
        timeOfDayQuality,
        timeOfDayDaysCovered: timeOfDayProfile == null ? void 0 : timeOfDayProfile.daysCovered,
        timeOfDayBucketCount: timeOfDayProfile == null ? void 0 : timeOfDayProfile.buckets.length,
        timeOfDayBucketCoverage: timeOfDayProfile == null ? void 0 : timeOfDayProfile.coverage,
        quality,
        qualityClassification
      }),
      rawSampleCount: this.samples.length,
      rawIntervalMinutes: rawIntervalMs / 6e4,
      historySpanMinutes: historySpan(this.samples) / 6e4,
      lastObservedValue: this.lastObservedValue,
      lastObservedTimestamp: this.lastObservedTimestamp
    };
    this.samples = trainingBasis;
    this.trainingBasisSource = effectiveTrainingSource;
    this.trainingBasisRestored = true;
    this.trainingBasisRestoreReasonValue = "accepted";
    this.pendingLiveSamples = 0;
    this.historyBootstrapRequired = false;
    return this.result(status, now);
  }
  /**
   *
   * @param now
   */
  forecast(now = Date.now()) {
    var _a, _b;
    if (!this.settings.enabled) {
      return this.result("disabled");
    }
    if (!this.data) {
      return this.result(
        this.samples.length < this.settings.minimumTrainingSamples ? "learning" : "error",
        void 0,
        this.samples.length < this.settings.minimumTrainingSamples ? "insufficientSamples" : void 0
      );
    }
    if (this.samples.length === 0) {
      return this.result((_a = this.data.status) != null ? _a : "unreliable", now);
    }
    const status = this.samples.length === 0 ? (_b = this.data.status) != null ? _b : "unreliable" : this.data.qualityNormalized !== void 0 && this.data.qualityNormalized <= 1.5 ? "ready" : "unreliable";
    return this.result(status, now);
  }
  /**
   *
   */
  toJSON() {
    return this.data;
  }
  /**
   *
   */
  get needsHistoryBootstrap() {
    return this.historyBootstrapRequired;
  }
  /** Indicates a legacy valid model whose bounded training basis is missing. */
  get needsTrainingBasisBootstrap() {
    return !!this.data && !this.trainingBasisRestored;
  }
  get trainingBasisRestoreStatus() {
    return this.trainingBasisRestored ? "accepted" : "rejected";
  }
  get trainingBasisRestoreReason() {
    return this.trainingBasisRestoreReasonValue;
  }
  /**
   *
   */
  get bootstrapReason() {
    return this.initialBootstrapReason;
  }
  /**
   *
   */
  get trainingSampleCount() {
    return this.samples.length;
  }
  result(status, now, learningReason) {
    var _a, _b, _c, _d;
    const data = this.data;
    const points = [];
    const forecastNow = now != null ? now : Date.now();
    const horizonMs = this.settings.horizonMinutes * 6e4;
    const currentValue = this.lastObservedValue;
    const currentValueTimestamp = this.lastObservedTimestamp;
    const currentValueAgeMs = currentValueTimestamp !== void 0 ? Math.max(0, forecastNow - currentValueTimestamp) : void 0;
    const freshnessLimitMs = data ? Math.max(data.intervalMs * 3, this.settings.updateIntervalMinutes * 6e4) : 0;
    const anchorApplied = data !== void 0 && Number.isFinite(currentValue) && currentValueTimestamp !== void 0 && currentValueAgeMs !== void 0 && currentValueAgeMs <= freshnessLimitMs;
    let baseForecastAtNow;
    let initialForecastOffset;
    let anchorDecayMinutes;
    let unanchoredFirstForecastValue;
    let anchoredFirstForecastValue;
    if (data && (status === "ready" || status === "unreliable")) {
      const baseCount = Math.max(1, Math.ceil(this.settings.horizonMinutes * 6e4 / data.intervalMs));
      const step = Math.max(1, Math.ceil(baseCount / MAX_FORECAST_POINTS));
      const count = Math.ceil(baseCount / step);
      const baseForecast = (modelStep, targetTimestamp) => {
        var _a2, _b2, _c2, _d2, _e;
        const seasonal = data.period ? (_a2 = data.seasonal[(data.trainingSampleCount - 1 + modelStep) % data.period]) != null ? _a2 : 0 : 0;
        return data.selectedModelType === "timeOfDay" && ((_b2 = data.timeOfDay) == null ? void 0 : _b2.length) ? timeOfDayPrediction(
          {
            bucketMinutes: (_c2 = data.timeOfDayBucketMinutes) != null ? _c2 : 15,
            buckets: data.timeOfDay,
            daysCovered: (_d2 = data.timeOfDayDaysCovered) != null ? _d2 : 0,
            coverage: (_e = data.timeOfDayBucketCoverage) != null ? _e : 0
          },
          targetTimestamp,
          0
        ) : data.level + boundedTrend(data.trend * modelStep, data) + seasonal;
      };
      baseForecastAtNow = baseForecast(0, forecastNow);
      initialForecastOffset = Number.isFinite(currentValue) ? currentValue - baseForecastAtNow : void 0;
      const decayDurationMs = Math.max(
        data.intervalMs,
        data.period > 0 ? Math.min(horizonMs, data.period * data.intervalMs) : horizonMs / 4
      );
      anchorDecayMinutes = decayDurationMs / 6e4;
      for (let index = 1; index <= count; index++) {
        const modelStep = index * step;
        const targetTimestamp = forecastNow + modelStep * data.intervalMs;
        const unanchored = baseForecast(modelStep, targetTimestamp);
        const decay = Math.exp(-(modelStep * data.intervalMs) / decayDurationMs);
        const value = anchorApplied ? unanchored + (initialForecastOffset != null ? initialForecastOffset : 0) * decay : unanchored;
        if (index === 1) {
          unanchoredFirstForecastValue = unanchored;
          anchoredFirstForecastValue = value;
        }
        points.push({
          timestamp: targetTimestamp,
          value
        });
      }
    }
    return {
      status,
      generatedAt: now,
      horizonMinutes: this.settings.horizonMinutes,
      points,
      qualityMetric: (data == null ? void 0 : data.qualityValue) === void 0 ? void 0 : "mae",
      qualityValue: data == null ? void 0 : data.qualityValue,
      qualityNormalized: data == null ? void 0 : data.qualityNormalized,
      qualityClass: data == null ? void 0 : data.qualityClass,
      qualityClassification: data == null ? void 0 : data.qualityClassification,
      testPointCount: data == null ? void 0 : data.testPointCount,
      seasonalityUsed: data == null ? void 0 : data.seasonalityUsed,
      seasonalPeriodMinutes: data == null ? void 0 : data.seasonalPeriodMinutes,
      seasonalPeriodSteps: (_a = data == null ? void 0 : data.seasonalPeriodSteps) != null ? _a : data == null ? void 0 : data.period,
      completeSeasonalPeriods: data == null ? void 0 : data.completeSeasonalPeriods,
      periodicityDetected: data == null ? void 0 : data.periodicityDetected,
      detectedPeriodMinutes: data == null ? void 0 : data.detectedPeriodMinutes,
      periodicityScore: data == null ? void 0 : data.periodicityScore,
      peakProminence: data == null ? void 0 : data.peakProminence,
      harmonicPeaks: data == null ? void 0 : data.harmonicPeaks,
      secondBestPeriodMinutes: data == null ? void 0 : data.secondBestPeriodMinutes,
      secondBestPeriodicityScore: data == null ? void 0 : data.secondBestPeriodicityScore,
      detrended: data == null ? void 0 : data.detrended,
      selectedModelType: data == null ? void 0 : data.selectedModelType,
      selectionReason: data == null ? void 0 : data.selectionReason,
      algorithmVersion: data == null ? void 0 : data.algorithmVersion,
      trainingSource: (_b = data == null ? void 0 : data.trainingSource) != null ? _b : data ? "persisted" : void 0,
      bootstrapReason: data == null ? void 0 : data.bootstrapReason,
      diagnostics: (_c = data == null ? void 0 : data.diagnostics) != null ? _c : status === "learning" ? {
        model: { trainingSampleCount: this.samples.length },
        seasonality: { mode: this.settings.seasonalityMode },
        quality: {
          levelTrend: { available: false },
          seasonal: { available: false },
          timeOfDay: { available: false }
        }
      } : void 0,
      modelType: "seasonal-exponential-smoothing",
      trainingSampleCount: status === "learning" ? this.samples.length : (_d = data == null ? void 0 : data.trainingSampleCount) != null ? _d : this.samples.length,
      minimumTrainingSamples: this.settings.minimumTrainingSamples,
      learningReason,
      lastTrainingAt: data == null ? void 0 : data.lastTrainingAt,
      rawSampleCount: data == null ? void 0 : data.rawSampleCount,
      rawIntervalMinutes: data == null ? void 0 : data.rawIntervalMinutes,
      historySpanMinutes: data == null ? void 0 : data.historySpanMinutes,
      currentValue,
      currentValueTimestamp,
      currentValueAgeMinutes: currentValueAgeMs === void 0 ? void 0 : currentValueAgeMs / 6e4,
      baseForecastAtNow,
      initialForecastOffset,
      anchorApplied,
      anchorDecayMinutes,
      unanchoredFirstForecastValue,
      anchoredFirstForecastValue
    };
  }
}
function medianInterval(samples) {
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const intervals = ordered.slice(1).map((sample, index) => sample.timestamp - ordered[index].timestamp).filter((value) => value > 0);
  if (!intervals.length) {
    return void 0;
  }
  intervals.sort((a, b) => a - b);
  return intervals[Math.floor(intervals.length / 2)];
}
function historySpan(samples) {
  if (samples.length < 2) {
    return 0;
  }
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  return ordered[ordered.length - 1].timestamp - ordered[0].timestamp;
}
function regularizedStartTimestamp(samples, intervalMs, count) {
  if (!samples.length || count < 1) {
    return void 0;
  }
  const end = Math.max(...samples.map((sample) => sample.timestamp));
  return end - (count - 1) * intervalMs;
}
function selectModelInterval(samples, rawIntervalMs, settings) {
  const span = historySpan(samples);
  const historyMinimum = span > 0 ? span / Math.max(1, settings.maximumTrainingPoints - 1) : rawIntervalMs;
  const horizonMinimum = settings.horizonMinutes * 6e4 / 600;
  const minimumResolution = rawIntervalMs < 6e4 ? 6e4 : rawIntervalMs;
  const selected = Math.max(minimumResolution, historyMinimum, horizonMinimum);
  return Math.max(1, Math.round(selected));
}
function regularizeSamples(samples, intervalMs, limit) {
  var _a, _b;
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  if (ordered.length === 0) {
    return [];
  }
  const end = ordered[ordered.length - 1].timestamp;
  const count = Math.min(limit, Math.max(1, Math.floor((end - ordered[0].timestamp) / intervalMs) + 1));
  const start = end - (count - 1) * intervalMs;
  const result = [];
  let right = 1;
  for (let index = 0; index < count; index++) {
    const timestamp = start + index * intervalMs;
    while (right < ordered.length - 1 && ordered[right].timestamp < timestamp) {
      right++;
    }
    const left = (_a = ordered[right - 1]) != null ? _a : ordered[0];
    const next = (_b = ordered[right]) != null ? _b : left;
    const span = next.timestamp - left.timestamp;
    const ratio = span > 0 ? Math.max(0, Math.min(1, (timestamp - left.timestamp) / span)) : 0;
    result.push(left.value + (next.value - left.value) * ratio);
  }
  return result;
}
function seasonalPeriodSteps(periodMinutes, intervalMs, sampleCount) {
  if (periodMinutes <= 0) {
    return 0;
  }
  const steps = Math.max(2, Math.round(periodMinutes * 6e4 / intervalMs));
  return sampleCount >= steps * 2 ? steps : 0;
}
function detectPeriod(values) {
  var _a, _b, _c, _d;
  const minimum = 10;
  const maximum = Math.min(2880, Math.floor(values.length / 3));
  if (maximum < minimum || values.length < minimum * 3) {
    return void 0;
  }
  const rawSlope = regressionSlope(values, 0);
  const detrended = values.map((value, index) => value - rawSlope * index);
  const mean = detrended.reduce((sum, value) => sum + value, 0) / detrended.length;
  const variance = detrended.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (variance <= 1e-9) {
    return void 0;
  }
  const scores = /* @__PURE__ */ new Map();
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
    const score2 = covariance / Math.sqrt(Math.max(1e-9, lagVariance * currentVariance));
    if (pairs >= lag * 2 && Number.isFinite(score2)) {
      scores.set(lag, score2);
    }
  }
  const peaks = [...scores.entries()].filter(([lag, score2]) => {
    if (lag < minimum) {
      return false;
    }
    const previous = scores.get(lag - 1);
    const next = scores.get(lag + 1);
    return score2 >= 0.92 && previous !== void 0 && next !== void 0 && score2 > previous && score2 >= next;
  }).sort(([, left], [, right]) => right - left);
  const [bestEntry, secondEntry] = peaks;
  if (!bestEntry) {
    return void 0;
  }
  const [steps, score] = bestEntry;
  const neighbour = Math.max((_a = scores.get(steps - 1)) != null ? _a : -1, (_b = scores.get(steps + 1)) != null ? _b : -1);
  const peakProminence = Math.max(0, score - neighbour);
  const harmonicPeaks = [2, 3, 4].filter((multiplier) => {
    const harmonic = scores.get(steps * multiplier);
    return harmonic !== void 0 && harmonic >= 0.92;
  }).length;
  const harmonicScores = [2, 3, 4].map((multiplier) => ({ lag: steps * multiplier, score: scores.get(steps * multiplier) })).filter((entry) => entry.score !== void 0);
  if (peakProminence < 1e-3) {
    return void 0;
  }
  return {
    steps,
    score,
    peakProminence,
    harmonicPeaks,
    secondBestSteps: (_c = secondEntry == null ? void 0 : secondEntry[0]) != null ? _c : 0,
    secondBestScore: (_d = secondEntry == null ? void 0 : secondEntry[1]) != null ? _d : 0,
    candidateScores: {
      minus2: scores.get(steps - 2),
      minus1: scores.get(steps - 1),
      candidate: score,
      plus1: scores.get(steps + 1),
      plus2: scores.get(steps + 2)
    },
    atLowerBoundary: steps === minimum,
    harmonicScores
  };
}
function fitModel(values, period, timeOfDay) {
  const levelValues = period > 0 ? values : values.slice(-Math.min(20, values.length));
  const level = levelValues.reduce((sum, value) => sum + value, 0) / Math.max(1, levelValues.length);
  const seasonal = period > 0 ? Array.from({ length: period }, (_, phase) => {
    const phaseValues = values.filter((_2, index) => index % period === phase);
    return phaseValues.length ? phaseValues.reduce((sum, value) => sum + value, 0) / phaseValues.length - level : 0;
  }) : [];
  const trend = regressionSlope(values, period);
  return { level, trend: Number.isFinite(trend) ? trend : 0, seasonal, timeOfDay: timeOfDay == null ? void 0 : timeOfDay.buckets, period };
}
function buildTimeOfDayProfile(values, intervalMs, start) {
  if (start === void 0 || values.length < 1) {
    return void 0;
  }
  const bucketMinutes = Math.max(5, Math.min(60, Math.round(intervalMs / 6e4)));
  const bucketCount = Math.max(1, Math.floor(24 * 60 / bucketMinutes));
  const buckets = Array.from({ length: bucketCount }, () => 0);
  const counts = Array.from({ length: bucketCount }, () => 0);
  const days = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index++) {
    const timestamp = start + index * intervalMs;
    const date = new Date(timestamp);
    const minute = date.getHours() * 60 + date.getMinutes();
    const bucket = Math.min(bucketCount - 1, Math.floor(minute / bucketMinutes));
    buckets[bucket] += values[index];
    counts[bucket]++;
    days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  }
  const covered = counts.filter((count) => count > 0).length;
  if (days.size < 3 || covered < Math.max(4, Math.floor(bucketCount * 0.1))) {
    return void 0;
  }
  for (let index = 0; index < buckets.length; index++) {
    buckets[index] = counts[index] ? buckets[index] / counts[index] : 0;
  }
  return { bucketMinutes, buckets, daysCovered: days.size, coverage: covered / bucketCount };
}
function timeOfDayPrediction(profile, timestamp, offset) {
  const date = new Date(timestamp);
  const minute = date.getHours() * 60 + date.getMinutes();
  const index = Math.min(profile.buckets.length - 1, Math.floor(minute / profile.bucketMinutes));
  return profile.buckets[index] + offset;
}
function regressionSlope(values, period) {
  const points = period > 0 ? Array.from({ length: Math.floor(values.length / period) }, (_, cycle) => {
    const slice = values.slice(cycle * period, (cycle + 1) * period);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  }) : [...values];
  if (points.length < 2) {
    return 0;
  }
  const meanX = (points.length - 1) / 2;
  const meanY = points.reduce((sum, value) => sum + value, 0) / points.length;
  const denominator = points.reduce((sum, _, index) => sum + (index - meanX) ** 2, 0);
  const slopePerPoint = points.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0) / denominator;
  return period > 0 ? slopePerPoint / period : slopePerPoint;
}
function boundedTrend(trend, data) {
  const scale = Math.max(1e-3, Math.abs(data.level) * 0.5);
  return Math.max(-scale, Math.min(scale, trend));
}
function resample(samples, limit) {
  if (samples.length <= limit) {
    return [...samples];
  }
  const result = [];
  const step = (samples.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index++) {
    result.push(samples[Math.round(index * step)]);
  }
  return result;
}
function deduplicateSamples(samples) {
  const byTimestamp = /* @__PURE__ */ new Map();
  for (const sample of samples) {
    if (Number.isFinite(sample.value) && Number.isFinite(sample.timestamp)) {
      byTimestamp.set(sample.timestamp, { value: sample.value, timestamp: sample.timestamp });
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}
function backtest(values, period, intervalMs, startTimestamp, timeOfDay) {
  var _a;
  if (values.length < 20) {
    return { available: false, scale: 0, scaleNearZero: true, scaleSource: "none" };
  }
  const holdout = Math.max(5, Math.floor(values.length * 0.2));
  const start = values.length - holdout;
  const training = values.slice(0, start);
  const fitted = fitModel(training, period > 0 && training.length >= period * 2 ? period : 0);
  const profile = timeOfDay ? buildTimeOfDayProfile(training, intervalMs != null ? intervalMs : 6e4, startTimestamp) : void 0;
  const offset = profile && startTimestamp !== void 0 ? values[0] - timeOfDayPrediction(profile, startTimestamp, 0) : 0;
  const comparisons = [];
  for (let index = start; index < values.length; index++) {
    const seasonal = fitted.period ? (_a = fitted.seasonal[index % fitted.period]) != null ? _a : 0 : 0;
    const timestamp = startTimestamp !== void 0 && intervalMs !== void 0 ? startTimestamp + index * intervalMs : void 0;
    const predicted2 = profile && timestamp !== void 0 ? timeOfDayPrediction(profile, timestamp, offset * 0.5) : fitted.level + boundedTrend(fitted.trend * index, { level: fitted.level }) + seasonal;
    comparisons.push({
      timestamp,
      actual: values[index],
      predicted: predicted2,
      absoluteError: Math.abs(values[index] - predicted2)
    });
  }
  const mae = meanAbsoluteError(
    comparisons.map((comparison) => comparison.actual),
    comparisons.map((comparison) => comparison.predicted)
  );
  const sorted = [...training].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const p05 = quantile(training, 0.05);
  const p95 = quantile(training, 0.95);
  const p95p05 = p95 - p05;
  const median = quantile(training, 0.5);
  const mad = quantile(
    training.map((value) => Math.abs(value - median)),
    0.5
  ) * 1.4826;
  const range = sorted[sorted.length - 1] - sorted[0];
  const scaleInfo = iqr >= 0.01 ? { scale: iqr, source: "iqr" } : p95p05 >= 1e-3 ? { scale: p95p05, source: "p95-p05" } : mad >= 1e-3 ? { scale: mad, source: "mad" } : range >= 1e-3 ? { scale: range, source: "range" } : { scale: 0, source: "none" };
  const scale = scaleInfo.scale;
  const actual = comparisons.map((comparison) => comparison.actual);
  const predicted = comparisons.map((comparison) => comparison.predicted);
  return {
    available: true,
    mae,
    normalized: mae / Math.max(1e-3, iqr),
    testPointCount: holdout,
    trainingSamples: training.length,
    trainingStart: startTimestamp,
    trainingEnd: startTimestamp !== void 0 && intervalMs !== void 0 ? startTimestamp + (start - 1) * intervalMs : void 0,
    holdoutStart: startTimestamp !== void 0 && intervalMs !== void 0 ? startTimestamp + start * intervalMs : void 0,
    holdoutEnd: startTimestamp !== void 0 && intervalMs !== void 0 ? startTimestamp + (values.length - 1) * intervalMs : void 0,
    actualMin: Math.min(...actual),
    actualMax: Math.max(...actual),
    actualMean: actual.reduce((sum, value) => sum + value, 0) / actual.length,
    predictedMin: Math.min(...predicted),
    predictedMax: Math.max(...predicted),
    predictedMean: predicted.reduce((sum, value) => sum + value, 0) / predicted.length,
    firstComparison: comparisons[0],
    lastComparison: comparisons.at(-1),
    maxError: comparisons.reduce(
      (max, comparison) => comparison.absoluteError > max.absoluteError ? comparison : max,
      comparisons[0]
    ),
    scale,
    scaleNearZero: iqr < 0.01,
    scaleSource: scaleInfo.source
  };
}
function quantile(values, fraction) {
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
function buildDiagnostics(input) {
  var _a;
  return {
    model: {
      selectedType: input.selectedType,
      intervalMinutes: input.intervalMs / 6e4,
      trainingSampleCount: input.trainingSampleCount,
      lastTrainingAt: input.lastTrainingAt,
      rawSampleCount: input.rawSampleCount,
      rawIntervalMinutes: input.rawIntervalMinutes,
      historySpanMinutes: input.historySpanMinutes,
      requestedHistorySpanMinutes: input.requestedHistorySpanMinutes,
      timeOfDayAvailable: (_a = input.timeOfDayQuality) == null ? void 0 : _a.available,
      timeOfDayDaysCovered: input.timeOfDayDaysCovered,
      timeOfDayBucketCount: input.timeOfDayBucketCount,
      timeOfDayBucketCoverage: input.timeOfDayBucketCoverage,
      selectionReason: input.selectionReason,
      algorithmVersion: PREDICTIVE_ALGORITHM_VERSION
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
      completePeriods: input.completePeriods
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
      timeOfDay: toDiagnosticBacktest(input.timeOfDayQuality)
    }
  };
}
function classifyPredictiveQuality(input) {
  var _a;
  const evidenceSamples = input.evidenceSamples;
  const scaleSource = (_a = input.scaleSource) != null ? _a : "none";
  if (evidenceSamples < 10) {
    return {
      class: "unknown",
      relativeError: void 0,
      scale: input.scale || void 0,
      scaleSource,
      evidenceSamples
    };
  }
  if (input.scale <= 0 || input.mae === void 0) {
    return {
      class: input.mae === 0 ? "good" : "unknown",
      relativeError: void 0,
      scale: void 0,
      scaleSource: "none",
      evidenceSamples
    };
  }
  const relativeError = input.mae / input.scale;
  const baseClass = relativeError <= 0.5 ? "good" : relativeError <= 1 ? "limited" : "poor";
  return {
    class: evidenceSamples < 30 && baseClass === "good" ? "limited" : baseClass,
    relativeError,
    scale: input.scale,
    scaleSource,
    evidenceSamples
  };
}
function classifyQuality(result) {
  var _a;
  return classifyPredictiveQuality({
    mae: result.mae,
    scale: result.scale,
    evidenceSamples: (_a = result.testPointCount) != null ? _a : 0,
    scaleSource: result.scaleSource
  });
}
function toDiagnosticBacktest(result) {
  return result ? {
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
    scaleSource: result.scaleSource
  } : { available: false };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PREDICTIVE_ALGORITHM_VERSION,
  PREDICTIVE_HISTORY_RAW_LIMIT,
  PredictiveModel,
  PredictiveTrainingQueue,
  classifyPredictiveQuality,
  meanAbsoluteError,
  normalizePredictiveSettings,
  predictiveHistorySpanMinutes
});
//# sourceMappingURL=predictive.js.map
