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
var history_provider_exports = {};
__export(history_provider_exports, {
  sanitizeHistory: () => sanitizeHistory
});
module.exports = __toCommonJS(history_provider_exports);
function sanitizeHistory(raw, limit) {
  if (!Number.isInteger(limit) || limit < 1) {
    return [];
  }
  const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray(raw.result) ? raw.result : [];
  const byTimestamp = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry;
    const value = typeof candidate.val === "number" ? candidate.val : Number(candidate.val);
    const timestamp = typeof candidate.ts === "number" ? candidate.ts : Number(candidate.ts);
    if (Number.isFinite(value) && Number.isFinite(timestamp) && timestamp > 0) {
      byTimestamp.set(timestamp, { value, timestamp });
    }
  }
  const sorted = [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
  if (sorted.length <= limit) {
    return sorted;
  }
  if (limit === 1) {
    return [sorted[0]];
  }
  const result = [];
  for (let index = 0; index < limit; index++) {
    result.push(sorted[Math.round(index * (sorted.length - 1) / (limit - 1))]);
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  sanitizeHistory
});
//# sourceMappingURL=history-provider.js.map
