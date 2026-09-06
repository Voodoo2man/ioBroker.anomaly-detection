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
var contextual_model_exports = {};
__export(contextual_model_exports, {
  ContextualModel: () => ContextualModel
});
module.exports = __toCommonJS(contextual_model_exports);
var import_statistics = require("./statistics");
var import_temporal_model = require("./temporal-model");
class ContextualModel {
  constructor(bucketMinutes, maxContexts, maxSamples = import_statistics.DEFAULT_MAX_SAMPLES, data) {
    this.bucketMinutes = bucketMinutes;
    this.maxContexts = maxContexts;
    this.maxSamples = maxSamples;
    var _a;
    for (const [key, entry] of Object.entries((_a = data == null ? void 0 : data.contexts) != null ? _a : {})) {
      if (this.contexts.size >= maxContexts) {
        break;
      }
      this.contexts.set(key, {
        model: new import_temporal_model.TemporalModel(bucketMinutes, maxSamples, entry.model),
        lastUsed: Number.isFinite(entry.lastUsed) ? entry.lastUsed : 0
      });
    }
  }
  contexts = /* @__PURE__ */ new Map();
  baseline(key, timestamp, minimumSamples, useTimeContext, useWeekdayContext) {
    if (!key) {
      return void 0;
    }
    const entry = this.contexts.get(key);
    if (!entry || entry.model.sampleCount < minimumSamples) {
      return void 0;
    }
    entry.lastUsed = timestamp;
    return entry.model.baseline(timestamp, minimumSamples, useTimeContext, useWeekdayContext);
  }
  /**
   * Returns the retained global sample count for one exact context combination.
   *
   * @param key Normalized context combination key.
   */
  sampleCount(key) {
    var _a, _b;
    return key ? (_b = (_a = this.contexts.get(key)) == null ? void 0 : _a.model.sampleCount) != null ? _b : 0 : 0;
  }
  add(key, value, timestamp, useTimeContext, useWeekdayContext) {
    if (!key) {
      return;
    }
    let entry = this.contexts.get(key);
    if (!entry) {
      if (this.contexts.size >= this.maxContexts) {
        const oldest = [...this.contexts.entries()].sort(
          ([leftKey, left], [rightKey, right]) => left.lastUsed - right.lastUsed || leftKey.localeCompare(rightKey)
        )[0];
        if (oldest) {
          this.contexts.delete(oldest[0]);
        }
      }
      entry = { model: new import_temporal_model.TemporalModel(this.bucketMinutes, this.maxSamples), lastUsed: timestamp };
      this.contexts.set(key, entry);
    }
    entry.lastUsed = timestamp;
    entry.model.add(value, timestamp, useTimeContext, useWeekdayContext);
  }
  toJSON() {
    return {
      contexts: Object.fromEntries(
        [...this.contexts].map(([key, entry]) => [
          key,
          { model: entry.model.toJSON(), lastUsed: entry.lastUsed }
        ])
      )
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ContextualModel
});
//# sourceMappingURL=contextual-model.js.map
