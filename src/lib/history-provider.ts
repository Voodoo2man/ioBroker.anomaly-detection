/** A numerical state sample returned by a history provider. */
export interface HistorySample {
	/** Numeric state value. */
	value: number;
	/** Unix timestamp in milliseconds. */
	timestamp: number;
}

/** Generic access contract for an ioBroker history adapter. */
export interface HistoryProvider {
	/** Loads raw history samples for a state and time range. */
	getHistory(sourceId: string, start: number, end: number, limit: number): Promise<unknown>;
}

export interface SanitizedHistoryResult {
	samples: HistorySample[];
	validSamples: number;
	duplicateSamplesRemoved: number;
}

export interface HistoryRange {
	start: number;
	end: number;
}

function parseFiniteNumber(value: unknown): number | undefined {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}
	if (typeof value !== "string" || value.trim() === "") {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalizes the result shapes commonly returned by ioBroker history adapters.
 * Duplicate timestamps keep the final value; evenly spaced downsampling preserves whole-range coverage.
 *
 * @param raw History response to normalize.
 * @param limit Maximum number of representative samples.
 * @param preserveTimestamps Timestamps that must remain represented when reducing the sample count.
 */
export function sanitizeHistory(
	raw: unknown,
	limit: number,
	preserveTimestamps: readonly number[] = [],
): HistorySample[] {
	return sanitizeHistoryWithDiagnostics(raw, limit, preserveTimestamps).samples;
}

export function sanitizeHistoryWithDiagnostics(
	raw: unknown,
	limit: number,
	preserveTimestamps: readonly number[] = [],
	range?: HistoryRange,
): SanitizedHistoryResult {
	if (!Number.isInteger(limit) || limit < 1) {
		return { samples: [], validSamples: 0, duplicateSamplesRemoved: 0 };
	}
	const entries = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object" && Array.isArray((raw as { result?: unknown }).result)
			? (raw as { result: unknown[] }).result
			: [];
	const byTimestamp = new Map<number, HistorySample>();
	let validSamples = 0;
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const candidate = entry as { val?: unknown; ts?: unknown };
		const value = parseFiniteNumber(candidate.val);
		const timestamp = parseFiniteNumber(candidate.ts);
		if (
			value !== undefined &&
			timestamp !== undefined &&
			timestamp > 0 &&
			(!range || (timestamp >= range.start && timestamp <= range.end))
		) {
			validSamples++;
			byTimestamp.set(timestamp, { value, timestamp });
		}
	}
	const sorted = [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
	if (sorted.length <= limit) {
		return {
			samples: sorted,
			validSamples,
			duplicateSamplesRemoved: validSamples - sorted.length,
		};
	}
	if (limit === 1) {
		return { samples: [sorted[0]], validSamples, duplicateSamplesRemoved: validSamples - sorted.length };
	}
	const protectedSamples = sorted.filter(sample => preserveTimestamps.includes(sample.timestamp));
	if (protectedSamples.length >= limit) {
		return {
			samples: protectedSamples.slice(0, limit),
			validSamples,
			duplicateSamplesRemoved: validSamples - sorted.length,
		};
	}
	const result: HistorySample[] = [...protectedSamples];
	const protectedSet = new Set(protectedSamples.map(sample => sample.timestamp));
	const candidates = sorted.filter(sample => !protectedSet.has(sample.timestamp));
	const remaining = limit - result.length;
	for (let index = 0; index < remaining; index++) {
		result.push(candidates[Math.round((index * (candidates.length - 1)) / Math.max(1, remaining - 1))]);
	}
	return {
		samples: result.sort((left, right) => left.timestamp - right.timestamp),
		validSamples,
		duplicateSamplesRemoved: validSamples - sorted.length,
	};
}
