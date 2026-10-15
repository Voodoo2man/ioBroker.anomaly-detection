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
  decisionRangeFor: () => decisionRangeFor,
  evaluateCurrentSourceValue: () => evaluateCurrentSourceValue,
  parseStoredModel: () => parseStoredModel,
  unavailableObservation: () => unavailableObservation
});
module.exports = __toCommonJS(source_monitor_exports);
var import_advanced_detectors = require("./advanced-detectors");
var import_detectors = require("./detectors");
var import_contextual_model = require("./model/contextual-model");
var import_statistics = require("./model/statistics");
var import_temporal_model = require("./model/temporal-model");
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
function unavailableObservation(sampleCount, requiredSamples, timestamp) {
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
    lastEvaluated: timestamp
  };
}
function evaluateCurrentSourceValue(monitor, value, timestamp, contextKey, requiredSamples, evaluatedAt) {
  if (timestamp !== void 0 && Number.isFinite(timestamp) && !monitor.isStaleTimestamp(timestamp) && typeof value === "number" && Number.isFinite(value)) {
    const result = monitor.evaluateCurrent(value, timestamp, contextKey);
    if (result) {
      return result;
    }
  }
  return unavailableObservation(monitor.sampleCount, requiredSamples, evaluatedAt);
}
class SourceMonitor {
  /**
   *
   * @param settings
   * @param data
   */
  constructor(settings, data) {
    this.settings = settings;
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const bucketMinutes = (_a = settings.bucketMinutes) != null ? _a : DEFAULTS.bucketMinutes;
    this.valueModel = new import_temporal_model.TemporalModel(bucketMinutes, void 0, data == null ? void 0 : data.value);
    this.rateModel = new import_temporal_model.TemporalModel(bucketMinutes, void 0, data == null ? void 0 : data.rate);
    this.contextualRateModel = new import_contextual_model.ContextualModel(
      bucketMinutes,
      DEFAULTS.maxContextModels,
      void 0,
      data == null ? void 0 : data.contextualRate
    );
    this.contextualModel = new import_contextual_model.ContextualModel(bucketMinutes, DEFAULTS.maxContextModels, void 0, data == null ? void 0 : data.context);
    for (const [scope, saved] of Object.entries((_b = data == null ? void 0 : data.scopedStates) != null ? _b : {})) {
      if (scope === "global") {
        continue;
      }
      this.scopedStates.set(scope, {
        advanced: new import_advanced_detectors.AdvancedDetectors(saved.advanced.changePoint, saved.advanced.trend),
        lastUsed: saved.lastUsed,
        anomalySince: saved.anomalySince,
        detected: saved.detected
      });
    }
    const savedGlobal = (_c = data == null ? void 0 : data.scopedStates) == null ? void 0 : _c.global;
    this.scopedStates.set("global", {
      advanced: new import_advanced_detectors.AdvancedDetectors(
        (_d = savedGlobal == null ? void 0 : savedGlobal.advanced.changePoint) != null ? _d : data == null ? void 0 : data.changePoint,
        (_e = savedGlobal == null ? void 0 : savedGlobal.advanced.trend) != null ? _e : data == null ? void 0 : data.trend
      ),
      lastUsed: (_f = savedGlobal == null ? void 0 : savedGlobal.lastUsed) != null ? _f : 0,
      anomalySince: (_g = savedGlobal == null ? void 0 : savedGlobal.anomalySince) != null ? _g : data == null ? void 0 : data.anomalySince,
      detected: (_i = (_h = savedGlobal == null ? void 0 : savedGlobal.detected) != null ? _h : data == null ? void 0 : data.detected) != null ? _i : false
    });
    this.activeStateScope = (data == null ? void 0 : data.activeStateScope) && this.scopedStates.has(data.activeStateScope) ? data.activeStateScope : "global";
    this.lastValue = data == null ? void 0 : data.lastValue;
    this.lastTimestamp = data == null ? void 0 : data.lastTimestamp;
    this.lastContextKey = data == null ? void 0 : data.lastContextKey;
    this.repeatedSince = data == null ? void 0 : data.repeatedSince;
    this.lastNormal = data == null ? void 0 : data.lastNormal;
    this.bootstrap = data == null ? void 0 : data.bootstrap;
    this.diagnostics = ((_j = data == null ? void 0 : data.diagnostics) != null ? _j : []).slice(-500);
  }
  valueModel;
  rateModel;
  contextualRateModel;
  contextualModel;
  scopedStates = /* @__PURE__ */ new Map();
  activeStateScope = "global";
  lastValue;
  lastTimestamp;
  lastContextKey;
  repeatedSince;
  lastNormal;
  bootstrap;
  diagnostics;
  /**
   *
   * @param value
   * @param timestamp
   * @param contextKey
   * @param learn Whether the observation updates training and timestamp state.
   */
  observe(value, timestamp, contextKey, learn = true) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return void 0;
    }
    const isNewSample = learn && this.isNewTimestamp(timestamp);
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
    const stateScope = contextBaseline && contextKey ? contextKey : this.settings.enableContext ? `fallback:${baseline.scope}` : "global";
    const state = isNewSample ? this.getScopedState(stateScope, timestamp) : (_f = this.scopedStates.get(stateScope)) != null ? _f : {
      advanced: new import_advanced_detectors.AdvancedDetectors(),
      lastUsed: timestamp,
      detected: false
    };
    if (isNewSample && stateScope !== this.activeStateScope) {
      state.anomalySince = void 0;
      state.detected = false;
      this.activeStateScope = stateScope;
    }
    const baselineScope = contextBaseline ? "context" : contextIsLearning ? "insufficient" : baseline.scope === "global" ? "global" : "time";
    const baselineSampleCount = contextIsLearning ? 0 : baseline.series.count;
    const expected = contextIsLearning ? void 0 : baseline.series.median();
    const expectedRange = expected === void 0 ? void 0 : expectedRangeFor(expected, baseline.series.mad(), sensitivity);
    const decisionRange = expected === void 0 ? void 0 : decisionRangeFor(expected, baseline.series.mad(), sensitivity, threshold);
    const contextChanged = this.settings.enableContext === true && contextKey !== this.lastContextKey;
    const rate = contextChanged ? void 0 : this.calculateRate(value, timestamp);
    const results = [];
    if (((_g = this.settings.enableMad) != null ? _g : true) && !contextIsLearning) {
      const result = (0, import_detectors.detectMadDeviation)(value, baseline.series, minSamples, sensitivity);
      if (result) {
        results.push(
          contextBaseline ? {
            ...result,
            name: "context",
            reason: "Value is significantly outside the normal range for the current context",
            reasonCode: "context_deviation"
          } : { ...result, reason: valueDeviationReason(baselineScope) }
        );
      }
    }
    if (((_h = this.settings.enableRate) != null ? _h : true) && !contextIsLearning) {
      const rateBaseline = hasActiveContext ? this.contextualRateModel.baseline(contextKey, timestamp, minSamples, timeContext, weekdayContext) : this.rateModel.baseline(timestamp, minSamples, timeContext, weekdayContext);
      const result = rateBaseline ? (0, import_detectors.detectRateDeviation)(rate, rateBaseline.series, minSamples, sensitivity) : void 0;
      if (result) {
        results.push(result);
      }
    }
    if (isNewSample) {
      this.updateRepeated(value, timestamp);
    }
    if ((_i = this.settings.enableStuck) != null ? _i : false) {
      const result = (0, import_detectors.detectStuck)(
        this.repeatedSince,
        timestamp,
        (_j = this.settings.stuckDurationMinutes) != null ? _j : DEFAULTS.stuckDurationMinutes
      );
      if (result) {
        results.push(result);
      }
    }
    const advanced = isNewSample ? state.advanced.observe(
      expected === void 0 ? void 0 : value - expected,
      timestamp,
      0,
      baseline.series.mad(),
      this.settings.enableChangePoint === true,
      this.settings.enableTrend === true,
      sensitivity
    ) : void 0;
    if (advanced == null ? void 0 : advanced.changePoint) {
      results.push(advanced.changePoint);
    }
    if (advanced == null ? void 0 : advanced.trend) {
      results.push(advanced.trend);
    }
    const scoring = (0, import_scoring.scoreDetectors)(results);
    if (isNewSample) {
      this.updatePersistentDetection(state, scoring.score, timestamp, threshold);
    }
    const isStrongAnomaly = scoring.score >= threshold;
    const learningNewContext = contextIsLearning;
    if (isNewSample && (!isStrongAnomaly || (advanced == null ? void 0 : advanced.adapt) || learningNewContext)) {
      this.valueModel.add(value, timestamp, timeContext, weekdayContext);
      if (this.settings.enableContext) {
        this.contextualModel.add(contextKey, value, timestamp, timeContext, weekdayContext);
      }
      if (rate !== void 0) {
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
      this.lastContextKey = this.settings.enableContext === true ? contextKey : void 0;
    }
    const sufficient = this.valueModel.sampleCount >= minSamples;
    const contextSampleCount = hasActiveContext ? this.contextualModel.sampleCount(contextKey) : 0;
    const relevantSampleScope = hasActiveContext ? "context" : baselineScope;
    const relevantSampleCount = hasActiveContext ? contextSampleCount : baseline.series.count;
    const statusCode = contextIsLearning ? "learning" : !sufficient ? "insufficient_data" : isStrongAnomaly ? state.detected ? "anomaly" : "deviating" : "normal";
    const observation = {
      actual: value,
      expected,
      deviation: expected === void 0 ? void 0 : finiteOrUndefined(value - expected),
      score: scoring.score,
      detected: state.detected,
      status: contextIsLearning ? "learning" : sufficient ? "monitoring" : this.valueModel.sampleCount === 0 ? "insufficientData" : "learning",
      reason: contextIsLearning && results.length === 0 ? "Insufficient data for the current context" : scoring.reason,
      sampleCount: this.valueModel.sampleCount,
      lastAnomaly: isStrongAnomaly ? timestamp : void 0,
      baselineScope,
      activeContext: formatContextKey(contextKey),
      baselineSampleCount,
      contextSampleCount,
      relevantSampleCount,
      relevantSampleScope,
      evaluationAvailable: !contextIsLearning && sufficient,
      requiredSamples: minSamples,
      statusCode,
      severity: statusCode === "anomaly" ? scoring.score >= 85 ? "high" : "noticeable" : "normal",
      reasonCode: contextIsLearning ? "insufficient_training_data" : scoring.reasonCode,
      detectors: scoring.detectors,
      lastEvaluated: timestamp,
      anomalySince: (_k = this.scopedStates.get(this.activeStateScope)) == null ? void 0 : _k.anomalySince,
      lastNormal: this.lastNormal,
      expectedLow: expectedRange == null ? void 0 : expectedRange.low,
      expectedHigh: expectedRange == null ? void 0 : expectedRange.high,
      decisionLow: decisionRange == null ? void 0 : decisionRange.low,
      decisionHigh: decisionRange == null ? void 0 : decisionRange.high,
      timeBucket: baseline.scope === "global" ? void 0 : String(
        Math.floor(
          (new Date(timestamp).getHours() * 60 + new Date(timestamp).getMinutes()) / ((_l = this.settings.bucketMinutes) != null ? _l : DEFAULTS.bucketMinutes)
        )
      )
    };
    if (isNewSample) {
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
        activeContext: observation.activeContext
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
  toJSON() {
    var _a, _b, _c, _d, _e;
    return {
      schemaVersion: import_statistics.MODEL_SCHEMA_VERSION,
      value: this.valueModel.toJSON(),
      rate: this.rateModel.toJSON(),
      lastValue: this.lastValue,
      lastTimestamp: this.lastTimestamp,
      lastContextKey: this.lastContextKey,
      repeatedSince: this.repeatedSince,
      // Preserve legacy global fields while also persisting the bounded scoped state.
      anomalySince: (_a = this.scopedStates.get("global")) == null ? void 0 : _a.anomalySince,
      lastNormal: this.lastNormal,
      detected: (_c = (_b = this.scopedStates.get("global")) == null ? void 0 : _b.detected) != null ? _c : false,
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
            detected: state.detected
          }
        ])
      ),
      activeStateScope: this.activeStateScope,
      ...(_e = (_d = this.scopedStates.get("global")) == null ? void 0 : _d.advanced.toJSON()) != null ? _e : {
        changePoint: { recent: [], candidateCount: 0 },
        trend: { recent: [] }
      },
      diagnostics: [...this.diagnostics]
    };
  }
  /**
   *
   */
  get hasSufficientData() {
    var _a;
    return this.valueModel.sampleCount >= ((_a = this.settings.minimumSamples) != null ? _a : DEFAULTS.minimumSamples);
  }
  /** Whether a timestamp is newer than the last learned sample. */
  isNewTimestamp(timestamp) {
    return Number.isFinite(timestamp) && (this.lastTimestamp === void 0 || timestamp > this.lastTimestamp);
  }
  /** Whether a timestamp predates the last learned sample. */
  isStaleTimestamp(timestamp) {
    return Number.isFinite(timestamp) && this.lastTimestamp !== void 0 && timestamp < this.lastTimestamp;
  }
  /** Number of retained global value-model samples, capped at the model capacity. */
  get sampleCount() {
    return this.valueModel.sampleCount;
  }
  /**
   * Evaluates a current value against the model without treating it as a new training event.
   *
   * @param value Current value to evaluate.
   * @param timestamp Timestamp associated with the current value.
   * @param contextKey Optional context used to select the baseline.
   */
  evaluateCurrent(value, timestamp, contextKey) {
    return this.observe(value, timestamp, contextKey, false);
  }
  /**
   *
   */
  get diagnosticSnapshots() {
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
  replaceFromHistory(samples, provider, historySourceId, start, end, configKey) {
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
  reset() {
    var _a, _b, _c, _d;
    this.valueModel = new import_temporal_model.TemporalModel((_a = this.settings.bucketMinutes) != null ? _a : DEFAULTS.bucketMinutes);
    this.rateModel = new import_temporal_model.TemporalModel((_b = this.settings.bucketMinutes) != null ? _b : DEFAULTS.bucketMinutes);
    this.contextualRateModel = new import_contextual_model.ContextualModel(
      (_c = this.settings.bucketMinutes) != null ? _c : DEFAULTS.bucketMinutes,
      DEFAULTS.maxContextModels
    );
    this.contextualModel = new import_contextual_model.ContextualModel(
      (_d = this.settings.bucketMinutes) != null ? _d : DEFAULTS.bucketMinutes,
      DEFAULTS.maxContextModels
    );
    this.scopedStates.clear();
    this.scopedStates.set("global", { advanced: new import_advanced_detectors.AdvancedDetectors(), lastUsed: 0, detected: false });
    this.activeStateScope = "global";
    this.lastValue = void 0;
    this.lastTimestamp = void 0;
    this.lastContextKey = void 0;
    this.repeatedSince = void 0;
    this.lastNormal = void 0;
    this.bootstrap = void 0;
    this.diagnostics = [];
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
  updatePersistentDetection(state, score, timestamp, threshold) {
    var _a, _b;
    if (state.detected) {
      if (score < Math.max(0, threshold - DEFAULTS.hysteresis)) {
        state.detected = false;
        state.anomalySince = void 0;
      }
      return;
    }
    if (score < threshold) {
      state.anomalySince = void 0;
      return;
    }
    (_a = state.anomalySince) != null ? _a : state.anomalySince = timestamp;
    const requiredDuration = ((_b = this.settings.minimumAnomalyDurationMinutes) != null ? _b : DEFAULTS.minimumAnomalyDurationMinutes) * 6e4;
    if (state.anomalySince !== void 0 && timestamp - state.anomalySince >= requiredDuration) {
      state.detected = true;
    }
  }
  getScopedState(scope, timestamp) {
    let state = this.scopedStates.get(scope);
    if (!state) {
      if (this.scopedStates.size >= DEFAULTS.maxContextModels + 1) {
        const removable = [...this.scopedStates.entries()].filter(([key]) => key !== "global" && key !== this.activeStateScope).sort(([, left], [, right]) => left.lastUsed - right.lastUsed)[0];
        if (removable) {
          this.scopedStates.delete(removable[0]);
        }
      }
      state = { advanced: new import_advanced_detectors.AdvancedDetectors(), lastUsed: timestamp, detected: false };
      this.scopedStates.set(scope, state);
    }
    state.lastUsed = timestamp;
    return state;
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
function expectedRangeFor(medianValue, mad, sensitivity) {
  if (!Number.isFinite(medianValue) || !Number.isFinite(mad) || mad === void 0 || mad < 0) {
    return void 0;
  }
  const halfWidth = sensitivity * mad / 0.6745;
  const low = medianValue - halfWidth;
  const high = medianValue + halfWidth;
  return Number.isFinite(low) && Number.isFinite(high) ? { low, high } : void 0;
}
function decisionRangeFor(medianValue, mad, sensitivity, threshold) {
  if (!Number.isFinite(medianValue) || !Number.isFinite(mad) || mad === void 0 || mad < 0 || sensitivity <= 0) {
    return void 0;
  }
  const halfWidth = sensitivity * (threshold / 100) * mad / 0.6745;
  const low = medianValue - halfWidth;
  const high = medianValue + halfWidth;
  return Number.isFinite(low) && Number.isFinite(high) ? { low, high } : void 0;
}
function finiteOrUndefined(value) {
  return Number.isFinite(value) ? value : void 0;
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
      Object.entries(parsed).filter(([, model]) => isSourceModelData(model))
    );
  } catch {
    return {};
  }
}
function isSourceModelData(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 && value.schemaVersion !== import_statistics.MODEL_SCHEMA_VERSION) {
    return false;
  }
  if (!isTemporalModelData(value.value) || !isTemporalModelData(value.rate)) {
    return false;
  }
  if (!isOptional(value, "context", isContextualModelData) || !isOptional(value, "contextualRate", isContextualModelData) || !isOptional(value, "changePoint", isChangePointData) || !isOptional(value, "trend", isTrendData) || !isOptional(value, "activeStateScope", isString)) {
    return false;
  }
  if (!isOptional(value, "scopedStates", isScopedStateRecord)) {
    return false;
  }
  if (isString(value.activeStateScope) && isRecord(value.scopedStates) && !Object.hasOwn(value.scopedStates, value.activeStateScope)) {
    return false;
  }
  if (!isOptional(value, "lastValue", isFiniteNumber) || !isOptional(value, "lastTimestamp", isFiniteNumber) || !isOptional(value, "repeatedSince", isFiniteNumber) || !isOptional(value, "anomalySince", isFiniteNumber) || !isOptional(value, "lastNormal", isFiniteNumber) || !isOptional(value, "detected", isBoolean) || !isOptional(value, "lastContextKey", isString) || !isOptional(value, "configuredSourceId", isString) || !isOptional(value, "bootstrap", isBootstrapMetadata)) {
    return false;
  }
  return isOptional(value, "diagnostics", isDiagnosticSnapshotArray);
}
function isScopedStateRecord(value) {
  if (!isRecord(value)) {
    return false;
  }
  const scopes = Object.entries(value);
  return Object.hasOwn(value, "global") && scopes.length <= DEFAULTS.maxContextModels + 1 && scopes.every(([, state]) => isPersistedScopedState(state));
}
function isContextualModelData(value) {
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
function isTemporalModelData(value) {
  if (!isRecord(value) || !isSampleSeriesData(value.global)) {
    return false;
  }
  if (!isOptional(value, "timeBuckets", isSampleSeriesRecord)) {
    return false;
  }
  return isOptional(value, "contextBuckets", isSampleSeriesRecord);
}
function isSampleSeriesRecord(value) {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((series) => isSampleSeriesData(series));
}
function isSampleSeriesData(value) {
  return isRecord(value) && Array.isArray(value.values) && value.values.every(isFiniteNumber);
}
function isChangePointData(value) {
  if (!isRecord(value) || !Array.isArray(value.recent) || !value.recent.every(isTimedResidual)) {
    return false;
  }
  if (value.candidateDirection !== void 0 && value.candidateDirection !== "upward" && value.candidateDirection !== "downward") {
    return false;
  }
  return isFiniteNumber(value.candidateCount) && Number.isInteger(value.candidateCount) && value.candidateCount >= 0;
}
function isTrendData(value) {
  if (!isRecord(value) || !Array.isArray(value.recent)) {
    return false;
  }
  return value.recent.every(isTimedResidual);
}
function isTimedResidual(value) {
  if (!isRecord(value)) {
    return false;
  }
  return isFiniteNumber(value.value) && isFiniteNumber(value.timestamp);
}
function isPersistedScopedState(value) {
  if (!isRecord(value) || !isRecord(value.advanced)) {
    return false;
  }
  if (!isChangePointData(value.advanced.changePoint) || !isTrendData(value.advanced.trend)) {
    return false;
  }
  return isFiniteNumber(value.lastUsed) && isBoolean(value.detected) && isOptional(value, "anomalySince", isFiniteNumber);
}
function isBootstrapMetadata(value) {
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
function isDiagnosticSnapshot(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.timestamp) || !isFiniteNumber(value.actual) || !isFiniteNumber(value.score)) {
    return false;
  }
  if (!isOptional(value, "expected", isFiniteNumber) || !isOptional(value, "decisionLow", isFiniteNumber)) {
    return false;
  }
  if (!isOptional(value, "decisionHigh", isFiniteNumber) || !isBoolean(value.detected) || !isString(value.reasonCode)) {
    return false;
  }
  if (!isString(value.activeContext) || !isFiniteNumber(value.baselineSampleCount)) {
    return false;
  }
  if (!["context", "time", "global", "insufficient"].includes(value.baselineScope)) {
    return false;
  }
  return value.statusCode === void 0 || ["learning", "normal", "deviating", "anomaly", "insufficient_data", "unavailable"].includes(
    value.statusCode
  );
}
function isDiagnosticSnapshotArray(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((entry) => isDiagnosticSnapshot(entry));
}
function isOptional(value, key, guard) {
  return value[key] === void 0 || guard(value[key]);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isString(value) {
  return typeof value === "string";
}
function isBoolean(value) {
  return typeof value === "boolean";
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULTS,
  SourceMonitor,
  decisionRangeFor,
  evaluateCurrentSourceValue,
  parseStoredModel,
  unavailableObservation
});
//# sourceMappingURL=source-monitor.js.map
