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
var scoring_exports = {};
__export(scoring_exports, {
  scoreDetectors: () => scoreDetectors
});
module.exports = __toCommonJS(scoring_exports);
var import_statistics = require("./model/statistics");
const WEIGHTS = {
  value: 0.5,
  context: 0.5,
  rate: 0.3,
  stuck: 0.2,
  changePoint: 0.45,
  trend: 0.35
};
const BEHAVIOR_DETECTORS = /* @__PURE__ */ new Set(["value", "context", "changePoint", "trend"]);
function scoreDetectors(results) {
  var _a;
  if (results.length === 0) {
    return {
      score: 0,
      reason: "Insufficient data for anomaly detection",
      reasonCode: "insufficient_training_data",
      detectors: []
    };
  }
  const behavior = results.filter((result) => BEHAVIOR_DETECTORS.has(result.name));
  const selected = [
    ...behavior.length ? [behavior.reduce((best, result) => result.score > best.score ? result : best)] : [],
    ...results.filter((result) => !BEHAVIOR_DETECTORS.has(result.name))
  ];
  const weight = selected.reduce((total, result) => total + WEIGHTS[result.name], 0);
  const weightedScore = selected.reduce((total, result) => total + result.score * WEIGHTS[result.name], 0) / weight;
  const strong = selected.filter((result) => result.score >= 50);
  const score = (0, import_statistics.clamp)(weightedScore + (strong.length >= 2 ? 10 : 0), 0, 100);
  if (score < 50) {
    return { score, reason: "Normal", reasonCode: "normal", detectors: selected.map(toDiagnostic) };
  }
  const reason = strong.length >= 2 ? "Multiple anomaly detectors agree" : selected.reduce((best, result) => result.score > best.score ? result : best).reason;
  const primary = selected.reduce((best, result) => result.score > best.score ? result : best);
  return {
    score,
    reason,
    reasonCode: strong.length >= 2 ? "multiple_detectors" : (_a = primary.reasonCode) != null ? _a : "unexpected_value",
    detectors: selected.map(toDiagnostic)
  };
}
function toDiagnostic(result) {
  var _a;
  return { name: result.name, score: result.score, reasonCode: (_a = result.reasonCode) != null ? _a : fallbackReasonCode(result.name) };
}
function fallbackReasonCode(name) {
  const codes = {
    value: "unexpected_value",
    context: "context_deviation",
    rate: "unexpected_rate_change",
    stuck: "stuck_value",
    changePoint: "persistent_level_shift",
    trend: "unusual_trend"
  };
  return codes[name];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  scoreDetectors
});
//# sourceMappingURL=scoring.js.map
