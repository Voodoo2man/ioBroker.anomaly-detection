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
var detectors_exports = {};
__export(detectors_exports, {
  detectMadDeviation: () => detectMadDeviation,
  detectRateDeviation: () => detectRateDeviation,
  detectStuck: () => detectStuck
});
module.exports = __toCommonJS(detectors_exports);
var import_statistics = require("./model/statistics");
function detectMadDeviation(value, series, minimumSamples, sensitivity) {
  if (series.count < minimumSamples) {
    return void 0;
  }
  const median = series.median();
  const mad = series.mad();
  if (median === void 0 || mad === void 0) {
    return void 0;
  }
  const deviation = Math.abs(value - median);
  const robustZ = mad === 0 ? deviation === 0 ? 0 : Number.POSITIVE_INFINITY : 0.6745 * deviation / mad;
  const score = robustZ === Number.POSITIVE_INFINITY ? 100 : (0, import_statistics.clamp)(robustZ / sensitivity * 100, 0, 100);
  return {
    name: "value",
    score,
    reason: "Value is significantly outside the normal range for this time period",
    reasonCode: "unexpected_value"
  };
}
function detectRateDeviation(rate, series, minimumSamples, sensitivity) {
  if (rate === void 0 || !Number.isFinite(rate) || series.count < minimumSamples) {
    return void 0;
  }
  const median = series.median();
  const mad = series.mad();
  if (median === void 0 || mad === void 0) {
    return void 0;
  }
  const deviation = Math.abs(rate - median);
  const robustZ = mad === 0 ? deviation === 0 ? 0 : Number.POSITIVE_INFINITY : 0.6745 * deviation / mad;
  const score = robustZ === Number.POSITIVE_INFINITY ? 100 : (0, import_statistics.clamp)(robustZ / sensitivity * 100, 0, 100);
  return { name: "rate", score, reason: "Rate of change is unusually high", reasonCode: "unexpected_rate_change" };
}
function detectStuck(repeatedSince, timestamp, stuckDurationMinutes) {
  if (repeatedSince === void 0 || timestamp < repeatedSince) {
    return void 0;
  }
  const duration = timestamp - repeatedSince;
  const limit = stuckDurationMinutes * 6e4;
  if (limit <= 0 || duration < limit) {
    return void 0;
  }
  return {
    name: "stuck",
    score: (0, import_statistics.clamp)(duration / limit * 50, 50, 100),
    reason: "Value has remained unchanged significantly longer than configured",
    reasonCode: "stuck_value"
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  detectMadDeviation,
  detectRateDeviation,
  detectStuck
});
//# sourceMappingURL=detectors.js.map
