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
var context_value_exports = {};
__export(context_value_exports, {
  createContextPart: () => createContextPart
});
module.exports = __toCommonJS(context_value_exports);
function createContextPart(id, value, bucketWidth) {
  if (typeof value === "boolean") {
    return `${id}=boolean:${value}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const width = bucketWidth && bucketWidth > 0 ? bucketWidth : 5;
    const start = Math.floor(value / width) * width;
    return `${id}=number:${start}:${start + width}`;
  }
  if (typeof value === "string" && value.trim() && value.length <= 96) {
    return `${id}=string:${value}`;
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createContextPart
});
//# sourceMappingURL=context-value.js.map
