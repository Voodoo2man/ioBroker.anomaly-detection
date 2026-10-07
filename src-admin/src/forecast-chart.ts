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
	yDomain: { min: number; max: number };
	/** Tick positions for the Y axis. */
	yTicks: number[];
	/** Number of decimal places used for Y-axis labels. */
	yTickDecimals: number;
	/** Tick offsets for the X axis. */
	xTicks: number[];
}

function niceStep(rawStep: number): number {
	const exponent = Math.floor(Math.log10(rawStep));
	const magnitude = 10 ** exponent;
	const fraction = rawStep / magnitude;
	const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
	return niceFraction * magnitude;
}

function createTicks(min: number, max: number, targetCount: number): number[] {
	const step = niceStep((max - min) / Math.max(1, targetCount - 1));
	const first = Math.ceil(min / step - 1e-10) * step;
	const ticks: number[] = [];
	for (let value = first; value <= max + step * 1e-9 && ticks.length < 8; value += step) {
		ticks.push(Number(value.toPrecision(12)));
	}
	return ticks.length >= 2 ? ticks : [min, max];
}

function timeStep(horizonMinutes: number): number {
	const preferredMinutes = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 360, 720, 1440];
	const targetMinutes = horizonMinutes / 5;
	return (
		(preferredMinutes.find(step => step >= targetMinutes) ?? preferredMinutes[preferredMinutes.length - 1]) * 60_000
	);
}

function decimalPlacesForStep(step: number): number {
	let decimals = 0;
	let scaled = Math.abs(step);
	while (decimals < 8 && Math.abs(scaled - Math.round(scaled)) > 1e-8) {
		decimals++;
		scaled *= 10;
	}
	return decimals;
}

/**
 * Formats a tick with only the precision needed to distinguish its neighbors.
 * @param value Tick value.
 * @param decimals Number of decimal places.
 * @param locale Optional number-formatting locale.
 */
export function formatForecastTick(value: number, decimals: number, locale?: string): string {
	const rounded = Number(value.toFixed(decimals));
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(rounded);
}

/**
 * Prepares forecast data for the admin chart without mixing the live value
 * into the model forecast series.
 *
 * @param actual Current live value, if available.
 * @param currentTimestamp Timestamp used for the "Now" marker.
 * @param horizonMinutes Configured forecast horizon.
 * @param points Model-generated forecast points.
 */
export function prepareForecastChartData(
	actual: number | undefined,
	currentTimestamp: number,
	horizonMinutes: number,
	points: readonly ForecastChartPoint[],
): ForecastChartData {
	const forecastPoints = points.filter(point => Number.isFinite(point.value));
	const values = [
		...(Number.isFinite(actual) ? [actual as number] : []),
		...forecastPoints.map(point => point.value),
	];
	const rawMin = values.length ? Math.min(...values) : 0;
	const rawMax = values.length ? Math.max(...values) : 1;
	const rawSpan = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.05);
	const paddedMin = rawMin - rawSpan * 0.08;
	const paddedMax = rawMax + rawSpan * 0.08;
	const yMin = rawMin <= 0 && rawMax >= 0 ? Math.min(0, paddedMin) : paddedMin;
	const yMax = rawMin <= 0 && rawMax >= 0 ? Math.max(0, paddedMax) : paddedMax;
	const yDomain = { min: yMin, max: yMax };
	const duration = horizonMinutes * 60_000;
	const xStep = timeStep(Math.max(1, horizonMinutes));
	const xTicks = [0];
	for (let offset = xStep; offset < duration; offset += xStep) {
		xTicks.push(offset);
	}
	if (duration > 0 && xTicks.at(-1) !== duration) {
		xTicks.push(duration);
	}
	const yTicks = createTicks(yMin, yMax, 5);
	const yTickStep = Math.abs((yTicks[1] ?? yMax) - (yTicks[0] ?? yMin));
	return {
		startTimestamp: currentTimestamp,
		endTimestamp: currentTimestamp + horizonMinutes * 60_000,
		actualPoint: Number.isFinite(actual) ? { timestamp: currentTimestamp, value: actual as number } : undefined,
		forecastPoints,
		yDomain,
		yTicks,
		yTickDecimals: decimalPlacesForStep(yTickStep),
		xTicks,
	};
}
