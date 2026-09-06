import { clamp, type SampleSeries } from "./model/statistics";

export interface DetectorResult {
	name: "value" | "context" | "rate" | "stuck" | "changePoint" | "trend";
	score: number;
	reason: string;
}

export function detectMadDeviation(
	value: number,
	series: SampleSeries,
	minimumSamples: number,
	sensitivity: number,
): DetectorResult | undefined {
	if (series.count < minimumSamples) {
		return undefined;
	}
	const median = series.median();
	const mad = series.mad();
	if (median === undefined || mad === undefined) {
		return undefined;
	}
	const deviation = Math.abs(value - median);
	const robustZ = mad === 0 ? (deviation === 0 ? 0 : Number.POSITIVE_INFINITY) : (0.6745 * deviation) / mad;
	const score = robustZ === Number.POSITIVE_INFINITY ? 100 : clamp((robustZ / sensitivity) * 100, 0, 100);
	return { name: "value", score, reason: "Value is significantly outside the normal range for this time period" };
}

export function detectRateDeviation(
	rate: number | undefined,
	series: SampleSeries,
	minimumSamples: number,
	sensitivity: number,
): DetectorResult | undefined {
	if (rate === undefined || !Number.isFinite(rate) || series.count < minimumSamples) {
		return undefined;
	}
	const median = series.median();
	const mad = series.mad();
	if (median === undefined || mad === undefined) {
		return undefined;
	}
	const deviation = Math.abs(rate - median);
	const robustZ = mad === 0 ? (deviation === 0 ? 0 : Number.POSITIVE_INFINITY) : (0.6745 * deviation) / mad;
	const score = robustZ === Number.POSITIVE_INFINITY ? 100 : clamp((robustZ / sensitivity) * 100, 0, 100);
	return { name: "rate", score, reason: "Rate of change is unusually high" };
}

export function detectStuck(
	repeatedSince: number | undefined,
	timestamp: number,
	stuckDurationMinutes: number,
): DetectorResult | undefined {
	if (repeatedSince === undefined || timestamp < repeatedSince) {
		return undefined;
	}
	const duration = timestamp - repeatedSince;
	const limit = stuckDurationMinutes * 60_000;
	if (limit <= 0 || duration < limit) {
		return undefined;
	}
	return {
		name: "stuck",
		score: clamp((duration / limit) * 50, 50, 100),
		reason: "Value has remained unchanged significantly longer than configured",
	};
}
