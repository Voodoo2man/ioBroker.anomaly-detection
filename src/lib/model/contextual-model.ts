import { DEFAULT_MAX_SAMPLES } from "./statistics";
import { TemporalModel, type Baseline, type TemporalModelData } from "./temporal-model";

export interface ContextualModelEntryData {
	model: TemporalModelData;
	lastUsed: number;
}

export interface ContextualModelData {
	contexts: Record<string, ContextualModelEntryData>;
}

/** Bounded context-specific temporal baselines with deterministic least-recently-used eviction. */
export class ContextualModel {
	private readonly contexts = new Map<string, { model: TemporalModel; lastUsed: number }>();

	public constructor(
		private readonly bucketMinutes: number,
		private readonly maxContexts: number,
		private readonly maxSamples = DEFAULT_MAX_SAMPLES,
		data?: ContextualModelData,
	) {
		for (const [key, entry] of Object.entries(data?.contexts ?? {})) {
			if (this.contexts.size >= maxContexts) {
				break;
			}
			this.contexts.set(key, {
				model: new TemporalModel(bucketMinutes, maxSamples, entry.model),
				lastUsed: Number.isFinite(entry.lastUsed) ? entry.lastUsed : 0,
			});
		}
	}

	public baseline(
		key: string | undefined,
		timestamp: number,
		minimumSamples: number,
		useTimeContext: boolean,
		useWeekdayContext: boolean,
	): Baseline | undefined {
		if (!key) {
			return undefined;
		}
		const entry = this.contexts.get(key);
		if (!entry || entry.model.sampleCount < minimumSamples) {
			return undefined;
		}
		entry.lastUsed = timestamp;
		return entry.model.baseline(timestamp, minimumSamples, useTimeContext, useWeekdayContext);
	}

	/**
	 * Returns the retained global sample count for one exact context combination.
	 *
	 * @param key Normalized context combination key.
	 */
	public sampleCount(key: string | undefined): number {
		return key ? (this.contexts.get(key)?.model.sampleCount ?? 0) : 0;
	}

	public add(
		key: string | undefined,
		value: number,
		timestamp: number,
		useTimeContext: boolean,
		useWeekdayContext: boolean,
	): void {
		if (!key) {
			return;
		}
		let entry = this.contexts.get(key);
		if (!entry) {
			if (this.contexts.size >= this.maxContexts) {
				const oldest = [...this.contexts.entries()].sort(
					([leftKey, left], [rightKey, right]) =>
						left.lastUsed - right.lastUsed || leftKey.localeCompare(rightKey),
				)[0];
				if (oldest) {
					this.contexts.delete(oldest[0]);
				}
			}
			entry = { model: new TemporalModel(this.bucketMinutes, this.maxSamples), lastUsed: timestamp };
			this.contexts.set(key, entry);
		}
		entry.lastUsed = timestamp;
		entry.model.add(value, timestamp, useTimeContext, useWeekdayContext);
	}

	public toJSON(): ContextualModelData {
		return {
			contexts: Object.fromEntries(
				[...this.contexts].map(([key, entry]) => [
					key,
					{ model: entry.model.toJSON(), lastUsed: entry.lastUsed },
				]),
			),
		};
	}
}
