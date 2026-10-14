import { expect } from "chai";
import { observeWithTimestampCache } from "./timestamp-cache";

describe("accepted observation timestamp cache", () => {
	it("does not suppress a valid correction after an invalid value", () => {
		const cache = new Map<string, number>();
		const observed: number[] = [];
		const invalid = observeWithTimestampCache(cache, "source", 1_000, () => undefined, 512);
		const valid = observeWithTimestampCache(
			cache,
			"source",
			1_000,
			() => {
				observed.push(42);
				return 42;
			},
			512,
		);

		expect(invalid.result).to.equal(undefined);
		expect(valid).to.deep.equal({ duplicate: false, result: 42 });
		expect(observed).to.deep.equal([42]);
		expect(cache.get("source")).to.equal(1_000);
	});

	it("skips a repeated timestamp after a successful observation", () => {
		const cache = new Map<string, number>();
		let calls = 0;
		observeWithTimestampCache(cache, "source", 1_000, () => ++calls, 512);
		const repeated = observeWithTimestampCache(cache, "source", 1_000, () => ++calls, 512);

		expect(repeated.duplicate).to.equal(true);
		expect(calls).to.equal(1);
	});
});