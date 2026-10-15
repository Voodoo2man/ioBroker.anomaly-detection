/** A timestamped numerical point shown in the forecast chart. */
export interface ForecastChartPoint {
    /** Point timestamp in milliseconds. */
    timestamp: number;
    /** Numerical value at the timestamp. */
    value: number;
}
/** Fully prepared data and axes for the forecast chart. */
export interface ForecastChartData {
    /** Start timestamp of the chart. */
    startTimestamp: number;
    /** End timestamp of the chart. */
    endTimestamp: number;
    /** Current live value, when available. */
    actualPoint?: ForecastChartPoint;
    /** Model-generated forecast points. */
    forecastPoints: ForecastChartPoint[];
    /** Padded numerical domain for the Y axis. */
    yDomain: {
        min: number;
        max: number;
    };
    /** Tick positions for the Y axis. */
    yTicks: number[];
    /** Number of decimal places used for Y-axis labels. */
    yTickDecimals: number;
    /** Tick offsets for the X axis. */
    xTicks: number[];
}
/**
 * Formats a tick with only the precision needed to distinguish its neighbors.
 *
 * @param value Tick value.
 * @param decimals Number of decimal places.
 * @param locale Optional number-formatting locale.
 */
export declare function formatForecastTick(value: number, decimals: number, locale?: string): string;
/**
 * Formats a forecast x-axis offset using the active interface translations.
 *
 * @param offsetMs Time since the forecast origin in milliseconds.
 * @param translate Active interface translation function.
 */
export declare function formatForecastAxisTimeLabel(offsetMs: number, translate: (key: string, value?: number) => string): string;
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
