import { clamp } from "./model/statistics";
import type { DetectorResult } from "./detectors";

export interface ScoringResult {
	score: number;
	reason: string;
}

const WEIGHTS: Record<DetectorResult["name"], number> = {
	value: 0.5,
	context: 0.5,
	rate: 0.3,
	stuck: 0.2,
	changePoint: 0.45,
	trend: 0.35,
};
const BEHAVIOR_DETECTORS = new Set<DetectorResult["name"]>(["value", "context", "changePoint", "trend"]);

export function scoreDetectors(results: readonly DetectorResult[]): ScoringResult {
	if (results.length === 0) {
		return { score: 0, reason: "Insufficient data for anomaly detection" };
	}
	const behavior = results.filter(result => BEHAVIOR_DETECTORS.has(result.name));
	const selected = [
		...(behavior.length ? [behavior.reduce((best, result) => (result.score > best.score ? result : best))] : []),
		...results.filter(result => !BEHAVIOR_DETECTORS.has(result.name)),
	];
	const weight = selected.reduce((total, result) => total + WEIGHTS[result.name], 0);
	const weightedScore = selected.reduce((total, result) => total + result.score * WEIGHTS[result.name], 0) / weight;
	const strong = selected.filter(result => result.score >= 50);
	const score = clamp(weightedScore + (strong.length >= 2 ? 10 : 0), 0, 100);
	if (score === 0) {
		return { score, reason: "Normal" };
	}
	const reason =
		strong.length >= 2
			? "Multiple anomaly detectors agree"
			: selected.reduce((best, result) => (result.score > best.score ? result : best)).reason;
	return { score, reason };
}
