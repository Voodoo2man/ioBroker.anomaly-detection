import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Collapse, Divider, Grid, Stack, Typography } from "@mui/material";
import { Refresh, ExpandMore, ExpandLess } from "@mui/icons-material";
import { chartYDomain } from "./chart-domain";

type Detector = { name: string; score: number; reasonCode: string };
type ChartSample = { value: number; timestamp: number };
type DiagnosticSnapshot = {
	timestamp: number;
	actual: number;
	expected?: number;
	decisionLow?: number;
	decisionHigh?: number;
	score: number;
	detected: boolean;
	reasonCode: string;
	baselineScope: string;
	baselineSampleCount: number;
	activeContext: string;
};
type Evaluation = {
	statusCode?: "learning" | "normal" | "anomaly" | "insufficient_data";
	severity?: "normal" | "noticeable" | "high";
	sampleCount?: number;
	requiredSamples?: number;
	actual?: number;
	expected?: number;
	expectedLow?: number;
	expectedHigh?: number;
	score?: number;
	reason?: string;
	reasonCode?: string;
	baselineScope?: string;
	activeContext?: string;
	baselineSampleCount?: number;
	contextSampleCount?: number;
	lastEvaluated?: number;
	anomalySince?: number;
	lastNormal?: number;
	decisionLow?: number;
	decisionHigh?: number;
	detectors?: Detector[];
};
type Source = {
	id: string;
	name: string;
	unit?: string;
	contextLabels?: Record<string, string>;
	evaluation: Evaluation;
};
type TabResponse = { data?: { sources?: Source[] } };
type ChartResponse = { data?: { samples?: ChartSample[]; diagnostics?: DiagnosticSnapshot[]; available?: boolean } };
type SocketLike = {
	sendTo?: <T = TabResponse>(target: string, command: string, data: unknown) => Promise<T>;
};
type Props = {
	socket?: SocketLike;
	instance?: string | number;
	adapterName?: string;
	oContext?: { instance?: string | number; adapterName?: string; socket?: SocketLike };
	data?: { sources?: Source[] };
};

const translations: Record<string, Record<string, string>> = {
	en: {
		"reason.normal": "The value behaves as expected.",
		"reason.insufficient_training_data": "I am still collecting data before rating this state reliably.",
		"reason.unexpected_value": "The current value is outside the usual range.",
		"reason.unexpected_low": "The current value is unusually low.",
		"reason.unexpected_high": "The current value is unusually high.",
		"reason.context_deviation": "The current value is unusual for this context.",
		"reason.context_low": "The current value is unusually low for this context.",
		"reason.context_high": "The current value is unusually high for this context.",
		"reason.unexpected_rate_change": "The value is changing unusually quickly.",
		"reason.stuck_value": "The value has not changed for longer than expected.",
		"reason.persistent_level_shift": "A persistent change in the normal level was detected.",
		"reason.unusual_trend": "An unusual long-term trend was detected.",
		"reason.multiple_detectors": "Several detectors jointly indicate unusual behavior.",
		"status.learning": "Learning",
		"status.normal": "Normal",
		"status.anomaly": "Anomaly",
		"status.insufficient_data": "Insufficient data",
		title: "Current anomaly assessments",
		refresh: "Refresh",
		empty: "No assessment is available yet for the configured states.",
		current: "Current",
		decisionRange: "MAD decision range",
		chartValue: "Value",
		chartExpected: "Expected range",
		chartAnomaly: "Anomaly",
		chartStatus: "Status",
		chartReason: "Reason",
		chartAssessment: "Assessment",
		chartDeviation: "Deviation",
		chartExpectedUnavailable: "Historical expected range not available",
		"deviation.below": "below the expected range",
		"deviation.above": "above the expected range",
		chartContext: "Assessment context",
		historicalAnomaliesOne: "%s conspicuous measurement in the selected period",
		historicalAnomaliesMany: "%s conspicuous measurements in the selected period",
		chartNoContext: "Historical context information is not available for this period.",
		chartNow: "Now",
		chartNormalExplanation: "The value is within the expected range.",
		learned: "%s of at least %s required samples learned",
		comparisonSamples: "Comparison based on %s similar samples",
		context: "Compared with context: %s",
		since: "Anomalous since %s",
		details: "Technical details",
		overall: "Overall score",
		baseline: "Baseline",
		baseline_context: "Context-based",
		baseline_time: "Time-based",
		baseline_global: "Global fallback",
		baseline_insufficient: "Insufficient baseline",
		valueDeviation: "Value deviation",
		contextDeviation: "Context deviation",
		rateDeviation: "Rate of change",
		stuckDetection: "Stuck-state detection",
		levelShift: "Persistent level shift",
		trendDetection: "Trend detection",
		samples: "samples",
		contextSamples: "Context samples",
		lastEvaluation: "Last evaluation",
		activeDetectors: "Active detectors",
		loadError: "The anomaly assessments could not be loaded.",
		chart: "History & anomalies",
		chartUnavailable: "No history data is available for this state.",
		chartNoBounds: "Historical decision bounds are not available for this period.",
		hour: "1 h",
		sixHours: "6 h",
		day: "24 h",
		week: "7 days",
	},
	de: {
		"reason.normal": "Der Wert verhält sich wie erwartet.",
		"reason.insufficient_training_data":
			"Ich sammle noch Daten, bevor ich diesen Datenpunkt zuverlässig bewerten kann.",
		"reason.unexpected_value": "Der aktuelle Wert liegt außerhalb des üblichen Bereichs.",
		"reason.unexpected_low": "Der aktuelle Wert ist ungewöhnlich niedrig.",
		"reason.unexpected_high": "Der aktuelle Wert ist ungewöhnlich hoch.",
		"reason.context_deviation": "Der aktuelle Wert ist für diesen Zustand ungewöhnlich.",
		"reason.context_low": "Der aktuelle Wert ist für diesen Zustand ungewöhnlich niedrig.",
		"reason.context_high": "Der aktuelle Wert ist für diesen Zustand ungewöhnlich hoch.",
		"reason.unexpected_rate_change": "Der Wert verändert sich ungewöhnlich schnell.",
		"reason.stuck_value": "Der Wert hat sich länger als erwartet nicht verändert.",
		"reason.persistent_level_shift": "Eine dauerhafte Veränderung des normalen Niveaus wurde erkannt.",
		"reason.unusual_trend": "Ein ungewöhnlicher längerfristiger Trend wurde erkannt.",
		"reason.multiple_detectors": "Mehrere Detektoren weisen gemeinsam auf ein ungewöhnliches Verhalten hin.",
		"status.learning": "Lernt noch",
		"status.normal": "Normal",
		"status.anomaly": "Auffällig",
		"status.insufficient_data": "Zu wenig Daten",
		title: "Aktuelle Anomaliebewertungen",
		refresh: "Aktualisieren",
		empty: "Für die konfigurierten Datenpunkte liegt noch keine Bewertung vor.",
		current: "Aktuell",
		decisionRange: "Erwarteter Bereich",
		chartValue: "Messwert",
		chartExpected: "Erwarteter Bereich",
		chartAnomaly: "Anomalie",
		chartStatus: "Status",
		chartReason: "Grund",
		chartAssessment: "Bewertung",
		chartDeviation: "Abweichung",
		chartExpectedUnavailable: "Historischer erwarteter Bereich nicht verfügbar",
		"deviation.below": "unter dem erwarteten Bereich",
		"deviation.above": "über dem erwarteten Bereich",
		chartContext: "Bewertungskontext",
		historicalAnomaliesOne: "%s auffälliger Messpunkt im gewählten Zeitraum",
		historicalAnomaliesMany: "%s auffällige Messpunkte im gewählten Zeitraum",
		chartNoContext: "Für diesen Zeitraum sind keine historischen Kontextinformationen verfügbar.",
		chartNow: "Jetzt",
		chartNormalExplanation: "Der Wert liegt im erwarteten Bereich.",
		learned: "%s von mindestens %s benötigten Messwerten gelernt",
		comparisonSamples: "Vergleich basiert auf %s ähnlichen Messungen",
		context: "Verglichen mit Kontext: %s",
		since: "Auffällig seit %s",
		details: "Technische Details",
		overall: "Gesamtbewertung",
		baseline: "Baseline",
		baseline_context: "Kontextbezogen",
		baseline_time: "Zeitabhängig",
		baseline_global: "Globale Fallback-Baseline",
		baseline_insufficient: "Baseline noch nicht reif",
		valueDeviation: "Wertabweichung",
		contextDeviation: "Abweichung im aktuellen Kontext",
		rateDeviation: "Änderungsgeschwindigkeit",
		stuckDetection: "Festhängender Wert",
		levelShift: "Dauerhafte Pegelverschiebung",
		trendDetection: "Trenderkennung",
		samples: "Samples",
		contextSamples: "Kontext-Samples",
		lastEvaluation: "Letzte Bewertung",
		activeDetectors: "Aktive Detektoren",
		loadError: "Die Anomaliebewertungen konnten nicht geladen werden.",
		chart: "Verlauf & Anomalien",
		chartUnavailable: "Für diesen Datenpunkt sind keine Verlaufsdaten verfügbar.",
		chartNoBounds: "Für diesen Zeitraum sind keine historischen Bewertungsgrenzen verfügbar.",
		hour: "1 h",
		sixHours: "6 h",
		day: "24 h",
		week: "7 Tage",
	},
};

function language(): string {
	return (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2).toLowerCase();
}
function t(key: string, ...args: Array<string | number>): string {
	const template = translations[language()]?.[key] || translations.en[key] || key;
	let text = template;
	for (const arg of args) {
		text = text.replace("%s", String(arg));
	}
	return text;
}

function translateReason(code?: string, fallback?: string): string {
	return (code && t(`reason.${code}`)) || fallback || t("empty");
}

function directionalReason(evaluation: Evaluation): string {
	if (evaluation.statusCode === "normal") {
		return t("reason.normal");
	}
	if (
		(evaluation.reasonCode === "context_deviation" || evaluation.reasonCode === "unexpected_value") &&
		evaluation.actual !== undefined &&
		evaluation.expected !== undefined
	) {
		const direction = evaluation.actual < evaluation.expected ? "low" : "high";
		const key =
			evaluation.reasonCode === "context_deviation"
				? `reason.context_${direction}`
				: `reason.unexpected_${direction}`;
		const translated = t(key);
		if (translated !== key) {
			return translated;
		}
	}
	return translateReason(evaluation.reasonCode, evaluation.reason);
}

function baselineLabel(scope?: string): string {
	return scope ? t(`baseline_${scope}`) : "–";
}

function detectorLabel(detector: Detector): string {
	if (detector.name === "context" || detector.reasonCode === "context_deviation") {
		return t("contextDeviation");
	}
	if (detector.name === "value" || detector.reasonCode === "unexpected_value") {
		return t("valueDeviation");
	}
	if (detector.name === "rate" || detector.reasonCode === "unexpected_rate_change") {
		return t("rateDeviation");
	}
	if (detector.name === "stuck" || detector.reasonCode === "stuck_value") {
		return t("stuckDetection");
	}
	if (detector.name === "changePoint" || detector.reasonCode === "persistent_level_shift") {
		return t("levelShift");
	}
	if (detector.name === "trend" || detector.reasonCode === "unusual_trend") {
		return t("trendDetection");
	}
	return detector.name;
}

function friendlyContext(value: string, labels?: Record<string, string>): string {
	return value
		.split("|")
		.map(part => {
			const separator = part.lastIndexOf("=");
			if (separator < 0) {
				return part;
			}
			const id = part.slice(0, separator);
			const state = part.slice(separator + 1);
			const label = labels?.[id] || id;
			if (state === "true") {
				return `${label} – ${language() === "de" ? "eingeschaltet" : "on"}`;
			}
			if (state === "false") {
				return `${label} – ${language() === "de" ? "ausgeschaltet" : "off"}`;
			}
			return `${label}=${state}`;
		})
		.join(", ");
}

function historicalTooltip(sample: ChartSample, item: DiagnosticSnapshot | undefined, source: Source): string {
	const lines = [
		formatTime(sample.timestamp),
		`${t("chartValue")}: ${formatRangeValue(sample.value)}${source.unit ? ` ${source.unit}` : ""}`,
	];
	if (!item) {
		return lines.join("\n");
	}
	if (item.decisionLow !== undefined && item.decisionHigh !== undefined) {
		lines.push(
			`${t("chartExpected")}: ${formatRangeValue(item.decisionLow)}–${formatRangeValue(item.decisionHigh)}${source.unit ? ` ${source.unit}` : ""}`,
		);
	} else {
		lines.push(t("chartExpectedUnavailable"));
	}
	lines.push(`${t("chartStatus")}: ${t(`status.${item.detected ? "anomaly" : "normal"}`)}`);
	if (item.detected) {
		lines.push(`${t("chartReason")}: ${translateReason(item.reasonCode)}`);
		const isRangeDeviation =
			(item.reasonCode === "unexpected_value" || item.reasonCode === "context_deviation") &&
			item.decisionLow !== undefined &&
			item.decisionHigh !== undefined;
		if (isRangeDeviation) {
			const difference =
				sample.value < item.decisionLow! ? item.decisionLow! - sample.value : sample.value - item.decisionHigh!;
			const direction = sample.value < item.decisionLow! ? "below" : "above";
			lines.push(
				`${t("chartDeviation")}: ${formatRangeValue(difference)}${source.unit ? ` ${source.unit}` : ""} ${t(`deviation.${direction}`)}`,
			);
		}
	} else {
		lines.push(`${t("chartReason")}: ${t("chartNormalExplanation")}`);
	}
	if (item.score !== undefined) {
		lines.push(`${t("chartAssessment")}: ${formatRangeValue(item.score)} %`);
	}
	if (item.activeContext) {
		lines.push(`${t("context")}: ${friendlyContext(item.activeContext, source.contextLabels)}`);
	}
	return lines.join("\n");
}

function HistoryChart({
	source,
	socket,
	target,
	refreshKey,
}: {
	source: Source;
	socket?: SocketLike;
	target: string;
	refreshKey: number;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [hours, setHours] = useState(24);
	const [data, setData] = useState<ChartResponse["data"]>();
	const [chartWidth, setChartWidth] = useState(600);
	const cache = useRef(new Map<number, ChartResponse["data"]>());
	const chartContainer = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open || !chartContainer.current || typeof ResizeObserver === "undefined") {
			return;
		}
		const updateWidth = (): void => {
			const width = chartContainer.current?.clientWidth;
			if (width && width > 0) {
				setChartWidth(width);
			}
		};
		updateWidth();
		const observer = new ResizeObserver(updateWidth);
		observer.observe(chartContainer.current);
		return () => observer.disconnect();
	}, [open]);
	useEffect(() => {
		cache.current.clear();
		if (open) {
			setData(undefined);
		}
	}, [refreshKey]);
	useEffect(() => {
		if (!open || !socket?.sendTo) {
			return;
		}
		const cached = cache.current.get(hours);
		if (cached) {
			setData(cached);
			return;
		}
		void socket
			.sendTo<ChartResponse>(target, "chartData", {
				sourceId: source.id,
				start: Date.now() - hours * 3600000,
				end: Date.now(),
				limit: 500,
			})
			.then(response => {
				cache.current.set(hours, response.data);
				setData(response.data);
			});
	}, [hours, open, refreshKey, socket, source.id, target]);
	const samples = data?.samples || [];
	const diagnostics = data?.diagnostics || [];
	const values = samples.map(sample => sample.value);
	if (!open) {
		return (
			<Button
				size="small"
				onClick={() => setOpen(true)}
				sx={{ mt: 1 }}
			>
				{t("chart")}
			</Button>
		);
	}
	if (!data?.available) {
		return (
			<Box sx={{ mt: 1 }}>
				<Button
					size="small"
					onClick={() => setOpen(false)}
				>
					{t("chart")}
				</Button>
				<Alert
					severity="info"
					sx={{ mt: 1 }}
				>
					{t("chartUnavailable")}
				</Alert>
			</Box>
		);
	}
	if (!samples.length) {
		return (
			<Box sx={{ mt: 1 }}>
				<Button
					size="small"
					onClick={() => setOpen(false)}
				>
					{t("chart")}
				</Button>
				<Alert
					severity="info"
					sx={{ mt: 1 }}
				>
					{t("chartUnavailable")}
				</Alert>
			</Box>
		);
	}
	const diagnosticsInRange = diagnostics.filter(
		item => item.timestamp >= samples[0].timestamp && item.timestamp <= samples[samples.length - 1].timestamp,
	);
	const comparableContext = source.evaluation.activeContext;
	const contextSegments: Array<{ start: number; end: number }> = [];
	for (let index = 0; index < diagnosticsInRange.length; index++) {
		const item = diagnosticsInRange[index];
		if (!comparableContext || item.activeContext !== comparableContext) {
			continue;
		}
		const end = diagnosticsInRange[index + 1]?.timestamp ?? samples[samples.length - 1].timestamp;
		contextSegments.push({ start: item.timestamp, end });
	}
	const bounds = diagnosticsInRange.filter(item => item.decisionLow !== undefined && item.decisionHigh !== undefined);
	const boundSegments: DiagnosticSnapshot[][] = [];
	let boundsGap = false;
	for (const item of diagnosticsInRange) {
		if (item.decisionLow === undefined || item.decisionHigh === undefined) {
			boundsGap = true;
			continue;
		}
		const previous = boundSegments[boundSegments.length - 1];
		if (boundsGap || !previous || previous[previous.length - 1].timestamp < item.timestamp - 2 * 60 * 60 * 1000) {
			boundSegments.push([item]);
			boundsGap = false;
		} else {
			previous.push(item);
		}
	}
	const domain = chartYDomain(
		values,
		bounds.flatMap(item => [item.decisionLow as number, item.decisionHigh as number]),
	);
	const min = domain.min;
	const max = domain.max;
	const span = max - min;
	const plotLeft = 44;
	const plotRight = Math.max(plotLeft + 40, chartWidth - 8);
	const x = (timestamp: number): number =>
		plotLeft +
		((timestamp - samples[0].timestamp) /
			Math.max(1, samples[samples.length - 1].timestamp - samples[0].timestamp)) *
			(plotRight - plotLeft);
	const y = (value: number): number => 84 - ((value - min) / span) * 76;
	const nearestDiagnostic = (timestamp: number): DiagnosticSnapshot | undefined => {
		let best: DiagnosticSnapshot | undefined;
		let distance = Number.POSITIVE_INFINITY;
		for (const item of diagnosticsInRange) {
			const candidate = Math.abs(item.timestamp - timestamp);
			if (candidate < distance) {
				best = item;
				distance = candidate;
			}
		}
		return best;
	};
	const valueLine = samples.map(sample => `${x(sample.timestamp)},${y(sample.value)}`).join(" ");
	const dateLabel = (timestamp: number): string =>
		new Date(timestamp).toLocaleString(undefined, {
			dateStyle: hours > 24 ? "short" : undefined,
			timeStyle: "short",
		});
	const contextChanges = diagnosticsInRange.filter(
		(item, index) => index > 0 && item.activeContext !== diagnosticsInRange[index - 1].activeContext,
	);
	const historicalAnomalyCount = diagnosticsInRange.filter(item => item.detected).length;
	return (
		<Box
			ref={chartContainer}
			sx={{ mt: 1, width: "100%" }}
		>
			<Stack
				direction="row"
				spacing={0.5}
				alignItems="center"
			>
				<Button
					size="small"
					onClick={() => setOpen(false)}
				>
					{t("chart")}
				</Button>
				{[
					[1, "hour"],
					[6, "sixHours"],
					[24, "day"],
					[168, "week"],
				].map(([value, key]) => (
					<Button
						key={String(value)}
						size="small"
						variant={hours === value ? "contained" : "text"}
						onClick={() => setHours(value as number)}
					>
						{t(key as string)}
					</Button>
				))}
			</Stack>
			<svg
				viewBox={`0 0 ${chartWidth} 100`}
				width="100%"
				height="220"
				role="img"
				aria-label={t("chart")}
				style={{ background: "rgba(127,127,127,0.08)", marginTop: 8 }}
			>
				<line
					x1={plotLeft}
					y1="8"
					x2={plotLeft}
					y2="84"
					stroke="currentColor"
					opacity="0.35"
				/>
				<line
					x1={plotLeft}
					y1="84"
					x2={plotRight}
					y2="84"
					stroke="currentColor"
					opacity="0.35"
				/>
				<text
					x={plotLeft}
					y="96"
					fontSize="3"
					fill="currentColor"
				>
					{dateLabel(samples[0].timestamp)}
				</text>
				<text
					x={plotRight}
					y="96"
					textAnchor="end"
					fontSize="3"
					fill="currentColor"
				>
					{dateLabel(samples[samples.length - 1].timestamp)}
				</text>
				<text
					x="1"
					y="10"
					fontSize="3"
					fill="currentColor"
				>
					{formatRangeValue(max)}
					{source.unit ? ` ${source.unit}` : ""}
				</text>
				<text
					x="1"
					y="84"
					fontSize="3"
					fill="currentColor"
				>
					{formatRangeValue(min)}
					{source.unit ? ` ${source.unit}` : ""}
				</text>
				{boundSegments.map((segment, index) => (
					<React.Fragment key={`bounds-${index}`}>
						<polygon
							fill="#90caf9"
							opacity="0.12"
							points={[
								...segment.map(item => `${x(item.timestamp)},${y(item.decisionLow as number)}`),
								...segment
									.slice()
									.reverse()
									.map(item => `${x(item.timestamp)},${y(item.decisionHigh as number)}`),
							].join(" ")}
						/>
					</React.Fragment>
				))}
				{contextSegments.map(segment => (
					<rect
						key={`context-band-${segment.start}`}
						x={x(segment.start)}
						width={Math.max(0.2, x(segment.end) - x(segment.start))}
						y="8"
						height="76"
						fill="#ab47bc"
						opacity="0.08"
					>
						<title>{t("chartContext")}</title>
					</rect>
				))}
				<polyline
					fill="none"
					stroke="#2196f3"
					strokeWidth="1.5"
					points={valueLine}
				>
					<title>{t("chartValue")}</title>
				</polyline>
				{contextChanges.map(item => (
					<line
						key={`context-${item.timestamp}`}
						x1={x(item.timestamp)}
						x2={x(item.timestamp)}
						y1="8"
						y2="84"
						stroke="#ab47bc"
						strokeDasharray="1 2"
						opacity="0.7"
					>
						<title>{`${t("chartContext")}: ${friendlyContext(item.activeContext, source.contextLabels)}`}</title>
					</line>
				))}
				{diagnostics
					.filter(
						item =>
							item.detected &&
							item.timestamp >= samples[0].timestamp &&
							item.timestamp <= samples[samples.length - 1].timestamp,
					)
					.map(item => {
						return (
							<polygon
								key={item.timestamp}
								points={`${x(item.timestamp)},${y(item.actual) - 2.5} ${x(item.timestamp) - 2.5},${y(item.actual) + 2} ${x(item.timestamp) + 2.5},${y(item.actual) + 2}`}
								fill="#f44336"
								role="img"
							>
								<title>
									{historicalTooltip({ value: item.actual, timestamp: item.timestamp }, item, source)}
								</title>
							</polygon>
						);
					})}
				{samples.map(sample => {
					const item = nearestDiagnostic(sample.timestamp);
					return (
						<circle
							key={sample.timestamp}
							cx={x(sample.timestamp)}
							cy={y(sample.value)}
							r="1.2"
							fill="#2196f3"
						>
							<title>{historicalTooltip(sample, item, source)}</title>
						</circle>
					);
				})}
				{samples.length > 0 && (
					<line
						x1={x(samples[samples.length - 1].timestamp)}
						x2={x(samples[samples.length - 1].timestamp)}
						y1="8"
						y2="84"
						stroke="#fff"
						opacity="0.5"
					>
						<title>{t("chartNow")}</title>
					</line>
				)}
			</svg>
			<Stack
				direction="row"
				spacing={2}
				sx={{ mt: 0.5 }}
			>
				<Typography variant="caption">━ {t("chartValue")}</Typography>
				{bounds.length > 0 && (
					<Typography
						variant="caption"
						color="info.main"
					>
						┄ {t("chartExpected")}
					</Typography>
				)}
				{contextSegments.length > 0 && (
					<Typography
						variant="caption"
						color="secondary"
					>
						▧ {t("chartContext")}
					</Typography>
				)}
				{diagnosticsInRange.some(item => item.detected) && (
					<Typography
						variant="caption"
						color="error"
					>
						▲ {t("chartAnomaly")}
					</Typography>
				)}
			</Stack>
			{historicalAnomalyCount > 0 && (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ display: "block", mt: 0.5 }}
				>
					{t(
						historicalAnomalyCount === 1 ? "historicalAnomaliesOne" : "historicalAnomaliesMany",
						historicalAnomalyCount,
					)}
				</Typography>
			)}
			{source.evaluation.activeContext && contextSegments.length === 0 && (
				<Typography
					variant="caption"
					color="text.secondary"
				>
					{t("chartNoContext")}
				</Typography>
			)}
			{!bounds.length && (
				<Typography
					variant="caption"
					color="text.secondary"
				>
					{t("chartNoBounds")}
				</Typography>
			)}
		</Box>
	);
}

function formatValue(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "";
}

function formatRangeValue(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value)
		? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
		: "";
}

function formatTime(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value) ? new Date(value).toLocaleString() : "";
}

function statusLabel(status?: Evaluation["statusCode"]): string {
	return t(`status.${status || "learning"}`);
}

function statusColor(status?: Evaluation["statusCode"]): "success" | "warning" | "error" | "default" {
	return status === "anomaly"
		? "error"
		: status === "normal"
			? "success"
			: status === "insufficient_data"
				? "warning"
				: "default";
}

function AnomalyCard({
	source,
	socket,
	target,
	refreshKey,
}: {
	source: Source;
	socket?: SocketLike;
	target: string;
	refreshKey: number;
}): React.JSX.Element {
	const [details, setDetails] = useState(false);
	const evaluation = source.evaluation || {};
	const range =
		evaluation.decisionLow !== undefined && evaluation.decisionHigh !== undefined
			? `${formatRangeValue(evaluation.decisionLow)}–${formatRangeValue(evaluation.decisionHigh)}`
			: undefined;
	const samples =
		evaluation.baselineScope === "context" && evaluation.contextSampleCount !== undefined
			? t("comparisonSamples", evaluation.contextSampleCount)
			: evaluation.sampleCount !== undefined && evaluation.requiredSamples !== undefined
				? t("learned", evaluation.sampleCount, evaluation.requiredSamples)
				: undefined;
	return (
		<Card
			variant="outlined"
			sx={{ height: "100%" }}
		>
			<CardContent>
				<Stack
					direction="row"
					sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
				>
					<Typography
						variant="h6"
						component="h2"
						noWrap
						title={source.id}
					>
						{source.name}
					</Typography>
					<Chip
						label={statusLabel(evaluation.statusCode)}
						color={statusColor(evaluation.statusCode)}
					/>
				</Stack>
				<Typography
					variant="subtitle1"
					sx={{ mt: 1 }}
				>
					{directionalReason(evaluation)}
				</Typography>
				<Grid
					container
					spacing={2}
					sx={{ mt: 0.5 }}
				>
					{evaluation.actual !== undefined && (
						<Grid
							item
							xs={12}
							sm={6}
						>
							<Typography
								variant="body2"
								color="text.secondary"
							>
								{t("current")}
							</Typography>
							<Typography>
								{formatValue(evaluation.actual)}
								{source.unit ? ` ${source.unit}` : ""}
							</Typography>
						</Grid>
					)}
					{range && (
						<Grid
							item
							xs={12}
							sm={6}
						>
							<Typography
								variant="body2"
								color="text.secondary"
							>
								{t("decisionRange")}
							</Typography>
							<Typography>
								{range}
								{source.unit ? ` ${source.unit}` : ""}
							</Typography>
						</Grid>
					)}
				</Grid>
				{samples && (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mt: 1 }}
					>
						{samples}
					</Typography>
				)}
				{evaluation.reasonCode && evaluation.statusCode !== "normal" && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{directionalReason(evaluation)}
					</Typography>
				)}
				{evaluation.statusCode === "anomaly" && evaluation.anomalySince && (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mt: 1 }}
					>
						{t("since", formatTime(evaluation.anomalySince))}
					</Typography>
				)}
				{evaluation.activeContext && (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mt: 1 }}
					>
						{t("context", friendlyContext(evaluation.activeContext, source.contextLabels))}
					</Typography>
				)}
				<HistoryChart
					source={source}
					socket={socket}
					target={target}
					refreshKey={refreshKey}
				/>
				<Button
					size="small"
					onClick={() => setDetails(value => !value)}
					endIcon={details ? <ExpandLess /> : <ExpandMore />}
					sx={{ mt: 1 }}
					aria-expanded={details}
				>
					{t("details")}
				</Button>
				<Collapse in={details}>
					<Divider sx={{ my: 1 }} />
					<Stack spacing={0.5}>
						<Typography variant="body2">
							{t("overall")}:{" "}
							{evaluation.score !== undefined ? `${formatValue(evaluation.score)} %` : "–"}
						</Typography>
						<Typography variant="body2">
							{t("baseline")}: {baselineLabel(evaluation.baselineScope)} (
							{evaluation.baselineSampleCount ?? 0} {t("samples")})
						</Typography>
						{evaluation.contextSampleCount !== undefined && (
							<Typography variant="body2">
								{t("contextSamples")}: {evaluation.contextSampleCount}
							</Typography>
						)}
						{evaluation.lastEvaluated && (
							<Typography variant="body2">
								{t("lastEvaluation")}: {formatTime(evaluation.lastEvaluated)}
							</Typography>
						)}
						{(evaluation.detectors || []).map(detector => (
							<Typography
								variant="body2"
								key={`${detector.name}-${detector.reasonCode}`}
							>
								{detectorLabel(detector)}: {formatValue(detector.score)} %
							</Typography>
						))}
					</Stack>
				</Collapse>
			</CardContent>
		</Card>
	);
}

/**
 * Renders the anomaly dashboard tab.
 *
 * @param props Dashboard integration properties.
 */
export function AnomalyDashboard(props: Props): React.JSX.Element {
	const [sources, setSources] = useState<Source[]>(props.data?.sources || []);
	const [error, setError] = useState<string>();
	const [refreshKey, setRefreshKey] = useState(0);
	const socket = props.socket || props.oContext?.socket;
	const target = useMemo(() => {
		const adapter = props.adapterName || props.oContext?.adapterName || "anomaly-detection";
		const instance = props.instance ?? props.oContext?.instance ?? 0;
		return String(instance).includes(".") ? String(instance) : `${adapter}.${instance}`;
	}, [props.adapterName, props.instance, props.oContext?.adapterName, props.oContext?.instance]);
	const refresh = useCallback(async () => {
		if (!socket?.sendTo) {
			setSources(props.data?.sources || []);
			return;
		}
		try {
			setRefreshKey(value => value + 1);
			const response = await socket.sendTo(target, "tab", {});
			const next = response?.data?.sources;
			if (Array.isArray(next)) {
				setSources(next);
				setError(undefined);
			} else {
				setError(t("loadError"));
			}
		} catch {
			setError(t("loadError"));
		}
	}, [socket, props.data, target]);
	useEffect(() => {
		void refresh();
	}, [refresh]);
	return (
		<Box sx={{ p: 2 }}>
			<Stack
				direction="row"
				sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
			>
				<Typography
					variant="h5"
					component="h1"
				>
					{t("title")}
				</Typography>
				<Button
					onClick={refresh}
					startIcon={<Refresh />}
					aria-label={t("refresh")}
				>
					{t("refresh")}
				</Button>
			</Stack>
			{error && (
				<Alert
					severity="error"
					sx={{ mb: 2 }}
				>
					{t("loadError")}
				</Alert>
			)}
			{sources.length === 0 ? (
				<Alert severity="info">{t("empty")}</Alert>
			) : (
				<Grid
					container
					spacing={2}
				>
					{sources.map(source => (
						<Grid
							item
							xs={12}
							md={6}
							xl={4}
							key={source.id}
						>
							<AnomalyCard
								source={source}
								socket={socket}
								target={target}
								refreshKey={refreshKey}
							/>
						</Grid>
					))}
				</Grid>
			)}
		</Box>
	);
}

export default { AnomalyDashboard };
