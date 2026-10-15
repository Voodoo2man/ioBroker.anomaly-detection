import { expect } from "chai";
import { HistoryLoadBudget, HistorySampleSampler } from "./history-budget";
import type { HistorySample } from "./history-provider";

describe("history import budget", () => {
	it("retains 60 unique values in one hour of a 30-day requested window", () => {
		const day = 24 * 60 * 60_000;
		const samples = Array.from({ length: 60 }, (_, index) => ({
			value: index,
			timestamp: 15 * day + index * 60_000,
		}));
		const sampler = new HistorySampleSampler(0, 30 * day, 1_000);
		sampler.add(samples);
		expect(sampler.getSamples()).to.deep.equal(samples);
	});

	for (const maximum of [30, 100, 500, 1_000, 2_000, 10_000]) {
		it(`retains all ${maximum} values at the limit, even in a tiny part of the requested window`, () => {
			const sampler = new HistorySampleSampler(0, 30 * 24 * 60 * 60_000, maximum);
			const samples = Array.from({ length: maximum }, (_, timestamp) => ({
				value: timestamp,
				timestamp: 1_000_000 + timestamp,
			}));
			for (const segment of splitSegments(samples, [1, 37, 503])) {
				sampler.add(segment);
			}
			expect(sampler.getSamples()).to.deep.equal(samples);
		});

		it(`fills limit ${maximum} with uneven densities and gaps independently of segmentation and import order`, () => {
			const samples = [
				...Array.from({ length: 4_000 }, (_, index) => ({ value: index, timestamp: 1_000 + index })),
				...Array.from({ length: 1_000 }, (_, index) => ({
					value: index,
					timestamp: 10_000_000 + index * 100_000,
				})),
				...Array.from({ length: 5_000 }, (_, index) => ({ value: index, timestamp: 200_000_000 + index })),
			];
			const expectedSampler = new HistorySampleSampler(0, 300_000_000, maximum);
			expectedSampler.add(samples);
			const expected = expectedSampler.getSamples();
			for (const sizes of [[1], [7, 101, 1_000], [10_000]]) {
				const segments = splitSegments(samples, sizes);
				for (const reverse of [false, true]) {
					const sampler = new HistorySampleSampler(0, 300_000_000, maximum);
					for (const segment of reverse ? [...segments].reverse() : segments) {
						sampler.add(reverse ? [...segment].reverse() : segment);
					}
					// Repeated provider overlaps must not consume slots or change tie-breaking.
					sampler.add(
						samples
							.filter((_, index) => index % 100 === 0)
							.map(sample => ({ ...sample, value: sample.value + 1 })),
					);
					const retained = sampler.getSamples();
					expect(retained).to.deep.equal(expected);
					expect(retained).to.have.length(maximum);
					expect(isChronological(retained)).to.equal(true);
					expect(new Set(retained.map(sample => sample.timestamp)).size).to.equal(maximum);
					expect(retained[0].timestamp).to.equal(samples[0].timestamp);
					expect(retained.at(-1)?.timestamp).to.equal(samples.at(-1)?.timestamp);
					expect(
						retained.some(sample => sample.timestamp >= 10_000_000 && sample.timestamp < 110_000_000),
					).to.equal(true);
				}
			}
		});
	}

	it("keeps a handful of clustered values and rejects invalid/out-of-window samples", () => {
		const sampler = new HistorySampleSampler(0, 1_000_000_000, 30);
		const valid = [
			{ value: 1, timestamp: 100 },
			{ value: 2, timestamp: 101 },
			{ value: 3, timestamp: 102 },
		];
		sampler.add([
			...valid,
			{ value: NaN, timestamp: 103 },
			{ value: 4, timestamp: Infinity },
			{ value: 0, timestamp: -1 },
		]);
		expect(sampler.getSamples()).to.deep.equal(valid);
	});

	it("preserves deterministic endpoint/center behavior for limits zero, one and two", () => {
		for (const maximum of [0, 1, 2]) {
			const sampler = new HistorySampleSampler(0, 100, maximum);
			sampler.add([
				{ value: 95, timestamp: 95 },
				{ value: 5, timestamp: 5 },
				{ value: 50, timestamp: 50 },
			]);
			expect(sampler.getSamples().map(sample => sample.timestamp)).to.deep.equal(
				maximum === 0 ? [] : maximum === 1 ? [50] : [5, 95],
			);
		}
	});

	it("keeps anomaly and predictive windows and limits independent without fetching more history", () => {
		const day = 24 * 60 * 60_000;
		const recent = Array.from({ length: 60 }, (_, index) => ({
			value: index,
			timestamp: 30 * day - (60 - index) * 60_000,
		}));
		const older = Array.from({ length: 120 }, (_, index) => ({ value: index, timestamp: (index * day) / 10 }));
		const anomaly = new HistorySampleSampler(29 * day, 30 * day, 1000);
		const predictive = new HistorySampleSampler(0, 30 * day, 100);
		for (const segment of splitSegments([...older, ...recent], [7, 11, 30])) {
			anomaly.add(segment);
			predictive.add(segment);
		}
		expect(anomaly.getSamples()).to.deep.equal(recent);
		expect(predictive.getSamples()).to.have.length(100);
		expect(predictive.getSamples()[0].timestamp).to.equal(0);
		expect(predictive.getSamples().at(-1)?.timestamp).to.equal(recent.at(-1)?.timestamp);
	});

	it("limits total provider calls and total elapsed time", () => {
		let now = 100;
		const budget = new HistoryLoadBudget(2, 10, () => now);
		budget.consumeCall();
		budget.consumeCall();
		expect(() => budget.consumeCall()).to.throw("2-request safety limit");
		expect(budget.providerCalls).to.equal(2);

		const timed = new HistoryLoadBudget(10, 10, () => now);
		now += 10;
		expect(() => timed.consumeCall()).to.throw("time budget");
	});

	it("samples one large segment uniformly and includes both endpoints", () => {
		const sampler = new HistorySampleSampler(0, 9_999, 1_000);
		sampler.add(Array.from({ length: 10_000 }, (_, timestamp) => ({ value: timestamp, timestamp })));
		const retained = sampler.getSamples();
		expect(retained).to.have.length(1_000);
		expect(retained[0].timestamp).to.equal(0);
		expect(retained.at(-1)?.timestamp).to.equal(9_999);
		expect(isChronological(retained)).to.equal(true);
	});

	it("allocates approximately 100 samples to each of ten equal segments", () => {
		const sampler = new HistorySampleSampler(0, 9_999, 1_000);
		for (let segment = 0; segment < 10; segment++) {
			const start = segment * 1_000;
			sampler.add(
				Array.from({ length: 1_000 }, (_, offset) => ({ value: start + offset, timestamp: start + offset })),
			);
		}
		const retained = sampler.getSamples();
		const counts = Array.from(
			{ length: 10 },
			(_, segment) => retained.filter(sample => Math.floor(sample.timestamp / 1_000) === segment).length,
		);
		expect(retained).to.have.length(1_000);
		counts.forEach(count => expect(count).to.be.within(98, 102));
	});

	it("does not favor later segments with unequal segment sizes or reversed import order", () => {
		const segments = [
			Array.from({ length: 100 }, (_, timestamp) => ({ value: timestamp, timestamp })),
			Array.from({ length: 900 }, (_, offset) => ({ value: 100 + offset, timestamp: 100 + offset })),
			Array.from({ length: 9_000 }, (_, offset) => ({ value: 1_000 + offset, timestamp: 1_000 + offset })),
		];
		const forward = new HistorySampleSampler(0, 9_999, 1_000);
		segments.forEach(segment => forward.add(segment));
		const reverse = new HistorySampleSampler(0, 9_999, 1_000);
		[...segments].reverse().forEach(segment => reverse.add(segment));
		expect(forward.getSamples().map(sample => sample.timestamp)).to.deep.equal(
			reverse.getSamples().map(sample => sample.timestamp),
		);
		expect(forward.getSamples().filter(sample => sample.timestamp < 100).length).to.be.greaterThan(5);
		expect(forward.getSamples().filter(sample => sample.timestamp >= 1_000).length).to.be.within(890, 910);
	});

	it("handles many small segments, duplicate timestamps, and large gaps within the bound", () => {
		const sampler = new HistorySampleSampler(0, 1_000_000, 100);
		for (let index = 0; index < 10_000; index++) {
			const timestamp = index < 100 ? index : 900_000 + index;
			sampler.add([
				{ value: index, timestamp },
				{ value: index + 1, timestamp },
			]);
		}
		const retained = sampler.getSamples();
		expect(retained.length).to.be.at.most(100);
		expect(new Set(retained.map(sample => sample.timestamp)).size).to.equal(retained.length);
		expect(retained[0].timestamp).to.equal(0);
		expect(retained.at(-1)?.timestamp).to.equal(909_999);
		expect(isChronological(retained)).to.equal(true);
	});

	it("selects the same value for duplicate timestamps regardless of segment import order", () => {
		const duplicateLow = [{ value: 10, timestamp: 500 }];
		const duplicateHigh = [{ value: 20, timestamp: 500 }];
		const first = new HistorySampleSampler(0, 1_000, 10);
		first.add(duplicateLow);
		first.add(duplicateHigh);
		const second = new HistorySampleSampler(0, 1_000, 10);
		second.add(duplicateHigh);
		second.add(duplicateLow);
		expect(first.getSamples()).to.deep.equal(second.getSamples());
		expect(first.getSamples()).to.deep.equal([{ value: 10, timestamp: 500 }]);
	});

	it("applies configured limits from 30 through 10000 exactly", () => {
		const samples = Array.from({ length: 10_000 }, (_, timestamp) => ({ value: timestamp, timestamp }));
		for (const maximum of [30, 100, 500, 1_000, 2_000, 10_000]) {
			const sampler = new HistorySampleSampler(0, 9_999, maximum);
			sampler.add(samples);
			expect(sampler.getSamples()).to.have.length(maximum);
		}
	});
});

function isChronological(samples: readonly { timestamp: number }[]): boolean {
	return samples.every((sample, index) => index === 0 || samples[index - 1].timestamp < sample.timestamp);
}

function splitSegments(samples: readonly HistorySample[], sizes: readonly number[]): HistorySample[][] {
	const segments: HistorySample[][] = [];
	let index = 0;
	while (index < samples.length) {
		const size = sizes[segments.length % sizes.length];
		segments.push(samples.slice(index, index + size));
		index += size;
	}
	return segments;
}
