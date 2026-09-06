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
var statistics_exports = {};
__export(statistics_exports, {
  DEFAULT_MAX_SAMPLES: () => DEFAULT_MAX_SAMPLES,
  MODEL_SCHEMA_VERSION: () => MODEL_SCHEMA_VERSION,
  SampleSeries: () => SampleSeries,
  clamp: () => clamp,
  median: () => median
});
module.exports = __toCommonJS(statistics_exports);
const MODEL_SCHEMA_VERSION = 2;
const DEFAULT_MAX_SAMPLES = 240;
class SampleSeries {
  constructor(maxSamples = DEFAULT_MAX_SAMPLES, values = []) {
    this.maxSamples = maxSamples;
    this.values = values.filter(Number.isFinite).slice(-maxSamples);
  }
  values;
  add(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    this.values.push(value);
    if (this.values.length > this.maxSamples) {
      this.values.splice(0, this.values.length - this.maxSamples);
    }
  }
  get count() {
    return this.values.length;
  }
  median() {
    return median(this.values);
  }
  mad() {
    const center = this.median();
    return center === void 0 ? void 0 : median(this.values.map((value) => Math.abs(value - center)));
  }
  toJSON() {
    return { values: [...this.values] };
  }
}
function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) {
    return void 0;
  }
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[middle - 1] + finite[middle]) / 2 : finite[middle];
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_MAX_SAMPLES,
  MODEL_SCHEMA_VERSION,
  SampleSeries,
  clamp,
  median
});
//# sourceMappingURL=statistics.js.map
