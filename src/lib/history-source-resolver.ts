export interface HistorySource {
	instanceId: string;
	sourceId: string;
}

export interface HistoryObjectStore {
	getForeignObjectAsync(id: string): Promise<ioBroker.Object | null | undefined>;
}

/** Resolves enabled per-state history settings without querying a history database. */
export class HistorySourceResolver {
	public constructor(private readonly objects: HistoryObjectStore) {}

	public async resolve(configuredSourceId: string): Promise<HistorySource[]> {
		const configuredObject = await this.objects.getForeignObjectAsync(configuredSourceId);
		if (!isStateObject(configuredObject)) {
			return [];
		}
		const targetId = getAliasReadTarget(configuredObject);
		const sources: Array<{ id: string; object: ioBroker.StateObject }> = [
			{ id: configuredSourceId, object: configuredObject },
		];
		if (targetId && targetId !== configuredSourceId) {
			const targetObject = await this.objects.getForeignObjectAsync(targetId);
			if (isStateObject(targetObject)) {
				sources.push({ id: targetId, object: targetObject });
			}
		}

		const resolved = new Map<string, HistorySource>();
		for (const source of sources) {
			for (const instanceId of enabledHistoryInstances(source.object)) {
				if (resolved.has(instanceId) || !(await this.isUsableHistoryInstance(instanceId))) {
					continue;
				}
				// The configured alias is visited first, so its own history wins over its target's history.
				resolved.set(instanceId, { instanceId, sourceId: source.id });
			}
		}
		return [...resolved.values()].sort((left, right) => left.instanceId.localeCompare(right.instanceId));
	}

	private async isUsableHistoryInstance(instanceId: string): Promise<boolean> {
		if (!isCompleteInstanceId(instanceId)) {
			return false;
		}
		const instance = await this.objects.getForeignObjectAsync(`system.adapter.${instanceId}`);
		if (!instance || instance.type !== "instance" || instance.common.enabled !== true) {
			return false;
		}
		return instance.common.getHistory === true || instance.common.supportedMessages?.getHistory === true;
	}
}

/** True only for a complete ioBroker adapter instance ID such as `influxdb.0`. */
export function isCompleteInstanceId(value: unknown): boolean {
	return typeof value === "string" && /^[A-Za-z0-9_-]+\.\d+$/.test(value);
}

/** Validates a persisted selection against the currently enabled history sources. */
export function selectHistorySource(
	configuredSourceId: string,
	instanceId: string,
	candidates: readonly HistorySource[],
): HistorySource {
	if (!isCompleteInstanceId(instanceId)) {
		throw new Error(
			`Invalid history instance '${instanceId}' configured for ${configuredSourceId}. Select a complete instance ID such as 'influxdb.0'.`,
		);
	}
	const source = candidates.find(candidate => candidate.instanceId === instanceId);
	if (!source) {
		throw new Error(
			`History instance '${instanceId}' is not enabled for ${configuredSourceId} or its alias target. Select a current history source.`,
		);
	}
	return source;
}

function isStateObject(object: ioBroker.Object | null | undefined): object is ioBroker.StateObject {
	return object?.type === "state";
}

function getAliasReadTarget(object: ioBroker.StateObject): string | undefined {
	const aliasId = object.common.alias?.id;
	if (typeof aliasId === "string") {
		return aliasId;
	}
	if (aliasId && typeof aliasId.read === "string" && aliasId.read.trim()) {
		return aliasId.read;
	}
	return undefined;
}

function enabledHistoryInstances(object: ioBroker.StateObject): string[] {
	return Object.entries(object.common.custom ?? {})
		.filter(([instanceId, settings]) => isCompleteInstanceId(instanceId) && settings?.enabled === true)
		.map(([instanceId]) => instanceId);
}
