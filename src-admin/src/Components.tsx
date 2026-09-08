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
	statusCode?: "learning" | "normal" | "deviating" | "anomaly" | "insufficient_data" | "unavailable";
	reasonCode: string;
	baselineScope: string;
	baselineSampleCount: number;
	activeContext: string;
};
type Evaluation = {
	statusCode?: "learning" | "normal" | "deviating" | "anomaly" | "insufficient_data" | "unavailable";
	severity?: "normal" | "noticeable" | "high";
	sampleCount?: number;
	requiredSamples?: number;
	actual?: number;
	detected?: boolean;
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
	relevantSampleCount?: number;
	relevantSampleScope?: "context" | "time" | "global" | "insufficient";
	evaluationAvailable?: boolean;
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
	predictive?: {
		status: "disabled" | "learning" | "ready" | "unreliable" | "error";
		generatedAt?: number;
		horizonMinutes: number;
		points: Array<{ timestamp: number; value: number }>;
		qualityMetric?: string;
		qualityValue?: number;
		qualityClass?: "unknown" | "good" | "limited" | "poor";
		trainingSampleCount: number;
		minimumTrainingSamples?: number;
		learningReason?: "insufficientSamples" | "waitingForTraining";
		seasonalityUsed?: boolean;
		seasonalPeriodMinutes?: number;
		seasonalPeriodSteps?: number;
		completeSeasonalPeriods?: number;
		periodicityDetected?: boolean;
		detectedPeriodMinutes?: number;
		periodicityScore?: number;
		peakProminence?: number;
		harmonicPeaks?: number;
		secondBestPeriodMinutes?: number;
		secondBestPeriodicityScore?: number;
		detrended?: boolean;
		candidateScores?: { minus2?: number; minus1?: number; candidate?: number; plus1?: number; plus2?: number };
		atLowerBoundary?: boolean;
		harmonicScores?: Array<{ lag: number; score: number }>;
		selectedModelType?: "levelTrend" | "seasonal" | "timeOfDay";
		selectionReason?: string;
		trainingSource?: "history" | "persisted" | "live" | "mixed";
		bootstrapReason?: string;
		rawSampleCount?: number;
		rawIntervalMinutes?: number;
		historySpanMinutes?: number;
		diagnostics?: {
			model?: {
				selectedType?: "levelTrend" | "seasonal" | "timeOfDay";
				intervalMinutes?: number;
				trainingSampleCount?: number;
				rawSampleCount?: number;
				rawIntervalMinutes?: number;
				historySpanMinutes?: number;
				requestedHistorySpanMinutes?: number;
				timeOfDayAvailable?: boolean;
				timeOfDayDaysCovered?: number;
				timeOfDayBucketCount?: number;
				timeOfDayBucketCoverage?: number;
				lastTrainingAt?: number;
				selectionReason?: string;
				algorithmVersion?: number;
				trainingSource?: "history" | "persisted" | "live" | "mixed";
				bootstrapReason?: string;
			};
			seasonality?: {
				mode?: "off" | "auto" | "manual";
				used?: boolean;
				periodicityDetected?: boolean;
				detectedPeriodMinutes?: number;
				periodicityScore?: number;
				peakProminence?: number;
				harmonicPeaks?: number;
				secondBestPeriodMinutes?: number;
				secondBestPeriodicityScore?: number;
				detrended?: boolean;
				candidateScores?: {
					minus2?: number;
					minus1?: number;
					candidate?: number;
					plus1?: number;
					plus2?: number;
				};
				atLowerBoundary?: boolean;
				harmonicScores?: Array<{ lag: number; score: number }>;
				completePeriods?: number;
			};
			quality?: {
				mae?: number;
				normalizedError?: number;
				holdoutSamples?: number;
				levelTrend?: {
					available?: boolean;
					mae?: number;
					normalizedError?: number;
					holdoutSamples?: number;
					qualityScaleNearZero?: boolean;
				};
				seasonal?: {
					available?: boolean;
					mae?: number;
					normalizedError?: number;
					holdoutSamples?: number;
					qualityScaleNearZero?: boolean;
				};
				timeOfDay?: {
					available?: boolean;
					mae?: number;
					normalizedError?: number;
					holdoutSamples?: number;
					qualityScaleNearZero?: boolean;
				};
				qualityScaleNearZero?: boolean;
				qualityClassification?: {
					class: "unknown" | "good" | "limited" | "poor";
					relativeError?: number;
					scale?: number;
					scaleSource: string;
					evidenceSamples: number;
				};
			};
		};
	};
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
		"status.deviating": "Conspicuous",
		"status.anomaly": "Anomaly",
		"status.insufficient_data": "Insufficient data",
		"status.unavailable": "No current assessment",
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
		chartDeviating: "Conspicuous",
		pendingExplanation: "The deviation is being observed and has not yet been confirmed as an anomaly.",
		unavailableExplanation: "No current assessment is available for this state yet.",
		learned: "%s of at least %s required samples learned",
		learnedContext: "%s of at least %s required samples learned for this state",
		basedOn: "Based on %s samples",
		predictive: "Forecast",
		predictive_ready: "Ready",
		predictive_learning: "Learning",
		predictive_unreliable: "Limited",
		predictive_error: "Error",
		predictive_disabled: "Forecast disabled",
		forecastExpectedIn: "Expected in %s",
		forecastHoursShort: "+%s h",
		forecastMinutesShort: "+%s min",
		forecastQualityGood: "Forecast quality: Good",
		forecastQualityLimited: "Forecast quality: Limited",
		forecastQualityPoor: "Forecast quality: Not reliable",
		forecastQualityUnknown: "Forecast quality: Not yet assessable",
		qualityGood: "Good",
		qualityLimited: "Limited",
		qualityPoor: "Not reliable",
		qualityUnknown: "Not yet assessable",
		forecastLimitedExplanation: "The forecast is currently only of limited reliability.",
		forecastNotReliable: "The forecast is currently not reliable.",
		forecastError: "The forecast could not be calculated.",
		forecastNow: "Now",
		predictiveDetails: "Technical details",
		model: "Model",
		selectedModel: "Selected model",
		modelLevelTrend: "Level/trend",
		modelSeasonal: "Cyclic",
		modelTimeOfDay: "Time of day profile",
		modelInterval: "Model interval",
		rawInterval: "Raw data interval",
		historySpan: "History span",
		requestedHistorySpan: "Requested history span",
		daysCovered: "Days covered",
		bucketCount: "Time buckets",
		bucketCoverage: "Bucket coverage",
		trainingSamples: "Training samples",
		lastTraining: "Last training",
		trainingSource: "Training source",
		bootstrapReason: "Bootstrap reason",
		modelVersion: "Model version",
		sourceHistory: "History",
		sourcePersisted: "Persisted model",
		sourceLive: "Live values",
		sourceMixed: "History + live values",
		seasonality: "Seasonality",
		seasonalityMode: "Mode",
		seasonalityOff: "Off",
		seasonalityAuto: "Automatic",
		seasonalityManual: "Manual",
		periodDetected: "Period detected",
		detectedPeriod: "Detected period",
		periodicityScore: "Periodicity score",
		peakProminence: "Peak prominence",
		harmonicPeaks: "Confirmed harmonic peaks",
		secondBestPeriod: "Second-best period",
		secondBestScore: "Second-best score",
		detrended: "Detrended before detection",
		acfNeighbourScores: "ACF around candidate",
		lowerBoundary: "At lower search boundary",
		completePeriods: "Complete cycles",
		seasonalityUsed: "Used for forecast",
		backtest: "Backtest",
		levelTrend: "Level/trend",
		seasonal: "Cyclic",
		mae: "MAE",
		normalizedError: "Normalized error",
		qualityScaleNearZero: "Low historical spread; normalized quality is limited",
		holdoutSamples: "Holdout samples",
		notAvailable: "Not available",
		selection: "Selection",
		qualityClass: "Quality class",
		relativeError: "Relative error",
		qualityScale: "Quality scale",
		scaleSource: "Scale source",
		scaleSource_iqr: "IQR",
		scaleSource_p95p05: "P95–P05",
		scaleSource_mad: "MAD",
		scaleSource_range: "Observed range",
		scaleSource_none: "None",
		selectionSeasonalBetter: "The cyclic model was more accurate in backtesting.",
		selectionLevelTrendBetter: "The level/trend model was more accurate in backtesting.",
		selectionNoPeriodicity: "No sufficiently stable repetition was detected.",
		selectionInsufficientCycles: "There are not enough complete cycles for reliable detection.",
		selectionInsufficientSeasonalData: "There are not enough seasonal samples yet.",
		selectionSeasonalityDisabled: "Seasonality is disabled for this state.",
		selectionManualSeasonality: "A manually configured period is being used.",
		selectionSeasonalBacktestFailed: "The cyclic backtest was not available.",
		selectionSeasonalNotBetterEnough: "The cyclic model was not sufficiently better in backtesting.",
		minutesShort: "min",
		yes: "Yes",
		no: "No",
		currentView: "Current",
		forecastView: "Forecast",
		forecastHorizon: "Forecast horizon",
		forecastQuality: "Model quality (MAE)",
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
		baseline_learning: "still learning",
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
		"status.deviating": "Auffällig",
		"status.anomaly": "Anomalie",
		"status.insufficient_data": "Zu wenig Daten",
		"status.unavailable": "Keine aktuelle Bewertung",
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
		chartDeviating: "Auffällig",
		pendingExplanation: "Die Abweichung wird beobachtet und ist noch nicht als Anomalie bestätigt.",
		unavailableExplanation: "Für diesen Datenpunkt liegt noch keine aktuelle Bewertung vor.",
		learned: "%s von mindestens %s benötigten Messwerten gelernt",
		learnedContext: "%s von mindestens %s benötigten Messwerten für diesen Zustand gelernt",
		basedOn: "Basierend auf %s Messwerten",
		predictive: "Prognose",
		predictive_ready: "Bereit",
		predictive_learning: "Lernt noch",
		predictive_unreliable: "Eingeschränkt",
		predictive_error: "Fehler",
		predictive_disabled: "Prognose deaktiviert",
		forecastExpectedIn: "In %s voraussichtlich",
		forecastHoursShort: "+%s h",
		forecastMinutesShort: "+%s Min.",
		forecastQualityGood: "Prognosequalität: Gut",
		forecastQualityLimited: "Prognosequalität: Eingeschränkt",
		forecastQualityPoor: "Prognosequalität: Nicht zuverlässig",
		forecastQualityUnknown: "Prognosequalität: Noch nicht bewertbar",
		qualityGood: "Gut",
		qualityLimited: "Eingeschränkt",
		qualityPoor: "Nicht zuverlässig",
		qualityUnknown: "Noch nicht bewertbar",
		forecastLimitedExplanation: "Die Prognose ist derzeit nur eingeschränkt zuverlässig.",
		forecastNotReliable: "Die Prognose ist derzeit nicht zuverlässig.",
		forecastError: "Die Prognose konnte nicht berechnet werden.",
		forecastNow: "Jetzt",
		predictiveDetails: "Technische Details",
		model: "Modell",
		selectedModel: "Gewähltes Modell",
		modelLevelTrend: "Level/Trend",
		modelSeasonal: "Zyklisch",
		modelTimeOfDay: "Tageszeitprofil",
		modelInterval: "Modellintervall",
		rawInterval: "Rohdatenintervall",
		historySpan: "History-Zeitraum",
		requestedHistorySpan: "Angeforderter History-Zeitraum",
		daysCovered: "Abgedeckte Tage",
		bucketCount: "Zeit-Buckets",
		bucketCoverage: "Bucket-Abdeckung",
		trainingSamples: "Trainingswerte",
		lastTraining: "Letztes Training",
		trainingSource: "Trainingsquelle",
		bootstrapReason: "Bootstrap-Grund",
		modelVersion: "Modellversion",
		sourceHistory: "History",
		sourcePersisted: "Persistiertes Modell",
		sourceLive: "Live-Werte",
		sourceMixed: "History + Live-Werte",
		seasonality: "Saisonalität",
		seasonalityMode: "Modus",
		seasonalityOff: "Aus",
		seasonalityAuto: "Automatisch",
		seasonalityManual: "Manuell",
		periodDetected: "Periode erkannt",
		detectedPeriod: "Erkannte Periode",
		periodicityScore: "Periodizitätsbewertung",
		peakProminence: "Peak-Prominenz",
		harmonicPeaks: "Bestätigte harmonische Peaks",
		secondBestPeriod: "Zweitbeste Periode",
		secondBestScore: "Zweitbester Score",
		detrended: "Vor der Erkennung detrendet",
		acfNeighbourScores: "ACF um den Kandidaten",
		lowerBoundary: "Am unteren Suchrand",
		completePeriods: "Vollständige Zyklen",
		seasonalityUsed: "Für Prognose verwendet",
		backtest: "Backtest",
		levelTrend: "Level/Trend",
		seasonal: "Zyklisch",
		mae: "MAE",
		normalizedError: "Normalisierter Fehler",
		qualityScaleNearZero:
			"Sehr geringe historische Streuung; normalisierte Qualität ist eingeschränkt aussagekräftig",
		holdoutSamples: "Holdout-Testwerte",
		notAvailable: "Nicht verfügbar",
		selection: "Auswahl",
		qualityClass: "Qualitätsklasse",
		relativeError: "Relativer Fehler",
		qualityScale: "Qualitätsskala",
		scaleSource: "Skalenquelle",
		scaleSource_iqr: "IQR",
		scaleSource_p95p05: "P95–P05",
		scaleSource_mad: "MAD",
		scaleSource_range: "Beobachteter Wertebereich",
		scaleSource_none: "Keine",
		selectionSeasonalBetter: "Das zyklische Modell war im Backtest genauer.",
		selectionLevelTrendBetter: "Das Level-/Trendmodell war im Backtest genauer.",
		selectionNoPeriodicity: "Es wurde keine ausreichend stabile Wiederholung erkannt.",
		selectionInsufficientCycles:
			"Für eine zuverlässige Erkennung liegen noch nicht genügend vollständige Zyklen vor.",
		selectionInsufficientSeasonalData: "Für eine saisonale Bewertung liegen noch nicht genügend Messwerte vor.",
		selectionSeasonalityDisabled: "Saisonalität ist für diesen Datenpunkt deaktiviert.",
		selectionManualSeasonality: "Eine manuell konfigurierte Periode wird verwendet.",
		selectionSeasonalBacktestFailed: "Der zyklische Backtest war nicht verfügbar.",
		selectionSeasonalNotBetterEnough: "Das zyklische Modell war im Backtest nicht ausreichend besser.",
		minutesShort: "Min.",
		yes: "Ja",
		no: "Nein",
		currentView: "Aktuell",
		forecastView: "Prognose",
		forecastHorizon: "Prognosehorizont",
		forecastQuality: "Modellgüte (MAE)",
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
		baseline_learning: "lernt noch",
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
	if (evaluation.statusCode === "unavailable") {
		return t("unavailableExplanation");
	}
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
	const status = item.statusCode || (item.detected ? "anomaly" : "normal");
	lines.push(`${t("chartStatus")}: ${t(`status.${status}`)}`);
	if (status !== "normal") {
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
	const historicalAnomalyCount = diagnosticsInRange.filter(
		item => item.statusCode === "anomaly" || (!item.statusCode && item.detected),
	).length;
	const historicalDeviationCount = diagnosticsInRange.filter(item => item.statusCode === "deviating").length;
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
						onClick={() => setHours(Number(value))}
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
							(item.statusCode === "anomaly" || (!item.statusCode && item.detected)) &&
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
							fill={item?.statusCode === "deviating" ? "#ff9800" : "#2196f3"}
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
				{diagnosticsInRange.some(
					item => item.statusCode === "anomaly" || (!item.statusCode && item.detected),
				) && (
					<Typography
						variant="caption"
						color="error"
					>
						▲ {t("chartAnomaly")}
					</Typography>
				)}
				{historicalDeviationCount > 0 && (
					<Typography
						variant="caption"
						color="warning.main"
					>
						● {t("chartDeviating")}
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

function effectiveStatus(evaluation: Evaluation): NonNullable<Evaluation["statusCode"]> {
	if (evaluation.statusCode === "anomaly" && evaluation.detected === false) {
		return "deviating";
	}
	return evaluation.statusCode || "learning";
}

function statusColor(status?: Evaluation["statusCode"]): "success" | "warning" | "error" | "default" {
	return status === "anomaly"
		? "error"
		: status === "deviating"
			? "warning"
			: status === "normal"
				? "success"
				: status === "insufficient_data" || status === "unavailable"
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
	const displayStatus = effectiveStatus(evaluation);
	const range =
		evaluation.decisionLow !== undefined && evaluation.decisionHigh !== undefined
			? `${formatRangeValue(evaluation.decisionLow)}–${formatRangeValue(evaluation.decisionHigh)}`
			: undefined;
	const relevantSampleCount =
		evaluation.relevantSampleCount ??
		(evaluation.baselineScope === "context" ? evaluation.contextSampleCount : evaluation.sampleCount);
	const relevantSampleScope = evaluation.relevantSampleScope ?? evaluation.baselineScope;
	const requiredSamples = evaluation.requiredSamples;
	const baselineDisplayScope = evaluation.relevantSampleScope ?? evaluation.baselineScope;
	const baselineDisplayCount = evaluation.relevantSampleCount ?? evaluation.baselineSampleCount;
	const baselineMature =
		evaluation.evaluationAvailable ??
		(requiredSamples !== undefined &&
			baselineDisplayCount !== undefined &&
			baselineDisplayCount >= requiredSamples);
	const samples =
		displayStatus === "unavailable" || relevantSampleCount === undefined
			? undefined
			: relevantSampleScope === "context" && requiredSamples !== undefined
				? relevantSampleCount >= requiredSamples
					? t("comparisonSamples", relevantSampleCount)
					: t("learnedContext", relevantSampleCount, requiredSamples)
				: requiredSamples !== undefined && relevantSampleCount < requiredSamples
					? t("learned", relevantSampleCount, requiredSamples)
					: t("basedOn", relevantSampleCount);
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
						label={statusLabel(displayStatus)}
						color={statusColor(displayStatus)}
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
				{displayStatus === "deviating" && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{t("pendingExplanation")}
					</Typography>
				)}
				{displayStatus === "normal" && range && (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ mt: 1 }}
					>
						{t("chartNormalExplanation")}
					</Typography>
				)}
				{evaluation.reasonCode && displayStatus !== "normal" && displayStatus !== "deviating" && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{directionalReason(evaluation)}
					</Typography>
				)}
				{displayStatus === "anomaly" && evaluation.anomalySince && (
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
				{source.predictive && source.predictive.status !== "disabled" && (
					<Box sx={{ mt: 1 }}>
						<Typography
							variant="body2"
							color="text.secondary"
						>
							{t("predictive")}: {t(`predictive_${source.predictive.status}`)}
						</Typography>
						{source.predictive.status === "ready" && source.predictive.points.length > 0 && (
							<Typography variant="body2">
								{source.predictive.points[0].value.toLocaleString()} ({source.predictive.horizonMinutes}{" "}
								min)
							</Typography>
						)}
					</Box>
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
							{t("baseline")}: {baselineLabel(baselineDisplayScope)}
							{!baselineMature && ` – ${t("baseline_learning")}`} ({baselineDisplayCount ?? 0}{" "}
							{t("samples")})
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

function forecastExpectedLabel(minutes: number): string {
	if (minutes >= 60 && minutes % 60 === 0) {
		const hours = minutes / 60;
		const value =
			language() === "de"
				? `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`
				: `${hours} ${hours === 1 ? "hour" : "hours"}`;
		return t("forecastExpectedIn", value);
	}
	return t("forecastExpectedIn", language() === "de" ? `${minutes} Minuten` : `${minutes} minutes`);
}

function forecastEndLabel(minutes: number): string {
	return minutes >= 60 && minutes % 60 === 0
		? t("forecastHoursShort", minutes / 60)
		: t("forecastMinutesShort", minutes);
}

function predictiveModelLabel(model?: "levelTrend" | "seasonal" | "timeOfDay"): string {
	return model === "seasonal"
		? t("modelSeasonal")
		: model === "timeOfDay"
			? t("modelTimeOfDay")
			: t("modelLevelTrend");
}

function predictiveModeLabel(mode?: "off" | "auto" | "manual"): string {
	return mode === "auto" ? t("seasonalityAuto") : mode === "manual" ? t("seasonalityManual") : t("seasonalityOff");
}

function predictiveSelectionLabel(reason?: string): string | undefined {
	if (!reason) {
		return undefined;
	}
	const key = `selection${reason
		.split("-")
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")}`;
	const value = t(key);
	return value === key ? undefined : value;
}

function predictiveTrainingSourceLabel(source?: "history" | "persisted" | "live" | "mixed"): string | undefined {
	return source === "history"
		? t("sourceHistory")
		: source === "persisted"
			? t("sourcePersisted")
			: source === "live"
				? t("sourceLive")
				: source === "mixed"
					? t("sourceMixed")
					: undefined;
}

function finiteDetail(value: number | undefined, suffix = ""): string | undefined {
	return Number.isFinite(value) ? `${formatValue(value)}${suffix}` : undefined;
}

function scaleSourceLabel(value: unknown): string {
	switch (value) {
		case "iqr":
			return t("scaleSource_iqr");
		case "p95-p05":
		case "p95p05":
		case "p95_p05":
			return t("scaleSource_p95p05");
		case "mad":
			return t("scaleSource_mad");
		case "range":
			return t("scaleSource_range");
		case "none":
			return t("scaleSource_none");
		default:
			return t("notAvailable");
	}
}

function ForecastCard({ source }: { source: Source }): React.JSX.Element {
	const forecast = source.predictive!;
	const [detailsOpen, setDetailsOpen] = useState(false);
	const diagnostics = forecast.diagnostics;
	const actual = source.evaluation.actual;
	const currentTimestamp = forecast.generatedAt ?? source.evaluation.lastEvaluated ?? Date.now();
	const points = forecast.points.filter(point => Number.isFinite(point.value));
	const chartPoints =
		Number.isFinite(actual) && points[0]?.timestamp !== currentTimestamp
			? [{ timestamp: currentTimestamp, value: actual as number }, ...points]
			: points;
	const domain = chartYDomain(
		chartPoints.map(point => point.value),
		[],
		{ floorAtZero: false },
	);
	const path = chartPoints
		.map((point, index) => {
			const start = chartPoints[0]?.timestamp ?? currentTimestamp;
			const end = start + forecast.horizonMinutes * 60_000;
			const x =
				end > start
					? Math.max(0, Math.min(280, ((point.timestamp - start) / (end - start)) * 280))
					: index === 0
						? 0
						: 280;
			const y = 112 - ((point.value - domain.min) / Math.max(0.001, domain.max - domain.min)) * 100;
			return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	const lastPoint = points.at(-1);
	const selectedType = diagnostics?.model?.selectedType ?? forecast.selectedModelType;
	const selectionReason = diagnostics?.model?.selectionReason ?? forecast.selectionReason;
	const quality = diagnostics?.quality;
	const qualityClass = forecast.qualityClass ?? quality?.qualityClassification?.class ?? "unknown";
	const showChart = (forecast.status === "ready" || forecast.status === "unreliable") && chartPoints.length > 0;
	const seasonality = diagnostics?.seasonality;
	const periodicityPercent = Number.isFinite(seasonality?.periodicityScore)
		? (seasonality?.periodicityScore as number) * 100
		: undefined;
	// Every active predictive state exposes details, even with partial diagnostics.
	const hasDetails = forecast.status !== "disabled";
	const renderBacktest = (
		label: string,
		result?: {
			available?: boolean;
			mae?: number;
			normalizedError?: number;
			holdoutSamples?: number;
			qualityScaleNearZero?: boolean;
		},
	): React.JSX.Element => {
		const metrics =
			result?.available && Number.isFinite(result.mae)
				? `${t("mae")} ${formatValue(result.mae)}${result?.available && Number.isFinite(result.normalizedError) ? ` · ${t("normalizedError")} ${formatValue((result.normalizedError as number) * 100)} %` : ""}`
				: t("notAvailable");
		return (
			<Stack
				spacing={0.25}
				sx={{ minWidth: 0 }}
			>
				<Typography
					variant="body2"
					sx={{ overflowWrap: "anywhere" }}
				>
					{label}: {metrics}
				</Typography>
				{result?.qualityScaleNearZero && (
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ overflowWrap: "anywhere" }}
					>
						{t("qualityScaleNearZero")}
					</Typography>
				)}
			</Stack>
		);
	};
	return (
		<Card
			variant="outlined"
			sx={{ height: "100%" }}
		>
			<CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
				<Stack
					direction="row"
					sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}
				>
					<Typography
						variant="h6"
						sx={{ fontWeight: 600 }}
					>
						{source.name}
					</Typography>
					<Chip
						label={t(`predictive_${forecast.status}`)}
						color={
							forecast.status === "ready"
								? "success"
								: forecast.status === "disabled"
									? "default"
									: "warning"
						}
						size="small"
					/>
				</Stack>
				{Number.isFinite(actual) && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{t("current")}: {formatValue(actual)}
						{source.unit ? ` ${source.unit}` : ""}
					</Typography>
				)}
				{forecast.status === "learning" && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{t(
							"learned",
							forecast.trainingSampleCount,
							forecast.minimumTrainingSamples ?? source.evaluation.requiredSamples ?? 0,
						)}
					</Typography>
				)}
				{(forecast.status === "ready" || forecast.status === "unreliable") && lastPoint && (
					<>
						<Typography
							variant="body2"
							sx={{ mt: 1 }}
						>
							{forecastExpectedLabel(forecast.horizonMinutes)}
						</Typography>
						<Typography
							variant="body1"
							sx={{ fontWeight: 500 }}
						>
							{formatValue(lastPoint.value)}
							{source.unit ? ` ${source.unit}` : ""}
						</Typography>
						<Typography
							variant="body2"
							sx={{ mt: 1 }}
						>
							{t(
								qualityClass === "good"
									? "forecastQualityGood"
									: qualityClass === "limited"
										? "forecastQualityLimited"
										: qualityClass === "poor"
											? "forecastQualityPoor"
											: "forecastQualityUnknown",
							)}
						</Typography>
					</>
				)}
				{forecast.status === "error" && (
					<Typography
						variant="body2"
						sx={{ mt: 1 }}
					>
						{t("forecastError")}
					</Typography>
				)}
				{showChart ? (
					<>
						<svg
							viewBox="0 0 280 140"
							width="100%"
							height="160"
							role="img"
							aria-label={t("predictive")}
						>
							<text
								x="0"
								y="136"
								fontSize="11"
								fill="currentColor"
							>
								{t("forecastNow")}
							</text>
							<text
								x="280"
								y="136"
								textAnchor="end"
								fontSize="11"
								fill="currentColor"
							>
								{forecastEndLabel(forecast.horizonMinutes)}
							</text>
							{Number.isFinite(actual) && (
								<circle
									cx="0"
									cy={
										112 -
										(((actual as number) - domain.min) / Math.max(0.001, domain.max - domain.min)) *
											100
									}
									r="3"
									fill="currentColor"
								/>
							)}
							<path
								d={path}
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeDasharray="6 4"
							/>
						</svg>
					</>
				) : null}
				{hasDetails && (
					<>
						<Box sx={{ flexGrow: 1, minHeight: 8 }} />
						<Button
							size="small"
							onClick={() => setDetailsOpen(value => !value)}
							endIcon={detailsOpen ? <ExpandLess /> : <ExpandMore />}
							sx={{ mt: 1 }}
							aria-expanded={detailsOpen}
						>
							{t("predictiveDetails")}
						</Button>
						<Collapse in={detailsOpen}>
							<Divider sx={{ my: 1 }} />
							<Stack spacing={0.5}>
								<Typography variant="subtitle2">{t("model")}</Typography>
								{selectedType && (
									<Typography variant="body2">
										{t("selectedModel")}: {predictiveModelLabel(selectedType)}
									</Typography>
								)}
								{Number.isFinite(diagnostics?.model?.algorithmVersion) && (
									<Typography variant="body2">
										{t("modelVersion")}: {diagnostics?.model?.algorithmVersion}
									</Typography>
								)}
								{finiteDetail(diagnostics?.model?.intervalMinutes, ` ${t("minutesShort")}`) && (
									<Typography variant="body2">
										{t("modelInterval")}:{" "}
										{finiteDetail(diagnostics?.model?.intervalMinutes, ` ${t("minutesShort")}`)}
									</Typography>
								)}
								<Typography variant="body2">
									{t("trainingSamples")}: {forecast.trainingSampleCount}
								</Typography>
								{predictiveTrainingSourceLabel(forecast.trainingSource) && (
									<Typography variant="body2">
										{t("trainingSource")}: {predictiveTrainingSourceLabel(forecast.trainingSource)}
									</Typography>
								)}
								{finiteDetail(diagnostics?.model?.rawIntervalMinutes, ` ${t("minutesShort")}`) && (
									<Typography variant="body2">
										{t("rawInterval")}:{" "}
										{finiteDetail(diagnostics?.model?.rawIntervalMinutes, ` ${t("minutesShort")}`)}
									</Typography>
								)}
								{finiteDetail(diagnostics?.model?.historySpanMinutes, ` ${t("minutesShort")}`) && (
									<Typography variant="body2">
										{t("historySpan")}:{" "}
										{finiteDetail(diagnostics?.model?.historySpanMinutes, ` ${t("minutesShort")}`)}
									</Typography>
								)}
								{finiteDetail(
									diagnostics?.model?.requestedHistorySpanMinutes,
									` ${t("minutesShort")}`,
								) && (
									<Typography variant="body2">
										{t("requestedHistorySpan")}:{" "}
										{finiteDetail(
											diagnostics.model.requestedHistorySpanMinutes,
											` ${t("minutesShort")}`,
										)}
									</Typography>
								)}
								{diagnostics?.model?.timeOfDayAvailable !== undefined && (
									<>
										<Typography variant="body2">
											{t("modelTimeOfDay")}:{" "}
											{diagnostics.model.timeOfDayAvailable ? t("yes") : t("no")}
										</Typography>
										{finiteDetail(
											diagnostics.model.timeOfDayDaysCovered,
											` ${t("daysCovered")}`,
										) && (
											<Typography variant="body2">
												{t("daysCovered")}: {diagnostics.model.timeOfDayDaysCovered}
											</Typography>
										)}
										{finiteDetail(
											diagnostics.model.timeOfDayBucketCount,
											` ${t("bucketCount")}`,
										) && (
											<Typography variant="body2">
												{t("bucketCount")}: {diagnostics.model.timeOfDayBucketCount}
											</Typography>
										)}
										{finiteDetail(
											diagnostics.model.timeOfDayBucketCoverage !== undefined
												? diagnostics.model.timeOfDayBucketCoverage * 100
												: undefined,
											" %",
										) && (
											<Typography variant="body2">
												{t("bucketCoverage")}:{" "}
												{finiteDetail(
													(diagnostics.model.timeOfDayBucketCoverage ?? 0) * 100,
													" %",
												)}
											</Typography>
										)}
									</>
								)}
								{diagnostics?.model?.lastTrainingAt && (
									<Typography variant="body2">
										{t("lastTraining")}: {formatTime(diagnostics.model.lastTrainingAt)}
									</Typography>
								)}
								{seasonality && (
									<>
										<Typography
											variant="subtitle2"
											sx={{ mt: 1 }}
										>
											{t("seasonality")}
										</Typography>
										<Typography variant="body2">
											{t("seasonalityMode")}: {predictiveModeLabel(seasonality.mode)}
										</Typography>
										{seasonality.periodicityDetected !== undefined && (
											<Typography variant="body2">
												{t("periodDetected")}:{" "}
												{seasonality.periodicityDetected ? t("yes") : t("no")}
											</Typography>
										)}
										{finiteDetail(seasonality.detectedPeriodMinutes, ` ${t("minutesShort")}`) && (
											<Typography variant="body2">
												{t("detectedPeriod")}: ca.{" "}
												{finiteDetail(
													seasonality.detectedPeriodMinutes,
													` ${t("minutesShort")}`,
												)}
											</Typography>
										)}
										{finiteDetail(periodicityPercent, " %") && (
											<Typography variant="body2">
												{t("periodicityScore")}: {finiteDetail(periodicityPercent, " %")}
											</Typography>
										)}
										{finiteDetail(
											seasonality.peakProminence !== undefined
												? seasonality.peakProminence * 100
												: undefined,
											" %",
										) && (
											<Typography variant="body2">
												{t("peakProminence")}:{" "}
												{finiteDetail((seasonality.peakProminence ?? 0) * 100, " %")}
											</Typography>
										)}
										{seasonality.harmonicPeaks !== undefined && (
											<Typography variant="body2">
												{t("harmonicPeaks")}: {seasonality.harmonicPeaks}
											</Typography>
										)}
										{finiteDetail(seasonality.secondBestPeriodMinutes, ` ${t("minutesShort")}`) && (
											<Typography variant="body2">
												{t("secondBestPeriod")}:{" "}
												{finiteDetail(
													seasonality.secondBestPeriodMinutes,
													` ${t("minutesShort")}`,
												)}
											</Typography>
										)}
										{finiteDetail(
											seasonality.secondBestPeriodicityScore !== undefined
												? seasonality.secondBestPeriodicityScore * 100
												: undefined,
											" %",
										) && (
											<Typography variant="body2">
												{t("secondBestScore")}:{" "}
												{finiteDetail(
													(seasonality.secondBestPeriodicityScore ?? 0) * 100,
													" %",
												)}
											</Typography>
										)}
										{seasonality.candidateScores && (
											<Typography variant="body2">
												{t("acfNeighbourScores")}:{" "}
												{Object.entries(seasonality.candidateScores)
													.map(([key, score]) => `${key} ${formatValue(score * 100)} %`)
													.join(" · ")}
											</Typography>
										)}
										{seasonality.atLowerBoundary !== undefined && (
											<Typography variant="body2">
												{t("lowerBoundary")}: {seasonality.atLowerBoundary ? t("yes") : t("no")}
											</Typography>
										)}
										{Number.isFinite(seasonality.completePeriods) && (
											<Typography variant="body2">
												{t("completePeriods")}: {seasonality.completePeriods}
											</Typography>
										)}
										{seasonality.used !== undefined && (
											<Typography variant="body2">
												{t("seasonalityUsed")}: {seasonality.used ? t("yes") : t("no")}
											</Typography>
										)}
									</>
								)}
								{quality && (
									<>
										{quality.qualityClassification && (
											<>
												<Typography variant="body2">
													{t("qualityClass")}:{" "}
													{t(
														quality.qualityClassification.class === "good"
															? "qualityGood"
															: quality.qualityClassification.class === "limited"
																? "qualityLimited"
																: quality.qualityClassification.class === "poor"
																	? "qualityPoor"
																	: "qualityUnknown",
													)}
												</Typography>
												{Number.isFinite(quality.qualityClassification.relativeError) && (
													<Typography variant="body2">
														{t("relativeError")}:{" "}
														{formatValue(
															(quality.qualityClassification.relativeError as number) *
																100,
														)}{" "}
														%
													</Typography>
												)}
												{Number.isFinite(quality.qualityClassification.scale) && (
													<Typography variant="body2">
														{t("qualityScale")}:{" "}
														{formatValue(quality.qualityClassification.scale)}
													</Typography>
												)}
												<Typography variant="body2">
													{t("scaleSource")}:{" "}
													{scaleSourceLabel(quality.qualityClassification.scaleSource)}
												</Typography>
											</>
										)}
										<Typography
											variant="subtitle2"
											sx={{ mt: 1 }}
										>
											{t("backtest")}
										</Typography>
										{renderBacktest(t("levelTrend"), quality.levelTrend)}
										{renderBacktest(t("seasonal"), quality.seasonal)}
										{renderBacktest(t("modelTimeOfDay"), quality.timeOfDay)}
										{quality.holdoutSamples !== undefined && (
											<Typography variant="body2">
												{t("holdoutSamples")}: {quality.holdoutSamples}
											</Typography>
										)}
									</>
								)}
								{predictiveSelectionLabel(selectionReason) && (
									<Typography
										variant="body2"
										sx={{ mt: 1 }}
									>
										{t("selection")}: {predictiveSelectionLabel(selectionReason)}
									</Typography>
								)}
							</Stack>
						</Collapse>
					</>
				)}
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
	const [view, setView] = useState<"current" | "forecast">("current");
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
			<Stack
				direction="row"
				spacing={1}
				sx={{ mb: 2 }}
			>
				<Button
					variant={view === "current" ? "contained" : "text"}
					onClick={() => setView("current")}
				>
					{t("currentView")}
				</Button>
				<Button
					variant={view === "forecast" ? "contained" : "text"}
					onClick={() => setView("forecast")}
				>
					{t("forecastView")}
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
			{view === "forecast" ? (
				<Grid
					container
					spacing={2}
				>
					{sources
						.map(source => ({
							...source,
							predictive: source.predictive ?? {
								status: "disabled" as const,
								horizonMinutes: 0,
								points: [],
								trainingSampleCount: 0,
							},
						}))
						.map(source => (
							<Grid
								item
								xs={12}
								md={6}
								xl={4}
								key={source.id}
							>
								<ForecastCard source={source} />
							</Grid>
						))}
				</Grid>
			) : sources.length === 0 ? (
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
