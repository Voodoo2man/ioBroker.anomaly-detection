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

interface PrioritizedSample {
	sample: HistorySample;
	priority: number;
}

/** Keeps temporal representatives and fills spare capacity from a bounded, order-independent reservoir. */
export class HistorySampleSampler {
	private readonly bucketSamples = new Map<number, HistorySample>();
	private readonly reservoir = new Map<number, PrioritizedSample>();
	private readonly reservoirHeap: PrioritizedSample[] = [];
	private first?: HistorySample;
	private last?: HistorySample;
	private centerSample?: HistorySample;
	private readonly bucketCount: number;
	private readonly span: number;

	/**
	 * Creates a bounded sampler tied to the complete requested history window.
	 *
	 * @param start Start timestamp of the complete history window.
	 * @param end End timestamp of the complete history window.
	 * @param maximumSamples Maximum number of samples to retain.
	 */
	public constructor(
		private readonly start: number,
		private readonly end: number,
		private readonly maximumSamples: number,
	) {
		this.maximumSamples = Number.isFinite(maximumSamples) ? Math.max(0, Math.floor(maximumSamples)) : 0;
		this.span = Math.max(0, end - start);
		this.bucketCount = this.maximumSamples > 2 ? this.maximumSamples - 2 : 0;
	}

	/**
	 * Adds a segment without resampling previously retained segments.
	 *
	 * @param samples Valid samples from a history segment.
	 */
	public add(samples: readonly HistorySample[]): void {
		for (const sample of samples) {
			if (
				!Number.isFinite(sample.timestamp) ||
				!Number.isFinite(sample.value) ||
				sample.timestamp < this.start ||
				sample.timestamp > this.end ||
				this.maximumSamples <= 0
			) {
				continue;
			}
			this.addToReservoir(sample);
			this.first = this.selectEndpoint(this.first, sample, true);
			this.last = this.selectEndpoint(this.last, sample, false);
			if (this.bucketCount === 0 || this.span === 0) {
				this.centerSample = this.selectNearestCenter(this.centerSample, sample);
				continue;
			}
			const position = Math.min(1, Math.max(0, (sample.timestamp - this.start) / this.span));
			const bucket = Math.min(this.bucketCount - 1, Math.floor(position * this.bucketCount));
			const current = this.bucketSamples.get(bucket);
			if (!current || this.isBetterBucketSample(sample, current, bucket)) {
				this.bucketSamples.set(bucket, sample);
			}
		}
	}

	/** Returns chronologically ordered, unique samples within the configured bound. */
	public getSamples(): HistorySample[] {
		if (this.maximumSamples <= 0) {
			return [];
		}
		const selected = new Map<number, HistorySample>();
		if (this.bucketCount === 0) {
			if (this.maximumSamples === 1) {
				if (this.span === 0) {
					if (this.first) {
						selected.set(this.first.timestamp, this.first);
					}
				} else if (this.centerSample) {
					selected.set(this.centerSample.timestamp, this.centerSample);
				}
			} else {
				if (this.first) {
					selected.set(this.first.timestamp, this.first);
				}
				if (this.last) {
					selected.set(this.last.timestamp, this.last);
				}
			}
		} else {
			for (const sample of this.bucketSamples.values()) {
				selected.set(sample.timestamp, this.preferDuplicate(selected.get(sample.timestamp), sample));
			}
			if (this.first) {
				selected.set(
					this.first.timestamp,
					this.preferDuplicate(selected.get(this.first.timestamp), this.first),
				);
			}
			if (this.last) {
				selected.set(this.last.timestamp, this.preferDuplicate(selected.get(this.last.timestamp), this.last));
			}
		}
		// Buckets guarantee coverage where data exists. Fill unused slots instead
		// of discarding clustered data merely because the requested window is large.
		// The reservoir retains every unique sample until the limit is exceeded.
		if (selected.size < this.maximumSamples) {
			const candidates = [...this.reservoirHeap].sort((left, right) => this.comparePriority(left, right));
			for (const { sample } of candidates) {
				selected.set(sample.timestamp, this.preferDuplicate(selected.get(sample.timestamp), sample));
				if (selected.size >= this.maximumSamples) {
					break;
				}
			}
		}
		return [...selected.values()]
			.sort((left, right) => left.timestamp - right.timestamp)
			.slice(0, this.maximumSamples);
	}

	private addToReservoir(sample: HistorySample): void {
		const existing = this.reservoir.get(sample.timestamp);
		if (existing) {
			existing.sample = this.preferDuplicate(existing.sample, sample);
			return;
		}
		const candidate = { sample, priority: this.timestampPriority(sample.timestamp) };
		if (this.reservoirHeap.length < this.maximumSamples) {
			this.reservoir.set(sample.timestamp, candidate);
			this.reservoirHeap.push(candidate);
			let index = this.reservoirHeap.length - 1;
			while (index > 0) {
				const parent = Math.floor((index - 1) / 2);
				if (this.comparePriority(this.reservoirHeap[index], this.reservoirHeap[parent]) <= 0) {
					break;
				}
				[this.reservoirHeap[index], this.reservoirHeap[parent]] = [
					this.reservoirHeap[parent],
					this.reservoirHeap[index],
				];
				index = parent;
			}
			return;
		}
		// A max-heap retains the lowest deterministic timestamp priorities in
		// O(limit) storage and O(log limit) work per replacement, without a seen-set.
		if (this.comparePriority(candidate, this.reservoirHeap[0]) >= 0) {
			return;
		}
		this.reservoir.delete(this.reservoirHeap[0].sample.timestamp);
		this.reservoirHeap[0] = candidate;
		this.reservoir.set(sample.timestamp, candidate);
		let index = 0;
		while (index * 2 + 1 < this.reservoirHeap.length) {
			let child = index * 2 + 1;
			if (
				child + 1 < this.reservoirHeap.length &&
				this.comparePriority(this.reservoirHeap[child + 1], this.reservoirHeap[child]) > 0
			) {
				child++;
			}
			if (this.comparePriority(this.reservoirHeap[index], this.reservoirHeap[child]) >= 0) {
				break;
			}
			[this.reservoirHeap[index], this.reservoirHeap[child]] = [
				this.reservoirHeap[child],
				this.reservoirHeap[index],
			];
			index = child;
		}
	}

	private comparePriority(left: PrioritizedSample, right: PrioritizedSample): number {
		return left.priority - right.priority || left.sample.timestamp - right.sample.timestamp;
	}

	private timestampPriority(timestamp: number): number {
		// Hash the complete timestamp, including fractional milliseconds. Segment
		// boundaries, import order and measurement values never affect priority.
		let hash = 0x811c9dc5;
		for (const character of String(timestamp)) {
			hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
		}
		hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
		hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
		return (hash ^ (hash >>> 16)) >>> 0;
	}

	private selectEndpoint(
		current: HistorySample | undefined,
		candidate: HistorySample,
		earliest: boolean,
	): HistorySample {
		if (!current) {
			return candidate;
		}
		if (candidate.timestamp === current.timestamp) {
			return this.preferDuplicate(current, candidate);
		}
		return (earliest ? candidate.timestamp < current.timestamp : candidate.timestamp > current.timestamp)
			? candidate
			: current;
	}

	private selectNearestCenter(current: HistorySample | undefined, candidate: HistorySample): HistorySample {
		if (!current) {
			return candidate;
		}
		const center = this.start + this.span / 2;
		const currentDistance = Math.abs(current.timestamp - center);
		const candidateDistance = Math.abs(candidate.timestamp - center);
		return candidateDistance < currentDistance ||
			(candidateDistance === currentDistance && this.compareSamples(candidate, current) < 0)
			? candidate
			: current;
	}

	private isBetterBucketSample(candidate: HistorySample, current: HistorySample, bucket: number): boolean {
		const bucketCenter = this.start + ((bucket + 0.5) * this.span) / this.bucketCount;
		const candidateDistance = Math.abs(candidate.timestamp - bucketCenter);
		const currentDistance = Math.abs(current.timestamp - bucketCenter);
		return (
			candidateDistance < currentDistance ||
			(candidateDistance === currentDistance && this.compareSamples(candidate, current) < 0)
		);
	}

	private preferDuplicate(current: HistorySample | undefined, candidate: HistorySample): HistorySample {
		return !current || this.compareSamples(candidate, current) < 0 ? candidate : current;
	}

	private compareSamples(left: HistorySample, right: HistorySample): number {
		return left.timestamp - right.timestamp || left.value - right.value;
	}
}
