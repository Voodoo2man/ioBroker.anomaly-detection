/** Waits for pending work, including work added while earlier tasks finish. */
export async function drainPendingWork(pending: Set<Promise<void>>): Promise<void> {
	while (pending.size > 0) {
		await Promise.all([...pending]);
	}
}
