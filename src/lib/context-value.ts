/**
 * Creates a stable context-key fragment while preserving valid falsy boolean and numeric values.
 *
 * @param id Configured context state ID.
 * @param value Current context state value.
 * @param bucketWidth Optional width for numerical context buckets.
 */
export function createContextPart(
	id: string,
	value: ioBroker.StateValue | undefined,
	bucketWidth?: number,
): string | undefined {
	if (typeof value === "boolean") {
		return `${id}=boolean:${value}`;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		const width = bucketWidth && bucketWidth > 0 ? bucketWidth : 5;
		const start = Math.floor(value / width) * width;
		return `${id}=number:${start}:${start + width}`;
	}
	if (typeof value === "string" && value.trim() && value.length <= 96) {
		return `${id}=string:${value}`;
	}
	return undefined;
}
