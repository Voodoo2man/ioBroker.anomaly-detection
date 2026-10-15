import { expect } from "chai";
import { HistoryLoadBudget, retainEvenlySpacedHistory } from "./history-budget";

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

	it("keeps a bounded, evenly spaced sample spanning the full time range", () => {
		const samples = Array.from({ length: 101 }, (_, index) => ({ value: index, timestamp: index }));
		const retained = retainEvenlySpacedHistory([], samples, 11);
		expect(retained).to.have.length(11);
		expect(retained[0].timestamp).to.equal(0);
		expect(retained.at(-1)?.timestamp).to.equal(100);
	});
});
