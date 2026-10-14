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
var bootstrap_policy_exports = {};
__export(bootstrap_policy_exports, {
  anomalyBootstrapStateUpdate: () => anomalyBootstrapStateUpdate,
  manualRetrainBootstrapNeeds: () => manualRetrainBootstrapNeeds,
  shouldBootstrapPredictiveHistory: () => shouldBootstrapPredictiveHistory
});
module.exports = __toCommonJS(bootstrap_policy_exports);
function anomalyBootstrapStateUpdate(needs, phase, hasSufficientData, autoStartMonitoring = true, importedSamples = 0) {
  if (!needs.anomaly) {
    return void 0;
  }
  if (phase === "started") {
    return { status: "importingHistory", bootstrapStatus: "Importing historical data" };
  }
  if (phase === "completed") {
    return {
      status: hasSufficientData && autoStartMonitoring ? "monitoring" : "learning",
      bootstrapStatus: `Historical training completed (${importedSamples} samples)`
    };
  }
  return {
    status: hasSufficientData ? "monitoring" : "learning",
    bootstrapStatus: "Insufficient historical data, continuing live learning"
  };
}
function shouldBootstrapPredictiveHistory(initialTrainingIsHistory, hasHistoryInstance, modelEnabled, modelNeedsBootstrap) {
  return initialTrainingIsHistory && hasHistoryInstance && modelEnabled && modelNeedsBootstrap;
}
function manualRetrainBootstrapNeeds(initialTrainingIsHistory, hasHistoryInstance, predictiveEnabled, predictiveModelNeedsBootstrap) {
  return {
    anomaly: true,
    predictive: shouldBootstrapPredictiveHistory(
      initialTrainingIsHistory,
      hasHistoryInstance,
      predictiveEnabled,
      predictiveModelNeedsBootstrap
    )
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  anomalyBootstrapStateUpdate,
  manualRetrainBootstrapNeeds,
  shouldBootstrapPredictiveHistory
});
//# sourceMappingURL=bootstrap-policy.js.map
