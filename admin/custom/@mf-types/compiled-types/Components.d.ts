import React from "react";
type Detector = {
    name: string;
    score: number;
    reasonCode: string;
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
        points: Array<{
            timestamp: number;
            value: number;
        }>;
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
        candidateScores?: {
            minus2?: number;
            minus1?: number;
            candidate?: number;
            plus1?: number;
            plus2?: number;
        };
        atLowerBoundary?: boolean;
        harmonicScores?: Array<{
            lag: number;
            score: number;
        }>;
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
                harmonicScores?: Array<{
                    lag: number;
                    score: number;
                }>;
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
type TabResponse = {
    data?: {
        sources?: Source[];
    };
};
type SocketLike = {
    sendTo?: <T = TabResponse>(target: string, command: string, data: unknown) => Promise<T>;
};
type Props = {
    socket?: SocketLike;
    instance?: string | number;
    adapterName?: string;
    oContext?: {
        instance?: string | number;
        adapterName?: string;
        socket?: SocketLike;
    };
    data?: {
        sources?: Source[];
    };
};
/**
 * Renders the anomaly dashboard tab.
 *
 * @param props Dashboard integration properties.
 */
export declare function AnomalyDashboard(props: Props): React.JSX.Element;
declare const _default: {
    AnomalyDashboard: typeof AnomalyDashboard;
};
export default _default;
