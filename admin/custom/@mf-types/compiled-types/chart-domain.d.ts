/**
 * Calculates a padded chart domain without introducing negative values for non-negative data.
 *
 * @param values Values shown in the chart.
 * @param bounds Historical boundary values.
 */
export declare function chartYDomain(values: readonly number[], bounds?: readonly number[]): {
    min: number;
    max: number;
};
