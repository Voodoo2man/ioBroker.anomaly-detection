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
var source_monitor_exports = {};
__export(source_monitor_exports, {
  DEFAULTS: () => DEFAULTS,
  SourceMonitor: () => SourceMonitor,
  parseStoredModel: () => parseStoredModel
});
module.exports = __toCommonJS(source_monitor_exports);
var import_detectors = require("./detectors");
var import_advanced_detectors = require("./advanced-detectors");
var import_contextual_model = require("./model/contextual-model");
var import_temporal_model = require("./model/temporal-model");
var import_statistics = require("./model/statistics");
var import_scoring = require("./scoring");
const DEFAULTS = {
  minimumSamples: 30,
  bucketMinutes: 60,
  sensitivity: 3.5,
  anomalyThreshold: 70,
  minimumAnomalyDurationMinutes: 5,
  hysteresis: 10,
  stuckDurationMinutes: 120,
  maxHistoryGapMinutes: 360,
  maxContextModels: 32
};
class SourceMonitor {
  constructor(settings, data) {
    this.settings = settings;
    var _a, _b;
    const bucketMinutes = (_a = settings.bucketMinutes) != null ? _a : DEFAULTS.bucketMinutes;
    this.valueModel = new import_temporal_model.TemporalModel(bucketMinutes, void 0, data == null ? void 0 : data.value);
    this.rateModel = new import_temporal_model.TemporalModel(bucketMinutes, void 0, data == null ? void 0 : data.rate);
    this.contextualModel = new import_contextual_model.ContextualModel(bucketMinutes, DEFAULTS.maxContextModels, void 0, data == null ? void 0 : data.context);
    this.advanced = new import_advanced_detectors.AdvancedDetectors(data == null ? void 0 : data.changePoint, data == null ? void 0 : data.trend);
    this.lastValue = data == null ? void 0 : data.lastValue;
    this.lastTimestamp = data == null ? void 0 : data.lastTimestamp;
    this.lastContextKey = data == null ? void 0 : data.lastContextKey;
    this.repeatedSince = data == null ? void 0 : data.repeatedSince;
    this.anomalySince = data == null ? void 0 : data.anomalySince;
    this.detected = (_b = data == null ? void 0 : data.detected) != null ? _b : false;
    this.bootstrap = data == null ? void 0 : data.bootstrap;
  }
  valueModel;
  rateModel;
  contextualModel;
  advanced;
  lastValue;
  lastTimestamp;
  lastContextKey;
  repeatedSince;
  anomalySince;
  detected;
  bootstrap;
  observe(value, timestamp, contextKey) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return void 0;
    }
    const minSamples = (_a = this.settings.minimumSamples) != null ? _a : DEFAULTS.minimumSamples;
    const sensitivity = (_b = this.settings.sensitivity) != null ? _b : DEFAULTS.sensitivity;
    const threshold = (_c = this.settings.anomalyThreshold) != null ? _c : DEFAULTS.anomalyThreshold;
    const timeContext = (_d = this.settings.timeContext) != null ? _d : true;
    const weekdayContext = (_e = this.settings.weekdayContext) != null ? _e : false;
    const hasActiveContext = this.settings.enableContext === true && contextKey !== void 0;
    const contextSampleCountBefore = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
    const contextIsLearning = hasActiveContext && contextSampleCountBefore < minSamples;
    const standardBaseline = this.valueModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
    const contextBaseline = contextIsLearning ? void 0 : this.settings.enableContext ? this.contextualModel.baseline(contextKey, timestamp, minSamples, timeContext, weekdayContext) : void 0;
    const baseline = contextBaseline != null ? contextBaseline : standardBaseline;
    const baselineScope = contextBaseline ? "context" : contextIsLearning ? "insufficient" : baseline.scope === "global" ? "global" : "time";
    const baselineSampleCount = contextIsLearning ? 0 : baseline.series.count;
    const expected = contextIsLearning ? void 0 : baseline.series.median();
    const contextChanged = this.settings.enableContext === true && contextKey !== this.lastContextKey;
    const rate = contextChanged ? void 0 : this.calculateRate(value, timestamp);
    const results = [];
    if (((_f = this.settings.enableMad) != null ? _f : true) && !contextIsLearning) {
      const result = (0, import_detectors.detectMadDeviation)(value, baseline.series, minSamples, sensitivity);
      if (result) {
        results.push(
          contextBaseline ? {
            ...result,
            name: "context",
            reason: "Value is significantly outside the normal range for the current context"
          } : { ...result, reason: valueDeviationReason(baselineScope) }
        );
      }
    }
    if ((_g = this.settings.enableRate) != null ? _g : true) {
      const rateBaseline = this.rateModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
      const result = (0, import_detectors.detectRateDeviation)(rate, rateBaseline.series, minSamples, sensitivity);
      if (result) {
        results.push(result);
      }
    }
    this.updateRepeated(value, timestamp);
    if ((_h = this.settings.enableStuck) != null ? _h : false) {
      const result = (0, import_detectors.detectStuck)(
        this.repeatedSince,
        timestamp,
        (_i = this.settings.stuckDurationMinutes) != null ? _i : DEFAULTS.stuckDurationMinutes
      );
      if (result) {
        results.push(result);
      }
    }
    const advanced = this.advanced.observe(
      expected === void 0 ? void 0 : value - expected,
      timestamp,
      0,
      baseline.series.mad(),
      this.settings.enableChangePoint === true,
      this.settings.enableTrend === true,
      sensitivity
    );
    if (advanced.changePoint) {
      results.push(advanced.changePoint);
    }
    if (advanced.trend) {
      results.push(advanced.trend);
    }
    const scoring = (0, import_scoring.scoreDetectors)(results);
    this.updatePersistentDetection(scoring.score, timestamp, threshold);
    const isStrongAnomaly = scoring.score >= threshold;
    const learningNewContext = contextIsLearning;
    if (!isStrongAnomaly || advanced.adapt || learningNewContext) {
      this.valueModel.add(value, timestamp, timeContext, weekdayContext);
      if (this.settings.enableContext) {
        this.contextualModel.add(contextKey, value, timestamp, timeContext, weekdayContext);
      }
      if (rate !== void 0) {
        this.rateModel.add(rate, timestamp, timeContext, weekdayContext);
      }
    }
    this.lastValue = value;
    this.lastTimestamp = timestamp;
    this.lastContextKey = this.settings.enableContext === true ? contextKey : void 0;
    const sufficient = this.valueModel.sampleCount >= minSamples;
    const contextSampleCount = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
    return {
      actual: value,
      expected,
      deviation: expected === void 0 ? void 0 : value - expected,
      score: scoring.score,
      detected: this.detected,
      status: contextIsLearning ? "learning" : sufficient ? "monitoring" : this.valueModel.sampleCount === 0 ? "insufficientData" : "learning",
      reason: contextIsLearning && results.length === 0 ? "Insufficient data for the current context" : scoring.reason,
      sampleCount: this.valueModel.sampleCount,
      lastAnomaly: isStrongAnomaly ? timestamp : void 0,
      baselineScope,
      activeContext: formatContextKey(contextKey),
      baselineSampleCount,
      contextSampleCount
    };
  }
  toJSON() {
    return {
      schemaVersion: import_statistics.MODEL_SCHEMA_VERSION,
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
      ...this.advanced.toJSON()
    };
  }
  get hasSufficientData() {
    var _a;
    return this.valueModel.sampleCount >= ((_a = this.settings.minimumSamples) != null ? _a : DEFAULTS.minimumSamples);
  }
  /** Number of retained global value-model samples, capped at the model capacity. */
  get sampleCount() {
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
  bootstrapFromHistory(samples, provider, historySourceId, start, end, configKey) {
    var _a, _b;
    const retained = this.rejectExtremeOutliers(samples);
    const timeContext = (_a = this.settings.timeContext) != null ? _a : true;
    const weekdayContext = (_b = this.settings.weekdayContext) != null ? _b : false;
    let previous;
    for (const sample of retained) {
      this.valueModel.add(sample.value, sample.timestamp, timeContext, weekdayContext);
      if (previous && sample.timestamp > previous.timestamp) {
        const gap = sample.timestamp - previous.timestamp;
        if (gap <= DEFAULTS.maxHistoryGapMinutes * 6e4) {
          this.rateModel.add(
            (sample.value - previous.value) / (gap / 1e3),
            sample.timestamp,
            timeContext,
            weekdayContext
          );
        }
      }
      previous = sample;
    }
    if (previous) {
      this.lastValue = previous.value;
      this.lastTimestamp = previous.timestamp;
      this.repeatedSince = void 0;
    }
    this.bootstrap = {
      completed: true,
      provider,
      historySourceId,
      configKey,
      start,
      end,
      importedSamples: retained.length
    };
    return retained.length;
  }
  reset() {
    var _a, _b, _c;
    this.valueModel = new import_temporal_model.TemporalModel((_a = this.settings.bucketMinutes) != null ? _a : DEFAULTS.bucketMinutes);
    this.rateModel = new import_temporal_model.TemporalModel((_b = this.settings.bucketMinutes) != null ? _b : DEFAULTS.bucketMinutes);
    this.contextualModel = new import_contextual_model.ContextualModel(
      (_c = this.settings.bucketMinutes) != null ? _c : DEFAULTS.bucketMinutes,
      DEFAULTS.maxContextModels
    );
    this.advanced = new import_advanced_detectors.AdvancedDetectors();
    this.lastValue = void 0;
    this.lastTimestamp = void 0;
    this.lastContextKey = void 0;
    this.repeatedSince = void 0;
    this.anomalySince = void 0;
    this.detected = false;
    this.bootstrap = void 0;
  }
  /** @param configKey Import-relevant source configuration. */
  bootstrapMatches(configKey) {
    var _a;
    return ((_a = this.bootstrap) == null ? void 0 : _a.completed) === true && this.bootstrap.configKey === configKey;
  }
  rejectExtremeOutliers(samples) {
    var _a;
    if (samples.length < 5) {
      return [...samples];
    }
    const values = samples.map((sample) => sample.value);
    const center = (0, import_statistics.median)(values);
    if (center === void 0) {
      return [];
    }
    const mad = (_a = (0, import_statistics.median)(values.map((value) => Math.abs(value - center)))) != null ? _a : 0;
    if (mad === 0) {
      return samples.filter((sample) => sample.value === center);
    }
    return samples.filter((sample) => 0.6745 * Math.abs(sample.value - center) / mad <= 7);
  }
  calculateRate(value, timestamp) {
    if (this.lastValue === void 0 || this.lastTimestamp === void 0 || timestamp <= this.lastTimestamp) {
      return void 0;
    }
    return (value - this.lastValue) / ((timestamp - this.lastTimestamp) / 1e3);
  }
  updateRepeated(value, timestamp) {
    if (this.lastValue === void 0 || this.lastValue !== value) {
      this.repeatedSince = timestamp;
    }
  }
  updatePersistentDetection(score, timestamp, threshold) {
    var _a, _b;
    if (this.detected) {
      if (score < Math.max(0, threshold - DEFAULTS.hysteresis)) {
        this.detected = false;
        this.anomalySince = void 0;
      }
      return;
    }
    if (score < threshold) {
      this.anomalySince = void 0;
      return;
    }
    (_a = this.anomalySince) != null ? _a : this.anomalySince = timestamp;
    const requiredDuration = ((_b = this.settings.minimumAnomalyDurationMinutes) != null ? _b : DEFAULTS.minimumAnomalyDurationMinutes) * 6e4;
    if (timestamp - this.anomalySince >= requiredDuration) {
      this.detected = true;
    }
  }
}
function valueDeviationReason(scope) {
  if (scope === "global") {
    return "Value is significantly outside the learned global normal range";
  }
  return "Value is significantly outside the normal range for this time period";
}
function formatContextKey(key) {
  if (!key) {
    return "";
  }
  return key.replace(/=boolean:/g, "=").replace(/=string:/g, "=").replace(/=number:([^:|]+):([^|]+)/g, "=$1\u2013$2");
}
function parseStoredModel(value) {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, model]) => !!model && typeof model === "object" && (model.schemaVersion === 1 || model.schemaVersion === import_statistics.MODEL_SCHEMA_VERSION)
      )
    );
  } catch {
    return {};
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULTS,
  SourceMonitor,
  parseStoredModel
});
//# sourceMappingURL=source-monitor.js.map
