import { expect } from "chai";
import { LatestRequest } from "../src/latest-request.ts";

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
} {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe("latest async request handling", () => {
	it("ignores an older rejection after a newer request succeeds", async () => {
		const latest = new LatestRequest();
		const oldRequest = deferred<string>();
		const newRequest = deferred<string>();
		const received: string[] = [];
		let errors = 0;
		const handlers = { onSuccess: (value: string): void => received.push(value), onError: (): void => errors++ };

		const oldRun = latest.run(() => oldRequest.promise, handlers);
		const newRun = latest.run(() => newRequest.promise, handlers);
		newRequest.resolve("new range");
		await newRun;
		oldRequest.reject(new Error("stale failure"));
		await oldRun;

		expect(received).to.deep.equal(["new range"]);
		expect(errors).to.equal(0);
	});

	it("ignores an older success after a newer request succeeds", async () => {
		const latest = new LatestRequest();
		const oldRequest = deferred<string>();
		const newRequest = deferred<string>();
		const received: string[] = [];
		const handlers = { onSuccess: (value: string): void => received.push(value), onError: () => expect.fail() };

		const oldRun = latest.run(() => oldRequest.promise, handlers);
		const newRun = latest.run(() => newRequest.promise, handlers);
		newRequest.resolve("new range");
		await newRun;
		oldRequest.resolve("old range");
		await oldRun;

		expect(received).to.deep.equal(["new range"]);
	});

	it("reports the current request failure and settles without leaking a rejection", async () => {
		const latest = new LatestRequest();
		const failedRequest = deferred<string>();
		let errors = 0;
		let settled = 0;
		const run = latest.run(() => failedRequest.promise, {
			onSuccess: () => expect.fail("failed request must not succeed"),
			onError: () => errors++,
			onSettled: () => settled++,
		});
		failedRequest.reject(new Error("history provider unavailable"));
		await run;

		expect(errors).to.equal(1);
		expect(settled).to.equal(1);
	});

	it("does not update the owner after cleanup invalidates a request", async () => {
		const latest = new LatestRequest();
		const request = deferred<string>();
		let received = false;
		const run = latest.run(() => request.promise, {
			onSuccess: () => (received = true),
			onError: () => expect.fail("invalidated failure must be ignored"),
		});
		latest.invalidate();
		request.resolve("after unmount");
		await run;

		expect(received).to.equal(false);
	});
});
