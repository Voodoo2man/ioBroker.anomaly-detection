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
const MODEL_STATE_ID = "models";
const PERSIST_DELAY_MS = 3e4;
const HISTORY_TIMEOUT_MS = 3e4;
const HISTORY_CONCURRENCY = 2;
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
  persistTimer;
  constructor(options = {}) {
    super({ ...options, name: "anomaly-detection" });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    await this.ensureModelState();
    const persistedValue = (_a = await this.getStateAsync(MODEL_STATE_ID)) == null ? void 0 : _a.val;
    let stored = (0, import_source_monitor.parseStoredModel)(persistedValue);
    if (typeof persistedValue === "string" && persistedValue !== "" && persistedValue !== "{}" && Object.keys(stored).length === 0) {
      this.log.warn("Ignoring corrupt or incompatible persisted anomaly models");
    }
    const configuredSourceIds = new Set(
      ((_b = this.config.sources) != null ? _b : []).flatMap((source) => {
        var _a2;
        return ((_a2 = source.id) == null ? void 0 : _a2.trim()) ? [source.id.trim()] : [];
      })
    );
    stored = await this.cleanupStaleSources(configuredSourceIds, stored);
    const configuredIds = /* @__PURE__ */ new Set();
    const bootstrapTasks = [];
    for (const source of (_c = this.config.sources) != null ? _c : []) {
      if (!source.enabled || !((_d = source.id) == null ? void 0 : _d.trim())) {
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
      this.sourceIds.set(id, safeId);
      const monitor = new import_source_monitor.SourceMonitor(source, stored[safeId]);
      this.monitors.set(id, monitor);
      this.sources.set(safeId, source);
      if (object == null ? void 0 : object.common.unit) {
        this.sourceUnits.set(id, object.common.unit);
      }
      for (const context of (_e = source.contextStates) != null ? _e : []) {
        const contextId = context && typeof context.id === "string" ? context.id.trim() : "";
        if (!contextId) {
          continue;
        }
        const contextObject = await this.getForeignObjectAsync(contextId);
        const name = (_f = contextObject == null ? void 0 : contextObject.common) == null ? void 0 : _f.name;
        if (typeof name === "string") {
          this.contextNames.set(contextId, name);
        } else if (name && typeof name === "object") {
          const localized = name;
          const value = (_h = (_g = localized.de) != null ? _g : localized.en) != null ? _h : Object.values(localized)[0];
          if (typeof value === "string") {
            this.contextNames.set(contextId, value);
          }
        }
      }
      await this.registerContexts(id, source);
      await this.ensureSourceObjects(safeId, source, object == null ? void 0 : object.common.unit);
      this.subscribeForeignStates(id);
      if (this.shouldBootstrap(source, monitor)) {
        bootstrapTasks.push(() => this.bootstrapSource(id, safeId, source, monitor));
      }
    }
    this.subscribeStates("sources.*.retrain");
    await this.runWithConcurrency(bootstrapTasks, HISTORY_CONCURRENCY);
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
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      return {
        id: sourceId,
        safeId,
        name: ((_a = this.sources.get(safeId)) == null ? void 0 : _a.name) || sourceId,
        unit: this.sourceUnits.get(sourceId),
        contextLabels: Object.fromEntries(
          ((_c = (_b = this.sources.get(safeId)) == null ? void 0 : _b.contextStates) != null ? _c : []).filter((context) => context && typeof context.id === "string" && context.id.trim()).map((context) => {
            const contextId = context.id.trim();
            return [contextId, this.contextNames.get(contextId) || contextId];
          })
        ),
        evaluation: (_i = this.evaluations.get(sourceId)) != null ? _i : {
          statusCode: ((_d = this.monitors.get(sourceId)) == null ? void 0 : _d.hasSufficientData) ? "normal" : "learning",
          severity: "normal",
          sampleCount: (_f = (_e = this.monitors.get(sourceId)) == null ? void 0 : _e.sampleCount) != null ? _f : 0,
          requiredSamples: (_h = (_g = this.sources.get(safeId)) == null ? void 0 : _g.minimumSamples) != null ? _h : 30
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
    try {
      const result = monitor.observe(
        state.val,
        typeof state.ts === "number" ? state.ts : Date.now(),
        this.contextKey(id)
      );
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
      this.schedulePersistence();
    } catch (error) {
      this.log.error(`Could not process source state ${id}: ${error.message}`);
    }
  }
  async registerContexts(sourceId, source) {
    var _a, _b, _c;
    if (!source.enableContext) {
      return;
    }
    if (((_b = (_a = source.contextStates) == null ? void 0 : _a.length) != null ? _b : 0) > 3) {
      this.warnContext(`Only the first 3 context states are used for ${sourceId}`);
    }
    for (const context of ((_c = source.contextStates) != null ? _c : []).filter((item) => item && typeof item.id === "string" && item.id.trim()).slice(0, 3)) {
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
    const parts = ((_a = source.contextStates) != null ? _a : []).filter((item) => item && typeof item.id === "string" && item.id.trim()).slice(0, 3).map((context) => {
      const value = values == null ? void 0 : values.get(context.id.trim());
      if (typeof value === "string" && value.trim() && value.length <= 96) {
        const categoryKey = `${sourceId}\0${context.id}`;
        let categories = this.contextCategories.get(categoryKey);
        if (!categories) {
          categories = /* @__PURE__ */ new Set();
          this.contextCategories.set(categoryKey, categories);
        }
        if (!categories.has(value) && categories.size >= 16) {
          this.warnContext(`Ignoring additional categorical values for ${context.id}; limit is 16`);
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
    const base = `sources.${safeId}`;
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
  async bootstrapSource(sourceId, safeId, source, monitor) {
    var _a, _b, _c, _d;
    const providerName = source.historyInstance.trim();
    const end = Date.now();
    const start = end - Math.max(7, (_a = source.trainingDays) != null ? _a : 30) * 24 * 60 * 60 * 1e3;
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
      const raw = await this.withHistoryTimeout(
        provider.getHistory(historySource.sourceId, start, end, (_b = source.maxHistorySamples) != null ? _b : 1e3)
      );
      const samples = (0, import_history_provider.sanitizeHistory)(raw, (_c = source.maxHistorySamples) != null ? _c : 1e3);
      if (samples.length === 0) {
        throw new Error("History provider returned no valid samples");
      }
      monitor.reset();
      const imported = monitor.bootstrapFromHistory(
        samples,
        providerName,
        historySource.sourceId,
        start,
        end,
        this.bootstrapConfigKey(source)
      );
      if (imported === 0) {
        throw new Error("No usable samples remained after historical outlier filtering");
      }
      await this.persistModels();
      await this.setStateAsync(`sources.${safeId}.analysis.sampleCount`, { val: monitor.sampleCount, ack: true });
      const status = monitor.hasSufficientData && ((_d = source.autoStartMonitoringAfterImport) != null ? _d : true) ? "monitoring" : "learning";
      await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: status, ack: true });
      await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
        val: `Historical training completed (${imported} samples)`,
        ack: true
      });
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
    try {
      monitor.reset();
      if (source.initialTraining === "history" && ((_a = source.historyInstance) == null ? void 0 : _a.trim())) {
        await this.bootstrapSource(sourceId, safeId, source, monitor);
      } else {
        await this.setStateAsync(`sources.${safeId}.analysis.status`, { val: "learning", ack: true });
        await this.setStateAsync(`sources.${safeId}.analysis.bootstrapStatus`, {
          val: "Model reset; learning live values",
          ack: true
        });
        await this.persistModels();
      }
    } finally {
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
      contextSampleCount: result.contextSampleCount
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
