<img src="admin/anomaly-detection.png" alt="Logo" width="400">

# ioBroker.anomaly-detection

[![NPM-Version](https://img.shields.io/npm/v/iobroker.anomaly-detection.svg)](https://www.npmjs.com/package/iobroker.anomaly-detection)

[English](README.md) · **Deutsch**

Der Adapter lernt das normale Verhalten ausgewählter numerischer ioBroker-Zustände und meldet statistisch ungewöhnliche Werte lokal.

> **Es wird keine KI verwendet.** Der Adapter nutzt weder Cloud-Dienste noch externe KI- oder Machine-Learning-APIs. Alle Bewertungen werden lokal mit deterministischen mathematischen und statistischen Verfahren berechnet, unter anderem Median, Median Absolute Deviation (MAD), Zeitbereichs-Baselines und robuste Steigungen. Bei gleichen Eingangsdaten und Einstellungen sind die Ergebnisse nachvollziehbar und reproduzierbar.

## Funktionsweise

Starre Grenzwerte können zeit- oder betriebsabhängiges Verhalten nicht abbilden: 8 kW können morgens normal, an einem warmen Sonntag aber ungewöhnlich sein. Für jeden konfigurierten numerischen Zustand verwaltet der Adapter begrenzte, robuste Baselines. Jede eingehende Zustandsänderung wird ausgewertet; die Quellzustände werden nicht abgefragt (kein Polling).

Der Adapter kombiniert folgende deterministische Detektoren:

- **Wertabweichungen (MAD):** Erkennt Werte außerhalb des gelernten Normalbereichs, ohne dass ein einzelner Extremwert die Baseline stark verzerrt.
- **Änderungsrate:** Bewertet `Delta / vergangene Zeit` und berücksichtigt dadurch unregelmäßige Update-Abstände.
- **Festhängende Werte:** Erkennt wiederholt empfangene identische Werte, die länger als die konfigurierte Dauer anhalten. Ein fehlendes Update allein gilt niemals als festhängend.
- **Tageszeit-Kontext:** Verwendet standardmäßig Stundenbereiche und kann zusätzlich nach Wochentagen getrennt werden. Bei zu wenigen Daten greift die Hierarchie auf den Zeitbereich und anschließend auf die globale Baseline zurück.

`score` ist ein deterministischer Schweregrad von 0 bis 100. Er ist weder eine statistische Wahrscheinlichkeit noch eine Diagnose der physischen Ursache.

| Score | Bedeutung |
| --- | --- |
| 0–49 | normal |
| 50–69 | ungewöhnlich |
| 70–84 | Anomalie |
| 85–100 | starke Anomalie |

## Mathematische Grundlagen

Der Adapter verwendet begrenzte, robuste Statistik. Er trainiert kein neuronales Netz, ruft keinen KI-Dienst auf und setzt keine konstanten Messintervalle voraus.

### Wertabweichungen: Median und MAD

Für eine gelernte Baseline mit Werten `x₁ … xₙ` ist der erwartete Wert der Median `m = median(x₁ … xₙ)`. Die Streuung wird mit der Median Absolute Deviation berechnet:

`MAD = median(|xᵢ − m|)`

Für einen neuen Wert `x` ergibt sich der robuste z-Score:

`robuster z-Score = 0,6745 × |x − m| / MAD`

Die Option **Sensitivität** legt fest, bei welchem z-Score dieser Detektor den Wert 100 erreicht. Median und MAD werden von einzelnen Ausreißern deutlich weniger verzerrt als Mittelwert und Standardabweichung. Bei `MAD = 0` ist ein unveränderter Wert normal; ein anderer Wert gilt als starke Abweichung.

### Änderungsrate

Für zwei aufeinanderfolgende Werte wird das tatsächliche Zeitintervall verwendet:

`Rate = (aktueller Wert − vorheriger Wert) / vergangene Sekunden`

Die Rate-Baseline wird mit derselben Median/MAD-Methode gelernt. So kann eine ungewöhnlich schnelle Änderung erkannt werden, auch wenn der absolute Endwert noch plausibel ist.

### Festhängende Werte

Dieser Detektor ist regelbasiert. Werden identische Werte wiederholt empfangen, merkt sich der Adapter den ersten Zeitpunkt `t₀`. Ein Treffer ist erst möglich, wenn gilt:

`aktueller Zeitpunkt − t₀ ≥ konfigurierte Dauer`

Ein fehlendes Update zählt nicht als wiederholter Wert und kann daher keine Festhängend-Anomalie auslösen.

### Tageszeit- und Wochentags-Kontext

Zeitbereiche werden aus der lokalen Tageszeit gebildet:

`Zeitbereich = floor(Minuten seit Mitternacht / Bucket-Größe)`

Mit aktivierter Wochentagsoption wird der Wochentag in den Schlüssel aufgenommen. Eine Baseline wird nur verwendet, wenn sie mindestens **Mindestanzahl gelernter Messwerte** enthält. Die Fallback-Reihenfolge lautet:

`Wochentag + Zeitbereich → Zeitbereich → globale Baseline`

### Kontextabhängige Baseline

Kontextzustände erzeugen zusätzliche Schlüssel, zum Beispiel `pumpe.ein=true`, `modus=eco` oder `temperatur=10–15`. Numerische Kontextwerte werden in feste Intervalle eingeteilt:

`Intervallbeginn = floor(Kontextwert / Bucket-Breite) × Bucket-Breite`

Bei einer Breite von 5 gehört der Wert 12,3 zum Intervall 10–15. Ein Kontext muss mindestens die konfigurierte Mindestanzahl an Messwerten enthalten, bevor er als Baseline verwendet wird. Ein gültiger, aber noch nicht ausgereifter Kontext bleibt im Status `learning` und wird nicht mit einer fremden globalen Baseline verglichen. Fehlende oder ungültige Kontextwerte verwenden den normalen Zeit-/Global-Fallback. Kombinationen, Kategorien und Samples sind begrenzt, damit der Speicher nicht unkontrolliert wächst.

### Dauerhafte Pegelverschiebung

Die Auswertung arbeitet mit Residuen:

`Residuum = tatsächlicher Wert − erwarteter Wert`

Der robuste Median eines begrenzten aktuellen Residuenfensters wird mit dem langfristig erwarteten Residuum verglichen und anhand der MAD-Baseline normiert. Eine Verschiebung muss bei mehreren Auswertungen in dieselbe Richtung anhalten; ein einzelner Peak wird dadurch nicht zu einem Change Point.

### Trend

Auch der Trend wird auf Residuen berechnet, damit normale Tagesmuster zuvor abgezogen werden. Für alle gültigen Wertepaarungen wird die Steigung bestimmt:

`Steigungᵢⱼ = (Residuumⱼ − Residuumᵢ) / (Zeitstempelⱼ − Zeitstempelᵢ)`

Die finale Steigung ist der Median dieser Steigungen (robuste Theil-Sen-ähnliche Methode). Isolierte Ausreißer haben dadurch deutlich weniger Einfluss als bei einer gewöhnlichen linearen Regression. Ein Trend benötigt mindestens 12 Messwerte über mindestens sechs Stunden.

### Kombinierter Score und Lernen

Jeder Detektor liefert einen begrenzten Score von 0 bis 100. Wert-/Kontext-, Pegelverschiebungs- und Trendsignale gelten als zusammengehörige Evidenz; nur das stärkste dieser Signale wird gewichtet, damit nichts doppelt gezählt wird. Rate- und Festhängend-Signale können unabhängig beitragen. Mehrere unabhängige starke Signale erzeugen einen kleinen begrenzten Bonus. Der Endwert wird immer auf 0–100 begrenzt.

Messwerte ab **Anomalie-Schwellenwert** werden normalerweise nicht weiter gelernt, damit ein anhaltender Fehler nicht sofort als normal gilt. Bestätigte Pegelverschiebungen sind eine Ausnahme: Ihre Werte werden schrittweise aufgenommen, damit ein legitimes neues Betriebsniveau zur neuen Baseline werden kann.

## Konfiguration

Füge in der Tabelle **Überwachte numerische Zustände** für jede Quelle eine Zeile hinzu. Unterstützt werden nur ioBroker-Zustände mit `common.type: number`.

Die wichtigsten Standardwerte sind bewusst zurückhaltend:

- Vor der Überwachung werden standardmäßig 30 Messwerte gelernt.
- Die Sensitivität beträgt 3,5 robuste z-Scores.
- Die persistente Anomalieanzeige benötigt standardmäßig Score 70 für fünf Minuten.
- Eine Hysterese von 10 Punkten verhindert Flattern an der Schwelle.
- Der Festhängend-Detektor ist standardmäßig deaktiviert und verwendet bei Aktivierung 120 Minuten.
- Der Tageszeitkontext arbeitet standardmäßig mit 60-Minuten-Bereichen; der Wochentagskontext ist optional.

Änderungen werden nach dem Neustart des Adapters wirksam. Doppelte Quell-IDs werden nach der ersten aktivierten Zeile ignoriert. Fehlende konfigurierte Objekte bleiben abonniert, damit sie später automatisch verwendet werden können; beim Start wird eine Warnung protokolliert.

Wird eine Quelle aus der Konfiguration entfernt und der Adapter neu gestartet, löscht er den zugehörigen generierten Teilbaum unter `anomaly-detection.0.sources` sowie das gespeicherte Modell. Dabei wird die ursprüngliche Quell-ID aus den Metadaten des generierten Geräts verwendet. Eine nur vorübergehend nicht verfügbare, weiterhin konfigurierte Quelle bleibt erhalten.

## Analyseansicht und Verlauf

Die Registerkarte **Aktuelle Anomaliebewertungen** enthält pro überwachte Quelle ein responsives, zunächst eingeklapptes Diagramm **Verlauf & Anomalien**. Der Verlauf wird erst beim Öffnen geladen. Zur Auswahl stehen **1 h**, **6 h**, **24 h** (Standard) und **7 Tage**.

Das Diagramm verwendet die Einheit des ioBroker-Zustands, zum Beispiel `W`, `%` oder `°C`, und passt seine Breite an die tatsächliche Kartenbreite an. Es zeigt:

- **Wert:** historische Messwerte aus dem konfigurierten History-Adapter.
- **Erwartungsbereich:** ein transparentes Band ausschließlich aus den zu jedem historischen Zeitpunkt gespeicherten `decisionLow`/`decisionHigh`-Grenzen. Fehlende Grenzen bleiben leer; der aktuelle Bereich wird nicht rückwirkend projiziert.
- **Kontext:** eine dezente Hervorhebung für Zeitabschnitte, deren gespeicherter Kontext zum aktuellen Kontext passt. Wenn vorhanden, werden die ioBroker-`common.name`-Namen angezeigt.
- **Anomalie:** ein rotes Dreieck nur bei historischen Bewertungen mit `detected: true`.

Beim Überfahren oder Berühren eines Punktes werden Wert und Einheit, historischer Erwartungsbereich (oder ein Hinweis, dass er nicht verfügbar ist), Status, übersetzter Grund, Score und Kontext für genau diesen Zeitpunkt angezeigt. Bei Wert-/Kontextabweichungen wird zusätzlich die konkrete Distanz oberhalb oder unterhalb des historischen Bereichs angegeben. Rate, Festhängend, Trend und Pegelverschiebung behalten ihre jeweilige Detektor-Erklärung.

## Lernen und Persistenz

Normale Beobachtungen aktualisieren globale und zeitbasierte Baselines schrittweise. Messwerte ab dem Anomalie-Schwellenwert werden nicht gelernt. Pro Baseline werden höchstens 240 Samples und kompakte Modelldaten gespeichert; eine unbegrenzte Rohdaten-Zeitreihe wird nicht angelegt.

Alle erweiterten Detektoren sind standardmäßig deaktiviert. Kontextabhängige Erkennung kann bis zu drei boolesche, Text-/Enum- oder numerisch gebucketete Zustände getrennt lernen. Eine gültige, aber noch zu kleine Kontext-Baseline bleibt im Lernstatus. Pegelverschiebung benötigt wiederholte Evidenz; Trend benötigt mindestens 12 Residuen über sechs Stunden.

Der Adapter erkennt statistische Ungewöhnlichkeit, diagnostiziert aber keinen Gerätefehler und beweist keine Ursache. Ein History-Import trainiert nur globale, Zeit-, Wochentags- und Rate-Modelle. Kontextbaselines lernen aus Live-Werten, weil allgemeine History-Adapter beliebige Kontextzustände nicht zuverlässig zeitlich rekonstruieren können.

## Optionen im Überblick

| Option | Zweck und Anwendung | Beispiel |
| --- | --- | --- |
| **Aktiviert** | Startet oder stoppt die Überwachung dieser Zeile. Deaktivierte Zeilen bleiben konfiguriert. | Während einer Wartung deaktivieren. |
| **Quellstatus-ID** | Numerischer ioBroker-Zustand, der bewertet wird. Über den Objekt-Picker auswählen. | `alias.0.pumpe.leistung` |
| **Name** | Lesbarer Name für das generierte Quellgerät; ändert nicht die Quell-ID. | `Gartenpumpe Leistung` |
| **Initiales Training** | Nur Live-Werte lernen oder vorhandene History importieren. | Für einen Power-Meter mit InfluxDB-History: History importieren. |
| **History-Quelle** | Kompatible, aktivierte History-Adapterinstanz für den Import. | `influxdb.0` |
| **Zeitraum des History-Trainings (Tage)** | Wie weit der Import zurückreicht. Nur repräsentative Normalzeiten auswählen. | `30` Tage |
| **Maximal importierte Proben** | Begrenzung des Imports zum Schutz von Speicher und Raspberry Pi. | `1000` |
| **Überwachung nach History-Import starten** | Startet nach ausreichendem Import direkt den Status `monitoring`. | Für eine etablierte Messreihe aktivieren. |
| **Mindestens gelernte Proben** | Mindestgröße einer vertrauenswürdigen Baseline. | `30` für häufige Leistungswerte. |
| **Zeit-Bucket-Größe (Minuten)** | Größe der Tageszeitbereiche. Kleinere Bereiche sind genauer, lernen aber langsamer. | `60` Minuten |
| **Sensitivität (robuster z-Score)** | Niedriger ist empfindlicher, höher toleranter. | Auf `5` erhöhen, wenn normale Schwankungen zu viele Meldungen erzeugen. |
| **Anomalie-Schwellenwert** | Score, ab dem eine Anomalie gespeichert und nicht mehr gelernt wird. | `70` |
| **Mindestdauer einer Anomalie (Minuten)** | Zeit, die die Schwelle überschritten sein muss, bevor `detected` dauerhaft gesetzt wird. | `5` Minuten |
| **Detektor für Wertabweichungen (MAD)** | Erkennt ungewöhnliche absolute Werte gegenüber dem gelernten Bereich. | Für Temperatur, Druck, Verbrauch und Leistung aktivieren. |
| **Detektor für Änderungsrate** | Erkennt ungewöhnlich schnelle Änderungen. | Für Durchfluss oder Füllstand aktivieren; bei normalen Lastsprüngen deaktiviert lassen. |
| **Detektor für festhängende Werte** | Erkennt wiederholt empfangene identische Werte über die konfigurierte Dauer. | Für regelmäßig wechselnde Sensoren aktivieren, nicht für lange konstante Setpoints. |
| **Dauer eines festhängenden Wertes** | Wird nur bei aktiviertem Festhängend-Detektor angezeigt; legt dessen Mindestdauer fest. | `120` Minuten |
| **Tageszeit-Kontext verwenden** | Trennt Baselines nach Tageszeit. | `60`-Minuten-Buckets für Haushaltsverbrauch. |
| **Wochentags-Kontext verwenden** | Trennt zusätzlich nach Wochentag; funktioniert zusammen mit dem Tageszeit-Kontext. | Büroverbrauch werktags gegenüber Wochenende. |
| **Kontextbezogene Erkennung aktivieren** | Lernt abhängig von bis zu drei weiteren Zuständen. | `pumpe.ein`, `modus`, Außentemperatur. |
| **Kontextzustände** | Die Zustände, die den Betriebszustand beschreiben. Boolesche und Enum-Werte benötigen keine Breite; numerische Werte verwenden Buckets. | `pumpe.ein=true`, Temperatur-Breite `5`. |
| **Dauerhafte Erkennung von Pegelverschiebungen** | Erkennt ein anhaltend verändertes Betriebsniveau. | Standby-Leistung dauerhaft von 5 W auf 12 W gestiegen. |
| **Trenderkennung aktivieren** | Erkennt langsame Aufwärts- oder Abwärtsentwicklung über Residuen. | Heizdauer steigt über mehrere Tage. |

### Konfigurationsgrundsätze

1. Beginne mit den Standarddetektoren und aktiviere nur Verfahren, die zum physikalischen Verhalten der überwachten Quelle passen.
2. Aktiviere nicht jeden verfügbaren Detektor nur deshalb, weil er vorhanden ist.
3. Füge Kontextzustände nur hinzu, wenn sie den erwarteten Wert erklären; mehr Kontext bedeutet weniger Trainingsdaten pro Kontext.
4. Starte mit der Standardsensitivität und dem Standardschwellenwert. Erhöhe die Toleranz erst, nachdem legitime Fehlalarme beobachtet wurden.
5. Verwende History-Training nur, wenn der ausgewählte Zeitraum den normalen Betrieb repräsentiert und nicht überwiegend bekannte Fehler- oder Installationsphasen enthält.
6. Eine statistische Anomalie zeigt ein ungewöhnliches Verhalten relativ zu den Lerndaten. Sie beweist weder einen Gerätefehler noch dessen Ursache.

### Einrichtung mit einem KI-Assistenten

Ein KI-Assistent kann anhand dieser README und deines Anwendungsfalls eine erste Konfiguration vorschlagen. Nenne dafür die physikalische Größe, die Bedeutung der Quelle, deren Update-Häufigkeit, relevante ioBroker-Kontextzustände, ob schnelle Änderungen oder lange konstante Phasen normal sind, ob Tages- oder Wochenmuster bestehen, ob dauerhafte Pegelverschiebungen oder langsame Trends relevant sind und ob historische Daten verfügbar sind.

KI-generierte Einstellungen sind nur ein Ausgangspunkt und müssen mit dem tatsächlichen Geräteverhalten abgeglichen werden. Der Adapter selbst bleibt deterministisch und verwendet keine KI.

Beispiel-Prompt:

> Ich möchte den elektrischen Leistungsverbrauch einer Pumpe überwachen. Der Ein-/Aus-Zustand und die Betriebsart der Pumpe sind als zusätzliche ioBroker-Zustände verfügbar. Start- und Stoppvorgänge verursachen schnelle, aber normale Leistungsänderungen. Eine dauerhafte Abweichung von der üblichen Betriebsleistung wäre relevant. Für die letzten 30 Tage liegt History in InfluxDB vor. Empfiehl mir auf Grundlage dieser README passende Einstellungen für anomaly-detection und erkläre jede Auswahl.

### Auswahlhilfe für Detektoren

- **MAD/Wertabweichungen:** Für unerwartete Einzelwerte relativ zum gelernten Normalverhalten.
- **Änderungsrate:** Wenn ungewöhnlich schnelle Änderungen relevant sind; deaktivieren, wenn schnelle Änderungen normal sind.
- **Festhängend:** Für Sensoren, die sich regelmäßig verändern müssen; nicht für Werte, die lange legitim konstant bleiben.
- **Kontextbezogen:** Wenn ein anderer Zustand das erwartete Verhalten erklärt. Boolesche/Enum-Kontexte beschreiben Betriebsart oder Anwesenheit, numerische Kontexte zum Beispiel Außentemperatur, Ladezustand oder Last.
- **Pegelverschiebung:** Für dauerhafte Änderungen des normalen Betriebsniveaus.
- **Trend:** Für langsame Drift oder Verschlechterung; bei stark schwankenden Signalen meist deaktiviert lassen.

### Praxisbeispiel: Pumpenleistung

Für die elektrische Leistung einer Pumpe sind zunächst **Detektor für Wertabweichungen**, **kontextbezogene Erkennung** und **dauerhafte Erkennung von Pegelverschiebungen** sinnvoll. **Detektor für Änderungsrate**, **Detektor für festhängende Werte** und **Trenderkennung** bleiben zunächst deaktiviert, weil normale Start-/Stoppvorgänge schnelle Änderungen verursachen und eine ausgeschaltete Pumpe legitim bei `0 W` stehen kann.

Als Kontext eignen sich der Ein-/Aus-Zustand und die Betriebsart. So entstehen getrennte Normalmodelle für beispielsweise Pumpe AUS, Pumpe EIN im Normalbetrieb und Pumpe EIN im Boost-Modus. Weitere Zustände nur hinzufügen, wenn sie die erwartete Leistung nachweislich erklären; zu viele Kontextzustände verteilen die Samples auf zu viele Kombinationen.

## Optionales History-Training

Für eine Quelle **Vorhandene History importieren** auswählen und danach eine **History-Quelle** aus der Auswahlliste wählen. Die Liste enthält nur vollständige, aktivierte History-Provider wie `influxdb.0`, `history.0` oder `sql.1`, die für genau diesen Zustand aktiviert sind. Wenn keine Quelle angezeigt wird, ist für den Zustand oder sein Alias-Ziel keine kompatible History aktiviert; **Nur Live-Werte lernen** bleibt trotzdem verfügbar.

Standardmäßig werden 30 Tage und höchstens 1.000 Samples importiert. Ungültige Werte und Zeitstempel werden verworfen, doppelte Zeitstempel zusammengeführt und übergroße Ergebnismengen gleichmäßig über den gesamten Zeitraum verteilt. Offensichtliche historische Extremwerte werden vor dem Lernen robust ausgeschlossen. Große Zeitlücken erzeugen niemals eine Festhängend-Anomalie.

Ein importiertes Modell wird nach einem Neustart wiederverwendet. Eine Änderung von History-Quelle, Zeitraum oder Sample-Limit startet einen neuen Import. Bei fehlgeschlagenem oder zu kleinem Import bleibt die Quelle nutzbar und lernt live weiter. Über `sources.<sanitized-source-id>.retrain = true` kann ein Modell ausdrücklich verworfen und neu trainiert werden; der Adapter setzt den Wert anschließend mit `ack=true` auf `false` zurück.

## Erzeugte Objekte

Für jede Quelle legt der Adapter unter folgendem Pfad eine sichere, deterministische Objekt-ID an:

`anomaly-detection.0.sources.<sanitized-source-id>.analysis`

| State | Typ/Rolle | Bedeutung |
| --- | --- | --- |
| `actual` | number / `value` | zuletzt akzeptierter Quellwert |
| `expected` | number / `value` | Median der verwendeten Baseline |
| `deviation` | number / `value` | `actual - expected` |
| `score` | number / `value` | normierter Anomalie-Score 0–100 |
| `detected` | boolean / `indicator` | persistente Anomalieanzeige |
| `status` | string / `info.status` | `insufficientData`, `learning` oder `monitoring` |
| `reason` | string / `text` | deterministische Erklärung der aktuellen Bewertung |
| `lastAnomaly` | string / `date` | Zeitpunkt der letzten hohen Bewertung |
| `sampleCount` | number / `value` | gespeicherte globale Samples, maximal 240 |
| `baselineScope` | string / `info.status` | verwendete Baseline: `context`, `time`, `global` oder `insufficient` |
| `activeContext` | string / `text` | aktueller normalisierter Kontext |
| `baselineSampleCount` | number / `value` | Samples der tatsächlich verwendeten Baseline |
| `contextSampleCount` | number / `value` | Samples im passenden Kontextmodell |
| `bootstrapStatus` | string / `info.status` | Ergebnis des optionalen History-Imports |
| `retrain` | boolean / `button` | `true` schreiben, um Quelle und Modell zurückzusetzen |

Alle vom Adapter geschriebenen Ergebnis-States verwenden `ack=true`. `retrain` ist der einzige Befehls-State und wird nach der Verarbeitung zurückgesetzt.

## Einschränkungen und Datenschutz

Eine Anomalie bedeutet, dass ein Wert oder Verhalten relativ zu den gelernten Beobachtungen ungewöhnlich ist. Sie beweist weder einen Gerätefehler noch dessen Ursache. Ungeeignete Einstellungen, nicht repräsentative Trainingszeiträume oder sich änderndes Anlagenverhalten können Fehlalarme oder übersehene Anomalien verursachen.

Verarbeitung und Modellspeicherung erfolgen vollständig lokal in ioBroker. Kein Messwert wird an einen externen KI-, Analyse- oder Cloud-Dienst gesendet.

## Changelog

### 0.3.0 (2026-09-08)

- Optionale lokale Predictive-Prognosen mit persistenten Modellen und Trainingsbasen ergänzt.
- History-basiertes Initialtraining, Wiederherstellung nach Neustarts, Rolling-Retraining und die Anzeige der Trainingsquelle verbessert.
- Robustes History-Bootstrap mit segmentierten Provider-Abfragen, Coverage-Probes, Deduplizierung und adaptiver Segmentierung ergänzt.
- Erklärbarkeit und Diagnosen der Anomalieerkennung verbessert, einschließlich kontextbezogener Sample-Reichweite und Bewertungsverfügbarkeit.

### 0.2.1 (2026-09-08)

- Aktuelle Anomaliebewertungen, erklärende Details und responsive Verlaufsdiagramme ergänzt.
- `Normal` wird als Grund für niedrige Scores angezeigt.
- Kontext-, Entscheidungsbereich- und History-Daten für die Analyseansicht erweitert.
- Absturz in der Analyseansicht behoben, wenn ein Kontextzustand `null` oder ungültig ist.

### 0.1.1 (2026-09-07)

- Konfigurationsoberfläche, Layout und Übersetzungen verbessert.
- Detektor-Hinweise und kontextabhängige Optionsanzeige ergänzt.

### 0.1.0 (2026-09-06)

- Lokale statistische Anomalieerkennung als MVP.
- Optionales, begrenztes History-Training.
- Auswahl aktivierter History-Quellen pro konfiguriertem Zustand.

## Lizenz

MIT License

Copyright (c) 2026 Voodoo2man <Voodoo2man@outlook.de>
