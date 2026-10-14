import { expect } from "chai";
import {
	anomalyBootstrapStateUpdate,
	manualRetrainBootstrapNeeds,
	shouldBootstrapPredictiveHistory,
} from "./bootstrap-policy";

describe("bootstrap policy", () => {
	it("does not alter anomaly states during predictive-only imports", () => {
		for (const phase of ["started", "completed", "failed"] as const) {
			expect(anomalyBootstrapStateUpdate({ anomaly: false, predictive: true }, phase, true)).to.equal(undefined);
		}
	});

	it("retains the established anomaly lifecycle when anomaly history is imported", () => {
		expect(anomalyBootstrapStateUpdate({ anomaly: true, predictive: true }, "started", false)).to.deep.equal({
			status: "importingHistory",
			bootstrapStatus: "Importing historical data",
		});
		expect(
			anomalyBootstrapStateUpdate({ anomaly: true, predictive: true }, "completed", true, true, 42),
		).to.deep.equal({
			status: "monitoring",
			bootstrapStatus: "Historical training completed (42 samples)",
		});
		expect(
			anomalyBootstrapStateUpdate({ anomaly: true, predictive: false }, "completed", true, false, 42)?.status,
		).to.equal("learning");
		expect(anomalyBootstrapStateUpdate({ anomaly: true, predictive: false }, "failed", true)?.status).to.equal(
			"monitoring",
		);
	});

	it("bootstraps only the predictive model that is missing required history data", () => {
		expect(shouldBootstrapPredictiveHistory(true, true, true, true)).to.equal(true);
		expect(shouldBootstrapPredictiveHistory(true, true, true, false)).to.equal(false);
		expect(shouldBootstrapPredictiveHistory(true, false, true, true)).to.equal(false);
		expect(shouldBootstrapPredictiveHistory(false, true, true, true)).to.equal(false);
		expect(shouldBootstrapPredictiveHistory(true, true, false, true)).to.equal(false);
	});

	it("retains a complete predictive model during manual anomaly retraining", () => {
		expect(manualRetrainBootstrapNeeds(true, true, true, false)).to.deep.equal({
			anomaly: true,
			predictive: false,
		});
		expect(manualRetrainBootstrapNeeds(true, true, true, true)).to.deep.equal({
			anomaly: true,
			predictive: true,
		});
	});

	it("leaves anomaly states untouched when no anomaly bootstrap is needed", () => {
		const preserved = { status: "monitoring", bootstrapStatus: "Historical training completed (240 samples)" };
		for (const scenario of [
			"current source value unavailable",
			"current source value is stale",
			"restart with the anomaly model preserved",
		]) {
			const update = anomalyBootstrapStateUpdate({ anomaly: false, predictive: true }, "completed", true);
			expect(update, scenario).to.equal(undefined);
			expect(preserved).to.deep.equal({
				status: "monitoring",
				bootstrapStatus: "Historical training completed (240 samples)",
			});
		}
	});
});
