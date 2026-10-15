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
var state_write_exports = {};
__export(state_write_exports, {
  writeStateValues: () => writeStateValues
});
module.exports = __toCommonJS(state_write_exports);
async function writeStateValues(values, alwaysWrite, write, writeChanged) {
  const results = await Promise.allSettled(
    values.map(async ([id, value]) => {
      try {
        await (alwaysWrite.has(id) ? write(id, value) : writeChanged(id, value));
      } catch (error) {
        throw new Error(
          `State write failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error
          }
        );
      }
    })
  );
  const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  writeStateValues
});
//# sourceMappingURL=state-write.js.map
