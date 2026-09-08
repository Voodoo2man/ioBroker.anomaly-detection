import { expect } from "chai";
import { detectMadDeviation, detectRateDeviation, detectStuck } from "./lib/detectors";
import { SampleSeries } from "./lib/model/statistics";
import { TemporalModel } from "./lib/model/temporal-model";
import { ContextualModel } from "./lib/model/contextual-model";
import { createContextPart } from "./lib/context-value";
import { AdvancedDetectors } from "./lib/advanced-detectors";
import { decisionRangeFor, parseStoredModel, SourceMonitor } from "./lib/source-monitor";
const chartYDomain = (values: readonly number[], bounds: readonly number[] = []): { min: number; max: number } => {
	const numeric = [...values, ...bounds].filter(value => Number.isFinite(value));
	if (numeric.length === 0) {
		return { min: 0, max: 1 };
	}
	const rawMin = Math.min(...numeric);
	const rawMax = Math.max(...numeric);
	const rawSpan = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.01);
	return { min: rawMin >= 0 ? 0 : rawMin - rawSpan * 0.05, max: rawMax + rawSpan * 0.05 };
};
import { scoreDetectors } from "./lib/scoring";
import { sanitizeHistory } from "./lib/history-provider";
import {
	HistorySourceResolver,
	isCompleteInstanceId,
	selectHistorySource,
	type HistoryObjectStore,
} from "./lib/history-source-resolver";
import { cleanupStaleSources, type GeneratedSourceDevice, type SourceCleanupStore } from "./lib/source-cleanup";

const makeSeries = (values: number[]): SampleSeries => new SampleSeries(240, values);

describe("robust statistical detectors", () => {
	it("keeps the chart axis at or above zero for non-negative values", () => {
		expect(chartYDomain([0, 140, 342], [318, 323]).min).to.equal(0);
	});
	it("allows a negative chart axis when real negative values exist", () => {
		expect(chartYDomain([-2, 0, 10]).min).to.be.lessThan(0);
	});
	it("preserves diagnostic timestamps when history is downsampled", () => {
		const samples = sanitizeHistory(
			Array.from({ length: 10 }, (_, index) => ({ val: index, ts: 1_000 + index })),
			4,
			[1_005],
		);
		expect(samples.map(sample => sample.timestamp)).to.include(1_005);
		expect(samples).to.have.length(4);
	});
	it("derives the displayed decision range from the detector threshold", () => {
		const range = decisionRangeFor(320, 2, 3.5, 70);
		expect(range?.low).to.be.closeTo(312.735, 0.001);
		expect(range?.high).to.be.closeTo(327.265, 0.001);
	});
	it("keeps normal values low and identifies an obvious MAD outlier", () => {
		const series = makeSeries([9.8, 10, 10.1, 10.2, 9.9, 10.05]);
		expect(detectMadDeviation(10.1, series, 5, 3.5)?.score).to.be.lessThan(50);
		expect(detectMadDeviation(30, series, 5, 3.5)?.score).to.equal(100);
	});

	it("handles constant, negative, decimal and insufficient samples safely", () => {
		expect(detectMadDeviation(1, makeSeries([1, 1, 1, 1, 1]), 5, 3.5)?.score).to.equal(0);
		expect(detectMadDeviation(2, makeSeries([1, 1, 1, 1, 1]), 5, 3.5)?.score).to.equal(100);
		expect(
			detectMadDeviation(-12.4, makeSeries([-12.2, -12.3, -12.1, -12.2, -12.3]), 5, 3.5)?.score,
		).to.be.greaterThan(0);
		expect(detectMadDeviation(10, makeSeries([10, 11]), 5, 3.5)).to.equal(undefined);
	});

	it("calculates rates over elapsed time and rejects invalid intervals", () => {
		const rates = makeSeries([0.9, 1, 1.1, 1, 0.95]);
		expect(detectRateDeviation(1, rates, 5, 3.5)?.score).to.be.lessThan(50);
		expect(detectRateDeviation(10, rates, 5, 3.5)?.score).to.equal(100);
		expect(detectRateDeviation(undefined, rates, 5, 3.5)).to.equal(undefined);
	});

	it("only declares a stuck value after repeated updates exceed the configured duration", () => {
		expect(detectStuck(1_000, 60_000, 2)).to.equal(undefined);
		expect(detectStuck(1_000, 121_000, 2)?.score).to.be.at.least(50);
	});
});

describe("temporal model", () => {
	it("uses time and weekday context, then falls back to time and global samples", () => {
		const mondayNine = new Date(2026, 0, 5, 9, 0).getTime();
		const sundayNine = new Date(2026, 0, 4, 9, 0).getTime();
		const model = new TemporalModel(60);
		for (let index = 0; index < 5; index++) {
			model.add(10, mondayNine + index, true, true);
		}
		for (let index = 0; index < 5; index++) {
			model.add(20, sundayNine + index, true, true);
		}
		expect(model.baseline(mondayNine, 5, true, true).scope).to.equal("context");
		expect(model.baseline(new Date(2026, 0, 6, 9, 0).getTime(), 5, true, true).scope).to.equal("time");
		expect(model.baseline(new Date(2026, 0, 6, 10, 0).getTime(), 5, true, true).scope).to.equal("global");
	});
});

describe("advanced detection", () => {
	it("keeps context baselines separate and bounds their count", () => {
		const model = new ContextualModel(60, 2);
		for (let index = 0; index < 5; index++) {
			model.add("on=false", 0, index, false, false);
		}
		expect(model.baseline("on=false", 10, 5, false, false)?.series.median()).to.equal(0);
		model.add("mode=eco", 1, 11, false, false);
		model.add("mode=boost", 2, 12, false, false);
		expect(Object.keys(model.toJSON().contexts)).to.deep.equal(["mode=eco", "mode=boost"]);
	});

	it("requires persistence for a level shift and detects a timestamp-based trend", () => {
		const change = new AdvancedDetectors();
		let changeResult;
		for (let index = 0; index < 14; index++) {
			changeResult = change.observe(20, index * 60_000, 0, 2, true, false, 3.5);
		}
		expect(changeResult?.changePoint?.reason).to.equal("Persistent upward level shift detected");
		const trend = new AdvancedDetectors();
		let trendResult;
		for (let index = 0; index < 12; index++) {
			trendResult = trend.observe(index, index * 60 * 60 * 1000, 0, 1, false, true, 3.5);
		}
		expect(trendResult?.trend?.reason).to.equal("Sustained upward trend outside normal behavior");
	});
});

describe("context-aware monitoring", () => {
	const settings = {
		enabled: true,
		id: "alias.0.tv.power",
		minimumSamples: 5,
		timeContext: false,
		enableContext: true,
		enableRate: true,
		enableStuck: false,
		enableChangePoint: true,
		enableTrend: true,
		minimumAnomalyDurationMinutes: 0,
	};
	const on = "alias.0.tv.relay=boolean:true";
	const off = "alias.0.tv.relay=boolean:false";

	it("preserves valid falsy context values and supported string values", () => {
		expect(createContextPart("relay", false)).to.equal("relay=boolean:false");
		expect(createContextPart("relay", true)).to.equal("relay=boolean:true");
		expect(createContextPart("load", 0, 5)).to.equal("load=number:0:5");
		expect(createContextPart("load", 1, 5)).to.equal("load=number:0:5");
		expect(createContextPart("mode", "off")).to.equal("mode=string:off");
		expect(createContextPart("mode", "on")).to.equal("mode=string:on");
	});

	it("uses a mature OFF context for normal zero power and flags an unexpected load", () => {
		const monitor = new SourceMonitor({ ...settings, enableRate: false });
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 6; index++) {
			monitor.observe(300 + (index % 2) * 10, start + index * 60_000, on);
		}
		for (let index = 0; index < 6; index++) {
			monitor.observe(0, start + (index + 6) * 60_000, off);
		}
		const normal = monitor.observe(0, start + 12 * 60_000, off)!;
		expect(normal.expected).to.equal(0);
		expect(normal.score).to.equal(0);
		expect(normal.detected).to.equal(false);
		expect(normal.baselineScope).to.equal("context");
		expect(normal.activeContext).to.equal("alias.0.tv.relay=false");
		expect(normal.baselineSampleCount).to.be.at.least(5);
		expect(normal.contextSampleCount).to.be.at.least(5);
		expect(normal.relevantSampleCount).to.equal(normal.contextSampleCount);
		expect(normal.relevantSampleScope).to.equal("context");
		expect(normal.evaluationAvailable).to.equal(true);
		expect(normal.statusCode).to.equal("normal");
		expect(normal.actual).to.equal(0);
		const anomaly = monitor.observe(150, start + 13 * 60_000, off)!;
		expect(anomaly.score).to.equal(100);
		expect(anomaly.reason).to.equal("Value is significantly outside the normal range for the current context");
	});

	it("keeps zero distinct from missing values across context changes", () => {
		const monitor = new SourceMonitor({
			...settings,
			enableRate: false,
			minimumAnomalyDurationMinutes: 0,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 6; index++) {
			monitor.observe(0, start + index * 60_000, off);
		}
		for (let index = 0; index < 6; index++) {
			monitor.observe(320, start + (index + 6) * 60_000, on);
		}
		const onResult = monitor.observe(320, start + 12 * 60_000, on)!;
		expect(onResult.actual).to.equal(320);
		expect(onResult.statusCode).to.equal("normal");
		const offResult = monitor.observe(0, start + 13 * 60_000, off)!;
		expect(offResult.actual).to.equal(0);
		expect(offResult.statusCode).to.equal("normal");
		expect(monitor.observe(null, start + 14 * 60_000, off)).to.equal(undefined);
		expect(monitor.observe(undefined, start + 15 * 60_000, off)).to.equal(undefined);
	});

	it("keeps a new valid context in learning instead of scoring it against an unrelated global baseline", () => {
		const monitor = new SourceMonitor(settings);
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 30; index++) {
			monitor.observe(300, start + index * 60_000, on);
		}
		const newOffContext = monitor.observe(0, start + 30 * 60_000, off)!;
		expect(newOffContext.expected).to.equal(undefined);
		expect(newOffContext.score).to.equal(0);
		expect(newOffContext.status).to.equal("learning");
		expect(newOffContext.reason).to.equal("Insufficient data for the current context");
		expect(newOffContext.baselineScope).to.equal("insufficient");
		expect(newOffContext.baselineSampleCount).to.equal(0);
		expect(newOffContext.contextSampleCount).to.equal(1);
		expect(newOffContext.relevantSampleCount).to.equal(1);
		expect(newOffContext.relevantSampleScope).to.equal("context");
		expect(newOffContext.evaluationAvailable).to.equal(false);
		expect(newOffContext.sampleCount).to.equal(31);
	});

	it("shows the global baseline reason when no usable context baseline is selected", () => {
		const monitor = new SourceMonitor({ ...settings, enableContext: false, enableRate: false });
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 5; index++) {
			monitor.observe(300, start + index * 60_000);
		}
		const result = monitor.observe(0, start + 5 * 60_000)!;
		expect(result.expected).to.equal(300);
		expect(result.score).to.equal(100);
		expect(result.baselineScope).to.equal("global");
		expect(result.reason).to.equal("Value is significantly outside the learned global normal range");
	});

	it("suppresses rate and residual detectors at context transitions and restores context diagnostics", () => {
		const monitor = new SourceMonitor(settings);
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 6; index++) {
			monitor.observe(300, start + index * 60_000, on);
		}
		for (let index = 0; index < 6; index++) {
			monitor.observe(0, start + (index + 6) * 60_000, off);
		}
		const switchedOn = monitor.observe(300, start + 12 * 60_000, on)!;
		expect(switchedOn.score).to.equal(0);
		expect(switchedOn.reason).to.equal("Normal");
		expect(switchedOn.baselineScope).to.equal("context");
		const restored = new SourceMonitor(settings, monitor.toJSON());
		const restoredOff = restored.observe(0, start + 13 * 60_000, off)!;
		expect(restoredOff.score).to.equal(0);
		expect(restoredOff.baselineScope).to.equal("context");
		expect(restoredOff.activeContext).to.equal("alias.0.tv.relay=false");
		expect(restoredOff.baselineSampleCount).to.be.at.least(5);
	});

	it("does not carry ON level-shift state into a learned OFF context", () => {
		const monitor = new SourceMonitor({
			...settings,
			enableRate: false,
			enableTrend: true,
			enableChangePoint: true,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 8; index++) {
			monitor.observe(0, start + index * 60_000, off);
		}
		for (let index = 0; index < 8; index++) {
			monitor.observe(320, start + (index + 8) * 60_000, on);
		}
		monitor.observe(320, start + 16 * 60_000, on);
		monitor.observe(100, start + 17 * 60_000, on);
		monitor.observe(320, start + 18 * 60_000, on);
		const result = monitor.observe(0, start + 19 * 60_000, off)!;
		expect(result.expected).to.equal(0);
		expect(result.score).to.equal(0);
		expect(result.reasonCode).to.equal("normal");
		expect(result.statusCode).to.equal("normal");
		expect(result.detectors.some(detector => detector.name === "changePoint")).to.equal(false);
		expect(result.detectors.some(detector => detector.name === "trend")).to.equal(false);
	});
});

describe("scoring and learning lifecycle", () => {
	it("combines enabled detectors, clamps output, and boosts detector agreement", () => {
		expect(scoreDetectors([]).score).to.equal(0);
		const one = scoreDetectors([{ name: "value", score: 40, reason: "value" }]);
		const several = scoreDetectors([
			{ name: "value", score: 100, reason: "value" },
			{ name: "rate", score: 100, reason: "rate" },
		]);
		expect(one.score).to.equal(40);
		expect(one.reason).to.equal("Normal");
		expect(one.reasonCode).to.equal("normal");
		expect(several.score).to.equal(100);
		expect(several.reason).to.equal("Multiple anomaly detectors agree");
	});

	it("returns explainability details without treating detector scores as contributions", () => {
		const monitor = new SourceMonitor({
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			enableRate: false,
			anomalyThreshold: 70,
			minimumAnomalyDurationMinutes: 0,
			timeContext: false,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 5; index++) {
			const normal = monitor.observe(10, start + index * 60_000)!;
			expect(normal.statusCode).to.equal(index < 4 ? "insufficient_data" : "normal");
		}
		const anomaly = monitor.observe(100, start + 5 * 60_000)!;
		expect(anomaly.statusCode).to.equal("anomaly");
		expect(anomaly.reasonCode).to.equal("unexpected_value");
		expect(anomaly.expectedLow).to.equal(10);
		expect(anomaly.expectedHigh).to.equal(10);
		expect(anomaly.detectors).to.deep.include({ name: "value", score: 100, reasonCode: "unexpected_value" });
	});

	it("distinguishes a currently deviating value from a persisted anomaly", () => {
		const monitor = new SourceMonitor({
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			enableRate: false,
			anomalyThreshold: 70,
			minimumAnomalyDurationMinutes: 15,
			timeContext: false,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 5; index++) {
			monitor.observe(10, start + index * 60_000);
		}
		const deviating = monitor.observe(100, start + 5 * 60_000)!;
		expect(deviating.statusCode).to.equal("deviating");
		expect(deviating.detected).to.equal(false);
		expect(monitor.diagnosticSnapshots.at(-1)?.statusCode).to.equal("deviating");

		const confirmed = monitor.observe(100, start + 20 * 60_000)!;
		expect(confirmed.statusCode).to.equal("anomaly");
		expect(confirmed.detected).to.equal(true);
		expect(monitor.diagnosticSnapshots.at(-1)?.statusCode).to.equal("anomaly");
	});

	it("does not learn strong anomalies and restores a persisted model safely", () => {
		const monitor = new SourceMonitor({
			enabled: true,
			id: "test.0.value",
			enableRate: false,
			anomalyThreshold: 70,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 30; index++) {
			monitor.observe(10, start + index * 60_000);
		}
		const before = monitor.toJSON().value.global.values.length;
		const anomaly = monitor.observe(100, start + 31 * 60_000);
		expect(anomaly?.score).to.equal(100);
		expect(monitor.toJSON().value.global.values.length).to.equal(before);
		const restored = new SourceMonitor({ enabled: true, id: "test.0.value", enableRate: false }, monitor.toJSON());
		expect(restored.observe(10, start + 32 * 60_000)?.status).to.equal("monitoring");
		expect(parseStoredModel("not json")).to.deep.equal({});
		expect(parseStoredModel(JSON.stringify({ invalid: { schemaVersion: 99 } }))).to.deep.equal({});
	});

	it("reports a normal current evaluation after an anomaly recovers", () => {
		const monitor = new SourceMonitor({
			enabled: true,
			id: "test.0.value",
			enableRate: false,
			minimumAnomalyDurationMinutes: 0,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		for (let index = 0; index < 30; index++) {
			monitor.observe(10, start + index * 60_000);
		}
		const anomaly = monitor.observe(100, start + 31 * 60_000);
		expect(anomaly?.score).to.equal(100);
		expect(anomaly?.detected).to.equal(true);
		const recovered = monitor.observe(10, start + 32 * 60_000);
		expect(recovered?.score).to.equal(0);
		expect(recovered?.detected).to.equal(false);
		expect(recovered?.reason).to.equal("Normal");
	});
});

describe("historical bootstrap", () => {
	it("sanitizes, orders, deduplicates and range-samples history responses", () => {
		const history = sanitizeHistory(
			{
				result: [
					{ val: "4", ts: 4_000 },
					{ val: 1, ts: 1_000 },
					{ val: "invalid", ts: 2_000 },
					{ val: 2, ts: 2_000 },
					{ val: 3, ts: 3_000 },
					{ val: 22, ts: 2_000 },
					{ val: 5, ts: 5_000 },
				],
			},
			3,
		);
		expect(history).to.deep.equal([
			{ value: 1, timestamp: 1_000 },
			{ value: 3, timestamp: 3_000 },
			{ value: 5, timestamp: 5_000 },
		]);
		expect(sanitizeHistory([], 0)).to.deep.equal([]);
	});

	it("uses historical values and rates without inferring a stuck state across gaps", () => {
		const monitor = new SourceMonitor({
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			enableStuck: true,
			stuckDurationMinutes: 1,
		});
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		const samples = [10, 10, 10, 10, 10, 10_000].map((value, index) => ({
			value,
			timestamp: start + index * 60_000,
		}));
		const imported = monitor.bootstrapFromHistory(
			samples,
			"influxdb.0",
			"test.0.value",
			start,
			start + 6 * 60_000,
			"config-a",
		);
		expect(imported).to.equal(5);
		expect(monitor.hasSufficientData).to.equal(true);
		expect(monitor.bootstrapMatches("config-a")).to.equal(true);
		expect(monitor.toJSON().rate.global.values).to.have.length(4);
		const next = monitor.observe(10, start + 8 * 60_000);
		expect(next?.reason).to.not.include("stuck");
		const restored = new SourceMonitor({ enabled: true, id: "test.0.value", minimumSamples: 5 }, monitor.toJSON());
		expect(restored.bootstrapMatches("config-a")).to.equal(true);
		expect(restored.bootstrapMatches("config-b")).to.equal(false);
	});

	it("reports retained model samples rather than the unbounded import size", () => {
		const monitor = new SourceMonitor({ enabled: true, id: "test.0.value", minimumSamples: 5 });
		const start = new Date(2026, 0, 1, 12, 0).getTime();
		const samples = Array.from({ length: 300 }, (_, index) => ({ value: 10, timestamp: start + index * 60_000 }));
		expect(monitor.bootstrapFromHistory(samples, "history.0", "test.0.value", start, start, "config-a")).to.equal(
			300,
		);
		expect(monitor.sampleCount).to.equal(240);
	});
});

const historyState = (custom: Record<string, unknown> = {}, alias?: ioBroker.StateCommon["alias"]): ioBroker.Object =>
	({
		type: "state",
		common: { name: "History state", type: "number", role: "value", read: true, write: false, custom, alias },
		native: {},
	}) as ioBroker.StateObject;

const historyInstance = (enabled = true, getHistory = true): ioBroker.Object =>
	({
		type: "instance",
		common: { name: "History provider", enabled, getHistory },
		native: {},
	}) as ioBroker.InstanceObject;

const resolverFor = (objects: Record<string, ioBroker.Object>): HistorySourceResolver => {
	const store: HistoryObjectStore = {
		getForeignObjectAsync: id => Promise.resolve(objects[id]),
	};
	return new HistorySourceResolver(store);
};

describe("history source resolution", () => {
	it("returns only enabled supported providers for a direct state", async () => {
		const resolver = resolverFor({
			"sensor.0.value": historyState({ "influxdb.0": { enabled: true }, "history.0": { enabled: true } }),
			"system.adapter.influxdb.0": historyInstance(),
			"system.adapter.history.0": historyInstance(),
		});
		expect(await resolver.resolve("sensor.0.value")).to.deep.equal([
			{ instanceId: "history.0", sourceId: "sensor.0.value" },
			{ instanceId: "influxdb.0", sourceId: "sensor.0.value" },
		]);
	});

	it("excludes unconfigured, disabled and non-history providers", async () => {
		const resolver = resolverFor({
			"sensor.0.value": historyState({
				"influxdb.0": { enabled: false },
				"history.0": { enabled: true },
				"sql.0": { enabled: true },
			}),
			"system.adapter.history.0": historyInstance(false),
			"system.adapter.sql.0": historyInstance(true, false),
		});
		expect(await resolver.resolve("sensor.0.value")).to.deep.equal([]);
	});

	it("returns no provider for a state without history and supports sql instances", async () => {
		const resolver = resolverFor({
			"sensor.0.none": historyState(),
			"sensor.0.sql": historyState({ "sql.1": { enabled: true } }),
			"system.adapter.sql.1": historyInstance(),
		});
		expect(await resolver.resolve("sensor.0.none")).to.deep.equal([]);
		expect(await resolver.resolve("sensor.0.sql")).to.deep.equal([
			{ instanceId: "sql.1", sourceId: "sensor.0.sql" },
		]);
	});

	it("resolves alias history first and otherwise uses the read target", async () => {
		const resolver = resolverFor({
			"alias.0.water": historyState(
				{ "history.0": { enabled: true }, "influxdb.0": { enabled: true } },
				{ id: { read: "device.0.water", write: "device.0.water" } },
			),
			"device.0.water": historyState({ "influxdb.0": { enabled: true }, "sql.0": { enabled: true } }),
			"system.adapter.history.0": historyInstance(),
			"system.adapter.influxdb.0": historyInstance(),
			"system.adapter.sql.0": historyInstance(),
		});
		expect(await resolver.resolve("alias.0.water")).to.deep.equal([
			{ instanceId: "history.0", sourceId: "alias.0.water" },
			{ instanceId: "influxdb.0", sourceId: "alias.0.water" },
			{ instanceId: "sql.0", sourceId: "device.0.water" },
		]);
	});

	it("handles malformed aliases safely and rejects invalid persisted selections before a request", async () => {
		const resolver = resolverFor({
			"alias.0.broken": historyState({}, { id: { read: "", write: "" } }),
			"alias.0.missing": historyState({}, { id: "device.0.missing" }),
		});
		expect(await resolver.resolve("alias.0.broken")).to.deep.equal([]);
		expect(await resolver.resolve("alias.0.missing")).to.deep.equal([]);
		expect(isCompleteInstanceId("0")).to.equal(false);
		expect(() => selectHistorySource("alias.0.broken", "0", [])).to.throw("Invalid history instance '0'");
		expect(() => selectHistorySource("sensor.0.value", "influxdb.0", [])).to.throw("not enabled");
		expect(
			selectHistorySource("sensor.0.value", "influxdb.0", [
				{ instanceId: "influxdb.0", sourceId: "sensor.0.value" },
			]),
		).to.deep.equal({ instanceId: "influxdb.0", sourceId: "sensor.0.value" });
	});
});

const cleanupStoreFor = (devices: GeneratedSourceDevice[]): { store: SourceCleanupStore; deleted: string[] } => {
	const deleted: string[] = [];
	return {
		store: {
			listGeneratedSourceDevices: () => Promise.resolve(devices),
			deleteGeneratedSourceTree: id => {
				deleted.push(id);
				return Promise.resolve();
			},
		},
		deleted,
	};
};

describe("generated source cleanup", () => {
	const namespace = "anomaly-detection.0";
	const sourceIds = new Map([
		["adapter.0.kept", "adapter_0_kept_a"],
		["adapter.0.removed", "adapter_0_removed_b"],
		["adapter.0.same-name", "adapter_0_same_name_c"],
		["adapter_0_same-name", "adapter_0_same_name_d"],
	]);
	const safeId = (sourceId: string): string => sourceIds.get(sourceId) ?? "unknown";
	const model = {} as ReturnType<typeof parseStoredModel>[string];

	it("deletes only the removed source tree and its persisted model", async () => {
		const { store, deleted } = cleanupStoreFor([
			{ id: `${namespace}.sources.adapter_0_kept_a`, sourceId: "adapter.0.kept" },
			{ id: `${namespace}.sources.adapter_0_removed_b`, sourceId: "adapter.0.removed" },
		]);
		const result = await cleanupStaleSources(
			store,
			namespace,
			new Set(["adapter.0.kept"]),
			{
				adapter_0_kept_a: { ...model, configuredSourceId: "adapter.0.kept" },
				adapter_0_removed_b: { ...model, configuredSourceId: "adapter.0.removed" },
			},
			safeId,
		);
		expect(deleted).to.deep.equal(["sources.adapter_0_removed_b"]);
		expect(result.models).to.deep.equal({ adapter_0_kept_a: { ...model, configuredSourceId: "adapter.0.kept" } });
		expect(result.removedSourceIds).to.deep.equal(["adapter.0.removed"]);
	});

	it("uses persisted source metadata rather than a model key alone", async () => {
		const { store } = cleanupStoreFor([]);
		const result = await cleanupStaleSources(
			store,
			namespace,
			new Set(["adapter.0.kept"]),
			{ adapter_0_kept_a: { ...model, configuredSourceId: "adapter.0.removed" } },
			safeId,
		);
		expect(result.models).to.deep.equal({});
	});

	it("retains configured sources even when their original state is temporarily unavailable", async () => {
		const { store, deleted } = cleanupStoreFor([
			{ id: `${namespace}.sources.adapter_0_kept_a`, sourceId: "adapter.0.kept" },
		]);
		const result = await cleanupStaleSources(
			store,
			namespace,
			new Set(["adapter.0.kept"]),
			{ adapter_0_kept_a: model },
			safeId,
		);
		expect(deleted).to.deep.equal([]);
		expect(result.models).to.deep.equal({ adapter_0_kept_a: model });
	});

	it("uses source metadata to distinguish similarly sanitized source IDs", async () => {
		const { store, deleted } = cleanupStoreFor([
			{ id: `${namespace}.sources.adapter_0_same_name_c`, sourceId: "adapter.0.same-name" },
			{ id: `${namespace}.sources.adapter_0_same_name_d`, sourceId: "adapter_0_same-name" },
		]);
		const result = await cleanupStaleSources(
			store,
			namespace,
			new Set(["adapter.0.same-name"]),
			{ adapter_0_same_name_c: model, adapter_0_same_name_d: model },
			safeId,
		);
		expect(deleted).to.deep.equal(["sources.adapter_0_same_name_d"]);
		expect(result.models).to.deep.equal({ adapter_0_same_name_c: model });
	});

	it("retains unrecognized trees and lets a re-added source start without an old model", async () => {
		const { store, deleted } = cleanupStoreFor([
			{ id: `${namespace}.sources.user_created`, sourceId: "adapter.0.removed" },
			{ id: "other-adapter.0.sources.adapter_0_removed_b", sourceId: "adapter.0.removed" },
		]);
		const removed = await cleanupStaleSources(store, namespace, new Set(), { adapter_0_removed_b: model }, safeId);
		expect(deleted).to.deep.equal([]);
		expect(removed.models).to.deep.equal({});
		const readded = await cleanupStaleSources(
			store,
			namespace,
			new Set(["adapter.0.removed"]),
			removed.models,
			safeId,
		);
		expect(readded.models).to.deep.equal({});
	});
});
