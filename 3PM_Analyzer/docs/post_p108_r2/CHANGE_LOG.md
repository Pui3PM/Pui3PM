# Post-P108 R2 change log (vs delivered Post-P108 DEV bytes, commit d6af163)

Production (`app/static/`):
- M `frame_identity_core.js` — v4 identity/order rules (R2-01, R2-02)
- M `evidence_identity_persistence_layer.js` — v2 provenance FrameUID + historical read stamp (R2-03, R2-04)
- M `index.html` — cache keys `frame_identity_core.js?v=p108r2`, `evidence_identity_persistence_layer.js?v=postp108r2`,
  `native_capture_layer.js?v=hv3-r8c1-p108r2`

Native source (compiled on the Mac by the launcher):
- M `app/native_capture_bridge/3PMNativeCaptureBridge.swift` — `tableLock` for `releaseRequests`/`bundles` (R2-05)

Tests / tools (not loaded by the app):
- A `app/tests/test_post_p108_r2_identity.js`
- A `app/tests/p108_browser/run_post_p108_r2_identity_chromium.cjs`
- A `app/tests/phase01/verify_package_fresh_unzip.py`, `app/tests/phase01/swift_syntax_check.cjs`
- M `app/tests/phase01/build_post_p108_engineering.py` — parameters (defaults = original call)
- M `app/tests/p108_harness.js`, `app/tests/test_evidence_identity_writer_r8c.js` — harness doubles load the shipped
  writer adapter and apply its read hook (no assertion changed)
- M `app/tests/test_p108_m04_bridge_exposure.js` — characterization re-pinned to hardened source facts (still OPEN)
- M `app/tests/manual/temporal_browser_smoke.html` — cache key

Contract / docs: `PACKAGE_CONTRACT.json` (2 new required test files), `docs/post_p108_r2/*`, root status lines in
`AGENTS.md`, `PROJECT_STATE.md`, `README_START_HERE_TH.txt`, `docs/HANDOFF_NEXT_CHAT.md`, `docs/QA_CURRENT.md`,
`docs/FIELD_TEST_INSTRUCTIONS.md`; `SHA256SUMS.txt`, `PACKAGE_ID.txt` regenerated.
