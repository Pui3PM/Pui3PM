# CHANGE_LOG — R8 P1-07 Claude Code implementation block (2026-10-02)

Base: `3PM_Analyzer_R8_P1_06_ClaudeRepair_DEV_20261002.zip` SHA-256 `1904f87d2d0b2ef60f413e23fa5880481dc67cc58f538f483ae71bd1914dbf21` (verified before any edit).
Instructions: `FINAL_REVIEW_FOR_CLAUDE_CODE.md` (handoff `3PM_Claude_Chat_Final_Review_Handoff.zip`), dependency order Q → S → P.
Lineage kept: EL18 → R7 parent → selective HV3 merge → R8 (R7 TransactionRepair behaviour untouched).
One commit per finding (or tightly coupled pair); every finding RED on the baseline before the fix, GREEN after.

| Commit | Finding | Change | Files |
|---|---|---|---|
| d413c09 | Q-01 | QA runners write to `$THREEPM_QA_OUT` or a system-temp run folder, never into the SHA256SUMS-attested package; in-package output path refused | `run_regressions.py`, `phase01/run_phase0_repros.py`, `phase01/run_p006_regressions.py`, new `test_qa_runner_isolation.js` |
| aca13f2 | Q-02 | Chromium discovery `CHROMIUM_PATH` → Playwright → PATH, `blocked` only when nothing launches; smoke file no longer written into the tree | `run_phase0_repros.py`, new `test_qa_browser_discovery.js` |
| 4f2a8f3 | Q-03 | C11 `if(real&&other)` guard → explicit precondition assert (no expected value changed) | `test_claude_r8_repairs.js` |
| 96aaad7 | S-01 | Linear table-driven base64 decode (no regex), canonical padding (`QR==` rejected), chunked encode | `shadow/contracts/binary_pure.js` |
| 43eed68 | S-02 | `isFrameUID` lower-case only; projection real slot UID recomputed from `(runId, sourceId, streamGeneration, frameSeq)` | `strict_types.js`, `record_validators.js` |
| 9db6c45 | S-03 | Validated mapping: `uncertaintyBoundUs ≥ residual?? 0 + transport ?? 0`; fixture namespace exact `shadow/replay` segment | `clock_mapper.js` |
| 426354a | S-04, S-05 | One shared `isShadowNamespace` predicate (prefix `shadow/`, non-empty, no `production`/`legacy`); constructor prefix may only narrow; used by event log, writer, reducer, archive events, importer | `strict_types.js`, `in_memory_event_log.js`, `in_memory_writer.js`, `shot_cycle_reducer.js`, `shadow_archive.js` |
| 529edb1 | S-06 | New `projection_binding.js`: slot time/uncertainty/delta/tolerance/target/phase interval/refs/phaseProof re-derived from stored candidate + timeline in writer `saveProjection` (payload now requires `timeline`, `releaseTime`) and archive (`records.schemaVersion:2`, typed `timelines`; v1 → `ARCHIVE_SCHEMA_UNSUPPORTED`) | `projection_binding.js`, `in_memory_writer.js`, `shadow_archive.js`, `logical25.js`; inputs of `test_p105`, `test_p106` |
| 84bf28e | S-07 | Archive binds `payloadRef` file sha256 to frame/candidate `contentDigest` (`PAYLOAD_DIGEST_MISMATCH`) | `shadow_archive.js` |
| f531bea | S-08, S-09 | Scheduler: executor gets `{signal, jobId}`; timeout/stale cancel aborts; timed-out unsettled job degrades the lane (`worker_unresponsive` drops, `maxOutstanding` 1); cancelled in-flight capped (`maxCancelledInFlight` 4); cancelled generations bounded (64); Side and aux in separate slots. Descriptor validated deep (plain data, frozen copy) | `priority_scheduler.js` |
| 0a74ff8 | S-10 | Idempotency memos per aggregate `(namespace, runId, cycleId, role)`; cap per aggregate; pruned only after `finalizeCycle` + retention (64); pruned → `COMMAND_EXPIRED` | `in_memory_writer.js` |
| fd6221b | S-11 | `inputCandidateDigest` over normalized list; malformed candidate → `candidate_invalid`, counted, not dropped, projection continues | `logical25.js` |
| 5d25784 | S-12 | Shadow reducer: `confirmed` needs ≥1 supporting observation and never comes from timeout/reset; `applyStreamEvent` → `uncertain(authority_stream_reset)`; pure 200 ms reorder buffer with gap/late/stale-generation outputs; event log also refuses evidence-free `confirmed` | `shot_cycle_reducer.js`, `in_memory_event_log.js`; fixture input of C10 |
| a519cf5 | S-13 | D-A option 1: anchor `phaseProof.anchorIntervalKind:'settled-anchor-interval'` replaces the hard-coded boolean (behaviour kept); writer/archive reject non-contract timeline fields | `logical25.js`, `record_validators.js`, `view_model.js`, `projection_binding.js` |
| 5b2458d | Track S | Bundle rebuilt (23 modules); new real-Chromium shadow bundle gate | `shadow_runtime_bundle.js`, `run_shadow_bundle_chromium.cjs` |
| e244175 | P-01..P-04 | Reviewed R8C patch applied unmodified (SHA-256 `bb931030…8e68`): temporal identity strict-null + per-source seq, camera timeline strict clocks, native writer through frozen `evidenceDbMerge`, idempotent rail render; Chromium gates added | `temporal_evidence_core.js`, `camera_timeline_core.js`, `native_capture_layer.js`, `evidence_integrity_repair_layer.js`, `index.html` (cache keys) + tests |
| 25df1b4 | P-05 | F02-upstream/F03 characterizations → closure regressions (`*_closed.js`); runner reports `closed`; F01 dynamic uses the Playwright harness (labelled dump-dom fallback) | phase01 repro scripts, `run_phase0_repros.py`, `test_qa_browser_discovery.js` |
| 8f73245 | P-06 | Artifact-class pose policy (D-B option 1); class pins hard-coded in gates; packaging tool `build_r8_artifact.py` builds and verifies from ZIP bytes | `PACKAGE_CONTRACT.json`, `static_integrity_x282.py`, `test_distribution_contract_r6.py`, `test_pose_narrow_thaw.js`, new `test_artifact_class_policy.js`, `strip_pose_trace_seam.cjs`, `build_r8_artifact.py` |

Not changed (by mandate): `app.js`, `core_runtime.js`, native binaries, Equipment/Athlete/Session, decision/biomechanics modules and thresholds, `evidence_budget_core.js`, `temporal_evidence_layer.js`. P-07 and P-08 recorded only.
