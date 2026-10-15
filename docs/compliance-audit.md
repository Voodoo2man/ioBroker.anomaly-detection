# ioBroker- und Funktionsaudit

Stand: 15. Oktober 2026. Geprüfter Ausgangsstand: Branch `fix/iobroker-compliance-audit`, Commit `282151121e4a8e3946bbe58a03572c3ed878898d` (Version 0.4.5). Dieser Bericht beschreibt die anschließenden Korrekturen im Arbeitsstand.

## Vorgehen und Regelgrundlage

Vier GPT-6-Luna-Agenten mit hoher Denktiefe prüften getrennt Prognosen, Anomalieerkennung, Laufzeitverhalten und Admin/Packaging. Der Lead überprüfte Befunde, begrenzte die Änderungen, ergänzte echte ioBroker-Integrationstests und beauftragte unabhängige Nachprüfungen. Zusätzliche Fehler aus diesen Nachprüfungen wurden vor dem abschließenden Testlauf korrigiert.

Regelgrundlage ist die offizielle [Adapterentwicklung](https://www.iobroker.com/docs/dev/adapterdev.md) einschließlich der verlinkten [Best Practices](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/bestpractices.md), [Adapterreferenz](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md), [Metadaten](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/iopackage.md), [Rollen](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md), [JSON-Konfiguration](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterjsonconfig.md), [Tests](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adaptertesting.md) und [Veröffentlichung](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterpublish.md). Die Website war über den Cloud-Proxy gesperrt; die Dokumente wurden aus dem offiziellen Repository `ioBroker/ioBroker.docs` gelesen.

## Behobene Befunde

| Bereich | Fehler und Auswirkung | Korrektur und Nachweis |
| --- | --- | --- |
| Bestätigte Messwerte | Beim Start und nach Retraining konnten gespeicherte `ack:false`-Sollwerte als Messung ausgewertet werden. | Alle Lernpfade akzeptieren nur `ack:true`. Nach Reset wird eine fehlende/unbestätigte Messung als nicht verfügbar veröffentlicht; alte Alarme bleiben nicht stehen. Echte ioBroker-Tests prüfen beide Pfade. |
| Kontextbezogene Änderungsraten | Reife Wertkontexte teilten sich eine kontextübergreifende Ratenbasis. Dadurch konnte eine normale Rate des zweiten Betriebszustands als Ausreißer erscheinen. | Eigene begrenzte Ratenmodelle je Kontext; Tests prüfen deren Lernphase, normale Rate und echten Ausreißer. |
| Kontextpersistenz | Nur globale Detektorzustände wurden gespeichert. Kontextbezogene Alarmdauer und fortgeschrittene Detektorfenster gingen beim Neustart verloren. | Begrenzte Zustände und aktiver Kontext werden optional mitgespeichert; ältere globale Felder bleiben kompatibel. Ein echter Kontextwechsel setzt die Alarmdauer weiterhin zurück und zählt inaktive Zeit nicht mit. |
| Beschädigte Modelle | Gültiges JSON mit beschädigten verschachtelten Arrays konnte die Initialisierung abbrechen. | Strukturprüfung verwirft den betroffenen Datensatz und erhält gültige Geschwistermodelle. |
| Numerische Stabilität | Der Median zweier gleicher, sehr großer endlicher Werte konnte zu Infinity überlaufen. | Überlaufsichere Mittelpunktberechnung, einschließlich unterschiedlicher Vorzeichen. |
| Trend-Backtest | Der Trend wurde mit dem absoluten Holdout-Index statt mit dem Abstand zum Trainingsende fortgeschrieben. | Backtest und Prognose verwenden denselben Bezug zum Trainingsende. Eine lineare Folge 0…29 prognostiziert den ersten Holdout-Wert 24 statt 37,5. |
| Prognosezeit | Trend und saisonale Phase wurden bei späterem Forecast-Aufruf nicht um die seit dem letzten Trainingswert vergangene Zeit verschoben. | Zeitfortschreibung einschließlich gebrochener Modellintervalle und interpolierter zyklischer Phasen; Tests prüfen ganze und halbe Schritte. |
| Tageszeit-Backtest | Ein willkürlicher halber Offset aus dem ersten Trainingswert verschob alle Holdout-Prognosen und verzerrte die Modellauswahl. | Der Backtest bewertet wie die Basisprognose das reine Trainingsprofil. Ein handprüfbarer Fall prognostiziert 25 statt 62,5; der aktuelle Live-Anker bleibt davon getrennt. |
| Persistierte Lernbasis | Ein noch nicht trainierter Live-Snapshot mit ausreichend Punkten konnte als fertiges Nullmodell behandelt werden und weiteres Training blockieren. | Der Lernmarker verhindert diese Fehlklassifikation; restaurierte Daten können unmittelbar trainiert werden. |
| Trend am Nulldurchgang | Eine ausschließlich vom letzten Modelllevel abhängige Trendbegrenzung unterdrückte gültige Trends bei Level null. | Die Begrenzung berücksichtigt die Trainingsstreuung; Regressionen prüfen lineare Verläufe am Nulldurchgang. |
| Prognosehorizont | Aufgerundete Modellschritte konnten außerhalb des angeforderten Horizonts liegen. | Der letzte Prognosepunkt wird auf den Horizont begrenzt, auch bei gröberem Modellintervall. |
| Trainingszählung | Wiederholungen desselben Live-Zeitstempels konnten den Frischezähler für erneutes Training erhöhen. | Nur neue Zeitpunkte zählen als neue Trainingsbeobachtungen; veraltete Werte ersetzen keinen neueren Live-Anker. |
| History-Lücken | Interpolation konnte eine künstliche Rampe durch eine lange Datenlücke erzeugen. | Prognosetraining verwendet bei großen Lücken den jüngsten zusammenhängenden Abschnitt; unzureichende neue Daten werden nicht als ausreichendes Training ausgegeben. |
| Saubere Installation | Die Admin-Lockdatei enthielt zehn optionale lightningcss-Plattformpakete nicht vollständig. `npm ci` brach ab. | Vollständige Registry-Metadaten und Integritätswerte ergänzt; keine Versionsänderung oder Abschaltung der Prüfung. |
| Dokumentationsmetadaten | Die vorhandenen englischen und deutschen Anleitungen waren nicht unter `common.docs` verzeichnet. | Beide README-Dateien werden als Sprachziele in den Paketmetadaten referenziert. |
| Admin-Anfragen | Abgelehnte Diagrammanfragen wurden nicht abgefangen; ältere Antworten konnten einen neu gewählten Zeitraum überschreiben. | Aktuelle Anfragen haben Lade-/Fehlerzustand und Wiederholung; veraltete Erfolge und Fehler werden verworfen. Cache und Antworten sind an die Quellenidentität gebunden. |
| Übersetzungen | Prognose-Zeitachsen verwendeten feste englische Einheiten. | Vorhandene übersetzte Zeitformate werden verwendet und getestet; neue Lade-/Fehlertexte liegen in allen elf Sprachen vor. |

Die Prognoseformeln ändern die Bedeutung gespeicherter Koeffizienten. Deshalb steigt `PREDICTIVE_ALGORITHM_VERSION` auf 8; alte Modelle werden anhand der konfigurierten History-Quelle oder neuer Live-Werte neu aufgebaut.

## Compliance-Prüfbereiche

| Anforderung | Prüfung |
| --- | --- |
| Adapterstruktur, Paketname, MIT-Lizenz, Autor, Kategorie, lokale Push-Datenquelle | Manifest-, Paket- und Schema-Prüfungen; Quellcodeprüfung. |
| Kommunikation über adapter-core, keine direkte Produktions-Datenbank | Laufzeitcode verwendet `@iobroker/adapter-core`; Datenbankzugriffe im Integrationstest gehören zum isolierten Test-Harness. |
| Rollen, Typen, Einheiten, Lese-/Schreibrechte, Elternobjekte und Übersetzungen | Objektdefinitionen, Schema- und vorhandene Strukturtests; Unit-Tests für übersetzte Objektnamen. |
| Ressourcen, Timer und Shutdown | Begrenzte Modelle/History-Budgets, serialisierte Schreibvorgänge, Abbruch laufender History-Anfragen, Drain laufender Aufgaben und Persistenz beim Shutdown; vorhandene Grenzfalltests und echte Prozesse. |
| `ack`-Semantik | Start, Live-Ereignisse und Retraining werden mit echten Datenbanken geprüft. |
| Konfiguration und Admin | JSON-Schema, Übersetzungsabdeckung, Typprüfung, Produktionsbuild und asynchrone Anfrage-Regressionen. |
| Veröffentlichungsartefakte | `npm pack --dry-run` prüft die Aufnahme von kompiliertem Adapter, Admin-Federation, dynamischen Assets, Konfiguration und Übersetzungen. |
| npm-Mitverantwortung | Öffentliche Registry-Metadaten führen `bluefox` und `voodoo2man` als Maintainer. |
| CI | Workflow enthält Paket-/Integrationstests sowie Node 22/24/26 auf Linux, Windows und macOS. Eine Konfiguration ist kein Beleg für die Ausführung aller Matrix-Kombinationen in diesem Audit. |

## Grenzen der Aussage

Ein bestandener Testlauf belegt die geprüften Fälle, keine allgemeine mathematische oder betriebliche Fehlerfreiheit. Anomaliescores bleiben statistische Heuristiken. Repräsentative Trainingsdaten, passende Detektoreinstellungen und die Beurteilung durch Anwender bleiben erforderlich.

Der offizielle Repository-Checker 5.23.0 wurde im dokumentierten lokalen Modus aufgerufen, konnte wegen einer Proxy-Sperre für `api.github.com` aber nicht initialisieren. Seine Zusammenfassung ist kein bestandener Check. `api.github.com` und `www.iobroker.com` wurden dem Cloud-Konfigurationsentwurf hinzugefügt; dessen Speicherung allein aktiviert die Freigaben nicht. Nach Aktivierung muss der Checker erneut ausgeführt werden.

Die Headless-Prüfungen ersetzen keinen manuellen Test des eingebetteten Admin-Tabs in einem realen Browser und keine Langzeitmessung mit echten Sensoren/History-Providern. Große Federation-Fallback-Assets bleiben eine Paketgrößenfrage; sie wurden ohne belegte Host-Kompatibilität nicht entfernt. GitHub- und npm-Veröffentlichung sind nicht Bestandteil der lokalen Prüfung.

## Abschließende Validierung

Die abschließenden Prüfungen wurden nach den Korrekturen ausgeführt. Frühere, absichtlich fehlschlagende Regressionen und der zunächst falsche Integrationstest-Zähler sind in diesen Ergebnissen nicht als Erfolg enthalten.

| Prüfung | Ergebnis |
| --- | --- |
| Saubere Installation | `npm ci` im Root und in `src-admin` erfolgreich; die korrigierten Lock-Einträge stimmen mit Registry-URLs und Integritätswerten überein. |
| `npm test`, Node 24.19.0 | 156 TypeScript-Tests, 8 Admin-Tests und 67 Pakettests bestanden. |
| Pakettests nach Ergänzung von `common.docs` | 67 bestanden. |
| `npm run check` | Bestanden. |
| Admin-Typecheck | Bestanden. |
| `npm run lint` | Keine Fehler; 130 bereits vorhandene JSDoc-Warnungen. Die Änderungen erhöhen deren Zahl nicht. |
| `npm run build:full` | Admin-Produktionsbuild und Adapterbuild einschließlich Typprüfung bestanden; versionierte Artefakte aktualisiert. Vite meldet große Federation-Fallback-Chunks. |
| Echte Integration, Node 24.19.0 | 5 Tests bestanden: Standardstart; Start mit unbestätigtem Sollwert; Lernen/Forecast/Ausreißer/Shutdown-Persistenz; Wiederherstellung in einem neuen Prozess; Retraining mit unbestätigtem Sollwert. Keine Adapter-Fehlerlogs in den Funktionsfällen. |
| Integrationstest-Controller | `8.0.0-alpha.6-20261013-09c6db0d1`, vom vorhandenen Test-Harness über den `dev`-Tag gewählt. Ältere Controller-Versionen wurden nicht separat ausgeführt. |
| Node 22.23.3 | Dieselben 156 TypeScript- und 8 Admin-Tests bestanden. |
| Admin-Host-Kompatibilität | Veröffentlichte offizielle Manifest-Dateien von Admin 8.0.1 (erste stabile 8er-Version), 8.0.5, 8.0.14 und 8.2.0 geprüft: React 19 und MUI 9 vorhanden; die Mindestversion bleibt unverändert. `json-config` wird vom eigenen Dashboard nicht direkt importiert. |
| Vollständige Betriebssystem-/Node-Matrix | In diesem Audit nicht ausgeführt; Windows, macOS und Node 26 sind im vorhandenen CI konfiguriert. |
| Online-Repository-Checker | Durch Proxy-Sperre für `api.github.com` blockiert; kein bestandenes Ergebnis behauptet. |
| `git diff --check` | Bestanden. |

Die Cloud-Konfiguration enthält das reproduzierbare `install_script`, ein `start_skill` mit Arbeitsverzeichnissen und Bereitschaftsprüfungen sowie die ergänzten Netzwerkziele. Diese Felder sind als Entwurf gespeichert. Veröffentlichung der Umgebung und Prüfung einer frisch daraus wiederhergestellten Aufgabe stehen aus. Für normale Entwicklung werden keine externen Zugangsdaten benötigt.
