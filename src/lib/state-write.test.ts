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
});
