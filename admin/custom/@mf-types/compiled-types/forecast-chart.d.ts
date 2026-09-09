export interface ForecastChartPoint {
    timestamp: number;
    value: number;
}
export interface ForecastChartData {
    startTimestamp: number;
    endTimestamp: number;
    actualPoint?: ForecastChartPoint;
    forecastPoints: ForecastChartPoint[];
    yDomain: {
        min: number;
        max: number;
    };
    yTicks: number[];
    yTickDecimals: number;
    xTicks: number[];
}
/** Formats a tick with only the precision needed to distinguish its neighbors. */
export declare function formatForecastTick(value: number, decimals: number, locale?: string): string;
/**
 * Prepares forecast data for the admin chart without mixing the live value
 * into the model forecast series.
 *
 * @param actual Current live value, if available.
 * @param currentTimestamp Timestamp used for the "Now" marker.
 * @param horizonMinutes Configured forecast horizon.
 * @param points Model-generated forecast points.
 */
export declare function prepareForecastChartData(actual: number | undefined, currentTimestamp: number, horizonMinutes: number, points: readonly ForecastChartPoint[]): ForecastChartData;
