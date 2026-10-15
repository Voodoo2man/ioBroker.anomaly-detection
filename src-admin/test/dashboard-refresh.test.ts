import { expect } from "chai";
import { DashboardRefresh, type DashboardSocket } from "../src/dashboard-refresh.ts";

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

type Source = { id: string };
const response = (id: string): { data: { sources: Source[] } } => ({ data: { sources: [{ id }] } });

describe("dashboard refresh lifecycle", () => {
	it("keeps the newer dashboard sources when an older refresh succeeds last", async () => {
		const oldRequest = deferred<unknown>();
		const newRequest = deferred<unknown>();
		const replies = [oldRequest.promise, newRequest.promise];
		const socket: DashboardSocket = { sendTo: async () => replies.shift()! };
		const refresh = new DashboardRefresh<Source>();
		refresh.setIdentity(socket, "anomaly-detection.0");
		const received: string[] = [];
		const handlers = {
			onSources: (sources: Source[]): void => received.push(sources[0].id),
			onError: () => expect.fail(),
		};

		const older = refresh.refresh([], handlers);
		const newer = refresh.refresh([], handlers);
		newRequest.resolve(response("new"));
		await newer;
		oldRequest.resolve(response("old"));
		await older;

		expect(received).to.deep.equal(["new"]);
	});

	it("ignores an older refresh failure after a newer refresh succeeds", async () => {
		const oldRequest = deferred<unknown>();
		const newRequest = deferred<unknown>();
		const replies = [oldRequest.promise, newRequest.promise];
		const socket: DashboardSocket = { sendTo: async () => replies.shift()! };
		const refresh = new DashboardRefresh<Source>();
		refresh.setIdentity(socket, "anomaly-detection.0");
		const received: string[] = [];
		let errors = 0;
		const handlers = {
			onSources: (sources: Source[]): void => received.push(sources[0].id),
			onError: (): number => ++errors,
		};

		const older = refresh.refresh([], handlers);
		const newer = refresh.refresh([], handlers);
		newRequest.resolve(response("new"));
		await newer;
		oldRequest.reject(new Error("stale request failure"));
		await older;

		expect(received).to.deep.equal(["new"]);
		expect(errors).to.equal(0);
	});

	it("invalidates a pending response when switching adapter instances", async () => {
		const oldRequest = deferred<unknown>();
		const newRequest = deferred<unknown>();
		const socket: DashboardSocket = {
			sendTo: (_target, _command, _data) => (_target.endsWith(".0") ? oldRequest.promise : newRequest.promise),
		};
		const refresh = new DashboardRefresh<Source>();
		const received: string[] = [];
		const handlers = {
			onSources: (sources: Source[]): void => received.push(sources[0].id),
			onError: () => expect.fail(),
		};

		refresh.setIdentity(socket, "anomaly-detection.0");
		const older = refresh.refresh([], handlers);
		refresh.setIdentity(socket, "anomaly-detection.1");
		const newer = refresh.refresh([], handlers);
		newRequest.resolve(response("instance-1"));
		await newer;
		oldRequest.resolve(response("instance-0"));
		await older;

		expect(received).to.deep.equal(["instance-1"]);
	});

	it("ignores pending results after component cleanup", async () => {
		const request = deferred<unknown>();
		const socket: DashboardSocket = { sendTo: async () => request.promise };
		const refresh = new DashboardRefresh<Source>();
		refresh.setIdentity(socket, "anomaly-detection.0");
		const received: string[] = [];
		const run = refresh.refresh([], {
			onSources: sources => received.push(sources[0].id),
			onError: () => expect.fail("invalidated failures are ignored"),
		});

		refresh.invalidate();
		request.resolve(response("after-unmount"));
		await run;

		expect(received).to.deep.equal([]);
	});

	it("applies a normal refresh response", async () => {
		const socket: DashboardSocket = { sendTo: async () => response("current") };
		const refresh = new DashboardRefresh<Source>();
		refresh.setIdentity(socket, "anomaly-detection.0");
		const received: string[] = [];
		let errors = 0;

		await refresh.refresh([{ id: "fallback" }], {
			onSources: sources => received.push(sources[0].id),
			onError: () => errors++,
		});

		expect(received).to.deep.equal(["current"]);
		expect(errors).to.equal(0);
	});
});
