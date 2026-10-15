import type { HistorySample } from "./history-provider";

export const MAX_HISTORY_PROVIDER_CALLS = 2_048;
export const MAX_HISTORY_LOAD_MS = 10 * 60_000;

/** Bounds the total provider requests and elapsed time for one history import. */
export class HistoryLoadBudget {
	private calls = 0;
	private readonly startedAt: number;

	/**
	 * Starts a load budget with optional testable limits and clock.
	 *
	 * @param maximumCalls Maximum number of provider calls.
	 * @param maximumDurationMs Maximum elapsed import duration in milliseconds.
	 * @param now Clock used to measure the elapsed duration.
	 */
	public constructor(
		private readonly maximumCalls = MAX_HISTORY_PROVIDER_CALLS,
		private readonly maximumDurationMs = MAX_HISTORY_LOAD_MS,
		private readonly now: () => number = Date.now,
	) {
		this.startedAt = now();
	}

	/** Reserves one provider request or throws when the budget is exhausted. */
	public consumeCall(): void {
		if (this.calls >= this.maximumCalls) {
			throw new Error(`History import exceeded the ${this.maximumCalls}-request safety limit`);
		}
		if (this.now() - this.startedAt >= this.maximumDurationMs) {
			throw new Error(`History import exceeded the ${this.maximumDurationMs} ms time budget`);
		}
		this.calls++;
	}

	/** Returns the number of requests reserved so far. */
	public get providerCalls(): number {
		return this.calls;
	}
}

/**
 * Retains unique history samples distributed across the complete timestamp span.
 *
 * @param current Samples previously retained for this import.
 * @param additional Samples from the latest accepted segment.
 * @param maximumSamples Maximum number of samples to retain.
 */
export function retainEvenlySpacedHistory(
	current: readonly HistorySample[],
	additional: readonly HistorySample[],
	maximumSamples: number,
): HistorySample[] {
	if (maximumSamples <= 0) {
		return [];
	}
	const sorted = [...current, ...additional].sort((a, b) => a.timestamp - b.timestamp);
	const uniqueByTimestamp = new Map<number, HistorySample>();
	for (const sample of sorted) {
		uniqueByTimestamp.set(sample.timestamp, sample);
	}
	const deduplicated = [...uniqueByTimestamp.values()];
	if (deduplicated.length <= maximumSamples) {
		return deduplicated;
	}
	if (maximumSamples <= 1) {
		return deduplicated.length ? [deduplicated.at(-1)!] : [];
	}
	return Array.from({ length: maximumSamples }, (_, index) => {
		const sourceIndex = Math.round((index * (deduplicated.length - 1)) / (maximumSamples - 1));
		return deduplicated[sourceIndex];
	});
}
