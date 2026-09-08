/**
 * Calculates a padded chart domain without introducing negative values for non-negative data.
 *
 * @param values Values shown in the chart.
 * @param bounds Historical boundary values.
 * @param options Chart scaling options.
 * @param options.floorAtZero Keep the lower bound at zero for non-negative data.
 */
export declare function chartYDomain(
	values: readonly number[],
	bounds?: readonly number[],
	options?: { floorAtZero?: boolean },
): {
	min: number;
	max: number;
};
