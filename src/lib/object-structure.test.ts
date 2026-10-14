import { expect } from "chai";
import { ensureStateUnit, generatedSourceParentIds, SOURCES_OBJECT_ID, sourcesObject } from "./object-structure";

describe("generated source object structure", () => {
	it("defines the shared sources container as a folder for source devices", () => {
		expect(SOURCES_OBJECT_ID).to.equal("sources");
		expect(sourcesObject.type).to.equal("folder");
		expect(sourcesObject.common).to.have.property("name");
		expect(sourcesObject.common.name).to.include({ en: "Monitored sources", de: "Überwachte Quellen" });
		expect(sourcesObject.native).to.deep.equal({});
	});

	it("lists every generated parent required before descendant states", () => {
		expect(generatedSourceParentIds("adapter_0_value")).to.deep.equal([
			"sources",
			"sources.adapter_0_value",
			"sources.adapter_0_value.analysis",
			"sources.adapter_0_value.anomaly",
			"sources.adapter_0_value.detectors",
			"sources.adapter_0_value.evaluation",
		]);
	});

	it("adds a missing source unit without replacing an existing unit", async () => {
		const objects: Record<string, { common: { name: string; unit?: string } }> = {
			"sources.sensor.evaluation.currentValue": { common: { name: "Custom name" } },
			"sources.sensor.evaluation.expectedLow": { common: { name: "Custom bound", unit: "custom" } },
		};
		const updated: string[] = [];
		const store = {
			getObjectAsync: (id: string) => Promise.resolve(objects[id]),
			extendObjectAsync: (id: string, patch: { common: { unit: string } }) => {
				objects[id] = { common: { ...objects[id].common, ...patch.common } };
				updated.push(id);
				return Promise.resolve();
			},
		};

		await ensureStateUnit(store, "sources.sensor.evaluation.currentValue", "W");
		await ensureStateUnit(store, "sources.sensor.evaluation.expectedLow", "W");

		expect(objects["sources.sensor.evaluation.currentValue"].common).to.deep.equal({
			name: "Custom name",
			unit: "W",
		});
		expect(objects["sources.sensor.evaluation.expectedLow"].common).to.deep.equal({
			name: "Custom bound",
			unit: "custom",
		});
		expect(updated).to.deep.equal(["sources.sensor.evaluation.currentValue"]);
	});
});
