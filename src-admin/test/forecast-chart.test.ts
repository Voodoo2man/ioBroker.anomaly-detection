import { expect } from "chai";
import { formatForecastTick, prepareForecastChartData } from "../src/forecast-chart";

describe("forecast chart data", () => {
	it("keeps the live value separate from the forecast series", () => {
		const data = prepareForecastChartData(21.2, 1_000_000, 300, [
			{ timestamp: 1_060_000, value: 22.1 },
			{ timestamp: 1_120_000, value: 26.792 },
		]);

		expect(data.actualPoint).to.deep.equal({ timestamp: 1_000_000, value: 21.2 });
		expect(data.forecastPoints).to.deep.equal([
			{ timestamp: 1_060_000, value: 22.1 },
			{ timestamp: 1_120_000, value: 26.792 },
		]);
		expect(data.yDomain.min).to.be.lessThan(21.2);
		expect(data.yDomain.max).to.be.greaterThan(26.792);
		expect(data.forecastPoints[0].timestamp - data.startTimestamp).to.equal(60_000);
		expect(data.yTicks.length).to.be.within(3, 5);
		expect(data.xTicks).to.deep.equal([0, 60 * 60_000, 120 * 60_000, 180 * 60_000, 240 * 60_000, 300 * 60_000]);
	});

	it("keeps zero, negative trends, and a single point unchanged", () => {
		const data = prepareForecastChartData(0, 5_000, 20, [{ timestamp: 5_300, value: -4.5 }]);

		expect(data.actualPoint?.value).to.equal(0);
		expect(data.forecastPoints).to.deep.equal([{ timestamp: 5_300, value: -4.5 }]);
		expect(data.endTimestamp).to.equal(1_205_000);
		expect(data.yDomain.min).to.be.lessThan(-4.5);
		expect(data.yTicks.length).to.be.at.least(2);
		expect(formatForecastTick(57.74, 2, "de-DE")).to.equal("57,74");
		expect(formatForecastTick(57.76, 2, "de-DE")).to.not.equal(formatForecastTick(57.74, 2, "de-DE"));
	});

	it("does not invent a live point for missing or unreliable forecast data", () => {
		const missing = prepareForecastChartData(12, 1_000, 60, []);
		expect(missing.actualPoint).to.deep.equal({ timestamp: 1_000, value: 12 });
		expect(missing.forecastPoints).to.deep.equal([]);
		expect(missing.yDomain.max - missing.yDomain.min).to.be.greaterThan(0);
		expect(missing.xTicks).to.deep.equal([0, 720000, 1440000, 2160000, 2880000, 3600000]);
		expect(prepareForecastChartData(undefined, 1_000, 60, [{ timestamp: 2_000, value: Number.NaN }])).to.deep.equal(
			{
				startTimestamp: 1_000,
				endTimestamp: 3_601_000,
				actualPoint: undefined,
				forecastPoints: [],
				yDomain: { min: -0.08, max: 1.08 },
				yTicks: [0, 0.5, 1],
				yTickDecimals: 0,
				xTicks: [0, 720000, 1440000, 2160000, 2880000, 3600000],
			},
		);
	});
});
