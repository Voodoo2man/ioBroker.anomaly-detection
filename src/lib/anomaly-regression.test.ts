import { expect } from "chai";
import { median, SampleSeries } from "./model/statistics";
import { SourceMonitor, parseStoredModel } from "./source-monitor";

describe("anomaly library regressions", () => {
	it("keeps rate baselines separate for mature contexts", () => {
		const settings = {
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			timeContext: false,
			enableContext: true,
			enableMad: false,
			enableRate: true,
			enableStuck: false,
			enableChangePoint: false,
			enableTrend: false,
		};
		const monitor = new SourceMonitor(settings);
		let timestamp = 1_000_000;
		for (let index = 0; index < 12; index++) {
			monitor.observe(index, timestamp, "mode=off");
			timestamp += 60_000;
		}
		for (let index = 0; index < 8; index++) {
			const result = monitor.observe(100 + index * 10, timestamp, "mode=on");
			timestamp += 60_000;
			if (index < 6) {
				expect(result?.detectors.some(detector => detector.name === "rate")).to.equal(false);
			}
		}
		const sameContextRate = monitor.observe(180, timestamp, "mode=on");
		expect(sameContextRate?.detectors.find(detector => detector.name === "rate")?.score).to.equal(0);
		const unusualContextRate = monitor.observe(210, timestamp + 60_000, "mode=on");
		expect(unusualContextRate?.detectors.find(detector => detector.name === "rate")?.score).to.equal(100);
	});

	it("does not count time away from a context toward its anomaly duration", () => {
		const settings = {
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			timeContext: false,
			enableContext: true,
			enableRate: false,
			enableChangePoint: false,
			enableTrend: true,
			minimumAnomalyDurationMinutes: 10,
		};
		const monitor = new SourceMonitor(settings);
		for (let index = 0; index < 6; index++) {
			monitor.observe(10 + (index % 2), 3_000_000 + index * 60_000, "mode=on");
		}
		monitor.observe(100, 3_360_000, "mode=on");
		monitor.observe(20, 3_420_000, "mode=off");
		const returned = monitor.observe(100, 4_000_000, "mode=on");
		expect(returned?.detected).to.equal(false);
		expect(returned?.anomalySince).to.equal(4_000_000);
	});

	it("persists bounded context detector state across a restart", () => {
		const settings = {
			enabled: true,
			id: "test.0.value",
			minimumSamples: 5,
			timeContext: false,
			enableContext: true,
			enableRate: false,
			enableChangePoint: false,
			enableTrend: true,
			minimumAnomalyDurationMinutes: 10,
		};
		const monitor = new SourceMonitor(settings);
		for (let index = 0; index < 6; index++) {
			monitor.observe(10 + (index % 2), 2_000_000 + index * 60_000, "mode=on");
		}
		const first = monitor.observe(100, 2_360_000, "mode=on");
		expect(first?.detected).to.equal(false);
		const data = monitor.toJSON();
		expect(data.scopedStates?.["mode=on"].advanced.trend.recent).to.have.length(2);
		const parsed = parseStoredModel(JSON.stringify({ source: data }));
		const restored = new SourceMonitor(settings, parsed.source);
		const recovered = restored.observe(100, 2_960_000, "mode=on");
		expect(recovered?.detected).to.equal(true);
	});

	it("rejects malformed persisted records while recovering valid siblings", () => {
		const valid = new SourceMonitor({ enabled: true, id: "test.0.good" }).toJSON();
		const malformed = {
			...valid,
			value: { global: { values: null }, timeBuckets: {}, contextBuckets: {} },
		};
		const malformedContext = {
			...valid,
			contextualRate: { contexts: { mode: { model: { global: { values: null } }, lastUsed: 1 } } },
		};
		const malformedScopedState = {
			...valid,
			scopedStates: {
				global: {
					advanced: { changePoint: { recent: [], candidateCount: "1" }, trend: { recent: [] } },
					lastUsed: 1,
					detected: false,
				},
			},
		};
		const legacy = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>;
		legacy.schemaVersion = 1;
		delete legacy.context;
		delete legacy.contextualRate;
		delete legacy.scopedStates;
		delete legacy.activeStateScope;
		const parsed = parseStoredModel(
			JSON.stringify({
				bad: malformed,
				badContext: malformedContext,
				badScopedState: malformedScopedState,
				good: valid,
				legacy,
			}),
		);
		expect(parsed).to.have.keys(["good", "legacy"]);
		expect(() => new SourceMonitor({ enabled: true, id: "test.0.good" }, parsed.good)).not.to.throw();
	});

	it("keeps medians finite for large same-sign values and correct across signs", () => {
		const maximum = Number.MAX_VALUE;
		expect(median([maximum, maximum])).to.equal(maximum);
		expect(median([-maximum, maximum])).to.equal(0);
		const series = new SampleSeries(10, [maximum, maximum]);
		expect(series.median()).to.equal(maximum);
		expect(series.mad()).to.equal(0);
	});

	it("does not expose overflowed deviations or expected-range bounds", () => {
		const settings = {
			enabled: true,
			id: "test.0.large",
			minimumSamples: 5,
			timeContext: false,
			enableRate: false,
			enableChangePoint: false,
			enableTrend: false,
		};
		const spread = new SourceMonitor(settings);
		const maximum = Number.MAX_VALUE;
		for (const [index, fraction] of [0.6, 0.7, 0.8, 0.9, 1].entries()) {
			spread.observe(maximum * fraction, 4_000_000 + index);
		}
		const wideRange = spread.observe(maximum * 0.8, 4_000_005)!;
		expect(wideRange.score).to.be.finite;
		expect(wideRange.expectedHigh).to.equal(undefined);
		expect(wideRange.decisionHigh).to.equal(undefined);

		const opposite = new SourceMonitor(settings);
		for (let index = 0; index < 5; index++) {
			opposite.observe(-maximum, 5_000_000 + index);
		}
		const oppositeSign = opposite.observe(maximum, 5_000_005)!;
		expect(oppositeSign.score).to.equal(100);
		expect(oppositeSign.deviation).to.equal(undefined);
	});
});
