# CHANGE LOG — R8 P1-08 Narrow Integration Repair (Claude Code, 2026-10-03)

Base: branch `claude/3pm-analyzer-r8-qru71a` commit `511cfdb` (audited P1-07; field ZIP `b6f0220e…`). One commit per finding, RED tests first.

| Commit | Finding | Change |
|---|---|---|
| `b0db211` | all | RED first: verbatim Astra probes (`app/tests/p108_astra/`), production-path harness `app/tests/p108_harness.js`, regressions H-01/H-02/H-03/M-01/M-02, Astra gate `test_p108_astra_probes.js`. All RED on the audited bytes. |
| `964f032` | H-01, H-02 | `frame_identity_core.js` (new); temporal/budget/timeline cores delegate identity and physical order to it; `index.html` loads it; `PACKAGE_CONTRACT.json` requires it; P-07 characterization flipped to closure. |
| `163b3bb` | H-02 | Narrow thaw `temporal_evidence_layer.js` `augmentBundle` mapping: unknown stays null; generation + worker FrameUID. |
| `56451bf` | H-03 (+H-02 origin) | `native_capture_layer.js`: request tokens, no `/close` on reopen, pending close awaited, `/diag` acknowledgement with bounded re-assert, origin-bound bundles, native generation/FrameUID stamping. |
| `ca72abc` | M-02 | `camera_timeline_core.js` strict target; `evidence_integrity_repair_layer.js` Anchor handler fails closed on unknown target. |
| `6ce6aeb` | M-03 | Full-app Chromium gate + backend test double (`app/tests/p108_browser/`). |
| `63ca2dc` | L-01 | Launcher banner shows `PACKAGE_ID` and artifact class. |
| `8e6abce` | M-04, M-05 | Bridge exposure characterization; P1-07→P1-08 stored-record migration compatibility test. |
| `823e155` | M-05 | Field-class launcher opens an isolated browser profile. |
| (this commit) | packaging, docs | `build_r8_artifact.py` P1-08 names, thaw record (`THAWED`), strict field QA, P1-08 gates on fresh unzip; FIELD_TEST_INSTRUCTIONS rewritten; P1-08 records; L-01 state-doc cleanup. |

Exact changed-file list vs `511cfdb`: `CHANGED_FILES.md`.
