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
	if (!Number.isInteger(limit) || limit < 1) {
		return [];
	}
	const entries = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object" && Array.isArray((raw as { result?: unknown }).result)
			? (raw as { result: unknown[] }).result
			: [];
	const byTimestamp = new Map<number, HistorySample>();
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const candidate = entry as { val?: unknown; ts?: unknown };
		const value = typeof candidate.val === "number" ? candidate.val : Number(candidate.val);
		const timestamp = typeof candidate.ts === "number" ? candidate.ts : Number(candidate.ts);
		if (Number.isFinite(value) && Number.isFinite(timestamp) && timestamp > 0) {
			byTimestamp.set(timestamp, { value, timestamp });
		}
	}
	const sorted = [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
	if (sorted.length <= limit) {
		return sorted;
	}
	if (limit === 1) {
		return [sorted[0]];
	}
	const protectedSamples = sorted.filter(sample => preserveTimestamps.includes(sample.timestamp));
	if (protectedSamples.length >= limit) {
		return protectedSamples.slice(0, limit);
	}
	const result: HistorySample[] = [...protectedSamples];
	const protectedSet = new Set(protectedSamples.map(sample => sample.timestamp));
	const candidates = sorted.filter(sample => !protectedSet.has(sample.timestamp));
	const remaining = limit - result.length;
	for (let index = 0; index < remaining; index++) {
		result.push(candidates[Math.round((index * (candidates.length - 1)) / Math.max(1, remaining - 1))]);
	}
	return result.sort((left, right) => left.timestamp - right.timestamp);
}
