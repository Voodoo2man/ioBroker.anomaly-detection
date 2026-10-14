/**
 * Writes event timestamps unconditionally and skips unchanged derived values.
 *
 * @param values State IDs and values to publish.
 * @param alwaysWrite State IDs whose timestamps represent each observation event.
 * @param write Writes a state even when its value is unchanged.
 * @param writeChanged Writes a state only when its value differs.
 */
export async function writeStateValues<T>(
	values: readonly (readonly [string, T])[],
	alwaysWrite: ReadonlySet<string>,
	write: (id: string, value: T) => Promise<unknown>,
	writeChanged: (id: string, value: T) => Promise<unknown>,
): Promise<void> {
	await Promise.all(values.map(([id, value]) => (alwaysWrite.has(id) ? write(id, value) : writeChanged(id, value))));
}
