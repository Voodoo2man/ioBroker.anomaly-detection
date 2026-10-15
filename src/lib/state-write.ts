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
	const results = await Promise.allSettled(
		values.map(async ([id, value]) => {
			try {
				await (alwaysWrite.has(id) ? write(id, value) : writeChanged(id, value));
			} catch (error) {
				throw new Error(
					`State write failed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
					{
						cause: error,
					},
				);
			}
		}),
	);
	const failures = results.flatMap(result => (result.status === "rejected" ? [result.reason as Error] : []));
	if (failures.length > 0) {
		throw new AggregateError(failures, failures.map(error => error.message).join("; "));
	}
}
