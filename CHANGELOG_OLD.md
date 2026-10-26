# Older changelog entries

The current release history is maintained in the English and German README files.
This file is kept for releases managed by the ioBroker release tooling.
## 0.4.2 (2026-10-06)

- Persist anomaly and forecast models periodically and finish pending adapter work before graceful shutdown.
- Process monitored foreign states only after acknowledgement and complete the admin translations for all supported ioBroker languages.
- Require admin 8.0.0 for the custom tab API.

## 0.4.1 (2026-10-05)

- Update repository compatibility and administration metadata.

## 0.4.0 (2026-09-09)

- Improve predictive forecasting with current-state anchoring and explainable forecast diagnostics.
- Keep the actual current value separate from the forecast chart series and improve forecast time-axis and value-axis formatting.

## 0.3.1 (2026-09-09)

- Protect persisted history and mixed predictive models from live-only retraining when the training basis cannot be restored.

## 0.3.0 (2026-09-08)

- Add optional local predictive forecasting with persistent models and training bases.
- Improve history-based initial training, restart recovery, rolling retraining, and history/live training-source reporting.
- Add robust history bootstrapping with segmented provider-limit handling, coverage probes, deduplication, and adaptive segmentation.
- Improve anomaly explainability and diagnostics, including context-aware sample scope and evaluation availability.

## 0.2.1 (2026-09-08)

- Report `Normal` as the current reason for scores below 50 instead of showing a technical detector message for a minor deviation.
- Improve analysis charts, historical explanations, and responsive layout.
- Fix a crash in the analysis view when a context-state entry is `null` or invalid.

## 0.1.1 (2026-09-07)

- (Voodoo2man) improve configuration UI layout and translations
- (Voodoo2man) add detector guidance and contextual option visibility

## 0.1.0 (2026-09-06)

- (Voodoo2man) add local statistical anomaly detection MVP
- (Voodoo2man) add optional bounded historical initial training
- (Voodoo2man) select only enabled history sources per configured state
