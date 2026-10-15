"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var object_names_exports = {};
__export(object_names_exports, {
  getObjectNameTranslations: () => getObjectNameTranslations,
  objectName: () => objectName
});
module.exports = __toCommonJS(object_names_exports);
const languages = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"];
const names = {
  "Monitored sources": [
    "Monitored sources",
    "\xDCberwachte Quellen",
    "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u043C\u044B\u0435 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438",
    "Fontes monitoradas",
    "Bewaakte bronnen",
    "Sources surveill\xE9es",
    "Fonti monitorate",
    "Fuentes supervisadas",
    "Monitorowane \u017Ar\xF3d\u0142a",
    "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043E\u0432\u0430\u043D\u0456 \u0434\u0436\u0435\u0440\u0435\u043B\u0430",
    "\u53D7\u76D1\u63A7\u7684\u6E90"
  ],
  "Persisted models": [
    "Persisted models",
    "Gespeicherte Modelle",
    "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043C\u043E\u0434\u0435\u043B\u0438",
    "Modelos persistidos",
    "Opgeslagen modellen",
    "Mod\xE8les persist\xE9s",
    "Modelli salvati",
    "Modelos guardados",
    "Zapisane modele",
    "\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0456 \u043C\u043E\u0434\u0435\u043B\u0456",
    "\u6301\u4E45\u5316\u6A21\u578B"
  ],
  "Persisted predictive models": [
    "Persisted predictive models",
    "Gespeicherte Prognosemodelle",
    "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043C\u043E\u0434\u0435\u043B\u0438 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
    "Modelos preditivos persistidos",
    "Opgeslagen voorspellingsmodellen",
    "Mod\xE8les pr\xE9dictifs persist\xE9s",
    "Modelli predittivi salvati",
    "Modelos predictivos guardados",
    "Zapisane modele predykcyjne",
    "\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0456 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u043D\u0456 \u043C\u043E\u0434\u0435\u043B\u0456",
    "\u6301\u4E45\u5316\u9884\u6D4B\u6A21\u578B"
  ],
  "Anomaly analysis": [
    "Anomaly analysis",
    "Anomalieanalyse",
    "\u0410\u043D\u0430\u043B\u0438\u0437 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0439",
    "An\xE1lise de anomalias",
    "Anomalieanalyse",
    "Analyse des anomalies",
    "Analisi delle anomalie",
    "An\xE1lisis de anomal\xEDas",
    "Analiza anomalii",
    "\u0410\u043D\u0430\u043B\u0456\u0437 \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u0439",
    "\u5F02\u5E38\u5206\u6790"
  ],
  "Predictive forecast": [
    "Predictive forecast",
    "Prognose",
    "\u041F\u0440\u043E\u0433\u043D\u043E\u0437",
    "Previs\xE3o",
    "Voorspelling",
    "Pr\xE9vision",
    "Previsione",
    "Pron\xF3stico",
    "Prognoza",
    "\u041F\u0440\u043E\u0433\u043D\u043E\u0437",
    "\u9884\u6D4B"
  ],
  "Forecast result": [
    "Forecast result",
    "Prognoseergebnis",
    "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0430",
    "Resultado da previs\xE3o",
    "Voorspellingsresultaat",
    "R\xE9sultat de la pr\xE9vision",
    "Risultato della previsione",
    "Resultado del pron\xF3stico",
    "Wynik prognozy",
    "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0443",
    "\u9884\u6D4B\u7ED3\u679C"
  ],
  "Forecast status": [
    "Forecast status",
    "Prognosestatus",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0430",
    "Estado da previs\xE3o",
    "Voorspellingsstatus",
    "\xC9tat de la pr\xE9vision",
    "Stato della previsione",
    "Estado del pron\xF3stico",
    "Status prognozy",
    "\u0421\u0442\u0430\u043D \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0443",
    "\u9884\u6D4B\u72B6\u6001"
  ],
  "Actual value": [
    "Actual value",
    "Istwert",
    "\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435",
    "Valor real",
    "Werkelijke waarde",
    "Valeur r\xE9elle",
    "Valore effettivo",
    "Valor real",
    "Warto\u015B\u0107 rzeczywista",
    "\u0424\u0430\u043A\u0442\u0438\u0447\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F",
    "\u5B9E\u9645\u503C"
  ],
  "Expected value": [
    "Expected value",
    "Erwarteter Wert",
    "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435",
    "Valor esperado",
    "Verwachte waarde",
    "Valeur attendue",
    "Valore previsto",
    "Valor esperado",
    "Warto\u015B\u0107 oczekiwana",
    "\u041E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F",
    "\u9884\u671F\u503C"
  ],
  Deviation: [
    "Deviation",
    "Abweichung",
    "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435",
    "Desvio",
    "Afwijking",
    "\xC9cart",
    "Scostamento",
    "Desviaci\xF3n",
    "Odchylenie",
    "\u0412\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F",
    "\u504F\u5DEE"
  ],
  "Anomaly score": [
    "Anomaly score",
    "Anomalie-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438",
    "Pontua\xE7\xE3o de anomalia",
    "Anomaliescore",
    "Score d\u2019anomalie",
    "Punteggio anomalia",
    "Puntuaci\xF3n de anomal\xEDa",
    "Wynik anomalii",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u0457",
    "\u5F02\u5E38\u8BC4\u5206"
  ],
  "Learned sample count": [
    "Learned sample count",
    "Anzahl gelernter Messwerte",
    "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0431\u0443\u0447\u0430\u044E\u0449\u0438\u0445 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439",
    "N\xFAmero de amostras aprendidas",
    "Aantal geleerde metingen",
    "Nombre d\u2019\xE9chantillons appris",
    "Numero di campioni appresi",
    "N\xFAmero de muestras aprendidas",
    "Liczba nauczonych pr\xF3bek",
    "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u043D\u0430\u0432\u0447\u0435\u043D\u0438\u0445 \u0432\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u044C",
    "\u5DF2\u5B66\u4E60\u6837\u672C\u6570"
  ],
  "Active baseline scope": [
    "Active baseline scope",
    "Aktiver Baseline-Bereich",
    "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Escopo da linha de base ativa",
    "Actief basisbereik",
    "P\xE9rim\xE8tre de la r\xE9f\xE9rence active",
    "Ambito della baseline attiva",
    "\xC1mbito de la referencia activa",
    "Zakres aktywnej bazy",
    "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0457 \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u5F53\u524D\u57FA\u7EBF\u8303\u56F4"
  ],
  "Active context": [
    "Active context",
    "Aktiver Kontext",
    "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442",
    "Contexto ativo",
    "Actieve context",
    "Contexte actif",
    "Contesto attivo",
    "Contexto activo",
    "Aktywny kontekst",
    "\u0410\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442",
    "\u5F53\u524D\u4E0A\u4E0B\u6587"
  ],
  "Active baseline sample count": [
    "Active baseline sample count",
    "Messwerte der aktiven Baseline",
    "\u0427\u0438\u0441\u043B\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Amostras da linha de base ativa",
    "Metingen in actieve basis",
    "\xC9chantillons de la r\xE9f\xE9rence active",
    "Campioni della baseline attiva",
    "Muestras de la referencia activa",
    "Pr\xF3bki aktywnej bazy",
    "\u0412\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0457 \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u5F53\u524D\u57FA\u7EBF\u6837\u672C\u6570"
  ],
  "Active context sample count": [
    "Active context sample count",
    "Messwerte des aktiven Kontexts",
    "\u0427\u0438\u0441\u043B\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430",
    "Amostras do contexto ativo",
    "Metingen in actieve context",
    "\xC9chantillons du contexte actif",
    "Campioni del contesto attivo",
    "Muestras del contexto activo",
    "Pr\xF3bki aktywnego kontekstu",
    "\u0412\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443",
    "\u5F53\u524D\u4E0A\u4E0B\u6587\u6837\u672C\u6570"
  ],
  "Relevant baseline sample count": [
    "Relevant baseline sample count",
    "Messwerte der relevanten Baseline",
    "\u0427\u0438\u0441\u043B\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0439 \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Amostras da linha de base relevante",
    "Metingen in relevante basis",
    "\xC9chantillons de la r\xE9f\xE9rence pertinente",
    "Campioni della baseline pertinente",
    "Muestras de la referencia relevante",
    "Pr\xF3bki odpowiedniej bazy",
    "\u0412\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0457 \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u76F8\u5173\u57FA\u7EBF\u6837\u672C\u6570"
  ],
  "Relevant baseline scope": [
    "Relevant baseline scope",
    "Bereich der relevanten Baseline",
    "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0439 \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Escopo da linha de base relevante",
    "Bereik van relevante basis",
    "P\xE9rim\xE8tre de la r\xE9f\xE9rence pertinente",
    "Ambito della baseline pertinente",
    "\xC1mbito de la referencia relevante",
    "Zakres odpowiedniej bazy",
    "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E\u0457 \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u76F8\u5173\u57FA\u7EBF\u8303\u56F4"
  ],
  "Evaluation available": [
    "Evaluation available",
    "Auswertung verf\xFCgbar",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430",
    "Avalia\xE7\xE3o dispon\xEDvel",
    "Evaluatie beschikbaar",
    "\xC9valuation disponible",
    "Valutazione disponibile",
    "Evaluaci\xF3n disponible",
    "Ocena dost\u0119pna",
    "\u041E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0435",
    "\u8BC4\u4F30\u53EF\u7528"
  ],
  "Persistent anomaly detected": [
    "Persistent anomaly detected",
    "Anhaltende Anomalie erkannt",
    "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430 \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u0430\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044F",
    "Anomalia persistente detetada",
    "Aanhoudende anomalie gedetecteerd",
    "Anomalie persistante d\xE9tect\xE9e",
    "Rilevata anomalia persistente",
    "Anomal\xEDa persistente detectada",
    "Wykryto trwa\u0142\u0105 anomali\u0119",
    "\u0412\u0438\u044F\u0432\u043B\u0435\u043D\u043E \u0441\u0442\u0456\u0439\u043A\u0443 \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u044E",
    "\u68C0\u6D4B\u5230\u6301\u7EED\u5F02\u5E38"
  ],
  "Model status": [
    "Model status",
    "Modellstatus",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u043C\u043E\u0434\u0435\u043B\u0438",
    "Estado do modelo",
    "Modelstatus",
    "\xC9tat du mod\xE8le",
    "Stato del modello",
    "Estado del modelo",
    "Stan modelu",
    "\u0421\u0442\u0430\u043D \u043C\u043E\u0434\u0435\u043B\u0456",
    "\u6A21\u578B\u72B6\u6001"
  ],
  "Anomaly reason": [
    "Anomaly reason",
    "Anomaliegrund",
    "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438",
    "Motivo da anomalia",
    "Reden van anomalie",
    "Motif de l\u2019anomalie",
    "Motivo dell\u2019anomalia",
    "Motivo de la anomal\xEDa",
    "Przyczyna anomalii",
    "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u0457",
    "\u5F02\u5E38\u539F\u56E0"
  ],
  "Last high-score anomaly": [
    "Last high-score anomaly",
    "Letzte Anomalie mit hohem Score",
    "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044F \u0441 \u0432\u044B\u0441\u043E\u043A\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u043E\u0439",
    "\xDAltima anomalia com pontua\xE7\xE3o elevada",
    "Laatste anomalie met hoge score",
    "Derni\xE8re anomalie \xE0 score \xE9lev\xE9",
    "Ultima anomalia con punteggio alto",
    "\xDAltima anomal\xEDa con puntuaci\xF3n alta",
    "Ostatnia anomalia z wysokim wynikiem",
    "\u041E\u0441\u0442\u0430\u043D\u043D\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u044F \u0437 \u0432\u0438\u0441\u043E\u043A\u043E\u044E \u043E\u0446\u0456\u043D\u043A\u043E\u044E",
    "\u6700\u8FD1\u9AD8\u5206\u5F02\u5E38"
  ],
  "Retrain model": [
    "Retrain model",
    "Modell neu trainieren",
    "\u041F\u0435\u0440\u0435\u043E\u0431\u0443\u0447\u0438\u0442\u044C \u043C\u043E\u0434\u0435\u043B\u044C",
    "Treinar modelo novamente",
    "Model opnieuw trainen",
    "R\xE9entra\xEEner le mod\xE8le",
    "Riaddestra modello",
    "Volver a entrenar el modelo",
    "Trenuj model ponownie",
    "\u041F\u0435\u0440\u0435\u043D\u0430\u0432\u0447\u0438\u0442\u0438 \u043C\u043E\u0434\u0435\u043B\u044C",
    "\u91CD\u65B0\u8BAD\u7EC3\u6A21\u578B"
  ],
  "Historical bootstrap status": [
    "Historical bootstrap status",
    "Status des History-Imports",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u0438",
    "Estado da importa\xE7\xE3o do hist\xF3rico",
    "Status geschiedenisimport",
    "\xC9tat de l\u2019importation historique",
    "Stato dell\u2019importazione dello storico",
    "Estado de importaci\xF3n del historial",
    "Status importu historii",
    "\u0421\u0442\u0430\u043D \u0456\u043C\u043F\u043E\u0440\u0442\u0443 \u0456\u0441\u0442\u043E\u0440\u0456\u0457",
    "\u5386\u53F2\u5BFC\u5165\u72B6\u6001"
  ],
  "Current anomaly assessment": [
    "Current anomaly assessment",
    "Aktuelle Anomaliebewertung",
    "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438",
    "Avalia\xE7\xE3o atual de anomalia",
    "Huidige anomaliebeoordeling",
    "\xC9valuation actuelle de l\u2019anomalie",
    "Valutazione attuale dell\u2019anomalia",
    "Evaluaci\xF3n actual de anomal\xEDa",
    "Bie\u017C\u0105ca ocena anomalii",
    "\u041F\u043E\u0442\u043E\u0447\u043D\u0435 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u0457",
    "\u5F53\u524D\u5F02\u5E38\u8BC4\u4F30"
  ],
  "Evaluation details": [
    "Evaluation details",
    "Auswertungsdetails",
    "\u0414\u0435\u0442\u0430\u043B\u0438 \u043E\u0446\u0435\u043D\u043A\u0438",
    "Detalhes da avalia\xE7\xE3o",
    "Evaluatiedetails",
    "D\xE9tails de l\u2019\xE9valuation",
    "Dettagli della valutazione",
    "Detalles de evaluaci\xF3n",
    "Szczeg\xF3\u0142y oceny",
    "\u0414\u0435\u0442\u0430\u043B\u0456 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F",
    "\u8BC4\u4F30\u8BE6\u60C5"
  ],
  "Detector scores": [
    "Detector scores",
    "Detektorwerte",
    "\u041E\u0446\u0435\u043D\u043A\u0438 \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440\u043E\u0432",
    "Pontua\xE7\xF5es dos detetores",
    "Detectorscores",
    "Scores des d\xE9tecteurs",
    "Punteggi dei rilevatori",
    "Puntuaciones de detectores",
    "Wyniki detektor\xF3w",
    "\u041E\u0446\u0456\u043D\u043A\u0438 \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440\u0456\u0432",
    "\u68C0\u6D4B\u5668\u8BC4\u5206"
  ],
  "Anomaly active": [
    "Anomaly active",
    "Anomalie aktiv",
    "\u0410\u043D\u043E\u043C\u0430\u043B\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0430",
    "Anomalia ativa",
    "Anomalie actief",
    "Anomalie active",
    "Anomalia attiva",
    "Anomal\xEDa activa",
    "Anomalia aktywna",
    "\u0410\u043D\u043E\u043C\u0430\u043B\u0456\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0430",
    "\u5F02\u5E38\u6D3B\u52A8"
  ],
  "Overall anomaly score": [
    "Overall anomaly score",
    "Gesamter Anomalie-Score",
    "\u041E\u0431\u0449\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438",
    "Pontua\xE7\xE3o geral de anomalia",
    "Totale anomaliescore",
    "Score global d\u2019anomalie",
    "Punteggio complessivo anomalia",
    "Puntuaci\xF3n global de anomal\xEDa",
    "\u0141\u0105czny wynik anomalii",
    "\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u043E\u0446\u0456\u043D\u043A\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0456\u0457",
    "\u603B\u5F02\u5E38\u8BC4\u5206"
  ],
  Severity: [
    "Severity",
    "Schweregrad",
    "\u0421\u0435\u0440\u044C\u0451\u0437\u043D\u043E\u0441\u0442\u044C",
    "Gravidade",
    "Ernst",
    "Gravit\xE9",
    "Gravit\xE0",
    "Gravedad",
    "Waga",
    "\u0421\u0435\u0440\u0439\u043E\u0437\u043D\u0456\u0441\u0442\u044C",
    "\u4E25\u91CD\u7A0B\u5EA6"
  ],
  "Reason code": [
    "Reason code",
    "Grundcode",
    "\u041A\u043E\u0434 \u043F\u0440\u0438\u0447\u0438\u043D\u044B",
    "C\xF3digo do motivo",
    "Redencode",
    "Code du motif",
    "Codice motivo",
    "C\xF3digo del motivo",
    "Kod przyczyny",
    "\u041A\u043E\u0434 \u043F\u0440\u0438\u0447\u0438\u043D\u0438",
    "\u539F\u56E0\u4EE3\u7801"
  ],
  "Human-readable reason": [
    "Human-readable reason",
    "Lesbare Begr\xFCndung",
    "\u041F\u043E\u043D\u044F\u0442\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u044B",
    "Motivo leg\xEDvel",
    "Leesbare reden",
    "Motif compr\xE9hensible",
    "Motivo leggibile",
    "Motivo legible",
    "Czytelne uzasadnienie",
    "\u0417\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F",
    "\u53EF\u8BFB\u539F\u56E0"
  ],
  "Anomaly since": [
    "Anomaly since",
    "Anomalie seit",
    "\u0410\u043D\u043E\u043C\u0430\u043B\u0438\u044F \u0441",
    "Anomalia desde",
    "Anomalie sinds",
    "Anomalie depuis",
    "Anomalia da",
    "Anomal\xEDa desde",
    "Anomalia od",
    "\u0410\u043D\u043E\u043C\u0430\u043B\u0456\u044F \u0437",
    "\u5F02\u5E38\u5F00\u59CB\u65F6\u95F4"
  ],
  "Last normal evaluation": [
    "Last normal evaluation",
    "Letzte normale Auswertung",
    "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430",
    "\xDAltima avalia\xE7\xE3o normal",
    "Laatste normale evaluatie",
    "Derni\xE8re \xE9valuation normale",
    "Ultima valutazione normale",
    "\xDAltima evaluaci\xF3n normal",
    "Ostatnia prawid\u0142owa ocena",
    "\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0435 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F",
    "\u6700\u8FD1\u6B63\u5E38\u8BC4\u4F30"
  ],
  "Evaluation status": [
    "Evaluation status",
    "Auswertungsstatus",
    "\u0421\u0442\u0430\u0442\u0443\u0441 \u043E\u0446\u0435\u043D\u043A\u0438",
    "Estado da avalia\xE7\xE3o",
    "Evaluatiestatus",
    "\xC9tat de l\u2019\xE9valuation",
    "Stato della valutazione",
    "Estado de evaluaci\xF3n",
    "Status oceny",
    "\u0421\u0442\u0430\u043D \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F",
    "\u8BC4\u4F30\u72B6\u6001"
  ],
  "Current value": [
    "Current value",
    "Aktueller Wert",
    "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435",
    "Valor atual",
    "Huidige waarde",
    "Valeur actuelle",
    "Valore attuale",
    "Valor actual",
    "Bie\u017C\u0105ca warto\u015B\u0107",
    "\u041F\u043E\u0442\u043E\u0447\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F",
    "\u5F53\u524D\u503C"
  ],
  "Expected range lower bound": [
    "Expected range lower bound",
    "Untere Grenze des Erwartungsbereichs",
    "\u041D\u0438\u0436\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430",
    "Limite inferior do intervalo esperado",
    "Ondergrens verwacht bereik",
    "Borne basse de la plage attendue",
    "Limite inferiore dell\u2019intervallo previsto",
    "L\xEDmite inferior del intervalo esperado",
    "Dolna granica oczekiwanego zakresu",
    "\u041D\u0438\u0436\u043D\u044F \u043C\u0435\u0436\u0430 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0433\u043E \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D\u0443",
    "\u9884\u671F\u8303\u56F4\u4E0B\u9650"
  ],
  "Expected range upper bound": [
    "Expected range upper bound",
    "Obere Grenze des Erwartungsbereichs",
    "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430",
    "Limite superior do intervalo esperado",
    "Bovengrens verwacht bereik",
    "Borne haute de la plage attendue",
    "Limite superiore dell\u2019intervallo previsto",
    "L\xEDmite superior del intervalo esperado",
    "G\xF3rna granica oczekiwanego zakresu",
    "\u0412\u0435\u0440\u0445\u043D\u044F \u043C\u0435\u0436\u0430 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043E\u0433\u043E \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D\u0443",
    "\u9884\u671F\u8303\u56F4\u4E0A\u9650"
  ],
  "Decision range lower bound": [
    "Decision range lower bound",
    "Untere Grenze des Entscheidungsbereichs",
    "\u041D\u0438\u0436\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0440\u0435\u0448\u0435\u043D\u0438\u044F",
    "Limite inferior do intervalo de decis\xE3o",
    "Ondergrens beslisbereik",
    "Borne basse de la plage de d\xE9cision",
    "Limite inferiore dell\u2019intervallo decisionale",
    "L\xEDmite inferior del intervalo de decisi\xF3n",
    "Dolna granica zakresu decyzyjnego",
    "\u041D\u0438\u0436\u043D\u044F \u043C\u0435\u0436\u0430 \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D\u0443 \u0440\u0456\u0448\u0435\u043D\u043D\u044F",
    "\u5224\u5B9A\u8303\u56F4\u4E0B\u9650"
  ],
  "Decision range upper bound": [
    "Decision range upper bound",
    "Obere Grenze des Entscheidungsbereichs",
    "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0440\u0435\u0448\u0435\u043D\u0438\u044F",
    "Limite superior do intervalo de decis\xE3o",
    "Bovengrens beslisbereik",
    "Borne haute de la plage de d\xE9cision",
    "Limite superiore dell\u2019intervallo decisionale",
    "L\xEDmite superior del intervalo de decisi\xF3n",
    "G\xF3rna granica zakresu decyzyjnego",
    "\u0412\u0435\u0440\u0445\u043D\u044F \u043C\u0435\u0436\u0430 \u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D\u0443 \u0440\u0456\u0448\u0435\u043D\u043D\u044F",
    "\u5224\u5B9A\u8303\u56F4\u4E0A\u9650"
  ],
  "Baseline type": [
    "Baseline type",
    "Baseline-Typ",
    "\u0422\u0438\u043F \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Tipo de linha de base",
    "Basistype",
    "Type de r\xE9f\xE9rence",
    "Tipo di baseline",
    "Tipo de referencia",
    "Typ bazy",
    "\u0422\u0438\u043F \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u57FA\u7EBF\u7C7B\u578B"
  ],
  "Baseline samples": [
    "Baseline samples",
    "Baseline-Messwerte",
    "\u0418\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
    "Amostras da linha de base",
    "Basismetingen",
    "\xC9chantillons de r\xE9f\xE9rence",
    "Campioni baseline",
    "Muestras de referencia",
    "Pr\xF3bki bazy",
    "\u0412\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F \u0431\u0430\u0437\u043E\u0432\u043E\u0457 \u043B\u0456\u043D\u0456\u0457",
    "\u57FA\u7EBF\u6837\u672C"
  ],
  "Used context": [
    "Used context",
    "Verwendeter Kontext",
    "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442",
    "Contexto utilizado",
    "Gebruikte context",
    "Contexte utilis\xE9",
    "Contesto utilizzato",
    "Contexto utilizado",
    "U\u017Cyty kontekst",
    "\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u0438\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442",
    "\u4F7F\u7528\u7684\u4E0A\u4E0B\u6587"
  ],
  "Time bucket": [
    "Time bucket",
    "Zeitbereich",
    "\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    "Intervalo de tempo",
    "Tijdvak",
    "Plage horaire",
    "Fascia oraria",
    "Franja horaria",
    "Przedzia\u0142 czasu",
    "\u0427\u0430\u0441\u043E\u0432\u0438\u0439 \u0456\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    "\u65F6\u95F4\u6BB5"
  ],
  "Last evaluation": [
    "Last evaluation",
    "Letzte Auswertung",
    "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043E\u0446\u0435\u043D\u043A\u0430",
    "\xDAltima avalia\xE7\xE3o",
    "Laatste evaluatie",
    "Derni\xE8re \xE9valuation",
    "Ultima valutazione",
    "\xDAltima evaluaci\xF3n",
    "Ostatnia ocena",
    "\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u0446\u0456\u043D\u044E\u0432\u0430\u043D\u043D\u044F",
    "\u4E0A\u6B21\u8BC4\u4F30"
  ],
  "Active detectors": [
    "Active detectors",
    "Aktive Detektoren",
    "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440\u044B",
    "Detetores ativos",
    "Actieve detectoren",
    "D\xE9tecteurs actifs",
    "Rilevatori attivi",
    "Detectores activos",
    "Aktywne detektory",
    "\u0410\u043A\u0442\u0438\u0432\u043D\u0456 \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440\u0438",
    "\u6D3B\u52A8\u68C0\u6D4B\u5668"
  ],
  "Value deviation score": [
    "Value deviation score",
    "Wertabweichungs-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F",
    "Pontua\xE7\xE3o de desvio do valor",
    "Score voor waardeafwijking",
    "Score d\u2019\xE9cart de valeur",
    "Punteggio deviazione valore",
    "Puntuaci\xF3n de desviaci\xF3n del valor",
    "Wynik odchylenia warto\u015Bci",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0432\u0456\u0434\u0445\u0438\u043B\u0435\u043D\u043D\u044F \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F",
    "\u6570\u503C\u504F\u5DEE\u8BC4\u5206"
  ],
  "Rate-of-change score": [
    "Rate-of-change score",
    "\xC4nderungsraten-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
    "Pontua\xE7\xE3o da taxa de varia\xE7\xE3o",
    "Veranderingssnelheidsscore",
    "Score du taux de variation",
    "Punteggio velocit\xE0 di variazione",
    "Puntuaci\xF3n de tasa de cambio",
    "Wynik szybko\u015Bci zmian",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0448\u0432\u0438\u0434\u043A\u043E\u0441\u0442\u0456 \u0437\u043C\u0456\u043D\u0438",
    "\u53D8\u5316\u7387\u8BC4\u5206"
  ],
  "Stuck-state score": [
    "Stuck-state score",
    "Festh\xE4ngend-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0437\u0430\u0441\u0442\u0440\u044F\u0432\u0448\u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F",
    "Pontua\xE7\xE3o de estado bloqueado",
    "Vastgelopen statusscore",
    "Score d\u2019\xE9tat bloqu\xE9",
    "Punteggio stato bloccato",
    "Puntuaci\xF3n de estado atascado",
    "Wynik zablokowanego stanu",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0437\u0430\u0432\u0438\u0441\u043B\u043E\u0433\u043E \u0441\u0442\u0430\u043D\u0443",
    "\u5361\u6EDE\u72B6\u6001\u8BC4\u5206"
  ],
  "Level-shift score": [
    "Level-shift score",
    "Pegelverschiebungs-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0443\u0440\u043E\u0432\u043D\u044F",
    "Pontua\xE7\xE3o de mudan\xE7a de n\xEDvel",
    "Niveauverschuivingsscore",
    "Score de d\xE9calage de niveau",
    "Punteggio spostamento livello",
    "Puntuaci\xF3n de cambio de nivel",
    "Wynik zmiany poziomu",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0437\u043C\u0456\u0449\u0435\u043D\u043D\u044F \u0440\u0456\u0432\u043D\u044F",
    "\u6C34\u5E73\u504F\u79FB\u8BC4\u5206"
  ],
  "Trend score": [
    "Trend score",
    "Trend-Score",
    "\u041E\u0446\u0435\u043D\u043A\u0430 \u0442\u0440\u0435\u043D\u0434\u0430",
    "Pontua\xE7\xE3o da tend\xEAncia",
    "Trendscore",
    "Score de tendance",
    "Punteggio tendenza",
    "Puntuaci\xF3n de tendencia",
    "Wynik trendu",
    "\u041E\u0446\u0456\u043D\u043A\u0430 \u0442\u0440\u0435\u043D\u0434\u0443",
    "\u8D8B\u52BF\u8BC4\u5206"
  ]
};
function objectName(name) {
  const translations = names[name];
  return Object.fromEntries(
    languages.map((language, index) => [language, translations[index]])
  );
}
function getObjectNameTranslations() {
  return names;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getObjectNameTranslations,
  objectName
});
//# sourceMappingURL=object-names.js.map
