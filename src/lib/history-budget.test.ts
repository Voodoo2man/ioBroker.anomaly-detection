import { expect } from "chai";
import { HistoryLoadBudget, HistorySampleSampler } from "./history-budget";

describe("history import budget", () => {
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
