import { DEFAULT_MAX_SAMPLES, SampleSeries, type SampleSeriesData } from "./statistics";

export interface TemporalModelData {
	global: SampleSeriesData;
	timeBuckets: Record<string, SampleSeriesData>;
	contextBuckets: Record<string, SampleSeriesData>;
}

export interface Baseline {
	series: SampleSeries;
	scope: "context" | "time" | "global";
}

/**
 * Stores only bounded samples per broad baseline, time bucket and optional day context.
 * The selection cascade avoids treating a sparse context as a reliable baseline.
 */
export class TemporalModel {
	private readonly global: SampleSeries;
	private readonly timeBuckets = new Map<string, SampleSeries>();
	private readonly contextBuckets = new Map<string, SampleSeries>();

	public constructor(
		private readonly bucketMinutes: number,
		private readonly maxSamples = DEFAULT_MAX_SAMPLES,
		data?: TemporalModelData,
	) {
		this.global = new SampleSeries(maxSamples, data?.global.values);
		for (const [key, series] of Object.entries(data?.timeBuckets ?? {})) {
			this.timeBuckets.set(key, new SampleSeries(maxSamples, series.values));
		}
		for (const [key, series] of Object.entries(data?.contextBuckets ?? {})) {
			this.contextBuckets.set(key, new SampleSeries(maxSamples, series.values));
		}
	}

	public add(value: number, timestamp: number, useTimeContext: boolean, useWeekdayContext: boolean): void {
		this.global.add(value);
		if (!useTimeContext) {
			return;
		}
		const timeKey = this.getTimeKey(timestamp);
		this.getOrCreate(this.timeBuckets, timeKey).add(value);
		if (useWeekdayContext) {
			this.getOrCreate(this.contextBuckets, `${this.getDayKey(timestamp)}:${timeKey}`).add(value);
		}
	}

	public baseline(
		timestamp: number,
		minSamples: number,
		useTimeContext: boolean,
		useWeekdayContext: boolean,
	): Baseline {
		if (useTimeContext) {
			const timeKey = this.getTimeKey(timestamp);
			if (useWeekdayContext) {
				const contextual = this.contextBuckets.get(`${this.getDayKey(timestamp)}:${timeKey}`);
				if (contextual && contextual.count >= minSamples) {
					return { series: contextual, scope: "context" };
				}
			}
			const time = this.timeBuckets.get(timeKey);
			if (time && time.count >= minSamples) {
				return { series: time, scope: "time" };
			}
		}
		return { series: this.global, scope: "global" };
	}

	public get sampleCount(): number {
		return this.global.count;
	}

	public toJSON(): TemporalModelData {
		return {
			global: this.global.toJSON(),
			timeBuckets: Object.fromEntries([...this.timeBuckets].map(([key, value]) => [key, value.toJSON()])),
			contextBuckets: Object.fromEntries([...this.contextBuckets].map(([key, value]) => [key, value.toJSON()])),
		};
	}

	private getOrCreate(map: Map<string, SampleSeries>, key: string): SampleSeries {
		let series = map.get(key);
		if (!series) {
			series = new SampleSeries(this.maxSamples);
			map.set(key, series);
		}
		return series;
	}

	private getTimeKey(timestamp: number): string {
		const date = new Date(timestamp);
		return String(Math.floor((date.getHours() * 60 + date.getMinutes()) / this.bucketMinutes));
	}

	private getDayKey(timestamp: number): string {
		return String(new Date(timestamp).getDay());
	}
}
