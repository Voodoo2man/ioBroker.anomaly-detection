declare global {
	namespace ioBroker {
		interface AdapterConfig {
			sources: Array<{
				enabled: boolean;
				id: string;
				name: string;
				minimumSamples: number;
				bucketMinutes: number;
				sensitivity: number;
				anomalyThreshold: number;
				minimumAnomalyDurationMinutes: number;
				enableMad: boolean;
				enableRate: boolean;
				enableStuck: boolean;
				stuckDurationMinutes: number;
				timeContext: boolean;
				weekdayContext: boolean;
				initialTraining: "live" | "history";
				historyInstance: string;
				trainingDays: number;
				maxHistorySamples: number;
				autoStartMonitoringAfterImport: boolean;
				enableContext: boolean;
				contextStates: Array<{ id: string; bucketWidth: number }>;
				enableChangePoint: boolean;
				enableTrend: boolean;
				predictive?: {
					enabled?: boolean;
					horizonMinutes?: number;
					updateIntervalMinutes?: number;
					minimumTrainingSamples?: number;
					maximumTrainingPoints?: number;
					seasonalPeriodMinutes?: number;
					seasonalityMode?: "off" | "auto" | "manual";
				};
				/** Flat aliases used by the JSON config editor for reliable persistence. */
				predictiveEnabled?: boolean;
				predictiveHorizonMinutes?: number;
				predictiveUpdateIntervalMinutes?: number;
				predictiveMinimumTrainingSamples?: number;
				predictiveMaximumTrainingPoints?: number;
				predictiveSeasonalPeriodMinutes?: number;
				predictiveSeasonalityMode?: "off" | "auto" | "manual";
			}>;
		}
	}
}
export {};
