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
var source_cleanup_exports = {};
__export(source_cleanup_exports, {
  cleanupStaleSources: () => cleanupStaleSources
});
module.exports = __toCommonJS(source_cleanup_exports);
async function cleanupStaleSources(store, namespace, configuredSourceIds, storedModels, createSourceId) {
  const configuredSafeIds = new Set([...configuredSourceIds].map(createSourceId));
  const removedSourceIds = [];
  const prefix = `${namespace}.sources.`;
  for (const device of await store.listGeneratedSourceDevices()) {
    if (!device.sourceId || configuredSourceIds.has(device.sourceId)) {
      continue;
    }
    const safeId = createSourceId(device.sourceId);
    const expectedId = `${prefix}${safeId}`;
    if (device.id !== expectedId) {
      continue;
    }
    await store.deleteGeneratedSourceTree(`sources.${safeId}`);
    removedSourceIds.push(device.sourceId);
  }
  const models = Object.fromEntries(
    Object.entries(storedModels).filter(([safeId, model]) => {
      if (model.configuredSourceId) {
        return configuredSourceIds.has(model.configuredSourceId) && createSourceId(model.configuredSourceId) === safeId;
      }
      return configuredSafeIds.has(safeId);
    })
  );
  return {
    models,
    modelsChanged: Object.keys(models).length !== Object.keys(storedModels).length,
    removedSourceIds
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cleanupStaleSources
});
//# sourceMappingURL=source-cleanup.js.map
