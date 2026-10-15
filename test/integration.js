const path = require("path");
const assert = require("node:assert/strict");
const { tests } = require("@iobroker/testing");

async function waitFor(check, description) {
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		const result = await check();
		if (result) return result;
		await new Promise(resolve => setTimeout(resolve, 30));
	}
	throw new Error(`Timed out waiting for ${description}`);
}

function requestTab(harness) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("Admin tab request timed out")), 5_000);
		harness.sendTo("anomaly-detection.0", "tab", {}, response => {
			clearTimeout(timeout);
			resolve(response.data.sources);
		});
	});
}

tests.integration(path.join(__dirname, ".."), {
	defineAdditionalTests({ suite, it }) {
		let savedModels;
		let savedPredictiveModels;
		let savedSourceState;
		let savedSourceObject;
		let savedConfig;
		suite("Numerical source lifecycle", getHarness => {
			const sourceId = "0_userdata.0.anomalyIntegration.power";
			let base;
			it("ignores a pending command at startup", async function () {
				this.timeout(20_000);
				const harness = getHarness();
				await harness.objects.setObjectAsync(sourceId, {
					_id: sourceId,
					type: "state",
					common: {
						name: "Test power",
						type: "number",
						role: "value.power",
						unit: "W",
						read: true,
						write: true,
					},
					native: {},
				});
				await harness.states.setStateAsync(sourceId, { val: 999, ack: false });
				await harness.changeAdapterConfig("anomaly-detection", {
					native: {
						sources: [
							{
								id: sourceId,
								enabled: true,
								initialTraining: "live",
								minimumSamples: 5,
								enableMad: true,
								enableRate: false,
								enableStuck: false,
								enableChangePoint: false,
								enableTrend: false,
								enableContext: false,
								timeContext: false,
								weekdayContext: false,
								minimumAnomalyDurationMinutes: 0,
								predictive: {
									enabled: true,
									minimumTrainingSamples: 10,
									maximumTrainingPoints: 100,
									horizonMinutes: 10,
									seasonalityMode: "off",
								},
							},
						],
					},
				});
				savedConfig = (await harness.getAdapterConfig()).native;
				savedSourceObject = await harness.objects.getObjectAsync(sourceId);
				await harness.startAdapterAndWait();
				await waitFor(() => harness.hasLog("Monitoring 1 numerical state"), "source registration");
				const [source] = await requestTab(harness);
				assert.equal(source.id, sourceId);
				assert.equal(source.evaluation.sampleCount, 0);
				assert.equal(source.evaluation.statusCode, "unavailable");
				base = `anomaly-detection.0.sources.${source.safeId}`;
			});

			it("learns acknowledged values, forecasts, detects an outlier and persists on shutdown", async function () {
				this.timeout(30_000);
				const harness = getHarness();
				const start = Date.now() - 20 * 60_000;
				for (let index = 0; index < 20; index++) {
					await harness.states.setStateAsync(sourceId, { val: 10, ack: true, ts: start + index * 60_000 });
					await waitFor(
						async () =>
							(await harness.states.getStateAsync(`${base}.analysis.sampleCount`))?.val === index + 1,
						`training sample ${index + 1}`,
					);
				}
				await waitFor(async () => {
					const [source] = await requestTab(harness);
					return source.predictive.points.length > 0;
				}, "trained forecast");
				const [normal] = await requestTab(harness);
				assert.equal(normal.evaluation.expected, 10);
				assert.equal(normal.evaluation.detected, false);
				assert.ok(
					normal.predictive.points.every(
						point => Number.isFinite(point.value) && Number.isFinite(point.timestamp),
					),
				);
				await harness.states.setStateAsync(sourceId, { val: 999, ack: false });
				await new Promise(resolve => setTimeout(resolve, 100));
				assert.equal(
					(await harness.states.getStateAsync(`${base}.analysis.actual`)).val,
					10,
					"Pending commands must not replace measured values",
				);
				await harness.states.setStateAsync(sourceId, { val: 50, ack: true, ts: Date.now() });
				await waitFor(
					async () => (await harness.states.getStateAsync(`${base}.analysis.actual`))?.val === 50,
					"outlier evaluation",
				);
				await waitFor(
					async () => (await harness.states.getStateAsync(`${base}.analysis.detected`))?.val === true,
					"anomaly activation",
				);
				const [outlier] = await requestTab(harness);
				assert.equal(
					outlier.evaluation.sampleCount,
					20,
					"Detected anomalies must not enter the normal baseline",
				);
				assert.equal(outlier.evaluation.expected, 10);
				assert.equal(outlier.evaluation.score, 100);
				assert.equal((await harness.states.getStateAsync(`${base}.analysis.actual`)).ack, true);
				savedSourceState = await harness.states.getStateAsync(sourceId);
				await harness.stopAdapter();
				const models = await harness.states.getStateAsync("anomaly-detection.0.models");
				assert.ok(models?.val, "Anomaly model must be persisted at shutdown");
				assert.ok(Object.keys(JSON.parse(models.val)).length > 0);
				const predictiveModels = await harness.states.getStateAsync("anomaly-detection.0.predictiveModels");
				assert.ok(
					Object.keys(JSON.parse(predictiveModels.val)).length > 0,
					"Predictive basis must survive shutdown",
				);
				savedModels = models.val;
				savedPredictiveModels = predictiveModels.val;
				assert.equal(harness.getLogs("error").length, 0);
			});
		});

		suite("Persisted model restart", getHarness => {
			it("restores learning and the current evaluation in a new adapter process", async function () {
				this.timeout(20_000);
				assert.ok(savedModels && savedPredictiveModels, "The lifecycle test must produce snapshots");
				const harness = getHarness();
				await harness.objects.setObjectAsync(savedSourceObject._id, savedSourceObject);
				await harness.states.setStateAsync(savedSourceObject._id, savedSourceState);
				await harness.states.setStateAsync("anomaly-detection.0.models", { val: savedModels, ack: true });
				await harness.states.setStateAsync("anomaly-detection.0.predictiveModels", {
					val: savedPredictiveModels,
					ack: true,
				});
				await harness.changeAdapterConfig("anomaly-detection", { native: savedConfig });
				await harness.startAdapterAndWait();
				await waitFor(() => harness.hasLog("Monitoring 1 numerical state"), "restored source registration");
				const [source] = await requestTab(harness);
				assert.equal(source.evaluation.sampleCount, 20);
				assert.equal(source.evaluation.actual, 50);
				assert.equal(source.evaluation.expected, 10);
				assert.equal(source.evaluation.detected, true);
				assert.ok(source.predictive.trainingSampleCount >= 10);
				assert.ok(source.predictive.points.length > 0);
				assert.equal(harness.getLogs("error").length, 0);
			});

			it("marks the evaluation unavailable after retraining with a pending command", async function () {
				this.timeout(15_000);
				const harness = getHarness();
				const [before] = await requestTab(harness);
				const base = `anomaly-detection.0.sources.${before.safeId}`;
				await harness.states.setStateAsync(savedSourceObject._id, { val: 999, ack: false });
				await harness.states.setStateAsync(`${base}.retrain`, { val: true, ack: false });
				await waitFor(async () => {
					const state = await harness.states.getStateAsync(`${base}.retrain`);
					return state?.val === false && state.ack === true;
				}, "retrain acknowledgement");
				const [source] = await requestTab(harness);
				assert.equal(source.evaluation.sampleCount, 0);
				assert.equal(source.evaluation.statusCode, "unavailable");
				assert.equal(source.evaluation.detected, false);
				assert.equal((await harness.states.getStateAsync(`${base}.analysis.actual`)).val, null);
				assert.equal((await harness.states.getStateAsync(`${base}.analysis.detected`)).val, false);
				assert.equal(harness.getLogs("error").length, 0);
			});
		});
	},
});
