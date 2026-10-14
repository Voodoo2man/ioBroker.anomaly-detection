import { objectName } from "./object-names";

/** Shared object metadata for the dynamically generated source tree. */
export const SOURCES_OBJECT_ID = "sources";

export const sourcesObject = {
	// The children are generated source devices; a folder is the appropriate
	// generic container for devices and their channel trees.
	type: "folder" as const,
	common: { name: objectName("Monitored sources") },
	native: {},
};
/** Minimal object operations required to fill a missing state unit. */
export interface StateUnitStore {
	/**
	 * Reads one object by id.
	 *
	 * @param id Object id to read.
	 */
	getObjectAsync(id: string): Promise<{ common?: Record<string, unknown> } | null | undefined>;
	/**
	 * Adds common metadata without replacing existing fields.
	 *
	 * @param id Object id to extend.
	 * @param object Metadata patch.
	 * @param object.common Common metadata to extend.
	 * @param object.common.unit Unit value to add.
	 */
	extendObjectAsync(id: string, object: { common: { unit: string } }): Promise<unknown>;
}

/** Adds the source unit only when the state has no existing unit. */
/**
 * @param store Object-store operations.
 * @param id State id to update.
 * @param unit Source unit, if available.
 */
export async function ensureStateUnit(store: StateUnitStore, id: string, unit?: string): Promise<void> {
	if (!unit) {
		return;
	}
	const object = await store.getObjectAsync(id);
	if (object && object.common?.unit === undefined) {
		await store.extendObjectAsync(id, { common: { unit } });
	}
}

/** Returns the generated parent paths required by a source tree. */
/** @param safeId Sanitized generated source identifier. */
export function generatedSourceParentIds(safeId: string): string[] {
	const base = `${SOURCES_OBJECT_ID}.${safeId}`;
	return [SOURCES_OBJECT_ID, base, `${base}.analysis`, `${base}.anomaly`, `${base}.detectors`, `${base}.evaluation`];
}
