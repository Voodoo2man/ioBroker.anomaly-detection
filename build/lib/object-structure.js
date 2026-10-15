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
var object_structure_exports = {};
__export(object_structure_exports, {
  SOURCES_OBJECT_ID: () => SOURCES_OBJECT_ID,
  ensureStateUnit: () => ensureStateUnit,
  generatedSourceParentIds: () => generatedSourceParentIds,
  sourcesObject: () => sourcesObject
});
module.exports = __toCommonJS(object_structure_exports);
var import_object_names = require("./object-names");
const SOURCES_OBJECT_ID = "sources";
const sourcesObject = {
  // The children are generated source devices; a folder is the appropriate
  // generic container for devices and their channel trees.
  type: "folder",
  common: { name: (0, import_object_names.objectName)("Monitored sources") },
  native: {}
};
async function ensureStateUnit(store, id, unit) {
  var _a;
  if (!unit) {
    return;
  }
  const object = await store.getObjectAsync(id);
  if (object && ((_a = object.common) == null ? void 0 : _a.unit) === void 0) {
    await store.extendObjectAsync(id, { common: { unit } });
  }
}
function generatedSourceParentIds(safeId) {
  const base = `${SOURCES_OBJECT_ID}.${safeId}`;
  return [SOURCES_OBJECT_ID, base, `${base}.analysis`, `${base}.anomaly`, `${base}.detectors`, `${base}.evaluation`];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SOURCES_OBJECT_ID,
  ensureStateUnit,
  generatedSourceParentIds,
  sourcesObject
});
//# sourceMappingURL=object-structure.js.map
