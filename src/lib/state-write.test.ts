import { expect } from "chai";
import { writeStateValues } from "./state-write";

describe("derived state write policy", () => {
	it("writes observation timestamps every time and routes derived values through changed writes", async () => {
		const always: Array<[string, unknown]> = [];
		const changed: Array<[string, unknown]> = [];

		await writeStateValues<ioBroker.StateValue>(
			[
				["analysis.actual", 10],
				["analysis.lastEvaluated", "2026-10-14T10:00:00.000Z"],
				["analysis.score", 25],
			],
			new Set(["analysis.actual", "analysis.lastEvaluated"]),
			(id, value) => {
				always.push([id, value]);
				return Promise.resolve();
			},
			(id, value) => {
				changed.push([id, value]);
				return Promise.resolve();
			},
		);

		expect(always).to.deep.equal([
			["analysis.actual", 10],
			["analysis.lastEvaluated", "2026-10-14T10:00:00.000Z"],
		]);
		expect(changed).to.deep.equal([["analysis.score", 25]]);
	});

	it("waits for every started write before rejecting individual failures", async () => {
		let releaseDelayed!: () => void;
		const delayed = new Promise<void>(resolve => {
			releaseDelayed = resolve;
		});
		let delayedFinished = false;
		const writing = writeStateValues(
			[
				["analysis.failed", 1],
				["analysis.delayed", 2],
			],
			new Set<string>(),
			() => Promise.resolve(),
			id =>
				id.endsWith("failed")
					? Promise.reject(new Error("unavailable"))
					: delayed.then(() => {
							delayedFinished = true;
						}),
		);
		let settled = false;
		void writing.catch(() => {
			settled = true;
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(settled).to.equal(false);
		releaseDelayed();
		let error: unknown;
		try {
			await writing;
		} catch (caught) {
			error = caught;
		}
		expect(delayedFinished).to.equal(true);
		expect(error).to.be.instanceOf(AggregateError);
		expect((error as AggregateError).message).to.include("analysis.failed");
	});
});
