import { expect } from "chai";
import { getObjectNameTranslations, objectName } from "./object-names";

const supportedLanguages = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"];

describe("generated object names", () => {
	it("provides translations for every generated name in all supported languages", () => {
		for (const [englishName, translations] of Object.entries(getObjectNameTranslations())) {
			expect(translations, englishName).to.have.length(supportedLanguages.length);
			expect(translations[0], englishName).to.equal(englishName);
			expect(
				translations.every(value => value.length > 0),
				englishName,
			).to.equal(true);
		}
	});

	it("returns ioBroker translated-name objects with the English fallback", () => {
		expect(objectName("Anomaly analysis")).to.deep.equal({
			en: "Anomaly analysis",
			de: "Anomalieanalyse",
			ru: "Анализ аномалий",
			pt: "Análise de anomalias",
			nl: "Anomalieanalyse",
			fr: "Analyse des anomalies",
			it: "Analisi delle anomalie",
			es: "Análisis de anomalías",
			pl: "Analiza anomalii",
			uk: "Аналіз аномалій",
			"zh-cn": "异常分析",
		});
	});
});
