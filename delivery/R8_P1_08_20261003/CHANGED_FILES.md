# Exact changed files vs audited base `511cfdb` (package-relative)

Production (`app/static/`, shipped):
- A `app/static/frame_identity_core.js` — new shared identity/order core (D-108-01)
- M `app/static/evidence_budget_core.js` — **protected-file thaw** D-108-02 (`fd7335e8…` → `de50d1eb…`)
- M `app/static/temporal_evidence_layer.js` — **protected-file narrow thaw** D-108-03 (`65aec490…` → `4af385e8…`), `augmentBundle` mapping only
- M `app/static/temporal_evidence_core.js` — delegate identity/order; same-domain dense replacement
- M `app/static/camera_timeline_core.js` — delegate identity/order; strict target (M-02)
- M `app/static/native_capture_layer.js` — H-03 generation authority + origin-bound bundles
- M `app/static/evidence_integrity_repair_layer.js` — Anchor handler strict target (M-02)
- M `app/static/index.html` — load `frame_identity_core.js`; cache keys `-p108`

Launcher / contract:
- M `internal/start_analyzer.sh` — banner (L-01); field-class isolated browser profile (M-05)
- M `PACKAGE_CONTRACT.json` — `frame_identity_core.js` required

Tests / tools (not loaded by the app):
- A `app/tests/p108_harness.js`, `app/tests/test_p108_{h01_chronology,h02_identity,h03_native_generation,m01_fps_scope,m02_alignment_anchor,astra_probes,m04_bridge_exposure,m05_migration_compat,m05_launcher_profile}.js`
- A `app/tests/p108_astra/{independent_core_probes,production_path_probes,native_open_race_probe,additional_probes}.cjs` (verbatim from the audit evidence ZIP)
- A `app/tests/p108_browser/{stub_backend,run_fullapp_gate_chromium}.cjs`
- M `app/tests/phase01/repro_astra_legacy_gaps.js` (P-07 closure, D-108-05)
- M `app/tests/manual/temporal_browser_smoke.html` (script tag)
- M `app/tests/phase01/build_r8_artifact.py` (P1-08 packaging)

Docs: `docs/phase01/claude_code_r8_p1_08_20261003/*`, `docs/FIELD_TEST_INSTRUCTIONS.md`, `PROJECT_STATE.md`, `docs/QA_CURRENT.md`, `docs/HANDOFF_NEXT_CHAT.md`, `docs/architecture/DECISION_LOG.md`; packaging regenerates `docs/qa/*.json`, `docs/phase01/*.json` snapshots, provenance and `SHA256SUMS.txt`.

Unchanged (byte-identical, verified by the build tool on the fresh unzip): `app.js`, `core_runtime.js`, both runtime binaries, Equipment catalog/lab files, `capture_integrity_layer.js`, `evidence_budget_layer.js`, `pose.js` per class policy, Swift/Windows bridge sources, all decision/threshold modules.
