/**
 * Waits for pending work, including work added while earlier tasks finish.
 *
 * @param pending The set of pending operations.
 */
export async function drainPendingWork(pending: Set<Promise<void>>): Promise<void> {
	while (pending.size > 0) {
		await Promise.all([...pending]);
	}
}

/**
 * Runs work in submission order for one key while allowing different keys to proceed independently.
 *
 * @param queues The active work queue for each key.
 * @param key The key whose work should be serialized.
 * @param task The next operation to run for the key.
 */
export function enqueueSerializedWork<K>(
	queues: Map<K, Promise<void>>,
	key: K,
	task: () => Promise<void>,
): Promise<void> {
	const previous = queues.get(key) ?? Promise.resolve();
	const current = previous.then(task, task);
	queues.set(key, current);
	void current.then(
		() => {
			if (queues.get(key) === current) {
				queues.delete(key);
			}
		},
		() => {
			if (queues.get(key) === current) {
				queues.delete(key);
			}
		},
	);
	return current;
}

/**
 * Acquires an exclusive per-key work slot, returning an idempotent release function.
 *
 * @param active Keys whose work slots are currently held.
 * @param key Key whose work slot should be acquired.
 */
export function acquireExclusiveWork<K>(active: Set<K>, key: K): (() => void) | undefined {
	if (active.has(key)) {
		return undefined;
	}
	active.add(key);
	let released = false;
	return () => {
		if (!released) {
			released = true;
			active.delete(key);
		}
	};
}
