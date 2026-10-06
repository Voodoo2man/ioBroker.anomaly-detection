import { expect } from "chai";
import { drainPendingWork } from "./pending-work";

describe("pending adapter work", () => {
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
});
