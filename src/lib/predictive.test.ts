import { expect } from "chai";
import {
	PREDICTIVE_ALGORITHM_VERSION,
	PredictiveModel,
	PredictiveTrainingQueue,
	classifyPredictiveQuality,
	meanAbsoluteError,
	normalizePredictiveSettings,
	predictiveHistorySpanMinutes,
} from "./predictive";
import type { PredictiveModelData, PredictiveResult } from "./predictive";

describe("predictive forecasting", () => {
	it("keeps predictive disabled by default", () => {
		const model = new PredictiveModel(normalizePredictiveSettings());
		expect(model.train().status).to.equal("disabled");
	});

	it("normalizes predictive limits and update intervals", () => {
		expect(normalizePredictiveSettings().updateIntervalMinutes).to.equal(30);
		expect(normalizePredictiveSettings({ updateIntervalMinutes: 2 }).updateIntervalMinutes).to.equal(5);
		expect(normalizePredictiveSettings({ updateIntervalMinutes: 5 }).updateIntervalMinutes).to.equal(5);
		expect(normalizePredictiveSettings({ horizonMinutes: 999 }).horizonMinutes).to.equal(360);
		expect(normalizePredictiveSettings({ maximumTrainingPoints: 99999 }).maximumTrainingPoints).to.equal(10000);
	});

	it("requests a bounded multi-day history for automatic seasonality", () => {
		expect(
			predictiveHistorySpanMinutes({ enabled: true, horizonMinutes: 300, seasonalityMode: "auto" }, 1),
		).to.equal(10080);
		expect(
			predictiveHistorySpanMinutes({ enabled: true, horizonMinutes: 300, seasonalityMode: "off" }, 1),
		).to.equal(10080);
	});

	it("selects a robust time-of-day profile when it wins the holdout", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				seasonalityMode: "off",
				horizonMinutes: 60,
			}),
		);
		for (let index = 0; index < 7 * 24 * 60; index += 5) {
			const minute = index % (24 * 60);
			model.add(40 + 8 * Math.sin((minute / (24 * 60)) * Math.PI * 2), index * 60_000);
		}
		const result = model.train();
		expect(result.diagnostics?.model.timeOfDayAvailable).to.equal(true);
		expect(result.diagnostics?.quality.timeOfDay.available).to.equal(true);
		expect(result.selectedModelType).to.equal("timeOfDay");
	});

	it("runs predictive tasks serially and isolates task errors", async () => {
		const queue = new PredictiveTrainingQueue();
		const events: string[] = [];
		const first = queue.enqueue(async () => {
			events.push("first-start");
			await Promise.resolve();
			events.push("first-error");
			throw new Error("expected");
		});
		const second = queue.enqueue(() => {
			events.push("second");
		});
		let rejected = false;
		try {
			await first;
		} catch (error) {
			rejected = (error as Error).message === "expected";
		}
		expect(rejected).to.equal(true);
		await second;
		expect(events).to.deep.equal(["first-start", "first-error", "second"]);
	});

	it("reports learning until the configured minimum is reached", () => {
		const model = new PredictiveModel(normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 }));
		for (let index = 0; index < 9; index++) {
			model.add(index, index * 60_000);
		}
		expect(model.train().status).to.equal("learning");
		expect(model.train().learningReason).to.equal("insufficientSamples");
	});

	it("leaves learning once the minimum number of usable samples is reached", () => {
		for (const count of [30, 141]) {
			const model = new PredictiveModel(
				normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30, seasonalPeriodMinutes: 0 }),
			);
			for (let index = 0; index < count; index++) {
				model.add(10 + (index % 3), index * 60_000);
			}
			expect(model.train().status).to.not.equal("learning");
		}
	});

	it("restores a trained status after restart without persisting raw samples", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30 });
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 141; index++) {
			original.add(10, index * 60_000);
		}
		const trained = original.train(141 * 60_000);
		const restored = new PredictiveModel(settings, original.toJSON());
		expect(trained.status).to.not.equal("learning");
		expect(restored.forecast(142 * 60_000).status).to.equal(trained.status);
		expect(restored.forecast(142 * 60_000).trainingSampleCount).to.equal(141);
		expect(restored.toJSON()?.trainingBasis).to.have.length(141);
	});

	it("keeps a persisted model active while collecting insufficient live samples", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 30,
			seasonalityMode: "off",
		});
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 40; index++) {
			original.add(10 + (index % 3), index * 60_000);
		}
		const trained = original.train(40 * 60_000, "history");
		const restored = new PredictiveModel(settings, original.toJSON());

		const initial = restored.train(41 * 60_000);
		expect(initial.status).to.equal(trained.status);
		expect(initial.trainingSampleCount).to.equal(trained.trainingSampleCount);
		expect(initial.trainingSource).to.equal("history");
		expect(initial.points.length).to.be.greaterThan(0);

		for (let index = 0; index < 5; index++) {
			restored.add(11, (41 + index) * 60_000);
		}
		const collecting = restored.train(46 * 60_000);
		expect(collecting.status).to.equal(trained.status);
		expect(collecting.trainingSampleCount).to.equal(trained.trainingSampleCount);
		expect(collecting.trainingSource).to.equal("history");
		expect(collecting.points.length).to.be.greaterThan(0);
	});

	it("replaces a persisted model only after enough new live samples are available", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 12; index++) {
			original.add(10, index * 60_000);
		}
		original.train(12 * 60_000, "history");
		const restored = new PredictiveModel(settings, original.toJSON());
		for (let index = 0; index < 10; index++) {
			restored.add(20, (12 + index) * 60_000);
		}

		const retrained = restored.train(22 * 60_000, "live");
		expect(retrained.trainingSource).to.equal("mixed");
		expect(retrained.trainingSampleCount).to.be.at.least(settings.minimumTrainingSamples);
		expect(restored.toJSON()?.trainingSource).to.equal("mixed");
		expect(restored.toJSON()?.trainingBasis).to.have.length(retrained.trainingSampleCount);
	});

	it("deduplicates timestamps with live values taking precedence", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		const model = new PredictiveModel(settings);
		for (let index = 0; index < 10; index++) {
			model.add(index, index * 60_000, "history");
		}
		model.add(99, 9 * 60_000, "live");
		const result = model.train(10 * 60_000, "history");
		const basis = model.toJSON()?.trainingBasis ?? [];
		expect(result.trainingSampleCount).to.be.at.most(settings.maximumTrainingPoints);
		expect(basis.filter(sample => sample.timestamp === 9 * 60_000)).to.have.length(1);
		expect(basis.at(-1)?.value).to.equal(99);
	});

	it("keeps a live-only rolling basis live across restart", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		const model = new PredictiveModel(settings);
		for (let index = 0; index < 12; index++) {
			model.add(index, index * 60_000);
		}
		model.train(12 * 60_000, "live");
		const restored = new PredictiveModel(settings, model.toJSON());
		for (let index = 12; index < 22; index++) {
			restored.add(index, index * 60_000);
		}
		const result = restored.train(22 * 60_000, "live");
		expect(result.trainingSource).to.equal("live");
	});

	it("keeps a new model in learning state until its first training completes", () => {
		const model = new PredictiveModel(normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 }));
		for (let index = 0; index < 3; index++) {
			model.add(index, index * 60_000);
		}
		const result = model.train();
		expect(result.status).to.equal("learning");
		expect(result.trainingSampleCount).to.equal(3);
	});

	it("does not impose an additional seasonal sample requirement when disabled", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30, seasonalPeriodMinutes: 0 }),
		);
		for (let index = 0; index < 30; index++) {
			model.add(index, index * 60_000);
		}
		expect(model.train().status).to.not.equal("learning");
	});

	it("reproduces a repeated cycle with multiple forecast points", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				seasonalPeriodMinutes: 10,
				horizonMinutes: 30,
			}),
		);
		for (let index = 0; index < 60; index++) {
			model.add(20 + 5 * Math.sin(((index % 10) * Math.PI * 2) / 10), index * 60_000);
		}
		const result = model.train(60 * 60_000);
		const values = result.points.map(point => point.value);
		expect(result.status).to.equal("ready");
		expect(values.length).to.be.greaterThan(5);
		expect(Math.max(...values) - Math.min(...values)).to.be.greaterThan(5);
	});

	it("regularizes irregular timestamps before forecasting", () => {
		const model = new PredictiveModel(normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 20 }));
		for (let index = 0; index < 30; index++) {
			model.add(index % 4, index * 60_000 + (index % 3) * 17_000);
		}
		const result = model.train();
		expect(result.points.every(point => Number.isFinite(point.value))).to.equal(true);
	});

	it("distributes forecast timestamps across the configured horizon", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30, horizonMinutes: 300 }),
		);
		for (let index = 0; index < 120; index++) {
			model.add(50, index * 60_000);
		}
		const generatedAt = 10_000_000;
		const result = model.train(generatedAt);
		expect(result.points.length).to.equal(300);
		expect(result.points[0].timestamp).to.equal(generatedAt + 60_000);
		expect(result.points.at(-1)?.timestamp).to.equal(generatedAt + 300 * 60_000);
		expect(
			result.points.every((point, index) => index === 0 || point.timestamp > result.points[index - 1].timestamp),
		).to.equal(true);
	});

	it("detects and selects a stable automatic period", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				seasonalityMode: "auto",
				seasonalPeriodMinutes: 0,
			}),
		);
		for (let index = 0; index < 120; index++) {
			model.add(20 + 5 * Math.sin(((index % 10) * Math.PI * 2) / 10), index * 60_000);
		}
		const result = model.train();
		expect(result.periodicityDetected).to.equal(true);
		expect(result.detectedPeriodMinutes).to.equal(10);
		expect(result.selectedModelType).to.equal("seasonal");
		expect(result.completeSeasonalPeriods).to.equal(12);
		expect(result.selectionReason).to.equal("seasonal-better");
		expect(result.diagnostics?.seasonality.mode).to.equal("auto");
		expect(result.diagnostics?.quality.levelTrend.available).to.equal(true);
		expect(result.diagnostics?.quality.seasonal.available).to.equal(true);
	});

	it("does not claim a period for constant, linear, or random data", () => {
		for (const values of [
			Array.from({ length: 90 }, () => 5),
			Array.from({ length: 90 }, (_, index) => index),
			Array.from({ length: 90 }, (_, index) => ((index * 37) % 101) / 10),
		]) {
			const model = new PredictiveModel(
				normalizePredictiveSettings({
					enabled: true,
					minimumTrainingSamples: 30,
					seasonalityMode: "auto",
					seasonalPeriodMinutes: 0,
				}),
			);
			values.forEach((value, index) => model.add(value, index * 60_000));
			const result = model.train();
			expect(result.selectedModelType).to.equal("levelTrend");
			expect(result.selectionReason).to.be.oneOf(["no-periodicity", "seasonal-not-better-enough"]);
			expect(result.diagnostics?.quality.levelTrend.available).to.equal(true);
		}
	});

	it("rejects smooth non-periodic and random-walk signals despite short-lag correlation", () => {
		const signals = [
			Array.from({ length: 180 }, (_, index) => 40 + Math.sqrt(index)),
			(() => {
				let value = 50;
				let seed = 17;
				return Array.from({ length: 180 }, () => {
					seed = (seed * 73 + 41) % 997;
					value += (seed / 997 - 0.5) * 0.8;
					return value;
				});
			})(),
		];
		for (const values of signals) {
			const model = new PredictiveModel(
				normalizePredictiveSettings({
					enabled: true,
					minimumTrainingSamples: 30,
					seasonalityMode: "auto",
					seasonalPeriodMinutes: 0,
				}),
			);
			values.forEach((value, index) => model.add(value, index * 60_000));
			expect(model.train().periodicityDetected).to.equal(false);
		}
	});

	it("tolerates small cycle-length variation but rejects unstable cycles", () => {
		const run = (lengths: number[]): PredictiveResult => {
			const model = new PredictiveModel(
				normalizePredictiveSettings({
					enabled: true,
					minimumTrainingSamples: 30,
					seasonalityMode: "auto",
					seasonalPeriodMinutes: 0,
				}),
			);
			let timestamp = 0;
			for (const length of lengths) {
				for (let index = 0; index < length; index++) {
					model.add(50 + 10 * Math.sin((index / length) * Math.PI * 2), timestamp++ * 60_000);
				}
			}
			return model.train();
		};
		expect(run([95, 101, 98, 103, 100]).periodicityDetected).to.equal(true);
		expect(run([60, 100, 180, 40]).periodicityDetected).to.equal(false);
	});

	it("gives a manually configured period precedence over automatic detection", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				seasonalityMode: "manual",
				seasonalPeriodMinutes: 10,
			}),
		);
		for (let index = 0; index < 60; index++) {
			model.add(20 + 5 * Math.sin(((index % 10) * Math.PI * 2) / 10), index * 60_000);
		}
		const result = model.train();
		expect(result.selectedModelType).to.equal("seasonal");
		expect(result.seasonalPeriodSteps).to.equal(10);
		expect(result.selectionReason).to.equal("manual-seasonality");
		expect(result.diagnostics?.seasonality.mode).to.equal("manual");
	});

	it("forecasts bounded cyclic numeric data without changing anomaly models", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 20,
				maximumTrainingPoints: 25,
				horizonMinutes: 30,
			}),
		);
		for (let index = 0; index < 40; index++) {
			model.add(index % 10, index * 60_000);
		}
		const result = model.train(40 * 60_000);
		expect(result.trainingSampleCount).to.equal(25);
		expect(result.points.length).to.be.greaterThan(0);
		expect(result.points.length).to.be.at.most(360);
		expect(result.modelType).to.equal("seasonal-exponential-smoothing");
	});

	it("accepts valid zero values and rejects invalid values", () => {
		const model = new PredictiveModel(normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 }));
		for (let index = 0; index < 12; index++) {
			model.add(0, index * 60_000);
		}
		expect(model.trainingSampleCount).to.equal(12);
		expect(() => model.add(Number.NaN, 1)).not.to.throw();
		expect(model.trainingSampleCount).to.equal(12);
	});

	it("anchors a fresh level/trend forecast and converges to the model", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				seasonalityMode: "off",
				horizonMinutes: 300,
			}),
		);
		for (let index = 0; index < 40; index++) {
			model.add(48, index * 60_000);
		}
		model.train(40 * 60_000);
		model.add(69.2, 40 * 60_000);
		const anchoredResult = model.forecast(40 * 60_000);

		expect(anchoredResult.anchorApplied).to.equal(true);
		expect(anchoredResult.currentValue).to.equal(69.2);
		expect(anchoredResult.baseForecastAtNow).to.be.lessThan(69.2);
		expect(anchoredResult.anchoredFirstForecastValue).to.be.greaterThan(
			anchoredResult.unanchoredFirstForecastValue!,
		);
		expect(anchoredResult.points[0].value).to.equal(anchoredResult.anchoredFirstForecastValue);
		expect(Math.abs(anchoredResult.points.at(-1)!.value - anchoredResult.baseForecastAtNow!)).to.be.lessThan(
			Math.abs(anchoredResult.points[0].value - anchoredResult.baseForecastAtNow!),
		);
	});

	it("anchors a time-of-day forecast without changing its model selection", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30, horizonMinutes: 60 });
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 40; index++) {
			original.add(48, index * 60_000);
		}
		original.add(69.2, 40 * 60_000);
		original.train(40 * 60_000);
		const timeOfDayData: PredictiveModelData = {
			...original.toJSON()!,
			selectedModelType: "timeOfDay",
			timeOfDay: Array.from({ length: 96 }, () => 48),
			timeOfDayBucketMinutes: 15,
			timeOfDayDaysCovered: 7,
			timeOfDayBucketCoverage: 1,
		};
		const timeOfDayModel = new PredictiveModel(settings, timeOfDayData);
		const result = timeOfDayModel.forecast(40 * 60_000);

		expect(result.selectedModelType).to.equal("timeOfDay");
		expect(result.anchorApplied).to.equal(true);
		expect(result.unanchoredFirstForecastValue).to.equal(48);
		expect(result.points[0].value).to.be.greaterThan(48);
		expect(result.points.at(-1)!.value).to.be.lessThan(69.2);
	});

	it("applies current-state anchoring symmetrically for zero and negative offsets", () => {
		for (const currentValue of [0, -10, 69.2]) {
			const settings = normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 10,
				seasonalityMode: "off",
				horizonMinutes: 60,
			});
			const model = new PredictiveModel(settings);
			for (let index = 0; index < 20; index++) {
				model.add(0, index * 60_000);
			}
			model.train(20 * 60_000);
			model.add(currentValue, 20 * 60_000);
			const result = model.forecast(20 * 60_000);
			const firstOffset = result.points[0].value - result.unanchoredFirstForecastValue!;
			const lastOffset = result.points.at(-1)!.value - result.baseForecastAtNow!;

			expect(result.anchorApplied).to.equal(true);
			if (currentValue !== 0) {
				expect(firstOffset * currentValue).to.be.greaterThan(0);
				expect(Math.abs(firstOffset)).to.be.lessThan(Math.abs(currentValue));
				expect(Math.abs(lastOffset)).to.be.lessThan(Math.abs(firstOffset));
			} else {
				expect(firstOffset).to.equal(0);
			}
		}
	});

	it("retains the seasonal model shape while anchoring its current level", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 20,
			seasonalityMode: "manual",
			seasonalPeriodMinutes: 10,
			horizonMinutes: 30,
		});
		const model = new PredictiveModel(settings);
		for (let index = 0; index < 40; index++) {
			model.add(20 + (index % 10), index * 60_000);
		}
		model.train(40 * 60_000);
		model.add(50, 40 * 60_000);
		const result = model.forecast(40 * 60_000);

		expect(result.selectedModelType).to.equal("seasonal");
		expect(result.anchorApplied).to.equal(true);
		expect(result.points[0].value).to.be.greaterThan(result.unanchoredFirstForecastValue!);
		expect(result.points[1].value - result.points[0].value).to.not.equal(0);
	});

	it("keeps real forecast timestamps without adding a synthetic t=0 point", () => {
		const intervalMs = 8.6 * 60_000;
		const model = new PredictiveModel(
			normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10, horizonMinutes: 300 }),
		);
		for (let index = 0; index < 20; index++) {
			model.add(48, Math.round(index * intervalMs));
		}
		model.train(Math.round(20 * intervalMs));
		model.add(69.2, Math.round(20 * intervalMs));
		const result = model.forecast(Math.round(20 * intervalMs));

		expect(result.points[0].timestamp).to.be.greaterThan(Math.round(20 * intervalMs));
		expect(result.points[0].timestamp - Math.round(20 * intervalMs)).to.be.closeTo(intervalMs, 1);
		expect(result.points.some(point => point.timestamp === Math.round(20 * intervalMs))).to.equal(false);
	});

	it("does not anchor a persisted history model without a fresh live value", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30 });
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 40; index++) {
			original.add(48, index * 60_000, "history");
		}
		original.train(40 * 60_000, "history");
		const restored = new PredictiveModel(settings, original.toJSON());
		const result = restored.forecast(3_000_000);

		expect(result.currentValue).to.equal(undefined);
		expect(result.anchorApplied).to.equal(false);
		expect(result.points[0].value).to.equal(result.unanchoredFirstForecastValue);
	});

	it("does not anchor a stale live observation", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 30 });
		const model = new PredictiveModel(settings);
		for (let index = 0; index < 40; index++) {
			model.add(48, index * 60_000);
		}
		const result = model.train(5_000_000);

		expect(result.currentValueAgeMinutes).to.be.greaterThan(settings.updateIntervalMinutes);
		expect(result.anchorApplied).to.equal(false);
	});

	it("resamples high-frequency data for long forecasts while retaining history span", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 30,
				maximumTrainingPoints: 2000,
				horizonMinutes: 300,
			}),
		);
		for (let index = 0; index < 2000; index++) {
			model.add(20 + Math.sin(index / 20), index * 10_000);
		}
		const result = model.train(20_000_000);
		expect(result.diagnostics?.model.rawIntervalMinutes).to.be.closeTo(1 / 6, 0.001);
		expect(result.diagnostics?.model.intervalMinutes).to.equal(1);
		expect(result.diagnostics?.model.historySpanMinutes).to.be.greaterThan(300);
		expect(result.trainingSampleCount).to.be.lessThan(2000);
	});

	it("invalidates a persisted model when predictive configuration changes", () => {
		const first = new PredictiveModel(normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 }));
		for (let index = 0; index < 20; index++) {
			first.add(index, index * 60_000);
		}
		first.train();
		const changed = new PredictiveModel(
			normalizePredictiveSettings({
				enabled: true,
				minimumTrainingSamples: 200,
				seasonalityMode: "auto",
				seasonalPeriodMinutes: 0,
			}),
			first.toJSON(),
		);
		expect(changed.forecast().status).to.equal("learning");
		expect(changed.needsHistoryBootstrap).to.equal(true);
	});

	it("restores a matching persisted model without requesting history bootstrap", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 });
		const first = new PredictiveModel(settings);
		for (let index = 0; index < 20; index++) {
			first.add(index, index * 60_000);
		}
		first.train();
		const restored = new PredictiveModel(settings, first.toJSON());
		expect(restored.needsHistoryBootstrap).to.equal(false);
		expect(restored.forecast().status).to.not.equal("learning");
	});

	it("requests history bootstrap for a matching but incomplete persisted model", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 200 });
		const first = new PredictiveModel(settings);
		for (let index = 0; index < 200; index++) {
			first.add(index, index * 60_000);
		}
		first.train();
		const incomplete: PredictiveModelData = {
			...first.toJSON()!,
			trainingSampleCount: 2,
		};
		const restored = new PredictiveModel(settings, incomplete);
		expect(restored.needsHistoryBootstrap).to.equal(true);
		expect(restored.bootstrapReason).to.equal("incomplete-model");
		expect(restored.forecast().trainingSource).to.equal(undefined);
	});

	it("requests a training-basis bootstrap for every invalid persisted basis shape", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			maximumTrainingPoints: 20,
		});
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 20; index++) {
			original.add(index, index * 60_000, "history");
		}
		original.train(20 * 60_000, "history");
		const current = original.toJSON()!;
		const invalidBases: Array<PredictiveModelData["trainingBasis"]> = [
			[],
			[...current.trainingBasis!, { value: 1, timestamp: 20 * 60_000 }],
			[{ value: Number.NaN, timestamp: 0 }],
			[{ value: 1, timestamp: Number.NaN }],
		];
		for (const trainingBasis of invalidBases) {
			const restored = new PredictiveModel(settings, { ...current, trainingBasis });
			expect(restored.needsTrainingBasisBootstrap).to.equal(true);
			expect(restored.trainingBasisRestoreStatus).to.equal("rejected");
		}
	});

	it("does not replace a history or mixed model with live-only data when its basis is unavailable", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		for (const source of ["history", "mixed"] as const) {
			const original = new PredictiveModel(settings);
			for (let index = 0; index < 20; index++) {
				original.add(10 + index, index * 60_000, "history");
			}
			original.train(20 * 60_000, "history");
			if (source === "mixed") {
				for (let index = 20; index < 30; index++) {
					original.add(20, index * 60_000);
				}
				original.train(30 * 60_000, "live");
			}
			const current = { ...original.toJSON()!, trainingSource: source, trainingBasis: [] };
			const restored = new PredictiveModel(settings, current);
			for (let index = 0; index < 10; index++) {
				restored.add(99, (31 + index) * 60_000);
			}
			const result = restored.train(41 * 60_000, "live");
			expect(result.trainingSource).to.equal(source);
			expect(result.trainingSampleCount).to.equal(current.trainingSampleCount);
			expect(restored.toJSON()?.trainingSource).to.equal(source);
		}
	});

	it("keeps a valid history model when a history bootstrap has not completed", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		const original = new PredictiveModel(settings);
		for (let index = 0; index < 20; index++) {
			original.add(index, index * 60_000, "history");
		}
		original.train(20 * 60_000, "history");
		const restored = new PredictiveModel(settings, { ...original.toJSON()!, trainingBasis: [] });
		const before = restored.toJSON();
		const result = restored.train(21 * 60_000, "history");
		expect(result.trainingSource).to.equal("history");
		expect(restored.toJSON()).to.deep.equal(before);
		expect(restored.needsTrainingBasisBootstrap).to.equal(true);
	});

	it("trains from history after replacing an incomplete persisted model", () => {
		const settings = normalizePredictiveSettings({
			enabled: true,
			minimumTrainingSamples: 10,
			seasonalityMode: "off",
		});
		const first = new PredictiveModel(settings);
		for (let index = 0; index < 12; index++) {
			first.add(10 + index, index * 60_000);
		}
		first.train();
		const incomplete: PredictiveModelData = {
			...first.toJSON()!,
			trainingSampleCount: 2,
		};
		const restored = new PredictiveModel(settings, incomplete);
		expect(restored.needsHistoryBootstrap).to.equal(true);
		for (let index = 0; index < 12; index++) {
			restored.add(10 + index, index * 60_000);
		}
		const result = restored.train(12 * 60_000, "history");
		expect(result.trainingSource).to.equal("history");
		expect(result.trainingSampleCount).to.be.at.least(settings.minimumTrainingSamples);
		expect(restored.needsHistoryBootstrap).to.equal(false);
		const secondRestart = new PredictiveModel(settings, restored.toJSON());
		expect(secondRestart.needsHistoryBootstrap).to.equal(false);
	});

	it("requests a one-time bootstrap for legacy models without a fingerprint", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 });
		const first = new PredictiveModel(settings);
		for (let index = 0; index < 20; index++) {
			first.add(index, index * 60_000);
		}
		first.train();
		const legacy = { ...first.toJSON()!, configFingerprint: undefined };
		const restored = new PredictiveModel(settings, legacy);
		expect(restored.needsHistoryBootstrap).to.equal(true);
		expect(restored.bootstrapReason).to.equal("legacy-model");
	});

	it("invalidates models without or with an older algorithm version", () => {
		const settings = normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 10 });
		const model = new PredictiveModel(settings);
		for (let index = 0; index < 20; index++) {
			model.add(index, index * 60_000);
		}
		model.train();
		const current = model.toJSON()!;
		expect(new PredictiveModel(settings, { ...current, algorithmVersion: undefined }).bootstrapReason).to.equal(
			"algorithm-changed",
		);
		expect(
			new PredictiveModel(settings, { ...current, algorithmVersion: PREDICTIVE_ALGORITHM_VERSION - 1 })
				.bootstrapReason,
		).to.equal("algorithm-changed");
		expect(new PredictiveModel(settings, current).needsHistoryBootstrap).to.equal(false);
	});

	it("calculates a hand-checkable MAE", () => {
		expect(meanAbsoluteError([10, 12, 14], [11, 10, 17])).to.equal(2);
	});

	it("aligns backtest diagnostics with the first and last holdout timestamps", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 20, seasonalityMode: "off" }),
		);
		for (let index = 0; index < 30; index++) {
			model.add(index, index * 60_000);
		}
		const result = model.train(30 * 60_000);
		const levelTrend = result.diagnostics?.quality.levelTrend;
		expect(levelTrend?.trainingSamples).to.equal(24);
		expect(levelTrend?.holdoutSamples).to.equal(6);
		expect(levelTrend?.firstComparison?.timestamp).to.equal(levelTrend?.holdoutStart);
		expect(levelTrend?.lastComparison?.timestamp).to.equal(levelTrend?.holdoutEnd);
	});

	it("flags zero and small IQR quality scales without changing the metric", () => {
		for (const values of [
			Array.from({ length: 30 }, () => 5),
			Array.from({ length: 30 }, (_, index) => 5 + index * 0.0001),
		]) {
			const model = new PredictiveModel(
				normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 20, seasonalityMode: "off" }),
			);
			values.forEach((value, index) => model.add(value, index * 60_000));
			const quality = model.train().diagnostics?.quality;
			expect(quality?.qualityScaleSource).to.equal("IQR");
			expect(quality?.qualityScaleNearZero).to.equal(true);
		}
	});

	it("does not flag a normally spread signal as near-zero IQR", () => {
		const model = new PredictiveModel(
			normalizePredictiveSettings({ enabled: true, minimumTrainingSamples: 20, seasonalityMode: "off" }),
		);
		for (let index = 0; index < 30; index++) {
			model.add(index, index * 60_000);
		}
		expect(model.train().diagnostics?.quality.qualityScaleNearZero).to.equal(false);
	});

	it("classifies quality independently from technical model status", () => {
		expect(classifyPredictiveQuality({ mae: 0.2, scale: 1, evidenceSamples: 100 }).class).to.equal("good");
		expect(classifyPredictiveQuality({ mae: 0.7, scale: 1, evidenceSamples: 100 }).class).to.equal("limited");
		expect(classifyPredictiveQuality({ mae: 1.2, scale: 1, evidenceSamples: 100 }).class).to.equal("poor");
		expect(classifyPredictiveQuality({ mae: 0.2, scale: 1, evidenceSamples: 5 }).class).to.equal("unknown");
		expect(classifyPredictiveQuality({ mae: 0.2, scale: 1, evidenceSamples: 15 }).class).to.equal("limited");
		expect(classifyPredictiveQuality({ mae: 0, scale: 0, evidenceSamples: 100 }).class).to.equal("good");
		expect(classifyPredictiveQuality({ mae: 0.2, scale: 0, evidenceSamples: 100 }).class).to.equal("unknown");
	});
});
