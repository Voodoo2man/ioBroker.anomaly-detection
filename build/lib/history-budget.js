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
var history_budget_exports = {};
__export(history_budget_exports, {
  HistoryLoadBudget: () => HistoryLoadBudget,
  MAX_HISTORY_LOAD_MS: () => MAX_HISTORY_LOAD_MS,
  MAX_HISTORY_PROVIDER_CALLS: () => MAX_HISTORY_PROVIDER_CALLS,
  retainEvenlySpacedHistory: () => retainEvenlySpacedHistory
});
module.exports = __toCommonJS(history_budget_exports);
const MAX_HISTORY_PROVIDER_CALLS = 2048;
const MAX_HISTORY_LOAD_MS = 10 * 6e4;
class HistoryLoadBudget {
  /**
   * Starts a load budget with optional testable limits and clock.
   *
   * @param maximumCalls Maximum number of provider calls.
   * @param maximumDurationMs Maximum elapsed import duration in milliseconds.
   * @param now Clock used to measure the elapsed duration.
   */
  constructor(maximumCalls = MAX_HISTORY_PROVIDER_CALLS, maximumDurationMs = MAX_HISTORY_LOAD_MS, now = Date.now) {
    this.maximumCalls = maximumCalls;
    this.maximumDurationMs = maximumDurationMs;
    this.now = now;
    this.startedAt = now();
  }
  calls = 0;
  startedAt;
  /** Reserves one provider request or throws when the budget is exhausted. */
  consumeCall() {
    if (this.calls >= this.maximumCalls) {
      throw new Error(`History import exceeded the ${this.maximumCalls}-request safety limit`);
    }
    if (this.now() - this.startedAt >= this.maximumDurationMs) {
      throw new Error(`History import exceeded the ${this.maximumDurationMs} ms time budget`);
    }
    this.calls++;
  }
  /** Returns the number of requests reserved so far. */
  get providerCalls() {
    return this.calls;
  }
}
function retainEvenlySpacedHistory(current, additional, maximumSamples) {
  if (maximumSamples <= 0) {
    return [];
  }
  const sorted = [...current, ...additional].sort((a, b) => a.timestamp - b.timestamp);
  const uniqueByTimestamp = /* @__PURE__ */ new Map();
  for (const sample of sorted) {
    uniqueByTimestamp.set(sample.timestamp, sample);
  }
  const deduplicated = [...uniqueByTimestamp.values()];
  if (deduplicated.length <= maximumSamples) {
    return deduplicated;
  }
  if (maximumSamples <= 1) {
    return deduplicated.length ? [deduplicated.at(-1)] : [];
  }
  return Array.from({ length: maximumSamples }, (_, index) => {
    const sourceIndex = Math.round(index * (deduplicated.length - 1) / (maximumSamples - 1));
    return deduplicated[sourceIndex];
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HistoryLoadBudget,
  MAX_HISTORY_LOAD_MS,
  MAX_HISTORY_PROVIDER_CALLS,
  retainEvenlySpacedHistory
});
//# sourceMappingURL=history-budget.js.map
