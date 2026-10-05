# Decision Log

## 2026-10-01 — D-001
Selected Option 2: staged Major Refactor; no clean-sheet whole-app rewrite.

## 2026-10-01 — D-002
Historical HV3 remains an immutable audit artifact, but after lineage reconciliation the development parent/rollback policy is R7 TransactionRepair. R8 is a development candidate only; no R8 package is production-approved.

## 2026-10-01 — D-003
Phase 0 does not repair legacy F01–F04 in place. It characterizes/reproduces them and builds strict shadow contracts.

## 2026-10-01 — D-004
Frozen `app.js`, `pose.js`, `core_runtime.js`, and Analyzer binaries remain byte-identical during current P0-00..P0-05 work.

## 2026-10-01 — D-005
Dynamic Chromium F01 execution is marked blocked in the current Linux container if even trivial Chromium headless smoke cannot complete; source characterization and Astra's prior isolated-browser evidence remain separate evidence levels.

## 2026-10-01 — D-006
Project owner authorized a conditional narrow thaw of `app/static/pose.js`: trace-only instrumentation may be added when it improves measurability without changing release/phase thresholds, scheduler policy, input selection, production shot decision, or persistence behavior.

## 2026-10-01 — D-007
The approved pose thaw is default-off and fail-closed to production behavior. External trace callbacks are invoked only after `detectForVideo` returns; callback exceptions are isolated. Legacy frozen-hash expectations are NOT refreshed to make old gates green. Instead, a separate equivalence test must reconstruct the exact HV3 pose.js baseline when approved instrumentation is removed.

## 2026-10-01 — D-008
Direct `<video>` inference is not claimed as immutable exact-raster capture. The trace marks it `blocked-live-direct-video`; matched-frame certification remains offline/common-input or canvas/video-frame only until a safe exact-sample tee is proven on target runtime.

## 2026-10-01 — D-009
P0-07 confirms Windows native capture remains `E_NOTIMPL` and macOS native helper security/concurrency repairs are Phase 1 gates, not reasons to mutate production native code during Phase 0.

## 2026-10-01 — D-010
Phase 0 may exit as an offline/instrumentation foundation with target-runtime items explicitly `NOT RUN/BLOCKED`; this does not authorize production promotion. Pure Phase 1 modules may start in isolated shadow namespace while legacy remains sole authority.

## 2026-10-01 — D-011
Phase 1 begins with pure shadow P1-01 contracts/identity/clock only. No production module imports the new files. Mapping uncertainty/unknown remains explicit and no arrival/wall-clock fallback is promoted as source time.

## 2026-10-01 — D-012
Astra delta review accepted the R7-parent selective-HV3 lineage direction but found end-to-end semantic gaps. Continued work is authorized only for pure/offline P1-02..P1-06 until live/browser/native gates are separately cleared.

## 2026-10-01 — D-013
P1-01 was hardened before use as an accepted shadow boundary: bounded integer strings, canonical `-0` rejection, deep immutable validated envelopes, clock cross-field constraints, calibration provenance and checked generation binding.

## 2026-10-01 — D-014
The pose trace-only seam was hardened within the already approved narrow-thaw scope: mutable production objects are never exposed; external callbacks are deferred through a bounded microtask queue after production processing; emitted payloads are immutable.

## 2026-10-02 — D-015 … D-024 (R8 P1-07 Claude Code)
D-A option 1, D-B option 1 and D-C proceed were applied as **default applied by Claude Code per FINAL_REVIEW_FOR_CLAUDE_CODE §11.4**. Full table with reasons, evidence and rollback: `docs/phase01/claude_code_r8_p1_07_20261002/DECISION_LOG.md` (D-015 settled-anchor proof wording, D-016 field build ships frozen pose.js, D-017 proceed into Track P, D-018 binding inputs in p105/p106 honest calls, D-019 S-06 minimum form + full target recompute, D-020 fail-closed sink constructor, D-021 scheduler cancel semantics, D-022 event-log evidence gate, D-023 F01 Playwright/fallback method, D-024 git metadata outside the package root).

## 2026-10-03 — D-108-01 … D-108-14 (R8 P1-08 Claude Code)
Narrow integration repair after independent audit (BLOCKED BEFORE FIELD TEST). Shared `FrameIdentityCore` (clock-domain identity/order); explicit thaws of protected `evidence_budget_core.js` and `temporal_evidence_layer.js` (augmentBundle mapping only); native facade generation authority; Swift bridge and frozen `app.js` not edited (M-04/M-01 OPEN, scope-restricted). Full table with reasons, evidence and rollback: `docs/phase01/claude_code_r8_p1_08_20261003/DECISION_LOG.md`.

## 2026-10-05 — D-R2-01 (Post-P108 R2/R3, Claude Code) — DECIDED: option 1
Owner authorization in chat (2026-10-05, after the option-1 recommendation in `docs/post_p108_r2/OWNER_DECISION_REQUIRED.md`): "ผม อนุญาติให้ทำในสิ่งที่ต้องทำ จะแก้ไขหรืออะไร ได้ แค่ขอให้จบจริง". Applied option 1: the Post-P108 H02 identity rule (no identity from epoch/size/proximity; camera identity only in an explicit source+generation domain; persisted rows carry FrameUID) is authoritative for the 8 legacy assertions in `test_transaction_r7.js`, `test_evidence_identity_writer_r8c.js`, `test_p108_h02_identity.js` (3), `test_p108_astra_probes.js` (2), `test_p108_m05_migration_compat.js`. Each original assertion is kept verbatim in a comment; each intent is re-asserted on production-shaped data (explicit domain, stored FrameUID, healthy-window replacement). The auditor's verbatim ID-CLONE probe is pinned as superseded at its exact value (2); WORKER-NULL-MAPPING is now asserted GREEN. Rollback: revert the R3 commit; the R2 commits restore the red-but-unedited state.

## 2026-10-05 — D-EL19-01 (Post-P108 R4, Claude Code) — Equipment EL19 owner list merge + Equipment Form fixes
Owner request in chat (2026-10-05): "ช่วยเอาข้อมูลนี้ใส่ไปในฐานข้อมูลอุปกรณ์ที่มีอยู่แล้ว ช่วยดูว่าฟอร์มขออุปกรณ์ข้อมูลมันซ้ำซ้อนหรือ ใช้งานได้ดี ถูกต้อง หรือมีอะไรต้องแก้ไขไหม", with the standing authorization "อนุญาติให้ทำในสิ่งที่ต้องทำ … แค่ขอให้จบจริง". Explicit thaw of the protected `app/static/equipment_catalog.js` (previous pin `d5eaf099…aa0a`) and `app/static/equipment_lab_layer.js` (previous pin `dd425979…00c0`); new pins and THAWED record in `build_r8_artifact.py`. The EL18 canonical JSON (`40eb1a46…4344`, 683 records) is NOT modified; EL19 is a new canonical file built from it by `app/tests/phase01/build_equipment_catalog_el19.py`.
Decisions: (a) owner rows are added only as `owner_supplied_unverified` (no auto-fill/lock fields; values as `reported_*`), because the list has no sources and contains placeholder-looking values; (b) verified values win every conflict (8 reported); (c) 12 ambiguous rows are held, not guessed; (d) 9 EL18 duplicate records folded and 13 renamed (core moved to `variant`, case unified) with `merged_ids`/`model_aliases`/`additional_sources` and the full removed record in `internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json` — the "683 monotonic unless evidence-backed dedup in an audit" rule is met by that audit, and every EL18 id still resolves through `byId`; (e) multi-model rows are kept as listed and flagged. Evidence: `docs/post_p108_r4/EQUIPMENT_EL19_REVIEW.md`, `test_equipment_catalog_el19.js`, `test_equipment_form_el19.js`, `p108_browser/run_equipment_form_el19_chromium.cjs`.
Rollback: restore `app/static/equipment_catalog.js`, `app/static/equipment_lab_layer.js` and the two cache keys in `app/static/index.html` from commit 8b0760a (`git checkout 8b0760a -- <files>`), restore the EL18 pins in `build_r8_artifact.py`, and delete `app/tests/test_equipment_catalog_el19.js`, `app/tests/test_equipment_form_el19.js`, `app/tests/p108_browser/run_equipment_form_el19_chromium.cjs` together with their entries in `PACKAGE_CONTRACT.json` and `verify_package_fresh_unzip.py` (the widened version checks in older equipment tests accept EL18 and need no change); the EL19 JSON/audit/CSV may stay as unreferenced inputs. A setup saved under an EL19-only name would then show its selectors unselected while the saved name text stays in the form (names are stored as text; no data loss).
