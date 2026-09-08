import { clamp } from "./model/statistics";
import type { DetectorResult } from "./detectors";

export interface DetectorDiagnostic {
	name: DetectorResult["name"];
	score: number;
	reasonCode: DetectorResult["reasonCode"];
}

export interface ScoringResult {
	score: number;
	reason: string;
	reasonCode:
		"normal" | "insufficient_training_data" | "multiple_detectors" | NonNullable<DetectorResult["reasonCode"]>;
	detectors: DetectorDiagnostic[];
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
		return {
			score: 0,
			reason: "Insufficient data for anomaly detection",
			reasonCode: "insufficient_training_data",
			detectors: [],
		};
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
	// Scores below 50 are defined as normal operation. Keep detector diagnostics
	// available, but do not expose their technical deviation text as the outcome.
	if (score < 50) {
		return { score, reason: "Normal", reasonCode: "normal", detectors: selected.map(toDiagnostic) };
	}
	const reason =
		strong.length >= 2
			? "Multiple anomaly detectors agree"
			: selected.reduce((best, result) => (result.score > best.score ? result : best)).reason;
	const primary = selected.reduce((best, result) => (result.score > best.score ? result : best));
	return {
		score,
		reason,
		reasonCode: strong.length >= 2 ? "multiple_detectors" : (primary.reasonCode ?? "unexpected_value"),
		detectors: selected.map(toDiagnostic),
	};
}

function toDiagnostic(result: DetectorResult): DetectorDiagnostic {
	return { name: result.name, score: result.score, reasonCode: result.reasonCode ?? fallbackReasonCode(result.name) };
}

function fallbackReasonCode(name: DetectorResult["name"]): DetectorDiagnostic["reasonCode"] {
	const codes: Record<DetectorResult["name"], DetectorDiagnostic["reasonCode"]> = {
		value: "unexpected_value",
		context: "context_deviation",
		rate: "unexpected_rate_change",
		stuck: "stuck_value",
		changePoint: "persistent_level_shift",
		trend: "unusual_trend",
	};
	return codes[name];
}
