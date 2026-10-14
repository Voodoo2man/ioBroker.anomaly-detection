import { expect } from "chai";
import { withAbortableTimeout } from "./history-request";

describe("abortable history requests", () => {
	it("stops waiting when shutdown aborts a segmented request", async () => {
		const controller = new AbortController();
		let resolveRequest!: (value: string[]) => void;
		const request = new Promise<string[]>(resolve => {
			resolveRequest = resolve;
		});
		const waiting = withAbortableTimeout(request, controller.signal, 1000);

		controller.abort();

		let error: Error | undefined;
		try {
			await waiting;
		} catch (caught) {
			error = caught as Error;
		}
		expect(error?.message).to.equal("History request aborted during shutdown");

		resolveRequest(["late result"]);
	});

	it("rejects a history request when its timeout expires", async () => {
		const request = new Promise<string[]>(() => {});
		let error: Error | undefined;
		try {
			await withAbortableTimeout(request, new AbortController().signal, 1);
		} catch (caught) {
			error = caught as Error;
		}
		expect(error?.message).to.equal("History request timed out");
	});

	it("does not replace a completed response when shutdown happens later", async () => {
		const controller = new AbortController();
		const response = await withAbortableTimeout(Promise.resolve([1]), controller.signal, 1000);

		controller.abort();

		expect(response).to.deep.equal([1]);
	});
});
