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
var history_request_exports = {};
__export(history_request_exports, {
  withAbortableTimeout: () => withAbortableTimeout
});
module.exports = __toCommonJS(history_request_exports);
function withAbortableTimeout(operation, signal, timeoutMs, setTimer, clearTimer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimer(() => finish(() => reject(new Error("History request timed out"))), timeoutMs);
    function finish(callback) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimer(timer);
      signal.removeEventListener("abort", onAbort);
      callback();
    }
    function onAbort() {
      finish(() => reject(new Error("History request aborted during shutdown")));
    }
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error instanceof Error ? error : new Error(String(error))))
    );
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  withAbortableTimeout
});
//# sourceMappingURL=history-request.js.map
