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
var history_source_resolver_exports = {};
__export(history_source_resolver_exports, {
  HistorySourceResolver: () => HistorySourceResolver,
  isCompleteInstanceId: () => isCompleteInstanceId,
  selectHistorySource: () => selectHistorySource
});
module.exports = __toCommonJS(history_source_resolver_exports);
class HistorySourceResolver {
  constructor(objects) {
    this.objects = objects;
  }
  async resolve(configuredSourceId) {
    const configuredObject = await this.objects.getForeignObjectAsync(configuredSourceId);
    if (!isStateObject(configuredObject)) {
      return [];
    }
    const targetId = getAliasReadTarget(configuredObject);
    const sources = [
      { id: configuredSourceId, object: configuredObject }
    ];
    if (targetId && targetId !== configuredSourceId) {
      const targetObject = await this.objects.getForeignObjectAsync(targetId);
      if (isStateObject(targetObject)) {
        sources.push({ id: targetId, object: targetObject });
      }
    }
    const resolved = /* @__PURE__ */ new Map();
    for (const source of sources) {
      for (const instanceId of enabledHistoryInstances(source.object)) {
        if (resolved.has(instanceId) || !await this.isUsableHistoryInstance(instanceId)) {
          continue;
        }
        resolved.set(instanceId, { instanceId, sourceId: source.id });
      }
    }
    return [...resolved.values()].sort((left, right) => left.instanceId.localeCompare(right.instanceId));
  }
  async isUsableHistoryInstance(instanceId) {
    var _a;
    if (!isCompleteInstanceId(instanceId)) {
      return false;
    }
    const instance = await this.objects.getForeignObjectAsync(`system.adapter.${instanceId}`);
    if (!instance || instance.type !== "instance" || instance.common.enabled !== true) {
      return false;
    }
    return instance.common.getHistory === true || ((_a = instance.common.supportedMessages) == null ? void 0 : _a.getHistory) === true;
  }
}
function isCompleteInstanceId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]+\.\d+$/.test(value);
}
function selectHistorySource(configuredSourceId, instanceId, candidates) {
  if (!isCompleteInstanceId(instanceId)) {
    throw new Error(
      `Invalid history instance '${instanceId}' configured for ${configuredSourceId}. Select a complete instance ID such as 'influxdb.0'.`
    );
  }
  const source = candidates.find((candidate) => candidate.instanceId === instanceId);
  if (!source) {
    throw new Error(
      `History instance '${instanceId}' is not enabled for ${configuredSourceId} or its alias target. Select a current history source.`
    );
  }
  return source;
}
function isStateObject(object) {
  return (object == null ? void 0 : object.type) === "state";
}
function getAliasReadTarget(object) {
  var _a;
  const aliasId = (_a = object.common.alias) == null ? void 0 : _a.id;
  if (typeof aliasId === "string") {
    return aliasId;
  }
  if (aliasId && typeof aliasId.read === "string" && aliasId.read.trim()) {
    return aliasId.read;
  }
  return void 0;
}
function enabledHistoryInstances(object) {
  var _a;
  return Object.entries((_a = object.common.custom) != null ? _a : {}).filter(([instanceId, settings]) => isCompleteInstanceId(instanceId) && (settings == null ? void 0 : settings.enabled) === true).map(([instanceId]) => instanceId);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HistorySourceResolver,
  isCompleteInstanceId,
  selectHistorySource
});
//# sourceMappingURL=history-source-resolver.js.map
