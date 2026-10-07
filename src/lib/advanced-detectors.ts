import { clamp, median } from "./model/statistics";
import type { DetectorResult } from "./detectors";

/** A residual value together with the time at which it was measured. */
export interface TimedResidual {
	/** Residual value. */
	value: number;
	/** Measurement timestamp in milliseconds. */
	timestamp: number;
}

/** Persisted state used for change-point detection. */
export interface ChangePointData {
	/** Recent residual samples. */
	recent: TimedResidual[];
	/** Direction of the current candidate level shift. */
	candidateDirection?: "upward" | "downward";
	/** Number of consecutive observations supporting the candidate. */
	candidateCount: number;
}

/** Persisted state used for trend detection. */
export interface TrendData {
	/** Recent residual samples. */
	recent: TimedResidual[];
}

/** Combined result of the advanced detectors for one observation. */
export interface AdvancedEvaluation {
	/** Change-point result, when a persistent level shift is detected. */
	changePoint?: DetectorResult;
	/** Trend result, when an unusual trend is detected. */
	trend?: DetectorResult;
	/** Whether the observation should be used to adapt the model. */
	adapt: boolean;
}

const MAX_RECENT = 48;
const MIN_RECENT = 12;
const MIN_TREND_SPAN_MS = 6 * 60 * 60 * 1000;
/** Maintains bounded residual windows for robust level-shift and trend evaluation. */
export class AdvancedDetectors {
	/** Recent residuals used for change-point detection. */
	private recentChange: TimedResidual[];
	/** Recent residuals used for trend detection. */
	private recentTrend: TimedResidual[];
	/** Current direction of a candidate level shift. */
	private candidateDirection: "upward" | "downward" | undefined;
	/** Number of consecutive observations supporting the candidate. */
	private candidateCount: number;

	/** Creates an advanced detector state from optional persisted data.
	 *
	 * @param change Persisted change-point state.
	 * @param trend Persisted trend state.
	 */
	public constructor(change?: ChangePointData, trend?: TrendData) {
		this.recentChange = sanitize(change?.recent);
		this.recentTrend = sanitize(trend?.recent);
		this.candidateDirection = change?.candidateDirection;
		this.candidateCount = Number.isInteger(change?.candidateCount) ? Math.max(0, change!.candidateCount) : 0;
	}

	/** Evaluates one residual and updates the detector windows.
	 *
	 * @param residual Current residual value.
	 * @param timestamp Observation timestamp in milliseconds.
	 * @param longMedian Long-term residual median.
	 * @param longMad Long-term median absolute deviation.
	 * @param enableChangePoint Whether change-point detection is enabled.
	 * @param enableTrend Whether trend detection is enabled.
	 * @param sensitivity Detection sensitivity threshold.
	 */
	public observe(
		residual: number | undefined,
		timestamp: number,
		longMedian: number | undefined,
		longMad: number | undefined,
		enableChangePoint: boolean,
		enableTrend: boolean,
		sensitivity: number,
	): AdvancedEvaluation {
		if (residual === undefined || !Number.isFinite(residual)) {
			return { adapt: false };
		}
		if (enableChangePoint) {
			append(this.recentChange, { value: residual, timestamp });
		}
		if (enableTrend) {
			append(this.recentTrend, { value: residual, timestamp });
		}
		const changePoint = enableChangePoint ? this.detectChangePoint(longMedian, longMad, sensitivity) : undefined;
		const trend = enableTrend ? this.detectTrend(sensitivity) : undefined;
		return { changePoint, trend, adapt: changePoint !== undefined };
	}

	/** Serializes the detector state for persistence. */
	public toJSON(): { changePoint: ChangePointData; trend: TrendData } {
		return {
			changePoint: {
				recent: [...this.recentChange],
				candidateDirection: this.candidateDirection,
				candidateCount: this.candidateCount,
			},
			trend: { recent: [...this.recentTrend] },
		};
	}

	private detectChangePoint(
		longMedian: number | undefined,
		longMad: number | undefined,
		sensitivity: number,
	): DetectorResult | undefined {
		if (this.recentChange.length < MIN_RECENT || longMedian === undefined || longMad === undefined) {
			this.resetCandidate();
			return undefined;
		}
		const recentMedian = median(this.recentChange.slice(-MIN_RECENT).map(sample => sample.value));
		if (recentMedian === undefined) {
			return undefined;
		}
		const delta = recentMedian - longMedian;
		const scale = Math.max(longMad, 1e-9);
		const normalized = Math.abs(delta) / scale;
		if (normalized < sensitivity) {
			this.resetCandidate();
			return undefined;
		}
		const direction = delta >= 0 ? "upward" : "downward";
		this.candidateCount = this.candidateDirection === direction ? this.candidateCount + 1 : 1;
		this.candidateDirection = direction;
		if (this.candidateCount < 3) {
			return undefined;
		}
		return {
			name: "changePoint",
			score: clamp((normalized / sensitivity) * 80, 70, 100),
			reason: `Persistent ${direction} level shift detected`,
			reasonCode: "persistent_level_shift",
		};
	}

	private detectTrend(sensitivity: number): DetectorResult | undefined {
		if (this.recentTrend.length < MIN_RECENT) {
			return undefined;
		}
		const first = this.recentTrend[0];
		const last = this.recentTrend[this.recentTrend.length - 1];
		const span = last.timestamp - first.timestamp;
		if (span < MIN_TREND_SPAN_MS) {
			return undefined;
		}
		const slopes: number[] = [];
		for (let left = 0; left < this.recentTrend.length; left++) {
			for (let right = left + 1; right < this.recentTrend.length; right++) {
				const elapsed = this.recentTrend[right].timestamp - this.recentTrend[left].timestamp;
				if (elapsed > 0) {
					slopes.push((this.recentTrend[right].value - this.recentTrend[left].value) / elapsed);
				}
			}
		}
		const slope = median(slopes);
		const center = median(this.recentTrend.map(sample => sample.value)) ?? 0;
		const residualMad = median(this.recentTrend.map(sample => Math.abs(sample.value - center))) ?? 0;
		if (slope === undefined) {
			return undefined;
		}
		const normalized = Math.abs(slope * span) / Math.max(residualMad, 1e-9);
		if (normalized < sensitivity) {
			return undefined;
		}
		const direction = slope >= 0 ? "upward" : "downward";
		return {
			name: "trend",
			score: clamp((normalized / sensitivity) * 60, 55, 95),
			reason: `Sustained ${direction} trend outside normal behavior`,
			reasonCode: "unusual_trend",
		};
	}

	private resetCandidate(): void {
		this.candidateDirection = undefined;
		this.candidateCount = 0;
	}
}

function append(target: TimedResidual[], value: TimedResidual): void {
	if (target.length > 0 && value.timestamp <= target[target.length - 1].timestamp) {
		return;
	}
	target.push(value);
	if (target.length > MAX_RECENT) {
		target.splice(0, target.length - MAX_RECENT);
	}
}

function sanitize(values: readonly TimedResidual[] | undefined): TimedResidual[] {
	return (values ?? [])
		.filter(sample => Number.isFinite(sample.value) && Number.isFinite(sample.timestamp))
		.sort((left, right) => left.timestamp - right.timestamp)
		.slice(-MAX_RECENT);
}
