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
var timestamp_cache_exports = {};
__export(timestamp_cache_exports, {
  observeWithTimestampCache: () => observeWithTimestampCache
});
module.exports = __toCommonJS(timestamp_cache_exports);
function observeWithTimestampCache(cache, key, timestamp, observe, maximumEntries) {
  if (timestamp !== void 0 && cache.get(key) === timestamp) {
    return { duplicate: true, result: void 0 };
  }
  const result = observe();
  if (result !== void 0 && timestamp !== void 0) {
    cache.set(key, timestamp);
    if (cache.size > maximumEntries) {
      cache.delete(cache.keys().next().value);
    }
  }
  return { duplicate: false, result };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  observeWithTimestampCache
});
//# sourceMappingURL=timestamp-cache.js.map
