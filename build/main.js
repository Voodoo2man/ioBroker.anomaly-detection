"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_history_provider = require("./lib/history-provider");
var import_history_source_resolver = require("./lib/history-source-resolver");
var import_source_cleanup = require("./lib/source-cleanup");
var import_source_monitor = require("./lib/source-monitor");
var import_context_value = require("./lib/context-value");
var import_object_structure = require("./lib/object-structure");
var import_predictive = require("./lib/predictive");
const MODEL_STATE_ID = "models";
const PREDICTIVE_MODEL_STATE_ID = "predictiveModels";
const PERSIST_DELAY_MS = 3e4;
const HISTORY_TIMEOUT_MS = 3e4;
const HISTORY_CONCURRENCY = 2;
const MAX_PROCESSED_TIMESTAMP_ENTRIES = 512;
function predictiveSettingsFor(source) {
  var _a, _b, _c, _d, _e, _f;
  const legacy = source.predictive;
  const flatEnabled = source.predictiveEnabled;
  const enabledValue = flatEnabled !== void 0 ? flatEnabled : legacy == null ? void 0 : legacy.enabled;
  if (enabledValue !== true && enabledValue !== "true" && enabledValue !== 1) {
    return void 0;
  }
  return {
    ...legacy,
    enabled: true,
    horizonMinutes: (_a = source.predictiveHorizonMinutes) != null ? _a : legacy == null ? void 0 : legacy.horizonMinutes,
    updateIntervalMinutes: (_b = source.predictiveUpdateIntervalMinutes) != null ? _b : legacy == null ? void 0 : legacy.updateIntervalMinutes,
    minimumTrainingSamples: (_c = source.predictiveMinimumTrainingSamples) != null ? _c : legacy == null ? void 0 : legacy.minimumTrainingSamples,
    maximumTrainingPoints: (_d = source.predictiveMaximumTrainingPoints) != null ? _d : legacy == null ? void 0 : legacy.maximumTrainingPoints,
    seasonalPeriodMinutes: (_e = source.predictiveSeasonalPeriodMinutes) != null ? _e : legacy == null ? void 0 : legacy.seasonalPeriodMinutes,
    seasonalityMode: (_f = source.predictiveSeasonalityMode) != null ? _f : legacy == null ? void 0 : legacy.seasonalityMode
  };
}
function parsePredictiveModels(value) {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return Object.fromEntries(Object.entries(parsed).filter(([, model]) => (model == null ? void 0 : model.version) === 1));
  } catch {
    return {};
  }
}
class IoBrokerHistoryProvider {
  constructor(adapter, instance) {
    this.adapter = adapter;
    this.instance = instance;
  }
  async getHistory(sourceId, start, end, limit) {
    const response = await this.adapter.sendToAsync(this.instance, "getHistory", {
      id: sourceId,
      options: { start, end, aggregate: "none", count: limit, returnNewestEntries: false }
    });
    return response;
  }
}
class AnomalyDetection extends utils.Adapter {
  monitors = /* @__PURE__ */ new Map();
  sourceIds = /* @__PURE__ */ new Map();
  sources = /* @__PURE__ */ new Map();
  sourceUnits = /* @__PURE__ */ new Map();
  contextNames = /* @__PURE__ */ new Map();
  invalidValueWarnings = /* @__PURE__ */ new Set();
  invalidHistoryConfigurationWarnings = /* @__PURE__ */ new Set();
  contextValues = /* @__PURE__ */ new Map();
  contextSources = /* @__PURE__ */ new Map();
  contextCategories = /* @__PURE__ */ new Map();
  contextWarnings = /* @__PURE__ */ new Set();
  evaluations = /* @__PURE__ */ new Map();
  historySourceResolver = new import_history_source_resolver.HistorySourceResolver(this);
  predictiveModels = /* @__PURE__ */ new Map();
  predictiveResults = /* @__PURE__ */ new Map();
  predictiveTrainingQueue = new import_predictive.PredictiveTrainingQueue();
  /** Sources are subscribed before bootstrap so state changes can arrive during import. */
  bootstrappingSources = /* @__PURE__ */ new Set();
  /** Last processed source timestamps; prevents duplicate delivery of one physical sample. */
  lastProcessedTimestamps = /* @__PURE__ */ new Map();
  persistTimer;
  constructor(options = {}) {
    super({ ...options, name: "anomaly-detection" });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
    await this.ensureModelState();
    await this.setObjectNotExistsAsync(import_object_structure.SOURCES_OBJECT_ID, import_object_structure.sourcesObject);
    const predictiveStored = parsePredictiveModels((_a = await this.getStateAsync(PREDICTIVE_MODEL_STATE_ID)) == null ? void 0 : _a.val);
    const persistedValue = (_b = await this.getStateAsync(MODEL_STATE_ID)) == null ? void 0 : _b.val;
    let stored = (0, import_source_monitor.parseStoredModel)(persistedValue);
    if (typeof persistedValue === "string" && persistedValue !== "" && persistedValue !== "{}" && Object.keys(stored).length === 0) {
      this.log.warn("Ignoring corrupt or incompatible persisted anomaly models");
    }
    const configuredSourceIds = new Set(
      ((_c = this.config.sources) != null ? _c : []).flatMap((source) => {
        var _a2;
        return ((_a2 = source.id) == null ? void 0 : _a2.trim()) ? [source.id.trim()] : [];
      })
    );
    stored = await this.cleanupStaleSources(configuredSourceIds, stored);
    const configuredIds = /* @__PURE__ */ new Set();
    const bootstrapTasks = [];
    for (const source of (_d = this.config.sources) != null ? _d : []) {
      if (!source.enabled || !((_e = source.id) == null ? void 0 : _e.trim())) {
        continue;
      }
      const id = source.id.trim();
      if (configuredIds.has(id)) {
        this.log.warn(`Ignoring duplicate configured source state: ${id}`);
        continue;
      }
      configuredIds.add(id);
      const object = await this.getForeignObjectAsync(id);
      if (!object) {
        this.log.warn(`Configured source state does not exist yet: ${id}`);
      } else if (object.type !== "state" || object.common.type !== "number") {
        this.log.warn(`Configured source is not a numerical state: ${id}`);
        continue;
      }
      const safeId = this.createSourceId(id);
      const predictive = predictiveSettingsFor(source);
      if (predictive && source.predictive !== predictive) {
        source.predictive = predictive;
      }
      this.sourceIds.set(id, safeId);
      const monitor = new import_source_monitor.SourceMonitor(source, stored[safeId]);
      this.monitors.set(id, monitor);
      this.sources.set(safeId, source);
      if ((predictive == null ? void 0 : predictive.enabled) === true) {
        const predictiveModel2 = new import_predictive.PredictiveModel(
          (0, import_predictive.normalizePredictiveSettings)(predictive),
          predictiveStored[safeId]
        );
        this.predictiveModels.set(safeId, predictiveModel2);
        if (predictiveStored[safeId]) {
          this.log.debug(
            `Predictive training basis restore: source=${id} status=${predictiveModel2.trainingBasisRestoreStatus} reason=${predictiveModel2.trainingBasisRestoreReason}`
          );
        }
        if (predictiveModel2.needsHistoryBootstrap) {
          const reason = (_f = predictiveModel2.bootstrapReason) != null ? _f : "missing-model";
          this.log.debug(`Predictive model reset for ${id}: ${reason}`);
          if (reason === "incomplete-model") {
            this.log.debug(
              `Predictive model incomplete: source=${id}, stored trainingSampleCount=${(_h = (_g = predictiveStored[safeId]) == null ? void 0 : _g.trainingSampleCount) != null ? _h : "missing"}, required minimumTrainingSamples=${(0, import_predictive.normalizePredictiveSettings)(predictive).minimumTrainingSamples}, bootstrapReason=${reason}`
            );
          }
          if (reason === "algorithm-changed") {
            this.log.debug(
              `Predictive model invalidated: algorithm version mismatch, source=${id}, stored=${(_j = (_i = predictiveStored[safeId]) == null ? void 0 : _i.algorithmVersion) != null ? _j : "missing"}, current=${import_predictive.PREDICTIVE_ALGORITHM_VERSION}`
            );
          }
        }
        const restoredResult = predictiveModel2.forecast();
        if (restoredResult.status !== "learning" || predictiveStored[safeId]) {
          this.predictiveResults.set(safeId, restoredResult);
        }
      }
      if (object == null ? void 0 : object.common.unit) {
        this.sourceUnits.set(id, object.common.unit);
      }
      for (const context of (_k = source.contextStates) != null ? _k : []) {
        const contextId = (_l = context.id) == null ? void 0 : _l.trim();
        if (!contextId) {
          continue;
        }
        const contextObject = await this.getForeignObjectAsync(contextId);
        const name = (_m = contextObject == null ? void 0 : contextObject.common) == null ? void 0 : _m.name;
        if (typeof name === "string") {
          this.contextNames.set(contextId, name);
        } else if (name && typeof name === "object") {
          const localized = name;
          const value = (_o = (_n = localized.de) != null ? _n : localized.en) != null ? _o : Object.values(localized)[0];
          if (typeof value === "string") {
            this.contextNames.set(contextId, value);
          }
        }
      }
      await this.registerContexts(id, source);
      await this.ensureSourceObjects(safeId, source, object == null ? void 0 : object.common.unit);
      this.subscribeForeignStates(id);
      const predictiveModel = this.predictiveModels.get(safeId);
      const anomalyBootstrap = this.shouldBootstrap(source, monitor);
      const predictiveBootstrap = this.shouldBootstrapPredictive(source, predictiveModel);
      const initialTrainingIsHistory = source.initialTraining === "history";
      const hasHistoryInstance = typeof source.historyInstance === "string" && !!source.historyInstance.trim();
      const predictiveEnabled = (predictive == null ? void 0 : predictive.enabled) === true;
      const storedPredictive = predictiveStored[safeId];
      const minimumTrainingSamples = predictive ? (0, import_predictive.normalizePredictiveSettings)(predictive).minimumTrainingSamples : void 0;
      const failedConditions = [
        !predictiveEnabled ? "predictiveEnabled" : void 0,
        !initialTrainingIsHistory ? "initialTrainingIsHistory" : void 0,
        !hasHistoryInstance ? "hasHistoryInstance" : void 0,
        !(predictiveModel == null ? void 0 : predictiveModel.needsHistoryBootstrap) ? "needsHistoryBootstrap" : void 0
      ].filter((condition) => condition !== void 0);
      const decisionDetails = [
        `enabled=${predictiveEnabled}`,
        `initialTraining=${(_p = source.initialTraining) != null ? _p : "undefined"}`,
        `historyInstance=${(_q = source.historyInstance) != null ? _q : "undefined"}`,
        `persistedModel=${storedPredictive !== void 0}`,
        `storedSamples=${(_r = storedPredictive == null ? void 0 : storedPredictive.trainingSampleCount) != null ? _r : "undefined"}`,
        `minimumSamples=${minimumTrainingSamples != null ? minimumTrainingSamples : "undefined"}`,
        `needsHistoryBootstrap=${(_s = predictiveModel == null ? void 0 : predictiveModel.needsHistoryBootstrap) != null ? _s : false}`,
        `initialTrainingIsHistory=${initialTrainingIsHistory}`,
        `hasHistoryInstance=${hasHistoryInstance}`,
        `shouldBootstrap=${predictiveBootstrap}`,
        ...!predictiveBootstrap ? [`failedConditions=${failedConditions.join(",") || "none"}`] : []
      ].join(" ");
      this.log.debug(`Predictive bootstrap decision: source=${id} safeId=${safeId} ${decisionDetails}`);
      if (anomalyBootstrap || predictiveBootstrap) {
        if (predictiveBootstrap) {
          this.log.debug(`Predictive bootstrap scheduled from history for ${id}`);
        }
        bootstrapTasks.push(async () => {
          this.bootstrappingSources.add(id);
          try {
            await this.bootstrapSource(id, safeId, source, monitor, {
              anomaly: anomalyBootstrap,
              predictive: predictiveBootstrap
            });
          } finally {
            this.bootstrappingSources.delete(id);
          }
        });
      }
    }
    this.subscribeStates("sources.*.retrain");
    await this.runWithConcurrency(bootstrapTasks, HISTORY_CONCURRENCY);
    for (const [sourceId, safeId] of this.sourceIds) {
      const state = await this.getForeignStateAsync(sourceId);
      if (state) {
        const monitor = this.monitors.get(sourceId);
        if (monitor) {
          await this.processState(sourceId, safeId, monitor, state);
        }
      }
    }
    this.log.info(`Monitoring ${this.monitors.size} numerical state${this.monitors.size === 1 ? "" : "s"}`);
  }
  onStateChange(id, state) {
    var _a, _b, _c;
    if (!state) {
      return;
    }
    for (const sourceId of (_a = this.contextSources.get(id)) != null ? _a : []) {
      (_b = this.contextValues.get(sourceId)) == null ? void 0 : _b.set(id, state.val);
    }
    const retrainMatch = id.match(/sources\.([^.]+)\.retrain$/);
    if (retrainMatch && state.ack === false && state.val === true) {
      const safeId2 = retrainMatch[1];
      const sourceId = (_c = [...this.sourceIds].find(([, value]) => value === safeId2)) == null ? void 0 : _c[0];
      const source = this.sources.get(safeId2);
      const monitor2 = sourceId ? this.monitors.get(sourceId) : void 0;
      if (sourceId && source && monitor2) {
        void this.retrainSource(sourceId, safeId2, source, monitor2);
      }
      return;
    }
    const monitor = this.monitors.get(id);
    const safeId = this.sourceIds.get(id);
    if (monitor && safeId) {
      if (this.bootstrappingSources.has(id)) {
        return;
      }
      void this.processState(id, safeId, monitor, state);
    }
  }
  onMessage(message) {
    if (!message.callback) {
      return;
    }
    if (message.command === "getHistoryProviders") {
      void this.replyWithHistoryProviders(message);
    } else if (message.command === "tab") {
      void this.replyWithAnomalyTab(message);
    } else if (message.command === "chartData") {
      void this.replyWithChartData(message);
    }
  }
  async replyWithChartData(message) {
    var _a, _b, _c, _d, _e;
    const sourceId = typeof ((_a = message.message) == null ? void 0 : _a.sourceId) === "string" ? message.message.sourceId.trim() : "";
    const start = Number((_b = message.message) == null ? void 0 : _b.start) || Date.now() - 24 * 60 * 60 * 1e3;
    const end = Number((_c = message.message) == null ? void 0 : _c.end) || Date.now();
    const limit = Math.min(1e3, Math.max(50, Number((_d = message.message) == null ? void 0 : _d.limit) || 500));
    const safeId = this.sourceIds.get(sourceId);
    const source = safeId ? this.sources.get(safeId) : void 0;
    const monitor = this.monitors.get(sourceId);
    if (!source || !monitor || !((_e = source.historyInstance) == null ? void 0 : _e.trim())) {
      this.sendTo(
        message.from,
        message.command,
        { data: { samples: [], diagnostics: [], available: false } },
        message.callback
      );
      return;
    }
    try {
      const historySource = await this.resolveConfiguredHistorySource(sourceId, source.historyInstance.trim());
      const provider = new IoBrokerHistoryProvider(this, source.historyInstance.trim());
      const raw = await provider.getHistory(historySource.sourceId, start, end, limit);
      const diagnostics = monitor.diagnosticSnapshots.filter(
        (diagnostic) => diagnostic.timestamp >= start && diagnostic.timestamp <= end
      );
      this.sendTo(
        message.from,
        message.command,
        {
          data: {
            samples: (0, import_history_provider.sanitizeHistory)(
              raw,
              limit,
              diagnostics.map((diagnostic) => diagnostic.timestamp)
            ),
            diagnostics,
            available: true
          }
        },
        message.callback
      );
    } catch {
      this.sendTo(
        message.from,
        message.command,
        { data: { samples: [], diagnostics: [], available: false } },
        message.callback
      );
    }
  }
  replyWithAnomalyTab(message) {
    const sources = [...this.sourceIds.entries()].map(([sourceId, safeId]) => {
      var _a, _b, _c, _d, _e, _f, _g;
      const source = this.sources.get(safeId);
      const predictiveSettings = source == null ? void 0 : source.predictive;
      const predictiveModel = this.predictiveModels.get(safeId);
      const predictive = (_b = this.predictiveResults.get(safeId)) != null ? _b : (predictiveSettings == null ? void 0 : predictiveSettings.enabled) === true ? {
        status: "learning",
        horizonMinutes: (0, import_predictive.normalizePredictiveSettings)(predictiveSettings).horizonMinutes,
        points: [],
        modelType: "seasonal-exponential-smoothing",
        trainingSampleCount: (_a = predictiveModel == null ? void 0 : predictiveModel.trainingSampleCount) != null ? _a : 0,
        minimumTrainingSamples: (0, import_predictive.normalizePredictiveSettings)(predictiveSettings).minimumTrainingSamples,
        learningReason: "insufficientSamples"
      } : void 0;
      return {
        id: sourceId,
        safeId,
        name: (source == null ? void 0 : source.name) || sourceId,
        unit: this.sourceUnits.get(sourceId),
        predictive,
        contextLabels: Object.fromEntries(
          ((_c = source == null ? void 0 : source.contextStates) != null ? _c : []).filter((context) => typeof (context == null ? void 0 : context.id) === "string" && context.id.trim()).map((context) => {
            const contextId = context.id.trim();
            return [contextId, this.contextNames.get(contextId) || contextId];
          })
        ),
        evaluation: (_g = this.evaluations.get(sourceId)) != null ? _g : {
          statusCode: "unavailable",
          severity: "normal",
          sampleCount: (_e = (_d = this.monitors.get(sourceId)) == null ? void 0 : _d.sampleCount) != null ? _e : 0,
          requiredSamples: (_f = source == null ? void 0 : source.minimumSamples) != null ? _f : 30
        }
      };
    });
    this.sendTo(message.from, message.command, { data: { sources } }, message.callback);
  }
  async replyWithHistoryProviders(message) {
    var _a;
    const sourceId = typeof ((_a = message.message) == null ? void 0 : _a.sourceId) === "string" ? message.message.sourceId.trim() : "";
    const sources = await this.historySourcesForAdmin(sourceId);
    this.sendTo(
      message.from,
      message.command,
      sources.map((source) => ({ value: source.instanceId, label: source.instanceId })),
      message.callback
    );
  }
  async historySourcesForAdmin(sourceId) {
    if (!sourceId) {
      return [];
    }
    try {
      return await this.historySourceResolver.resolve(sourceId);
    } catch (error) {
      this.log.warn(`Could not resolve history sources for ${sourceId}: ${error.message}`);
      return [];
    }
  }
  async processState(id, safeId, monitor, state) {
    var _a;
    try {
      const sourceTimestamp = typeof state.ts === "number" && Number.isFinite(state.ts) ? state.ts : void 0;
      const timestamp = sourceTimestamp != null ? sourceTimestamp : Date.now();
      if (sourceTimestamp !== void 0) {
        if (this.lastProcessedTimestamps.get(id) === sourceTimestamp) {
          return;
        }
        this.lastProcessedTimestamps.set(id, sourceTimestamp);
        if (this.lastProcessedTimestamps.size > MAX_PROCESSED_TIMESTAMP_ENTRIES) {
          this.lastProcessedTimestamps.delete(this.lastProcessedTimestamps.keys().next().value);
        }
      }
      const result = monitor.observe(state.val, timestamp, this.contextKey(id));
      if (!result) {
        if (!this.invalidValueWarnings.has(id)) {
          this.invalidValueWarnings.add(id);
          this.log.warn(`Ignoring invalid non-numerical value from ${id}`);
        }
        return;
      }
      this.invalidValueWarnings.delete(id);
      this.evaluations.set(id, result);
      await this.writeResult(safeId, result);
      await this.updatePredictive(safeId, state.val, (_a = state.ts) != null ? _a : Date.now());
      this.schedulePersistence();
    } catch (error) {
      this.log.error(`Could not process source state ${id}: ${error.message}`);
    }
  }
  async updatePredictive(safeId, value, timestamp) {
    await this.predictiveTrainingQueue.enqueue(async () => {
      var _a;
      try {
        const model = this.predictiveModels.get(safeId);
        if (!model || typeof value !== "number" || !Number.isFinite(value)) {
          return;
        }
        model.add(value, Number.isFinite(timestamp) ? timestamp : Date.now());
        const current = this.predictiveResults.get(safeId);
        const interval = (0, import_predictive.normalizePredictiveSettings)((_a = this.sources.get(safeId)) == null ? void 0 : _a.predictive).updateIntervalMinutes * 6e4;
        if ((current == null ? void 0 : current.lastTrainingAt) && Date.now() - current.lastTrainingAt < interval) {
          const refreshed = model.forecast(Date.now());
          this.predictiveResults.set(safeId, refreshed);
          await this.setStateAsync(`sources.${safeId}.predictive.result`, {
            val: JSON.stringify(refreshed),
            ack: true
          });
          return;
        }
        const result = model.train();
        this.predictiveResults.set(safeId, result);
        await this.setStateAsync(`sources.${safeId}.predictive.status`, { val: result.status, ack: true });
        await this.setStateAsync(`sources.${safeId}.predictive.result`, {
          val: JSON.stringify(result),
          ack: true
        });
        await this.persistPredictiveModels();
      } catch (error) {
        this.log.warn(`Predictive update failed for ${safeId}: ${error.message}`);
      }
    });
  }
  async registerContexts(sourceId, source) {
    var _a, _b, _c;
    if (!source.enableContext) {
      return;
    }
    if (((_b = (_a = source.contextStates) == null ? void 0 : _a.length) != null ? _b : 0) > 3) {
      this.warnContext(`Only the first 3 context states are used for ${sourceId}`);
    }
    for (const context of ((_c = source.contextStates) != null ? _c : []).filter((item) => typeof (item == null ? void 0 : item.id) === "string" && item.id.trim()).slice(0, 3)) {
      const id = context.id.trim();
      let sources = this.contextSources.get(id);
      if (!sources) {
        sources = /* @__PURE__ */ new Set();
        this.contextSources.set(id, sources);
        this.subscribeForeignStates(id);
      }
      sources.add(sourceId);
      const state = await this.getForeignStateAsync(id);
      if (state) {
        let values = this.contextValues.get(sourceId);
        if (!values) {
          values = /* @__PURE__ */ new Map();
          this.contextValues.set(sourceId, values);
        }
        values.set(id, state.val);
      }
    }
  }
  contextKey(sourceId) {
    var _a;
    const safeId = this.sourceIds.get(sourceId);
    const source = safeId ? this.sources.get(safeId) : void 0;
    if (!(source == null ? void 0 : source.enableContext)) {
      return void 0;
    }
    const values = this.contextValues.get(sourceId);
    const parts = ((_a = source.contextStates) != null ? _a : []).filter((item) => {
      var _a2;
      return (_a2 = item.id) == null ? void 0 : _a2.trim();
    }).slice(0, 3).map((context) => {
      const contextId = context.id.trim();
      const value = values == null ? void 0 : values.get(contextId);
      if (typeof value === "string" && value.trim() && value.length <= 96) {
        const categoryKey = `${sourceId}\0${contextId}`;
        let categories = this.contextCategories.get(categoryKey);
        if (!categories) {
          categories = /* @__PURE__ */ new Set();
          this.contextCategories.set(categoryKey, categories);
        }
        if (!categories.has(value) && categories.size >= 16) {
          this.warnContext(`Ignoring additional categorical values for ${contextId}; limit is 16`);
          return void 0;
        }
        categories.add(value);
      }
      return (0, import_context_value.createContextPart)(context.id, value, context.bucketWidth);
    });
    return parts.length > 0 && parts.every(Boolean) ? parts.join("|") : void 0;
  }
  warnContext(message) {
    if (!this.contextWarnings.has(message)) {
      this.contextWarnings.add(message);
      this.log.warn(message);
    }
  }
  async ensureModelState() {
    await this.setObjectNotExistsAsync(MODEL_STATE_ID, {
      type: "state",
      common: { name: "Persisted models", type: "string", role: "json", read: true, write: false, def: "" },
      native: {}
    });
    await this.setObjectNotExistsAsync(PREDICTIVE_MODEL_STATE_ID, {
      type: "state",
      common: {
        name: "Persisted predictive models",
        type: "string",
        role: "json",
        read: true,
        write: false,
        def: ""
      },
      native: {}
    });
  }
  async cleanupStaleSources(configuredSourceIds, storedModels) {
    try {
      const result = await (0, import_source_cleanup.cleanupStaleSources)(
        {
          listGeneratedSourceDevices: async () => {
            const devices = await this.getForeignObjectsAsync(`${this.namespace}.sources.*`, "device");
            return Object.entries(devices).map(([id, device]) => {
              var _a;
              return {
                id,
                sourceId: typeof ((_a = device.native) == null ? void 0 : _a.sourceId) === "string" ? device.native.sourceId : void 0
              };
            });
          },
          deleteGeneratedSourceTree: (relativeId) => this.delObjectAsync(relativeId, { recursive: true })
        },
        this.namespace,
        configuredSourceIds,
        storedModels,
        this.createSourceId.bind(this)
      );
      if (result.modelsChanged) {
        await this.setStateAsync(MODEL_STATE_ID, { val: JSON.stringify(result.models), ack: true });
      }
      for (const sourceId of result.removedSourceIds) {
        this.log.info(`Removed generated anomaly objects and model for deleted source: ${sourceId}`);
      }
      return result.models;
    } catch (error) {
      this.log.error(`Could not clean up stale monitored sources: ${error.message}`);
      return storedModels;
    }
  }
  async ensureSourceObjects(safeId, source, unit) {
    var _a;
    const base = `${import_object_structure.SOURCES_OBJECT_ID}.${safeId}`;
    await this.setObjectNotExistsAsync(base, {
      type: "device",
      common: { name: source.name || source.id },
      native: { sourceId: source.id }
    });
    await this.setObjectNotExistsAsync(`${base}.analysis`, {
      type: "channel",
      common: { name: "Anomaly analysis" },
      native: {}
    });
    if (((_a = predictiveSettingsFor(source)) == null ? void 0 : _a.enabled) === true) {
      await this.setObjectNotExistsAsync(`${base}.predictive`, {
        type: "channel",
        common: { name: "Predictive forecast" },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${base}.predictive.result`, {
        type: "state",
        common: { name: "Forecast result", type: "string", role: "json", read: true, write: false },
        native: {}
      });
      await this.setObjectNotExistsAsync(`${base}.predictive.status`, {
        type: "state",
        common: { name: "Forecast status", type: "string", role: "info.status", read: true, write: false },
        native: {}
      });
    }
    const numberState = (name, role, extra = {}) => ({
      type: "state",
      common: { name, type: "number", role, read: true, write: false, ...extra },
      native: {}
    });
    await this.setObjectNotExistsAsync(
      `${base}.analysis.actual`,
      numberState("Actual value", "value", unit ? { unit } : {})
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.expected`,
      numberState("Expected value", "value", unit ? { unit } : {})
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.deviation`,
      numberState("Deviation", "value", unit ? { unit } : {})
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.score`,
      numberState("Anomaly score", "value", { min: 0, max: 100, unit: "%" })
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.sampleCount`,
      numberState("Learned sample count", "value")
    );
    await this.setObjectNotExistsAsync(`${base}.analysis.baselineScope`, {
      type: "state",
      common: { name: "Active baseline scope", type: "string", role: "info.status", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.activeContext`, {
      type: "state",
      common: { name: "Active context", type: "string", role: "text", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(
      `${base}.analysis.baselineSampleCount`,
      numberState("Active baseline sample count", "value")
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.contextSampleCount`,
      numberState("Active context sample count", "value")
    );
    await this.setObjectNotExistsAsync(
      `${base}.analysis.relevantSampleCount`,
      numberState("Relevant baseline sample count", "value")
    );
    await this.setObjectNotExistsAsync(`${base}.analysis.relevantSampleScope`, {
      type: "state",
      common: { name: "Relevant baseline scope", type: "string", role: "info.status", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.evaluationAvailable`, {
      type: "state",
      common: { name: "Evaluation available", type: "boolean", role: "indicator", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.detected`, {
      type: "state",
      common: {
        name: "Persistent anomaly detected",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.status`, {
      type: "state",
      common: { name: "Model status", type: "string", role: "info.status", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.reason`, {
      type: "state",
      common: { name: "Anomaly reason", type: "string", role: "text", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.lastAnomaly`, {
      type: "state",
      common: { name: "Last high-score anomaly", type: "string", role: "date", read: true, write: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.retrain`, {
      type: "state",
      common: { name: "Retrain model", type: "boolean", role: "button", read: false, write: true, def: false },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.analysis.bootstrapStatus`, {
      type: "state",
      common: {
        name: "Historical bootstrap status",
        type: "string",
        role: "info.status",
        read: true,
        write: false
      },
      native: {}
    });
    await this.ensureExplainabilityObjects(base, numberState);
  }
  async ensureExplainabilityObjects(base, numberState) {
    await this.setObjectNotExistsAsync(`${base}.anomaly`, {
      type: "channel",
      common: { name: "Current anomaly assessment" },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.evaluation`, {
      type: "channel",
      common: { name: "Evaluation details" },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${base}.detectors`, {
      type: "channel",
      common: { name: "Detector scores" },
      native: {}
    });
    const textState = (name, role = "text") => ({
      type: "state",
      common: { name, type: "string", role, read: true, write: false },
      native: {}
    });
    const booleanState = {
      type: "state",
      common: {
        name: "Anomaly active",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false
      },
      native: {}
    };
    await this.setObjectNotExistsAsync(`${base}.anomaly.active`, booleanState);
    await this.setObjectNotExistsAsync(
      `${base}.anomaly.score`,
      numberState("Overall anomaly score", "value", { min: 0, max: 100, unit: "%" })
    );
    await this.setObjectNotExistsAsync(`${base}.anomaly.severity`, textState("Severity", "info.status"));
    await this.setObjectNotExistsAsync(`${base}.anomaly.reasonCode`, textState("Reason code"));
    await this.setObjectNotExistsAsync(`${base}.anomaly.reason`, textState("Human-readable reason"));
    await this.setObjectNotExistsAsync(`${base}.anomaly.since`, textState("Anomaly since", "date"));
    await this.setObjectNotExistsAsync(`${base}.anomaly.lastNormal`, textState("Last normal evaluation", "date"));
    await this.setObjectNotExistsAsync(`${base}.evaluation.status`, textState("Evaluation status", "info.status"));
    await this.setObjectNotExistsAsync(`${base}.evaluation.currentValue`, numberState("Current value", "value"));
    await this.setObjectNotExistsAsync(
      `${base}.evaluation.expectedLow`,
      numberState("Expected range lower bound", "value")
    );
    await this.setObjectNotExistsAsync(
      `${base}.evaluation.expectedHigh`,
      numberState("Expected range upper bound", "value")
    );
    await this.setObjectNotExistsAsync(
      `${base}.evaluation.decisionLow`,
      numberState("Decision range lower bound", "value")
    );
    await this.setObjectNotExistsAsync(
      `${base}.evaluation.decisionHigh`,
      numberState("Decision range upper bound", "value")
    );
    await this.setObjectNotExistsAsync(`${base}.evaluation.baselineType`, textState("Baseline type"));
    await this.setObjectNotExistsAsync(
      `${base}.evaluation.baselineSamples`,
      numberState("Baseline samples", "value")
    );
    await this.setObjectNotExistsAsync(`${base}.evaluation.context`, textState("Used context"));
    await this.setObjectNotExistsAsync(`${base}.evaluation.timeBucket`, textState("Time bucket"));
    await this.setObjectNotExistsAsync(`${base}.evaluation.lastEvaluated`, textState("Last evaluation", "date"));
    await this.setObjectNotExistsAsync(`${base}.detectors.active`, textState("Active detectors"));
    for (const [id, label] of [
      ["valueDeviation", "Value deviation score"],
      ["rateOfChange", "Rate-of-change score"],
      ["stuck", "Stuck-state score"],
      ["levelShift", "Level-shift score"],
      ["trend", "Trend score"]
    ]) {
      await this.setObjectNotExistsAsync(
        `${base}.detectors.${id}`,
        numberState(label, "value", { min: 0, max: 100 })
      );
    }
  }
  shouldBootstrap(source, monitor) {
    var _a;
    return source.initialTraining === "history" && !!((_a = source.historyInstance) == null ? void 0 : _a.trim()) && (!monitor.hasSufficientData || !monitor.bootstrapMatches(this.bootstrapConfigKey(source)));
  }
  shouldBootstrapPredictive(source, model) {
    var _a;
    return source.initialTraining === "history" && !!((_a = source.historyInstance) == null ? void 0 : _a.trim()) && !!model && (model.needsHistoryBootstrap || model.needsTrainingBasisBootstrap);
  }
  async bootstrapSource(sourceId, safeId, source, monitor, needs) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const providerName = source.historyInstance.trim();
    const end = Date.now();
    const anomalyStart = end - Math.max(7, (_a = source.trainingDays) != null ? _a : 30) * 24 * 60 * 60 * 1e3;
    await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "importingHistory", ack: true });
    await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
      val: "Importing historical data",
      ack: true
    });
    try {
      const historySource = await this.resolveConfiguredHistorySource(sourceId, providerName);
      await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
        val: `Importing history from ${historySource.sourceId} via ${providerName}`,
        ack: true
      });
      const provider = new IoBrokerHistoryProvider(this, providerName);
      const predictiveSettings = needs.predictive ? (0, import_predictive.normalizePredictiveSettings)(source.predictive) : void 0;
      const predictiveStart = needs.predictive ? end - (0, import_predictive.predictiveHistorySpanMinutes)(predictiveSettings, (_b = source.trainingDays) != null ? _b : 30) * 6e4 : anomalyStart;
      const start = Math.min(anomalyStart, predictiveStart);
      const historyLimit = needs.predictive ? import_predictive.PREDICTIVE_HISTORY_RAW_LIMIT : Math.min(import_predictive.PREDICTIVE_HISTORY_RAW_LIMIT, (_c = source.maxHistorySamples) != null ? _c : 1e3);
      const memoryBefore = process.memoryUsage();
      const historyResult = await this.loadSegmentedHistory(
        provider,
        historySource.sourceId,
        start,
        end,
        historyLimit,
        (_e = (_d = predictiveSettings == null ? void 0 : predictiveSettings.maximumTrainingPoints) != null ? _d : source.maxHistorySamples) != null ? _e : 2e3
      );
      const samples = historyResult.samples;
      const memoryAfter = process.memoryUsage();
      const mb = (value) => (value / 1024 / 1024).toFixed(1);
      const anomalySamples = samples.filter((sample) => sample.timestamp >= anomalyStart);
      this.log.debug(
        `History load summary: source=${sourceId} mode=${needs.predictive ? "history" : "anomaly-only"} requestedDuration=${Math.round((end - start) / 6e4)}min providerCalls=${historyResult.providerCalls} segmentQueries=${historyResult.segmentQueries} coverageProbes=${historyResult.coverageProbes} segmentSplits=${historyResult.segmentSplits} queryLimitSplits=${historyResult.queryLimitSplits} coverageProbeSplits=${historyResult.coverageProbeSplits} acceptedSegments=${historyResult.acceptedSegments} providerSamplesTotal=${historyResult.providerSamplesTotal} maxProviderResponse=${historyResult.maxProviderResponse} finalRawSamples=${historyResult.finalRawSamples} adaptiveSegments=${historyResult.adaptiveSegments} densityEstimates=${historyResult.densityEstimates} adaptiveTargetSamples=${historyResult.adaptiveTargetSamples} minAdaptiveSegmentDuration=${(_f = historyResult.minAdaptiveSegmentDuration) != null ? _f : "none"} maxAdaptiveSegmentDuration=${(_g = historyResult.maxAdaptiveSegmentDuration) != null ? _g : "none"} fallbackSplits=${historyResult.fallbackSplits} densityRecalculations=${historyResult.densityRecalculations} adaptiveDownscales=${historyResult.adaptiveDownscales} initialAdaptiveSegmentDuration=${(_h = historyResult.initialAdaptiveSegmentDuration) != null ? _h : "none"} finalAdaptiveSegmentDuration=${(_i = historyResult.finalAdaptiveSegmentDuration) != null ? _i : "none"} adaptiveLimitHits=${historyResult.adaptiveLimitHits} deduplicatedSamples=${historyResult.deduplicatedSamples} duplicateSamplesRemoved=${historyResult.duplicateSamplesRemoved} rssBeforeMB=${mb(memoryBefore.rss)} rssAfterMB=${mb(memoryAfter.rss)} rssDeltaMB=${mb(memoryAfter.rss - memoryBefore.rss)} heapBeforeMB=${mb(memoryBefore.heapUsed)} heapAfterMB=${mb(memoryAfter.heapUsed)} heapDeltaMB=${mb(memoryAfter.heapUsed - memoryBefore.heapUsed)}`
      );
      this.log.debug(
        `Predictive history loaded for ${sourceId}: raw=${historyResult.finalRawSamples}, deduplicated=${samples.length}, oldest=${(_k = (_j = samples[0]) == null ? void 0 : _j.timestamp) != null ? _k : "none"}, newest=${(_m = (_l = samples.at(-1)) == null ? void 0 : _l.timestamp) != null ? _m : "none"}, source=${needs.predictive ? "history" : "anomaly-only"} requestedStart=${start} requestedEnd=${end} requestedDuration=${Math.round((end - start) / 6e4)}min segments=${historyResult.acceptedSegments} limitedSegments=${historyResult.queryLimitSplits}`
      );
      if (samples.length === 0) {
        throw new Error("History provider returned no valid samples");
      }
      if (needs.anomaly) {
        monitor.reset();
      }
      const imported = needs.anomaly ? monitor.bootstrapFromHistory(
        anomalySamples,
        providerName,
        historySource.sourceId,
        start,
        end,
        this.bootstrapConfigKey(source)
      ) : anomalySamples.length;
      if (needs.anomaly && imported === 0) {
        this.log.debug(
          `Historical outlier filtering for ${sourceId}: input=${anomalySamples.length} retained=0`
        );
        throw new Error("No usable samples remained after historical outlier filtering");
      }
      if (needs.anomaly) {
        this.log.debug(
          `Historical outlier filtering for ${sourceId}: input=${anomalySamples.length} retained=${imported}`
        );
      }
      const predictive = this.predictiveModels.get(safeId);
      if (predictive && needs.predictive) {
        for (const sample of samples) {
          predictive.add(sample.value, sample.timestamp, "history");
        }
        await this.predictiveTrainingQueue.enqueue(async () => {
          var _a2, _b2;
          try {
            const predictiveResult = predictive.train(Date.now(), "history");
            this.log.debug(
              `Predictive bootstrap completed for ${sourceId}: raw=${samples.length}, modelInterval=${(_b2 = (_a2 = predictiveResult.diagnostics) == null ? void 0 : _a2.model.intervalMinutes) != null ? _b2 : "unknown"} min, resampled=${predictiveResult.trainingSampleCount}, source=history, status=${predictiveResult.status}`
            );
            this.predictiveResults.set(safeId, predictiveResult);
            await this.setStateAsync(`sources.${safeId}.predictive.status`, {
              val: predictiveResult.status,
              ack: true
            });
            await this.setStateAsync(`sources.${safeId}.predictive.result`, {
              val: JSON.stringify(predictiveResult),
              ack: true
            });
          } catch (error) {
            this.log.warn(`Predictive bootstrap failed for ${safeId}: ${error.message}`);
          }
        });
      }
      if (needs.anomaly) {
        await this.persistModels();
      }
      if (needs.predictive) {
        await this.persistPredictiveModels();
      }
      if (needs.anomaly) {
        await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, {
          val: monitor.sampleCount,
          ack: true
        });
      }
      const status = monitor.hasSufficientData && ((_n = source.autoStartMonitoringAfterImport) != null ? _n : true) ? "monitoring" : "learning";
      if (needs.anomaly) {
        await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: status, ack: true });
      }
      if (needs.anomaly) {
        await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
          val: `Historical training completed (${imported} samples)`,
          ack: true
        });
      }
    } catch (error) {
      this.log.warn(`Historical bootstrap failed for ${sourceId}: ${error.message}`);
      await this.persistModels();
      await this.setStateAsync(`sources.${safeId}.analysis.status`, {
        val: monitor.hasSufficientData ? "monitoring" : "learning",
        ack: true
      });
      await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
        val: "Insufficient historical data, continuing live learning",
        ack: true
      });
    }
  }
  async loadSegmentedHistory(provider, sourceId, start, end, limit, maximumTrainingPoints) {
    const collected = [];
    let providerCalls = 0;
    let segmentQueries = 0;
    let coverageProbes = 0;
    let segmentSplits = 0;
    let queryLimitSplits = 0;
    let coverageProbeSplits = 0;
    let acceptedSegments = 0;
    let providerSamplesTotal = 0;
    let maxProviderResponse = 0;
    let adaptiveSegments = 0;
    let densityEstimates = 0;
    let adaptiveTargetSamples = 0;
    let minAdaptiveSegmentDuration;
    let maxAdaptiveSegmentDuration;
    let fallbackSplits = 0;
    let densityRecalculations = 0;
    let adaptiveDownscales = 0;
    let initialAdaptiveSegmentDuration;
    let adaptiveDurationHint;
    let finalAdaptiveSegmentDuration;
    let adaptiveLimitHits = 0;
    const load = async (segmentStart, segmentEnd, depth) => {
      var _a, _b;
      providerCalls++;
      segmentQueries++;
      const raw = await this.withHistoryTimeout(provider.getHistory(sourceId, segmentStart, segmentEnd, limit));
      const entries = Array.isArray(raw) ? raw.length : raw && typeof raw === "object" && Array.isArray(raw.result) ? raw.result.length : 0;
      providerSamplesTotal += entries;
      maxProviderResponse = Math.max(maxProviderResponse, entries);
      const samples = (0, import_history_provider.sanitizeHistory)(raw, Math.max(1e3, Math.min(limit, maximumTrainingPoints)));
      const oldest = (_a = samples[0]) == null ? void 0 : _a.timestamp;
      const newest = (_b = samples.at(-1)) == null ? void 0 : _b.timestamp;
      let splitReason;
      if (entries >= limit) {
        splitReason = "query-limit";
        adaptiveLimitHits++;
        if (samples.length >= 2) {
          const observedSpan = samples.at(-1).timestamp - samples[0].timestamp;
          if (observedSpan > 0) {
            const density = (samples.length - 1) / observedSpan;
            const targetSamples = Math.max(100, Math.floor(limit * 0.8));
            const estimatedDuration = Math.max(60001, Math.floor(targetSamples / density));
            densityRecalculations++;
            densityEstimates++;
            adaptiveTargetSamples = targetSamples;
            if (adaptiveDurationHint === void 0) {
              adaptiveDurationHint = estimatedDuration;
              initialAdaptiveSegmentDuration = estimatedDuration;
            } else if (estimatedDuration < adaptiveDurationHint) {
              this.log.debug(
                `Adaptive history density adjusted: source=${sourceId} oldDuration=${adaptiveDurationHint} newDuration=${estimatedDuration} responseSamples=${entries} reason=query-limit`
              );
              adaptiveDurationHint = estimatedDuration;
              adaptiveDownscales++;
            }
            finalAdaptiveSegmentDuration = adaptiveDurationHint;
            minAdaptiveSegmentDuration = Math.min(
              minAdaptiveSegmentDuration != null ? minAdaptiveSegmentDuration : estimatedDuration,
              estimatedDuration
            );
            maxAdaptiveSegmentDuration = Math.max(
              maxAdaptiveSegmentDuration != null ? maxAdaptiveSegmentDuration : estimatedDuration,
              estimatedDuration
            );
          }
        }
      } else if (oldest !== void 0 && newest !== void 0 && newest < segmentEnd - 60 * 6e4) {
        const probeStart = Math.floor((segmentStart + segmentEnd) / 2);
        providerCalls++;
        coverageProbes++;
        const probeRaw = await this.withHistoryTimeout(
          provider.getHistory(sourceId, probeStart, segmentEnd, limit)
        );
        const probeEntries = Array.isArray(probeRaw) ? probeRaw.length : probeRaw && typeof probeRaw === "object" && Array.isArray(probeRaw.result) ? probeRaw.result.length : 0;
        providerSamplesTotal += probeEntries;
        maxProviderResponse = Math.max(maxProviderResponse, probeEntries);
        const probeSamples = (0, import_history_provider.sanitizeHistory)(probeRaw, 1);
        if (probeSamples.length > 0) {
          splitReason = "coverage-probe";
        }
      }
      if (splitReason && segmentEnd - segmentStart > 6e4 && depth < 16) {
        segmentSplits++;
        if (splitReason === "query-limit") {
          queryLimitSplits++;
        }
        if (splitReason === "coverage-probe") {
          coverageProbeSplits++;
        }
        this.log.debug(
          `Predictive history segment split: source=${sourceId} reason=${splitReason} start=${segmentStart} end=${segmentEnd}`
        );
        const totalDuration = segmentEnd - segmentStart;
        const halfDuration = Math.floor(totalDuration / 2);
        let childStart = segmentStart;
        let usedFallback = false;
        while (childStart <= segmentEnd) {
          const childDuration = splitReason === "query-limit" && adaptiveDurationHint !== void 0 ? Math.min(halfDuration, adaptiveDurationHint) : halfDuration;
          const childEnd = Math.min(segmentEnd, childStart + childDuration);
          if (childDuration === halfDuration) {
            usedFallback = true;
          } else {
            adaptiveSegments++;
          }
          await load(childStart, childEnd, depth + 1);
          childStart = childEnd + 1;
        }
        if (usedFallback) {
          fallbackSplits++;
        }
        return;
      }
      acceptedSegments++;
      collected.push(...samples);
    };
    await load(start, end, 0);
    const byTimestamp = /* @__PURE__ */ new Map();
    for (const sample of collected) {
      byTimestamp.set(sample.timestamp, sample);
    }
    const deduplicated = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
    return {
      samples: deduplicated,
      providerCalls,
      segmentQueries,
      coverageProbes,
      segmentSplits,
      queryLimitSplits,
      coverageProbeSplits,
      acceptedSegments,
      providerSamplesTotal,
      maxProviderResponse,
      adaptiveSegments,
      densityEstimates,
      adaptiveTargetSamples,
      minAdaptiveSegmentDuration,
      maxAdaptiveSegmentDuration,
      fallbackSplits,
      densityRecalculations,
      adaptiveDownscales,
      initialAdaptiveSegmentDuration,
      finalAdaptiveSegmentDuration,
      adaptiveLimitHits,
      finalRawSamples: collected.length,
      deduplicatedSamples: deduplicated.length,
      duplicateSamplesRemoved: collected.length - deduplicated.length
    };
  }
  async resolveConfiguredHistorySource(sourceId, instanceId) {
    try {
      return (0, import_history_source_resolver.selectHistorySource)(sourceId, instanceId, await this.historySourceResolver.resolve(sourceId));
    } catch (error) {
      this.warnInvalidHistoryConfiguration(error.message);
      throw error;
    }
  }
  warnInvalidHistoryConfiguration(message) {
    if (!this.invalidHistoryConfigurationWarnings.has(message)) {
      this.invalidHistoryConfigurationWarnings.add(message);
      this.log.warn(message);
    }
  }
  async retrainSource(sourceId, safeId, source, monitor) {
    var _a;
    this.bootstrappingSources.add(sourceId);
    try {
      monitor.reset();
      if (source.initialTraining === "history" && ((_a = source.historyInstance) == null ? void 0 : _a.trim())) {
        await this.bootstrapSource(sourceId, safeId, source, monitor, {
          anomaly: true,
          predictive: this.shouldBootstrapPredictive(source, this.predictiveModels.get(safeId))
        });
      } else {
        await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "learning", ack: true });
        await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
          val: "Model reset; learning live values",
          ack: true
        });
        await this.persistModels();
      }
    } finally {
      this.bootstrappingSources.delete(sourceId);
      await this.setStateAsync(`sources.${safeId}.retrain`, { val: false, ack: true });
    }
  }
  async runWithConcurrency(tasks, concurrency) {
    const queue = [...tasks];
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          await queue.shift()();
        }
      })
    );
  }
  async withHistoryTimeout(operation) {
    return new Promise((resolve, reject) => {
      const timer = this.setTimeout(() => reject(new Error("History request timed out")), HISTORY_TIMEOUT_MS);
      operation.then(
        (value) => {
          this.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          this.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }
  bootstrapConfigKey(source) {
    var _a, _b, _c;
    return JSON.stringify({
      provider: (_a = source.historyInstance) == null ? void 0 : _a.trim(),
      days: (_b = source.trainingDays) != null ? _b : 30,
      limit: (_c = source.maxHistorySamples) != null ? _c : 1e3
    });
  }
  async writeResult(safeId, result) {
    var _a, _b, _c, _d, _e, _f, _g;
    const base = `sources.${safeId}.analysis`;
    const values = {
      actual: result.actual,
      score: result.score,
      detected: result.detected,
      status: result.status,
      reason: result.reason,
      sampleCount: result.sampleCount,
      baselineScope: result.baselineScope,
      activeContext: result.activeContext,
      baselineSampleCount: result.baselineSampleCount,
      contextSampleCount: result.contextSampleCount,
      relevantSampleCount: result.relevantSampleCount,
      relevantSampleScope: result.relevantSampleScope,
      evaluationAvailable: result.evaluationAvailable
    };
    values.expected = (_a = result.expected) != null ? _a : null;
    values.deviation = (_b = result.deviation) != null ? _b : null;
    if (result.lastAnomaly !== void 0) {
      values.lastAnomaly = new Date(result.lastAnomaly).toISOString();
    }
    const explainability = {
      "anomaly.active": result.statusCode === "anomaly",
      "anomaly.score": result.score,
      "anomaly.severity": result.severity,
      "anomaly.reasonCode": result.reasonCode,
      "anomaly.reason": result.reason,
      "anomaly.since": result.anomalySince ? new Date(result.anomalySince).toISOString() : null,
      "anomaly.lastNormal": result.lastNormal ? new Date(result.lastNormal).toISOString() : null,
      "evaluation.status": result.statusCode,
      "evaluation.currentValue": result.actual,
      "evaluation.expectedLow": (_c = result.expectedLow) != null ? _c : null,
      "evaluation.expectedHigh": (_d = result.expectedHigh) != null ? _d : null,
      "evaluation.decisionLow": (_e = result.decisionLow) != null ? _e : null,
      "evaluation.decisionHigh": (_f = result.decisionHigh) != null ? _f : null,
      "evaluation.baselineType": result.baselineScope,
      "evaluation.baselineSamples": result.baselineSampleCount,
      "evaluation.context": result.activeContext || null,
      "evaluation.timeBucket": (_g = result.timeBucket) != null ? _g : null,
      "evaluation.lastEvaluated": new Date(result.lastEvaluated).toISOString(),
      "detectors.active": result.detectors.map((detector) => detector.name).join(", ") || null,
      "detectors.valueDeviation": null,
      "detectors.rateOfChange": null,
      "detectors.stuck": null,
      "detectors.levelShift": null,
      "detectors.trend": null
    };
    const detectorIds = {
      value: "valueDeviation",
      context: "valueDeviation",
      rate: "rateOfChange",
      stuck: "stuck",
      changePoint: "levelShift",
      trend: "trend"
    };
    for (const detector of result.detectors) {
      explainability[`detectors.${detectorIds[detector.name]}`] = detector.score;
    }
    await Promise.all(
      [...Object.entries(values), ...Object.entries(explainability)].map(
        ([key, value]) => this.setStateAsync(`${key.includes(".") ? `sources.${safeId}` : base}.${key}`, {
          val: value,
          ack: true
        })
      )
    );
  }
  schedulePersistence() {
    if (this.persistTimer) {
      return;
    }
    this.persistTimer = this.setTimeout(() => {
      this.persistTimer = void 0;
      void this.persistModels();
    }, PERSIST_DELAY_MS);
  }
  async persistModels() {
    try {
      const models = Object.fromEntries(
        [...this.monitors].map(([sourceId, monitor]) => [
          this.sourceIds.get(sourceId),
          { ...monitor.toJSON(), configuredSourceId: sourceId }
        ])
      );
      await this.setStateAsync(MODEL_STATE_ID, { val: JSON.stringify(models), ack: true });
    } catch (error) {
      this.log.error(`Could not persist anomaly models: ${error.message}`);
    }
  }
  async persistPredictiveModels() {
    try {
      const models = Object.fromEntries(
        [...this.predictiveModels].flatMap(([safeId, model]) => {
          const data = model.toJSON();
          return data ? [[safeId, data]] : [];
        })
      );
      await this.setStateAsync(PREDICTIVE_MODEL_STATE_ID, { val: JSON.stringify(models), ack: true });
    } catch (error) {
      this.log.warn(`Could not persist predictive models: ${error.message}`);
    }
  }
  createSourceId(sourceId) {
    const normalized = sourceId.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "source";
    const hash = [...sourceId].reduce((value, character) => value * 31 + character.charCodeAt(0) >>> 0, 0).toString(36);
    return `${normalized}_${hash}`;
  }
  onUnload(callback) {
    if (this.persistTimer) {
      this.clearTimeout(this.persistTimer);
    }
    void this.persistModels().finally(callback);
  }
}
if (require.main !== module) {
  module.exports = (options) => new AnomalyDetection(options);
} else {
  (() => new AnomalyDetection())();
}
//# sourceMappingURL=main.js.map
