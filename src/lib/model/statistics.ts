export const MODEL_SCHEMA_VERSION = 2;
export const DEFAULT_MAX_SAMPLES = 240;

export interface SampleSeriesData {
	values: number[];
}

/** A bounded sample reservoir. Keeping samples rather than raw history makes median and MAD robust and restart-safe. */
export class SampleSeries {
	private readonly values: number[];

	public constructor(
		private readonly maxSamples = DEFAULT_MAX_SAMPLES,
		values: number[] = [],
	) {
		this.values = values.filter(Number.isFinite).slice(-maxSamples);
	}

	public add(value: number): void {
		if (!Number.isFinite(value)) {
			return;
		}
		this.values.push(value);
		if (this.values.length > this.maxSamples) {
			this.values.splice(0, this.values.length - this.maxSamples);
		}
	}

	public get count(): number {
		return this.values.length;
	}

	public median(): number | undefined {
		return median(this.values);
	}

	public mad(): number | undefined {
		const center = this.median();
		return center === undefined ? undefined : median(this.values.map(value => Math.abs(value - center)));
	}

	public toJSON(): SampleSeriesData {
		return { values: [...this.values] };
	}
}

export function median(values: readonly number[]): number | undefined {
	const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
	if (finite.length === 0) {
		return undefined;
	}
	const middle = Math.floor(finite.length / 2);
	if (finite.length % 2 !== 0) {
		return finite[middle];
	}
	const lower = finite[middle - 1];
	const upper = finite[middle];
	// Avoid overflowing when two large finite values have the same sign. For
	// opposite signs, halve first so the subtraction cannot overflow.
	return lower < 0 && upper > 0 ? lower / 2 + upper / 2 : lower + (upper - lower) / 2;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
