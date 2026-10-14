export interface CachedObservation<T> {
	duplicate: boolean;
	result: T | undefined;
}

/** Deduplicates an observation and remembers its timestamp only after acceptance.
 * @param cache Per-source timestamps already accepted by the observer.
 * @param key Source key used for deduplication.
 * @param timestamp Source timestamp, if supplied.
 * @param observe Performs and validates the observation.
 * @param maximumEntries Maximum cache size before the oldest key is removed.
 */
export function observeWithTimestampCache<T>(
	cache: Map<string, number>,
	key: string,
	timestamp: number | undefined,
	observe: () => T | undefined,
	maximumEntries: number,
): CachedObservation<T> {
	if (timestamp !== undefined && cache.get(key) === timestamp) {
		return { duplicate: true, result: undefined };
	}
	const result = observe();
	if (result !== undefined && timestamp !== undefined) {
		cache.set(key, timestamp);
		if (cache.size > maximumEntries) {
			cache.delete(cache.keys().next().value as string);
		}
	}
	return { duplicate: false, result };
}