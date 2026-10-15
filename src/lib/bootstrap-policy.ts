export interface BootstrapNeeds {
	anomaly: boolean;
	predictive: boolean;
}

export interface AnomalyBootstrapStateUpdate {
	status: string;
	bootstrapStatus: string;
}

export type AnomalyBootstrapPhase = "started" | "completed" | "failed";

export function anomalyBootstrapStateUpdate(
	needs: BootstrapNeeds,
	phase: AnomalyBootstrapPhase,
	hasSufficientData: boolean,
	autoStartMonitoring = true,
	importedSamples = 0,
): AnomalyBootstrapStateUpdate | undefined {
	if (!needs.anomaly) {
		return undefined;
	}
	if (phase === "started") {
		return { status: "importingHistory", bootstrapStatus: "Importing historical data" };
	}
	if (phase === "completed") {
		return {
			status: hasSufficientData && autoStartMonitoring ? "monitoring" : "learning",
			bootstrapStatus: `Historical training completed (${importedSamples} samples)`,
		};
	}
	return {
		status: hasSufficientData ? "monitoring" : "learning",
		bootstrapStatus: "Insufficient historical data, continuing live learning",
	};
}

export function shouldBootstrapPredictiveHistory(
	initialTrainingIsHistory: boolean,
	hasHistoryInstance: boolean,
	modelEnabled: boolean,
	modelNeedsBootstrap: boolean,
): boolean {
	return initialTrainingIsHistory && hasHistoryInstance && modelEnabled && modelNeedsBootstrap;
}

export function manualRetrainBootstrapNeeds(
	initialTrainingIsHistory: boolean,
	hasHistoryInstance: boolean,
	predictiveEnabled: boolean,
	predictiveModelNeedsBootstrap: boolean,
): BootstrapNeeds {
	return {
		anomaly: true,
		predictive: shouldBootstrapPredictiveHistory(
			initialTrainingIsHistory,
			hasHistoryInstance,
			predictiveEnabled,
			predictiveModelNeedsBootstrap,
		),
	};
}
