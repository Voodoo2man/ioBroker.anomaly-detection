/**
 * Calculates a padded chart domain without introducing negative values for non-negative data.
 *
 * @param values Values shown in the chart.
 * @param bounds Historical boundary values.
 */
export function chartYDomain(values: readonly number[], bounds: readonly number[] = []): { min: number; max: number } {
	const numeric = [...values, ...bounds].filter(value => Number.isFinite(value));
	if (numeric.length === 0) {
		return { min: 0, max: 1 };
	}
	const rawMin = Math.min(...numeric);
	const rawMax = Math.max(...numeric);
	const rawSpan = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.01);
	return {
		min: rawMin >= 0 ? 0 : rawMin - rawSpan * 0.05,
		max: rawMax + rawSpan * 0.05,
	};
}
