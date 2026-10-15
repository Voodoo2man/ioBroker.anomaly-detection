# Abschlussprüfung 0.4.5: Sparse History und Dashboard-Refresh

Ausgangsstand: `d0b4ef9215ff20fe268a6abcf75800c6f370f0b4`, Branch `fix/iobroker-compliance-audit`. Version 0.4.5 bleibt erhalten. Es wurden keine Commits, Pushes, Merges, Tags oder Releases ausgeführt. Produktions-State-IDs und Modell-/Persistenzformate bleiben unverändert. Manifeste und Lockdateien wurden nicht aktualisiert; nur die Admin-TypeScript-Konfiguration erlaubt zusätzlich `.ts`-Importe für den vorhandenen Test-Runner.

## 1. Bestätigte Fehler

1. `HistorySampleSampler` warf gültige Messungen vor Erreichen des Limits weg: Bei 60 Werten in einer Stunde innerhalb eines 30-Tage-Fensters blieben im reproduzierten Vorher-Test nur drei Werte übrig. Damit konnte die konfigurierte Mindestmenge von 30 Trainingswerten verfehlt werden.
2. `AnomalyDashboard.refresh()` übernahm jede erfolgreiche Antwort bzw. jeden Fehler ungeachtet später gestarteter Anfragen oder eines Instanzwechsels. Dadurch konnten ältere Quellen bzw. Fehlermeldungen neuere Ergebnisse überschreiben. Die Anfragebehandlung hatte keinen Invalidierungsmechanismus beim Unmount.
3. Die vorhandenen Integrationstests starteten den Adapter als eigenen Node-Prozess. Die Deklaration `common.compact: true` und diese Tests allein belegten den von der Review-Checkliste verlangten Compact-Mode-Lebenszyklus nicht.

## 2. Durchgeführte Korrekturen

### History-Sampling

Die vorhandenen globalen Zeit-Bucket-Repräsentanten und die beiden Endpunkte bleiben für zeitliche Abdeckung vorrangig. Zusätzlich speichert ein deterministischer Bottom-K-Vorrat bis zu `maximumSamples` eindeutige Zeitpunkte. Nicht belegte Ausgabeplätze werden daraus aufgefüllt.

- Bei höchstens K gültigen eindeutigen Werten enthält der Vorrat alle Werte; das Ergebnis verliert keinen davon.
- Bei mehr als K Werten sichern zuerst die belegten Zeit-Buckets und Endpunkte die zeitliche Abdeckung. Der Vorrat füllt die verbleibenden Plätze mit stabilen Hash-Prioritäten der Zeitstempel.
- Ein Max-Heap hält die K kleinsten Prioritäten mit O(log K) pro Ersetzung. Die zugehörige Map enthält nur diese K Einträge, keine unbegrenzte Liste jemals gesehener Zeitpunkte. Bucket-Map und Heap/Map bleiben jeweils begrenzt; Gesamtspeicher O(K), Ausgabe höchstens K.
- Hash-Priorität hängt nur vom vollständigen Zeitstempel ab. Segmentgrenzen, Aufrufreihenfolge und Messwerte beeinflussen sie nicht. Gleichstände werden stabil nach Zeitstempel aufgelöst; doppelte Zeitstempel behalten wie bisher deterministisch den kleineren Messwert.
- Ergebnisse sind dedupliziert und chronologisch. Anomalie- und Predictive-Sampler behalten ihre eigenen Fenster/Limits. Der Provider-Abfragealgorithmus wurde nicht verändert.

Der Hash-Vorrat ist eine deterministische pseudorandomisierte Ergänzung; er garantiert keine perfekt gleiche Belegung jedes Unterintervalls innerhalb eines einzigen globalen Buckets. Die vorrangigen Bucket-Repräsentanten und Endpunkte bleiben davon unberührt. Eine Dichtegewichtung anhand von Antwortsegmenten wird vermieden.

### Dashboard

Ein kleiner, separat testbarer `DashboardRefresh`-Koordinator verwendet den vorhandenen `LatestRequest`. Die Hauptansicht routet Quellen und Fehler ausschließlich über dessen aktuelle Generation. Socket-/Target-Wechsel invalidieren alte Anfragen in einem Layout-Effekt; Effektbereinigung und Unmount invalidieren ebenfalls. Der bestehende HistoryChart-Pfad wurde nicht geändert. Keine neuen Laufzeit-Dependencies.

## 3. Neue Regressionstests

Die History-Suite umfasst jetzt 23 Tests, darunter den tatsächlich vor der Korrektur fehlgeschlagenen 60-Werte-Fall sowie neue Fälle für kurze Cluster, exakt volle Kapazität, ungültige Werte, kleine Grenzlimits und getrennte Trainingsfenster. Die Matrix verwendet Limits 30, 100, 500, 1000, 2000 und 10000. Sie prüft 10000 gleichmäßig verteilte Werte, unterschiedliche Dichten und große Lücken, kleine und große Segmente, umgekehrte Segment-/Messwertreihenfolgen und überlappende Provider-Antworten.

Fünf neue Dashboard-Regressionen prüfen alte Erfolge, alte Fehler nach neuerem Erfolg, Adapterinstanzwechsel, Bereinigung einer laufenden Anfrage und normale Aktualisierung. Diese Tests prüfen den von der Komponente verwendeten Anfragekoordinator; sie ersetzen keinen Browser-DOM-Test.

Zwei neue Integrationstests verwenden die echte ioBroker-Messagebox mit einem simulierten History-Provider:

- Sparse Bootstrap: 60 Messwerte werden für Anomalie- und Prognosemodelle übernommen; genau ein Provider-Aufruf.
- Segmentierter Bootstrap: Eine absichtlich unvollständige breite Antwort löst Coverage-Probe und Segmentierung aus. Alle 120 Anomalie-Trainingswerte bleiben erhalten; die Prognose verwendet entsprechend der bestehenden Lückenregel die 60 neuesten zusammenhängenden Werte. Genau fünf Provider-Aufrufe.

Zusätzlicher Speicher-Stresstest: 2000000 Werte in 1000er-Blöcken, Limit 10000, V8-Old-Space-Limit 96 MiB. Alle internen Vorrats-/Bucket-Grenzen wurden pro Block geprüft; Ergebnis 10000 Werte mit beiden Endpunkten, gemessener Heap-Verbrauch am Ende rund 17,5 MB. Dies ist ein zusätzlicher Lauf gegen den frisch gebauten Sampler, kein Bestandteil der normalen Unit-Suite.

## 4. Tatsächlich ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `npm ci` | Erfolgreich, Root-Abhängigkeiten frisch installiert. |
| `npm ci --prefix src-admin` | Erfolgreich, Admin-Abhängigkeiten frisch installiert. |
| `npm run check` | Bestanden. |
| `npm run lint` | Bestanden: 0 Fehler, 130 bereits vorhandene JSDoc-Warnungen. |
| `npm run test:unit` | 172 TypeScript-Tests und 13 Admin-Tests bestanden. |
| `npm run test:package` | 67 Tests bestanden. |
| `npm run test:integration` | 7 Tests bestanden, einschließlich der beiden neuen History-Bootstrap-Fälle sowie Start, Lernen, Forecast, Ausreißer, Persistenz/Neustart, Retraining und Shutdown. |
| Zusätzlicher Admin-Typecheck | Bestanden. |
| `npm run build:full` | Admin-Produktionsbuild und Adapterbuild einschließlich Typprüfung bestanden; versionierte Artefakte aktualisiert. |
| `npm pack --dry-run` | Erfolgreich; lokaler Paketinhalt geprüft, keine Veröffentlichung. |
| `npm audit` | Ausgeführt, Exit 1 wegen 38 Befunden: 4 critical, 15 high, 18 moderate, 1 low. Kein bestandener Sicherheitscheck. |
| `npm audit --omit=dev` | Ausgeführt, Exit 1: 3 high-Pakete, 0 critical; siehe Abschnitt 5. |
| Zusätzliche Admin-Audits, vollständig und `--omit=dev` | Je 12 high-Pakete, 0 critical. |
| Offizieller `@iobroker/repochecker` 5.23.0, lokaler Modus mit Prüfbranch | Ausgeführt, Exit 1; drei Fehler eingeordnet, siehe Abschnitt 6. |
| `git diff --check` | Bestanden. |

Die Unit-Suite führt tatsächlich MAD, Rate-of-Change, Kontextmodelle, Stuck, Level-Shift/Trend, Modellpersistenz, History-Budgets/-Sampling/-Requests, Predictive Forecasting und Forecast-Diagrammdaten aus. Die Integrationssuite verwendet js-controller `8.0.0-alpha.6-20261013-09c6db0d1` unter Node.js 24.19.0. Es wurde keine vollständige Linux/Windows/macOS- oder Node-22/24/26-Matrix in diesem Folgeauftrag ausgeführt.

Ein zusätzlicher echter Compact-Mode-Test besteht ebenfalls. Dafür wurde das frisch erzeugte lokale 0.4.5-Paket in einer isolierten Controller-Kopie mit real installiertem `admin@8.0.14` gestartet. Instanzen `.0` und `.2` liefen in Compact-Gruppe 42. Die Gruppen-PID blieb unverändert, während `.0` gestoppt und neu gestartet wurde und `.2` weiterlief. Nach dem Stop verursachte ein neuer Quellwert weder eine weitere Verarbeitung noch Adapter-Logs von `.0`. Vorher wurden 20 normale Werte gelernt, ein Ausreißer erkannt und von weiterem Lernen ausgeschlossen sowie die Callback-Antwort des `tab`-Kommandos geprüft. Der Neustart stellte den Modellzähler 20 wieder her; ein normaler Folgewert erhöhte ihn auf 21. `compactMode=true` und die Controller-Startlogs wurden geprüft. Anschließend wurden die Testinstanzen und der Controller beendet und die separaten DB-Ports freigegeben.

Ausführungsprotokolle liegen unter `/workspace/.cloud-onboarding/followup/`, einschließlich `compact/COMPACT-RUN-RESULT.md`, `compact/COMPACT-SMOKE.md` und der reproduzierbaren Compact-Testhelfer. Diese zusätzlichen lokalen Tests veröffentlichen kein Paket.

## 5. Sicherheitsbefunde

### Produktionsbaum des Adapters

| Paket | Installiert | Schweregrad | GHSA/CVE | Abhängigkeitspfad und Relevanz |
| --- | --- | --- | --- | --- |
| `node-forge` | 1.4.0 | high, CVSS 7.5, CWE-347 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv); npm nennt keine CVE | `@iobroker/adapter-core@3.4.3 → @iobroker/js-controller-common-db@7.2.2 → node-forge@1.4.0`. Betroffen ist RSA-PKCS#1-v1.5-Signaturprüfung mit zusätzlichen verschachtelten DigestAlgorithm-Elementen; betroffener Bereich laut Audit `<=1.4.0`. |
| `@iobroker/js-controller-common-db` | 7.2.2 | high, transitiv | dieselbe GHSA | Bezieht `node-forge`; keine zweite unabhängige Advisory. Die inspizierten Tools verwenden Forge für PEM-/Zertifikatsverarbeitung sowie Schlüssel-/Zertifikatserzeugung und Signieren. |
| `@iobroker/adapter-core` | 3.4.3 | high, transitiv | dieselbe GHSA | Direkte Adapter-Dependency; übernimmt den betroffenen Common-DB-Pfad. |

Die drei Audit-Pakete bezeichnen hier **eine zugrunde liegende Schwachstelle**, nicht drei voneinander unabhängige CVEs. Der Adapter importiert Forge nicht direkt. In den gezielt untersuchten Common-/Adapter-Core-Paketen wurde keine entsprechende RSA-Verifikationsstelle gefunden; die beobachteten Aufrufe parsen oder erzeugen/signieren Zertifikate. Common-DB exportiert diese Tools aber öffentlich und der reale Controller hat weitere Verbraucher. Aus diesem Befund folgt **kein Nachweis genereller Nichtausnutzbarkeit**. Eine Upstream-Korrektur bzw. separat geprüfte Abhängigkeitsänderung bleibt erforderlich.

### Admin-Produktionsbaum

Auch `npm audit --prefix src-admin --omit=dev` ist nicht sauber. Die zwölf high-Paketmarkierungen gehen auf dieselbe `node-forge@1.4.0`-GHSA zurück:

- `@iobroker/json-config@10.0.7 → @iobroker/gui-components@10.3.6 → @iobroker/js-controller-common-db@7.2.5 → node-forge@1.4.0`.
- `@iobroker/gui-components → @iobroker/js-controller-common →` Objects-/States-DB-Pakete `→ @iobroker/db-base → @iobroker/js-controller-common-db → node-forge`.
- Markierte Pakete: `node-forge`, `@iobroker/js-controller-common-db`, `@iobroker/db-base`, `@iobroker/db-objects-file`, `@iobroker/db-objects-jsonl`, `@iobroker/db-objects-redis`, `@iobroker/db-states-file`, `@iobroker/db-states-jsonl`, `@iobroker/db-states-redis`, `@iobroker/js-controller-common`, `@iobroker/gui-components`, `@iobroker/json-config`.

Die Klassifizierung ist deshalb nicht pauschal „nur dev“. Der Dependency-Audit allein beweist jedoch weder Erreichbarkeit der verwundbaren Funktion im Browser noch deren Aufnahme in die von Vite erzeugten Chunks. Die großen Federation-Fallback-Assets bleiben eine zusätzliche Größe-/Prüffrage.

### Entwicklungswerkzeuge

Der vollständige Root-Audit meldet zusätzlich kritische Paketmarkierungen für `form-data` (u.a. GHSA-fjxv-7rqg-78g4), `proxy-addr` (GHSA-jqcg-44mw-7w3h), `request` (transitive Auswirkungen u.a. über form-data) und `xmldom` (u.a. GHSA-crh6-fp67-6883). Sie verschwinden im Root-Audit mit `--omit=dev`; sie bleiben für Build-/Test-/Entwicklungsumgebungen relevant. Root-Gesamtergebnis: 38 Paketmarkierungen, keine Aussage über 38 unabhängige CVEs.

Es wurde weder `npm audit fix` noch `npm audit fix --force` ausgeführt. Der von npm vorgeschlagene Wechsel von Adapter-Core wird nicht ungeprüft übernommen. Lockdateien und Dependency-Versionen bleiben unverändert.

## 6. Richtlinien und verbleibende Risiken

Geprüfte aktuelle Quellen:

- [Adapterentwicklung](https://www.iobroker.com/docs/dev/adapterdev.md), über die [offizielle Markdown-Quelle](https://raw.githubusercontent.com/ioBroker/ioBroker.docs/master/docs/en/dev/adapterdev.md).
- [Aktuelle Repository-Anforderungen](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md), insbesondere Ressourcenbereinigung, asynchrone Verarbeitung, Compact Mode sowie Paket-/Integrationstests.
- [Aktuelle Adapter Review Checklist](https://github.com/ioBroker/ioBroker.repositories/blob/master/REVIEW_CHECKLIST.md).

Diese Quellen wurden für diesen Auftrag neu gelesen. Mindestversionen in README und Manifesten, Beschreibung/Changelog/Lizenz, Übersetzungen, Admin-/Dokumentationsverweise, Rollen, ACK-Behandlung, asynchrone Objekterzeugung, Fehlerbehandlung und Ressourcenbereinigung wurden gegen die Checkliste geprüft. Die Laufzeittests ergänzen die Prüfung insbesondere für Start, Stop, Persistenz, Message-Callbacks und Compact Mode. Keine Änderung an Versionsnummer, State-IDs oder persistierten Modellen war erforderlich.

Der offizielle Repository-Checker 5.23.0 wurde tatsächlich gegen den lokalen Stand ausgeführt:

```text
npm_config_cache=/workspace/.npm-cache node /workspace/.npm-cache/_npx/2a0de87ebf5a3bc4/node_modules/@iobroker/repochecker/index.js https://github.com/Voodoo2man/ioBroker.anomaly-detection fix/iobroker-compliance-audit --local --success
```

Er beendet sich mit Exit 1 und meldet drei Fehler. Seine zusätzliche Ausgabe `FINAL status 'OK'` wird ausdrücklich nicht als bestandener Check gewertet:

- **E1025, externes Icon:** lokaler Prüfmodus löst die konfigurierte Raw-URL als `main/admin/anomaly-detection-icon.png` unter dem Checkout auf. Die tatsächliche Datei liegt korrekt unter `admin/anomaly-detection-icon.png`; die unveränderte externe URL wurde separat abgerufen und liefert HTTP 200.
- **E3037, Workflow-Push-Branch:** der Aufruf mit Prüfbranch behandelt `fix/iobroker-compliance-audit` als Default-Branch. Die GitHub-API bestätigt jedoch `main` als wirklichen Default-Branch. Der Workflow enthält `push` auf `main` und `pull_request`; daher keine Änderung nur zur Umgehung dieses lokalen Prüfeffekts.
- **E3032, fehlender Tag 0.4.5:** zutreffender Veröffentlichungsstatus. Das Erzeugen eines Tags oder Releases ist im Auftrag ausdrücklich ausgeschlossen.

Warnungen zur npm-Version 0.4.4 gegenüber lokal 0.4.5 und zu noch nicht veröffentlichten 0.4.5-News gehören zum unveröffentlichten Stand. Für den Prüfbranch ist kein CI-Lauf bestätigt; der Checker fand einen erfolgreichen Lauf zur veröffentlichten 0.4.4, der kein Nachweis für diese lokalen Änderungen ist. Die fehlende Aufnahme in das zentrale Latest-Repository bleibt ein externer Listing-Status. Der Hinweis zur MX-Auflösung der Autorenadresse wurde nicht als verifizierter Fehler übernommen. Repository-Abnahme, Forum-Abnahme und Remote-CI dieses Arbeitsstands bleiben unbestätigt. Kein Push oder externer Schreibzugriff erfolgte.

Kein manueller Test des eingebetteten Admin-Tabs im Browser und kein Langzeittest mit realem SQL-/InfluxDB-Provider. Unit- und Messagebox-Tests decken die beschriebenen Race-/Sampling-Fälle ab. Die Sicherheitsbefunde sind reale offene Abhängigkeitsbefunde, auch wenn keine direkte Ausnutzbarkeit im eigenen Adaptercode nachgewiesen wurde.

## 7. Merge-Reife

Die beiden gemeldeten Funktionsfehler sind korrigiert; die genannten lokalen Standardprüfungen und der echte Compact-Mode-Test bestehen. Funktional ist der Arbeitsstand zur Review geeignet. Eine uneingeschränkte Sicherheits-/Release-Freigabe wird wegen der offenen high-Produktionsbefunde, der kritischen Entwicklungsabhängigkeiten und der unbestätigten Remote-CI **nicht** erteilt. Der Repository-Checker ist ausgeführt und seine Meldungen sind eingeordnet; sein Ergebnis bleibt Exit 1. Ob die dokumentierten Abhängigkeitsrisiken für einen Merge akzeptiert werden, muss separat entschieden oder durch gezielte, rückwärtskompatibel geprüfte Upstream-Korrekturen gelöst werden. Es wurde weder committed noch gepusht, gemergt, getaggt oder veröffentlicht.
