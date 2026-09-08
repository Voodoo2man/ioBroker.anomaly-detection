import React from "react";
type Detector = {
    name: string;
    score: number;
    reasonCode: string;
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
