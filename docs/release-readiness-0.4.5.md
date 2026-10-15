# Release-Reife 0.4.5

Prüfdatum: 15. Oktober 2026. Geprüfter Stand: `8983701098dea46d22d5006a307d059e7293a19d`, Branch `fix/iobroker-compliance-audit`, Version **0.4.5**. Der Remote-Branch entspricht diesem Commit. Kein Commit, Push, Merge, Tag oder Release wurde in diesem Prüfauftrag ausgeführt.

Es wurden keine neuen Fehler im Adaptercode bestätigt und keine Produktionsdateien, Abhängigkeiten, State-IDs oder Modellformate geändert. Dieser Bericht ergänzt die vorherige Funktionsprüfung. Builds und Laufzeitprüfungen fanden in separaten Kopien des geprüften Commits statt; der Original-Checkout wurde dafür nicht umgebaut.

## 1. Bestätigte Sicherheitsbefunde

**GHSA-86w9-cpqp-85rv / CVE-2026-85393 betrifft das installierte `node-forge@1.4.0`.** Bei RSA-PKCS#1-v1.5-Signaturprüfungen werden zusätzliche Elemente innerhalb einer ASN.1-`DigestAlgorithm`-Sequenz nicht streng geprüft. Laut Advisory erlaubt dies gefälschte Signaturen für vom Angreifer gewählte Nachrichten bei RSA-Schlüsseln mit kleinem Exponenten. CVSS 3.1: **7,5 / high**, CVSS 4.0 im CVE-Datensatz: **8,7**. Dies ist ein unvollständiger Fix für CVE-2026-33894.

Betroffen ist `<=1.4.0`. Zum Prüfzeitpunkt nennt die Advisory **keine gepatchte Version**; npm führt weiterhin 1.4.0 als neueste Veröffentlichung. Der referenzierte Upstream-Fix PR #1152 ist offen und nicht gemergt. Ein Major-Upgrade oder Downgrade von Adapter-Core beseitigt diesen Befund daher nicht nachgewiesenermaßen.

| Paket / Aufrufpfad | Tatsächlich geprüfte Verwendung und Erreichbarkeit |
| --- | --- |
| `@iobroker/adapter-core@3.4.3` | Direkte Produktionsabhängigkeit. Der Peer `@iobroker/js-controller-common-db >=7.2.2` löst im Root-Lock auf 7.2.2 auf. Die dynamische Controller-Brücke lädt zusätzlich die Common-Tools des installierten Hosts. Die öffentliche `commonTools`-Allowlist enthält keine Zertifikatshelfer. Dieser Adapter ruft weder Forge noch Zertifikats-/RSA-Verifikations-APIs auf. |
| `@iobroker/js-controller-common-db@7.2.2` / `7.2.5` | Importiert Forge im Tools-Modul. Die untersuchten Helfer parsen PEM-Zertifikate oder erzeugen/signieren selbst ausgestellte Zertifikate; dabei wurde keine betroffene Signaturprüfung gefunden. Die Generierung verwendet Exponent 65537. Öffentlich exportierte Tools und andere Verbraucher des Hosts bleiben separat zu bewerten. |
| `@iobroker/gui-components@10.3.6` | Zieht Common-/Common-DB-Pakete und damit Forge in den Admin-Installationsbaum. Der Adapter verwendet daraus `I18n`. In den 17 ausgelieferten JS-Chunks wurden weder die untersuchten Forge-/Verifier-Marker noch die charakteristischen Fehlermeldungen gefunden. Das ist kein Beweis für sämtliche möglichen dynamischen Host-Abhängigkeiten. |
| `@iobroker/json-config@10.0.7` | Zieht GUI Components und dessen Abhängigkeitsbaum ein; kein eigener RSA-Verifikationsaufruf im Adapter. Die Audit-Klassifizierung als Produktionsabhängigkeit des Admin-Builds beweist allein keine Auslieferung des verwundbaren Verifiers an den Browser. |

Die Auflösung wurde auch in den echten Testinstallationen vom installierten Adapter aus geprüft. Auf Controller **6.0.11** existieren zwei Pfade: ein Adapter-Peer mit Common-DB 7.2.5 sowie die tatsächlich vom Host verwendeten Common-/Common-DB-Tools 6.0.11. Beide führen zu Forge 1.4.0. Auf Controller **7.2.5** sind diese Pfade dedupliziert. Die Controller-Brücke lädt das Tools-Modul und Forge bereits beim Modulimport; Laden allein löst die verwundbare Signaturprüfung nicht aus.

**Bewertung:** Reale verwundbare Produktionsabhängigkeit; im geprüften Adapter wurde kein auslösbarer Verifikationspfad gefunden. Keine generelle Entwarnung für den gesamten ioBroker-Host oder andere Adapter. Es wurde kein Exploit ausgeführt. Ein kontrollierter, geprüfter Patch/Fork wäre eine gesonderte Änderung; ein ungemergter PR wird nicht stillschweigend als behobene Upstream-Version behandelt.

Frisch ausgeführte Audits, jeweils Exit **1**:

| Audit | Ergebnis in Paketmarkierungen |
| --- | --- |
| Root `npm audit` | 4 critical, 15 high, 18 moderate, 1 low; insgesamt 38. |
| Root `npm audit --omit=dev` | 3 high: Forge und zwei abhängige Pakete; dieselbe zugrunde liegende GHSA. |
| Admin vollständig und `--omit=dev` | Je 12 high, 0 critical; dieselbe GHSA über mehrere Vorfahren im Abhängigkeitsbaum. |

Die kritischen Root-Entwicklungsbefunde betreffen unter anderem `form-data`, `proxy-addr`, `request` und `xmldom`. Sie verschwinden im Root-Produktionsaudit, bleiben aber für Entwicklungs-/Build-Umgebungen relevant. Keine Audit-Befunde wurden durch erzwungene Upgrades oder `npm audit fix` unterdrückt.

Quellen: [GitHub Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [CVE-Datensatz](https://www.cve.org/CVERecord?id=CVE-2026-85393), [Upstream-Fix PR #1152](https://github.com/digitalbazaar/forge/pull/1152). Detaillierte Aufrufstellen, npm-Explain-Bäume, Runtime-Auflösung und rohe Audit-/Advisory-Daten: `/workspace/.cloud-onboarding/release-readiness/security/`, insbesondere `report.md` und `runtime-resolution.json`.

## 2. Tatsächlich bestandene automatisierte Prüfungen

Die vollständige Basissuite lief unter Linux mit Node **24.19.0** gegen eine saubere Archivkopie von HEAD und die installierten Lockfile-Abhängigkeiten:

| Befehl | Ergebnis |
| --- | --- |
| `npm run check` | Bestanden. |
| `npm run lint` | Bestanden: 0 Fehler, 130 vorhandene JSDoc-Warnungen. |
| `npm run test:unit` | 172 TypeScript-Tests und 13 Admin-Tests bestanden. |
| `npm run test:package` | 66 Tests bestanden. |
| `npm --prefix src-admin exec -- tsc --noEmit` | Bestanden. |
| `npm run build:full` | Admin-/Federation-Produktionsbuild und Adapterbuild bestanden. |
| `npm pack --dry-run --json` | Erfolgreich: 86 Dateien, 3.898.821 Byte gepackt, 11.198.658 Byte entpackt. |
| `npm run test:integration` | 7 Tests bestanden; automatischer Dev-Controller `8.0.0-alpha.7-20261015-00e1bb8a1`. Dies ist ausdrücklich kein Stable-Controller-Nachweis. |
| `git diff --check` | Bestanden. |

Die frühere Zahl von 67 Pakettests enthielt zusätzlich die Validierung einer ignorierten lokalen `.vite/manifest.json`. Diese Datei gehört nicht zum sauberen Commit; dessen Paketprüfung umfasst 66 Tests. Es wurde kein Test entfernt.

Die Suiten decken MAD, Rate-of-Change, Kontextmodelle, Stuck-State, Level-Shift/Trend, Retraining, Persistenz, History-Budgets/-Sampling/-Segmentierung, Forecast-Berechnung und Diagrammdaten ab. Die beiden History-Integrationstests verwenden eine echte ioBroker-Messagebox mit simuliertem Provider: 60 konzentrierte Werte mit genau einem Provider-Aufruf sowie segmentiertes Bootstrap mit 120 Anomalie-/60 zusammenhängenden Prognosewerten und genau fünf Aufrufen. Es war kein realer SQL-/InfluxDB-Langzeittest.

Das geprüfte npm-Paket enthält `build/main.js`, Federation-Remote-Entry und Manifest. Die Inhaltskontrolle fand keine Quelltests, `node_modules`, `.env`, ZIP- oder verschachtelten Tarball-Dateien. Große Federation-Chunks verursachen weiterhin eine Build-Größenwarnung; daraus wurde kein Funktionsfehler abgeleitet.

Für die Controllerprüfungen wurde das vorhandene lokale 0.4.5-Artefakt verwendet. Alle **83 enthaltenen Runtime-/Admin-/Metadatendateien** stimmen byteweise mit HEAD überein. SHA-256: `6d81ea71c4d3f9ee5ae0db5ef446db24964c470187730241223a0cb3ca42e483`. Protokoll: `release-readiness/artifact-provenance.json`.

## 3. Kompatibilität und Lebenszyklus

Die aktuelle stabile Controller-Version wurde über `npm view iobroker.js-controller@latest version` als **7.2.5** bestimmt. Zusätzlich zum Dev-Controller der Standardsuite wurden **6.0.11** und **7.2.5** wirklich installiert und gestartet, jeweils mit Adapter 0.4.5 und real installiertem Admin 8.0.14 unter Node 24.19.0.

Dies waren konfigurierte Testinstallationen, keine Neuinstallation des gesamten ioBroker-Systems. Beim Austausch auf Controller 6.0.11 scheiterte zunächst dessen npm-Setup-Lifecycle an der DB-Verbindung; die exakte Version wurde anschließend mit `--ignore-scripts` installiert und gegen die vorhandene isolierte DB-Konfiguration tatsächlich gestartet. Das belegt den Adapterbetrieb mit 6.0.11, aber keinen erfolgreichen vollständigen Erstinstallationsprozess dieses Controllers.

Auf beiden Controllern besteht ein echter Compact-Mode-Test mit zwei Instanzen in Gruppe 42. Während `.0` stoppt und neu startet, bleibt `.2` aktiv und die Gruppen-PID unverändert. Geprüft wurden `compactMode=true`, Lernen von 20 bestätigten Werten, Ausreißererkennung ohne Weiterlernen des Ausreißers, Callback-Antwort des Dashboard-Kommandos, keine weitere Verarbeitung/Adapter-Logs nach Stop sowie Wiederherstellung des Zählers 20 und Fortschritt auf 21 nach Neustart.

Ein separater Predictive-Lauf besteht auf beiden Controllern: 20 Eingabewerte, 10 akzeptierte Trainingswerte und 10 berechnete Forecast-Punkte, über die echte `tab`-Antwort aus dem laufenden Compact-Adapter gelesen. Die exakten Teilmengen sind Testkonfiguration und kein behaupteter Verlust im History-Sampler.

Die separaten Live-Controller-Smokes enthielten keinen installierten History-Provider. History-Bootstrap ist durch die Integrationssuite mit Testprovider abgedeckt, jedoch nicht auf dem Live-Controller 6.0.11. Nach den Tests wurden beide Controller/Gruppen beendet und ihre DB-Ports freigegeben. Nachweise und Testhelfer: `/workspace/.cloud-onboarding/release-readiness/controllers/report.md` und die beiden Controller-Unterverzeichnisse.

### Linux-Node-Matrix

Die offiziellen Linux-x64-Binaries wurden anhand der offiziellen SHA-256-Liste geprüft. Ergebnisse und genaue Kommandos stehen unter `release-readiness/node-matrix/`.

| Node.js | Unit / Admin | Paket | TypeScript | Integration mit stabilem Controller 7.2.5 |
| --- | --- | --- | --- | --- |
| 22.23.3 | 172 + 13 bestanden | 66 bestanden | Bestanden | 7 bestanden |
| 24.22.0 | 172 + 13 bestanden | 66 bestanden | Bestanden | 7 bestanden |
| 26.12.0 | 172 + 13 bestanden | 66 bestanden | Bestanden | 7 bestanden |

Zusätzlich besteht `npm run build:full` in separaten Kopien unter Node **22.23.3** und **26.12.0**. Der Node-24-Build wurde unter **24.19.0** ausgeführt; für 24.22.0 werden nur die oben aufgeführten tatsächlich ausgeführten Prüfungen behauptet.

Damit wird keine vollständige Kreuzmatrix jeder Controller-Version mit jeder Node-Version behauptet.

### Browser und Betriebssysteme

**Die Browser-Tests wurden auf ausdrücklichen Wunsch des Nutzers übersprungen und werden vom Nutzer übernommen.** Admin-Dashboard, Diagramme und Module Federation gelten daher hier nicht als im Browser bestanden. Build, Admin-Unit-Tests, Diagrammdaten und statische Paketprüfung bestehen. Explorative vorherige HTTP-Abrufe von Federation-Dateien sind kein Ersatz für einen UI-Test.

Windows und macOS wurden in dieser Linux-Umgebung nicht ausgeführt. Die vorhandene GitHub-Actions-Matrix definiert Node 22/24/26 auf Ubuntu, Windows und macOS. Für den geprüften Commit wurden jedoch keine Check-Runs und keine Commit-Status-Ergebnisse gefunden. Die Workflow-Definition allein ist kein Nachweis bestandener Plattformtests; es wurde kein Workflow ausgelöst.

## 4. Offizieller Repository-Checker

Der offizielle **`@iobroker/repochecker` 5.23.0** wurde erneut gegen den Commit 8983701 mit explizitem Prüfbranch und **`--local`** ausgeführt. Ergebnis: **Exit 1**, drei Fehler, vier Warnungen, ein Hinweis. Die zusätzliche Ausgabe `FINAL status 'OK'` wird ausdrücklich nicht als bestandener Compliance-Check gewertet. Remote-Modus-Versuche blieben beim Abruf externer Daten hängen und wurden mit Exit 143 beendet; sie zählen nicht als Erfolg. `checker/local-metadata.log` und `checker/remote-metadata.log` dokumentieren die unterschiedlichen Aufrufe getrennt.

| Meldung | Einordnung |
| --- | --- |
| E1025: externes Icon nicht gefunden | Effekt des experimentellen lokalen Prüfmodus: Die Raw-URL wird als lokaler Pfad mit zusätzlichem `main/` ausgewertet; die Datei liegt unter `admin/anomaly-detection-icon.png`. Die konfigurierte externe URL liefert HTTP 200. |
| E3037: Workflow müsse auf `fix/iobroker-compliance-audit` pushen | Der Checker behandelt den expliziten Prüfbranch als Default-Branch. Die GitHub-API bestätigt `main` als tatsächlichen Default-Branch. Der Workflow enthält `push` auf `main` und `pull_request`; kein bestätigter Compliance-Fehler. |
| E3032: Version 0.4.5 ungetaggt | Tatsächlicher Veröffentlichungsstatus, für den unveröffentlichten Stand erwartbar. Ein Tag ist in diesem Auftrag ausdrücklich ausgeschlossen. |
| W2002 / W2004: npm noch 0.4.4, 0.4.5-News unveröffentlicht | Erwartbare Folge der noch nicht veröffentlichten Version; kein Anlass, 0.4.5 oder deren News zu entfernen. |
| W3031: kein Workflow-Lauf für den Prüfbranch | Tatsächlich fehlender CI-Nachweis, keine automatische Testfreigabe. |
| W4001: Adapter nicht im zentralen Latest-Repository | Externer Listing-Status; Repository-Aufnahme wurde nicht durchgeführt. |
| S4054: MX-Auflösung der Autorenadresse | Nicht unabhängig als ungültige Adresse bestätigt; kein Anlass, die Kontaktadresse zu erfinden oder zu ändern. |

Damit wurde kein neuer, bestätigter Fehler in den Paket-/Workflow-Dateien gefunden, der im Arbeitsbranch zu korrigieren wäre. Ausgeführte Kommandos, Modus, Rohmeldungen und Metadaten stehen unter `/workspace/.cloud-onboarding/release-readiness/checker/`.

## 5. Fehlende Nachweise und Empfehlungen

- Browserfreigabe von Admin 8, Dashboard-Refresh, Forecast-Diagrammen und Module Federation durch den Nutzer.
- Tatsächliche Windows-/macOS-Ergebnisse sowie grüne Remote-CI für genau diesen Commit.
- Behebung oder dokumentierte Akzeptanz des verbleibenden Forge-Produktionsrisikos; kein gepatchtes npm-Release verfügbar.
- Kein Nachweis für andere Adapter/Host-Verbraucher der kryptografischen APIs oder für reale SQL-/InfluxDB-Langzeitläufe.

**Merge-Empfehlung:** Die geprüften Linux-Funktionen und Lebenszyklen sprechen für den Stand. Ein Merge ist nach den noch offenen Browser-/Plattformnachweisen und einer bewussten Bewertung der dokumentierten Sicherheitsabhängigkeit vertretbar. Aus diesen Prüfungen ergibt sich kein begründeter zusätzlicher Umbau des Adaptercodes.

**Release-Empfehlung:** Noch keine uneingeschränkte Release-Freigabe. Browser-/Plattformnachweise und der Umgang mit der offenen Produktions-GHSA fehlen. Erwartbare Checker-Meldungen zu unveröffentlichter Version und fehlendem Tag sind gesondert zu behandeln und rechtfertigen in diesem Auftrag weder Tag noch Veröffentlichung.

Alle lokalen Laufprotokolle liegen unter `/workspace/.cloud-onboarding/release-readiness/`. Dieser Auftrag erzeugt ausschließlich diesen zusätzlichen Bericht im Repository.
