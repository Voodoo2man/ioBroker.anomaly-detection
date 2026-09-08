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
var advanced_detectors_exports = {};
__export(advanced_detectors_exports, {
  AdvancedDetectors: () => AdvancedDetectors
});
module.exports = __toCommonJS(advanced_detectors_exports);
var import_statistics = require("./model/statistics");
const MAX_RECENT = 48;
const MIN_RECENT = 12;
const MIN_TREND_SPAN_MS = 6 * 60 * 60 * 1e3;
class AdvancedDetectors {
  recentChange;
  recentTrend;
  candidateDirection;
  candidateCount;
  constructor(change, trend) {
    this.recentChange = sanitize(change == null ? void 0 : change.recent);
    this.recentTrend = sanitize(trend == null ? void 0 : trend.recent);
    this.candidateDirection = change == null ? void 0 : change.candidateDirection;
    this.candidateCount = Number.isInteger(change == null ? void 0 : change.candidateCount) ? Math.max(0, change.candidateCount) : 0;
  }
  observe(residual, timestamp, longMedian, longMad, enableChangePoint, enableTrend, sensitivity) {
    if (residual === void 0 || !Number.isFinite(residual)) {
      return { adapt: false };
    }
    if (enableChangePoint) {
      append(this.recentChange, { value: residual, timestamp });
    }
    if (enableTrend) {
      append(this.recentTrend, { value: residual, timestamp });
    }
    const changePoint = enableChangePoint ? this.detectChangePoint(longMedian, longMad, sensitivity) : void 0;
    const trend = enableTrend ? this.detectTrend(sensitivity) : void 0;
    return { changePoint, trend, adapt: changePoint !== void 0 };
  }
  toJSON() {
    return {
      changePoint: {
        recent: [...this.recentChange],
        candidateDirection: this.candidateDirection,
        candidateCount: this.candidateCount
      },
      trend: { recent: [...this.recentTrend] }
    };
  }
  detectChangePoint(longMedian, longMad, sensitivity) {
    if (this.recentChange.length < MIN_RECENT || longMedian === void 0 || longMad === void 0) {
      this.resetCandidate();
      return void 0;
    }
    const recentMedian = (0, import_statistics.median)(this.recentChange.slice(-MIN_RECENT).map((sample) => sample.value));
    if (recentMedian === void 0) {
      return void 0;
    }
    const delta = recentMedian - longMedian;
    const scale = Math.max(longMad, 1e-9);
    const normalized = Math.abs(delta) / scale;
    if (normalized < sensitivity) {
      this.resetCandidate();
      return void 0;
    }
    const direction = delta >= 0 ? "upward" : "downward";
    this.candidateCount = this.candidateDirection === direction ? this.candidateCount + 1 : 1;
    this.candidateDirection = direction;
    if (this.candidateCount < 3) {
      return void 0;
    }
    return {
      name: "changePoint",
      score: (0, import_statistics.clamp)(normalized / sensitivity * 80, 70, 100),
      reason: `Persistent ${direction} level shift detected`,
      reasonCode: "persistent_level_shift"
    };
  }
  detectTrend(sensitivity) {
    var _a, _b;
    if (this.recentTrend.length < MIN_RECENT) {
      return void 0;
    }
    const first = this.recentTrend[0];
    const last = this.recentTrend[this.recentTrend.length - 1];
    const span = last.timestamp - first.timestamp;
    if (span < MIN_TREND_SPAN_MS) {
      return void 0;
    }
    const slopes = [];
    for (let left = 0; left < this.recentTrend.length; left++) {
      for (let right = left + 1; right < this.recentTrend.length; right++) {
        const elapsed = this.recentTrend[right].timestamp - this.recentTrend[left].timestamp;
        if (elapsed > 0) {
          slopes.push((this.recentTrend[right].value - this.recentTrend[left].value) / elapsed);
        }
      }
    }
    const slope = (0, import_statistics.median)(slopes);
    const center = (_a = (0, import_statistics.median)(this.recentTrend.map((sample) => sample.value))) != null ? _a : 0;
    const residualMad = (_b = (0, import_statistics.median)(this.recentTrend.map((sample) => Math.abs(sample.value - center)))) != null ? _b : 0;
    if (slope === void 0) {
      return void 0;
    }
    const normalized = Math.abs(slope * span) / Math.max(residualMad, 1e-9);
    if (normalized < sensitivity) {
      return void 0;
    }
    const direction = slope >= 0 ? "upward" : "downward";
    return {
      name: "trend",
      score: (0, import_statistics.clamp)(normalized / sensitivity * 60, 55, 95),
      reason: `Sustained ${direction} trend outside normal behavior`,
      reasonCode: "unusual_trend"
    };
  }
  resetCandidate() {
    this.candidateDirection = void 0;
    this.candidateCount = 0;
  }
}
function append(target, value) {
  if (target.length > 0 && value.timestamp <= target[target.length - 1].timestamp) {
    return;
  }
  target.push(value);
  if (target.length > MAX_RECENT) {
    target.splice(0, target.length - MAX_RECENT);
  }
}
function sanitize(values) {
  return (values != null ? values : []).filter((sample) => Number.isFinite(sample.value) && Number.isFinite(sample.timestamp)).sort((left, right) => left.timestamp - right.timestamp).slice(-MAX_RECENT);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdvancedDetectors
});
//# sourceMappingURL=advanced-detectors.js.map
