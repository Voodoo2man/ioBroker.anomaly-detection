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
  HistorySampleSampler: () => HistorySampleSampler,
  MAX_HISTORY_LOAD_MS: () => MAX_HISTORY_LOAD_MS,
  MAX_HISTORY_PROVIDER_CALLS: () => MAX_HISTORY_PROVIDER_CALLS
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
class HistorySampleSampler {
  /**
   * Creates a bounded sampler tied to the complete requested history window.
   *
   * @param start Start timestamp of the complete history window.
   * @param end End timestamp of the complete history window.
   * @param maximumSamples Maximum number of samples to retain.
   */
  constructor(start, end, maximumSamples) {
    this.start = start;
    this.end = end;
    this.maximumSamples = maximumSamples;
    this.span = Math.max(0, end - start);
    this.bucketCount = maximumSamples > 2 ? maximumSamples - 2 : 0;
  }
  bucketSamples = /* @__PURE__ */ new Map();
  first;
  last;
  centerSample;
  bucketCount;
  span;
  /**
   * Adds a segment without resampling previously retained segments.
   *
   * @param samples Valid samples from a history segment.
   */
  add(samples) {
    for (const sample of samples) {
      if (sample.timestamp < this.start || sample.timestamp > this.end || this.maximumSamples <= 0) {
        continue;
      }
      this.first = this.selectEndpoint(this.first, sample, true);
      this.last = this.selectEndpoint(this.last, sample, false);
      if (this.bucketCount === 0 || this.span === 0) {
        this.centerSample = this.selectNearestCenter(this.centerSample, sample);
        continue;
      }
      const position = Math.min(1, Math.max(0, (sample.timestamp - this.start) / this.span));
      const bucket = Math.min(this.bucketCount - 1, Math.floor(position * this.bucketCount));
      const current = this.bucketSamples.get(bucket);
      if (!current || this.isBetterBucketSample(sample, current, bucket)) {
        this.bucketSamples.set(bucket, sample);
      }
    }
  }
  /** Returns chronologically ordered, unique samples within the configured bound. */
  getSamples() {
    if (this.maximumSamples <= 0) {
      return [];
    }
    const selected = /* @__PURE__ */ new Map();
    if (this.bucketCount === 0) {
      if (this.maximumSamples === 1) {
        if (this.span === 0) {
          if (this.first) {
            selected.set(this.first.timestamp, this.first);
          }
        } else if (this.centerSample) {
          selected.set(this.centerSample.timestamp, this.centerSample);
        }
      } else {
        if (this.first) {
          selected.set(this.first.timestamp, this.first);
        }
        if (this.last) {
          selected.set(this.last.timestamp, this.last);
        }
      }
    } else {
      for (const sample of this.bucketSamples.values()) {
        selected.set(sample.timestamp, this.preferDuplicate(selected.get(sample.timestamp), sample));
      }
      if (this.first) {
        selected.set(
          this.first.timestamp,
          this.preferDuplicate(selected.get(this.first.timestamp), this.first)
        );
      }
      if (this.last) {
        selected.set(this.last.timestamp, this.preferDuplicate(selected.get(this.last.timestamp), this.last));
      }
    }
    return [...selected.values()].sort((left, right) => left.timestamp - right.timestamp).slice(0, this.maximumSamples);
  }
  selectEndpoint(current, candidate, earliest) {
    if (!current) {
      return candidate;
    }
    if (candidate.timestamp === current.timestamp) {
      return this.preferDuplicate(current, candidate);
    }
    return (earliest ? candidate.timestamp < current.timestamp : candidate.timestamp > current.timestamp) ? candidate : current;
  }
  selectNearestCenter(current, candidate) {
    if (!current) {
      return candidate;
    }
    const center = this.start + this.span / 2;
    const currentDistance = Math.abs(current.timestamp - center);
    const candidateDistance = Math.abs(candidate.timestamp - center);
    return candidateDistance < currentDistance || candidateDistance === currentDistance && this.compareSamples(candidate, current) < 0 ? candidate : current;
  }
  isBetterBucketSample(candidate, current, bucket) {
    const bucketCenter = this.start + (bucket + 0.5) * this.span / this.bucketCount;
    const candidateDistance = Math.abs(candidate.timestamp - bucketCenter);
    const currentDistance = Math.abs(current.timestamp - bucketCenter);
    return candidateDistance < currentDistance || candidateDistance === currentDistance && this.compareSamples(candidate, current) < 0;
  }
  preferDuplicate(current, candidate) {
    return !current || this.compareSamples(candidate, current) < 0 ? candidate : current;
  }
  compareSamples(left, right) {
    return left.timestamp - right.timestamp || left.value - right.value;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HistoryLoadBudget,
  HistorySampleSampler,
  MAX_HISTORY_LOAD_MS,
  MAX_HISTORY_PROVIDER_CALLS
});
//# sourceMappingURL=history-budget.js.map
