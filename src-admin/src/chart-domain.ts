/**
 * Calculates a padded chart domain without introducing negative values for non-negative data.
 *
 * @param values Values shown in the chart.
 * @param bounds Historical boundary values.
 * @param options Chart scaling options.
 * @param options.floorAtZero Keep the lower bound at zero for non-negative data.
 */
export function chartYDomain(
	values: readonly number[],
	bounds: readonly number[] = [],
	options: { floorAtZero?: boolean } = {},
): { min: number; max: number } {
	const numeric = [...values, ...bounds].filter(value => Number.isFinite(value));
	if (numeric.length === 0) {
		return { min: 0, max: 1 };
	}
	const rawMin = Math.min(...numeric);
	const rawMax = Math.max(...numeric);
	const rawSpan = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.01);
	const paddedMin = rawMin - rawSpan * 0.05;
	return {
		min: options.floorAtZero === false ? Math.max(0, paddedMin) : rawMin >= 0 ? 0 : paddedMin,
		max: rawMax + rawSpan * 0.05,
	};
}
