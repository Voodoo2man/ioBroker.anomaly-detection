/**
 * Combines restored models with initialized snapshots while startup is incomplete.
 *
 * @param stored Models restored from storage after intentional stale-source cleanup.
 * @param current Snapshots for sources initialized during this startup.
 * @param startupComplete Whether current contains the complete configured-source snapshot.
 */
export function mergeStartupModels<T>(
	stored: Readonly<Record<string, T>>,
	current: Readonly<Record<string, T>>,
	startupComplete: boolean,
): Record<string, T> {
	return startupComplete ? { ...current } : { ...stored, ...current };
}
