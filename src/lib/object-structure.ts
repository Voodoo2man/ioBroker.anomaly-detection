/** Shared object metadata for the dynamically generated source tree. */
export const SOURCES_OBJECT_ID = "sources";

export const sourcesObject = {
	// The children are generated source devices; a folder is the appropriate
	// generic container for devices and their channel trees.
	type: "folder" as const,
	common: { name: "Monitored sources" },
	native: {},
};

/** Returns the generated parent paths required by a source tree. */
/** @param safeId Sanitized generated source identifier. */
export function generatedSourceParentIds(safeId: string): string[] {
	const base = `${SOURCES_OBJECT_ID}.${safeId}`;
	return [SOURCES_OBJECT_ID, base, `${base}.analysis`, `${base}.anomaly`, `${base}.detectors`, `${base}.evaluation`];
}
