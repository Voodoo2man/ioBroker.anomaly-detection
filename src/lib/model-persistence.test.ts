import { expect } from "chai";
import { mergeStartupModels } from "./model-persistence";

describe("startup model persistence", () => {
	it("preserves uninitialized anomaly and predictive models during partial startup", () => {
		const restored = {
			first: { samples: 3 },
			pending: { samples: 8 },
		};
		const initialized = { first: { samples: 4 } };
		const restoredPredictive = {
			first: { trainingSamples: 10 },
			pending: { trainingSamples: 20 },
		};
		const initializedPredictive = { first: { trainingSamples: 11 } };

		expect(mergeStartupModels(restored, initialized, false)).to.deep.equal({
			first: { samples: 4 },
			pending: { samples: 8 },
		});
		expect(mergeStartupModels(restoredPredictive, initializedPredictive, false)).to.deep.equal({
			first: { trainingSamples: 11 },
			pending: { trainingSamples: 20 },
		});
	});

	it("uses the complete current snapshot after normal startup", () => {
		expect(mergeStartupModels({ removed: { samples: 8 } }, { current: { samples: 2 } }, true)).to.deep.equal({
			current: { samples: 2 },
		});
	});
});
