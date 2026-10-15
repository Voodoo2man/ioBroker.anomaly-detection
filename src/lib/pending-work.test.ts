import { expect } from "chai";
import { acquireExclusiveWork, drainPendingWork, enqueueSerializedWork, settleIndependentTasks } from "./pending-work";
import { writeStateValues } from "./state-write";

describe("pending adapter work", () => {
	it("allows only one active task per key and independent keys concurrently", () => {
		const active = new Set<string>();
		const releaseA = acquireExclusiveWork(active, "source-a");
		expect(releaseA).to.be.a("function");
		expect(acquireExclusiveWork(active, "source-a")).to.equal(undefined);
		const releaseB = acquireExclusiveWork(active, "source-b");
		expect(releaseB).to.be.a("function");

		releaseA?.();
		releaseA?.();
		expect(acquireExclusiveWork(active, "source-a")).to.be.a("function");
		releaseB?.();
	});

	it("waits for work added while an earlier task is finishing", async () => {
		const pending = new Set<Promise<void>>();
		let finishInitial!: () => void;
		let finishFollowUp!: () => void;
		let drained = false;

		const initial = new Promise<void>(resolve => {
			finishInitial = resolve;
		});
		const trackedInitial = initial.then(() => {
			const followUp = new Promise<void>(resolve => {
				finishFollowUp = resolve;
			});
			pending.add(followUp);
			void followUp.then(() => pending.delete(followUp));
		});
		pending.add(trackedInitial);
		void trackedInitial.then(() => pending.delete(trackedInitial));

		const drain = drainPendingWork(pending).then(() => {
			drained = true;
		});
		finishInitial();
		await Promise.resolve();
		await Promise.resolve();
		expect(drained).to.equal(false);

		finishFollowUp();
		await drain;
		expect(drained).to.equal(true);
	});

	it("serializes every result write for one source without blocking another source", async () => {
		const queues = new Map<string, Promise<void>>();
		const events: string[] = [];
		let releaseFirst!: () => void;
		const firstGate = new Promise<void>(resolve => {
			releaseFirst = resolve;
		});
		const first = enqueueSerializedWork(queues, "source-a", async () => {
			events.push("a1-start");
			await firstGate;
			events.push("a1-end");
		});
		const second = enqueueSerializedWork(queues, "source-a", () => {
			events.push("a2");
			return Promise.resolve();
		});
		const independent = enqueueSerializedWork(queues, "source-b", () => {
			events.push("b1");
			return Promise.resolve();
		});

		await independent;
		expect(events).to.deep.equal(["a1-start", "b1"]);
		releaseFirst();
		await Promise.all([first, second]);
		expect(events).to.deep.equal(["a1-start", "b1", "a1-end", "a2"]);
	});

	it("persists the newest snapshot when an earlier state write is delayed", async () => {
		const queues = new Map<string, Promise<void>>();
		const model = { samples: 1 };
		const persisted: number[] = [];
		let signalFirstSnapshot!: () => void;
		let releaseFirst!: () => void;
		const firstSnapshotTaken = new Promise<void>(resolve => {
			signalFirstSnapshot = resolve;
		});
		const firstWriteGate = new Promise<void>(resolve => {
			releaseFirst = resolve;
		});

		const persist = (): Promise<void> =>
			enqueueSerializedWork(queues, "models", async () => {
				const snapshot = JSON.stringify(model);
				if (persisted.length === 0) {
					signalFirstSnapshot();
					await firstWriteGate;
				}
				persisted.push(JSON.parse(snapshot).samples);
			});

		const olderPersist = persist();
		await firstSnapshotTaken;
		model.samples = 2;
		const newerPersist = persist();
		expect(persisted).to.deep.equal([]);

		releaseFirst();
		await Promise.all([olderPersist, newerPersist]);
		expect(persisted).to.deep.equal([1, 2]);
		expect(persisted.at(-1)).to.equal(model.samples);
	});

	it("serializes after partial write failure, lets other sources proceed, and drains shutdown work", async () => {
		const queues = new Map<string, Promise<void>>();
		const pending = new Set<Promise<void>>();
		const events: string[] = [];
		let releaseSibling!: () => void;
		const siblingGate = new Promise<void>(resolve => {
			releaseSibling = resolve;
		});
		const first = enqueueSerializedWork(queues, "source-a", () =>
			writeStateValues(
				[
					["failed", 1],
					["delayed", 2],
				],
				new Set<string>(),
				() => Promise.resolve(),
				id =>
					id === "failed"
						? Promise.reject(new Error("write failed"))
						: siblingGate.then(() => {
								events.push("sibling-finished");
							}),
			),
		);
		const settledFirst = first.then(
			() => undefined,
			() => undefined,
		);
		pending.add(settledFirst);
		void settledFirst.then(() => pending.delete(settledFirst));
		const second = enqueueSerializedWork(queues, "source-a", () => {
			events.push("same-source-next");
			return Promise.resolve();
		});
		const independent = enqueueSerializedWork(queues, "source-b", () => {
			events.push("other-source");
			return Promise.resolve();
		});
		await independent;
		await Promise.resolve();
		await Promise.resolve();
		expect(events).to.deep.equal(["other-source"]);

		let drained = false;
		const drain = drainPendingWork(pending).then(() => {
			drained = true;
		});
		releaseSibling();
		await Promise.all([settledFirst, second, drain]);
		expect(events).to.deep.equal(["other-source", "sibling-finished", "same-source-next"]);
		expect(drained).to.equal(true);
	});

	it("runs predictive training even when result-state writes fail", async () => {
		const events: string[] = [];
		const resultWrite = writeStateValues(
			[["analysis.result", 1]],
			new Set<string>(),
			() => Promise.resolve(),
			() => Promise.reject(new Error("state unavailable")),
		);
		const training = Promise.resolve().then(() => {
			events.push("trained");
		});

		const outcomes = await settleIndependentTasks([resultWrite, training]);

		expect(events).to.deep.equal(["trained"]);
		expect(outcomes[0].status).to.equal("rejected");
		expect(outcomes[1].status).to.equal("fulfilled");
	});
});
