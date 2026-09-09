import { expect } from "chai";
import { generatedSourceParentIds, SOURCES_OBJECT_ID, sourcesObject } from "./object-structure";

describe("generated source object structure", () => {
	it("defines the shared sources container as a folder for source devices", () => {
		expect(SOURCES_OBJECT_ID).to.equal("sources");
		expect(sourcesObject.type).to.equal("folder");
		expect(sourcesObject.common).to.have.property("name");
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
});
