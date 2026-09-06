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
var temporal_model_exports = {};
__export(temporal_model_exports, {
  TemporalModel: () => TemporalModel
});
module.exports = __toCommonJS(temporal_model_exports);
var import_statistics = require("./statistics");
class TemporalModel {
  constructor(bucketMinutes, maxSamples = import_statistics.DEFAULT_MAX_SAMPLES, data) {
    this.bucketMinutes = bucketMinutes;
    this.maxSamples = maxSamples;
    var _a, _b;
    this.global = new import_statistics.SampleSeries(maxSamples, data == null ? void 0 : data.global.values);
    for (const [key, series] of Object.entries((_a = data == null ? void 0 : data.timeBuckets) != null ? _a : {})) {
      this.timeBuckets.set(key, new import_statistics.SampleSeries(maxSamples, series.values));
    }
    for (const [key, series] of Object.entries((_b = data == null ? void 0 : data.contextBuckets) != null ? _b : {})) {
      this.contextBuckets.set(key, new import_statistics.SampleSeries(maxSamples, series.values));
    }
  }
  global;
  timeBuckets = /* @__PURE__ */ new Map();
  contextBuckets = /* @__PURE__ */ new Map();
  add(value, timestamp, useTimeContext, useWeekdayContext) {
    this.global.add(value);
    if (!useTimeContext) {
      return;
    }
    const timeKey = this.getTimeKey(timestamp);
    this.getOrCreate(this.timeBuckets, timeKey).add(value);
    if (useWeekdayContext) {
      this.getOrCreate(this.contextBuckets, `${this.getDayKey(timestamp)}:${timeKey}`).add(value);
    }
  }
  baseline(timestamp, minSamples, useTimeContext, useWeekdayContext) {
    if (useTimeContext) {
      const timeKey = this.getTimeKey(timestamp);
      if (useWeekdayContext) {
        const contextual = this.contextBuckets.get(`${this.getDayKey(timestamp)}:${timeKey}`);
        if (contextual && contextual.count >= minSamples) {
          return { series: contextual, scope: "context" };
        }
      }
      const time = this.timeBuckets.get(timeKey);
      if (time && time.count >= minSamples) {
        return { series: time, scope: "time" };
      }
    }
    return { series: this.global, scope: "global" };
  }
  get sampleCount() {
    return this.global.count;
  }
  toJSON() {
    return {
      global: this.global.toJSON(),
      timeBuckets: Object.fromEntries([...this.timeBuckets].map(([key, value]) => [key, value.toJSON()])),
      contextBuckets: Object.fromEntries([...this.contextBuckets].map(([key, value]) => [key, value.toJSON()]))
    };
  }
  getOrCreate(map, key) {
    let series = map.get(key);
    if (!series) {
      series = new import_statistics.SampleSeries(this.maxSamples);
      map.set(key, series);
    }
    return series;
  }
  getTimeKey(timestamp) {
    const date = new Date(timestamp);
    return String(Math.floor((date.getHours() * 60 + date.getMinutes()) / this.bucketMinutes));
  }
  getDayKey(timestamp) {
    return String(new Date(timestamp).getDay());
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TemporalModel
});
//# sourceMappingURL=temporal-model.js.map
