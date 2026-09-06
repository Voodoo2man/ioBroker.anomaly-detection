import type { SourceModelData } from "./source-monitor";

export interface GeneratedSourceDevice {
	id: string;
	sourceId?: string;
}

export interface SourceCleanupStore {
	listGeneratedSourceDevices(): Promise<GeneratedSourceDevice[]>;
	deleteGeneratedSourceTree(relativeId: string): Promise<void>;
}

export interface SourceCleanupResult {
	models: Record<string, SourceModelData>;
	modelsChanged: boolean;
	removedSourceIds: string[];
}

/** Removes only generated source trees whose persisted source metadata is no longer configured. */
export async function cleanupStaleSources(
	store: SourceCleanupStore,
	namespace: string,
	configuredSourceIds: ReadonlySet<string>,
	storedModels: Record<string, SourceModelData>,
	createSourceId: (sourceId: string) => string,
): Promise<SourceCleanupResult> {
	const configuredSafeIds = new Set([...configuredSourceIds].map(createSourceId));
	const removedSourceIds: string[] = [];
	const prefix = `${namespace}.sources.`;
	for (const device of await store.listGeneratedSourceDevices()) {
		if (!device.sourceId || configuredSourceIds.has(device.sourceId)) {
			continue;
		}
		const safeId = createSourceId(device.sourceId);
		const expectedId = `${prefix}${safeId}`;
		if (device.id !== expectedId) {
			continue;
		}
		await store.deleteGeneratedSourceTree(`sources.${safeId}`);
		removedSourceIds.push(device.sourceId);
	}
	const models = Object.fromEntries(
		Object.entries(storedModels).filter(([safeId, model]) => {
			if (model.configuredSourceId) {
				return (
					configuredSourceIds.has(model.configuredSourceId) &&
					createSourceId(model.configuredSourceId) === safeId
				);
			}
			return configuredSafeIds.has(safeId);
		}),
	) as Record<string, SourceModelData>;
	return {
		models,
		modelsChanged: Object.keys(models).length !== Object.keys(storedModels).length,
		removedSourceIds,
	};
}
