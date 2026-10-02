# Handoff — mandatory order

1. Read `../AGENTS.md` and `../PROJECT_STATE.md`.
2. Read `QA_CURRENT.md`, `ROOT_CAUSE_REVIEW_TH.md`, `TEST_CONTEXT.md` and `RELEASE_LOGIC.md`.
3. Use `../PACKAGE_CONTRACT.json`. The ONLY public launcher is `../START_3PM.command`, unchanged in every future Mac version regardless of AI/model.
4. Current development tree is **R8 P1 Harden DEV**, derived from R7 TransactionRepair as parent plus selective HV3 merge. It is NOT a release and NOT approved for live shooting. Preserve R7 transaction/negative-control semantics, the reviewed parent hashes/provenance manifest, and the owner-approved trace-only pose exception. Equipment Source of Truth remains `EL18-FORM-UX-2026-09-30-R1` (683 records).
5. Equipment catalog changes are monotonic from the EL16 655-record baseline / EL17 681 normalized parent unless an explicit evidence-backed dedup/supersession is written into an audit. Pandarus Champion 11-spine matrix is mandatory.
6. Equipment Form principle: one fact once; product identity separate from size/length/weight; derived facts are not asked twice; numeric unit conversion is real; catalog reference values remain separate from measured setup values.
7. Do not reintroduce competing state writers. `equipment_lab_layer.js` must not erase/reset main-form values owned by frozen `app.js`.
8. Stabilizer length-specific mass must bind to the selected length variant. Fixed V-Bar geometry is derived from the selected variant. Component pickers use verified catalog records plus Unknown/Custom, not parallel hard-coded product menus.
9. RamRods remains Priority 1. Continue current/historical family extraction and merge forward into EL18 or its successor; never branch from older EL14 research catalogs. Existing historical research files are evidence inputs, not new canonical parents.
10. Run full regression, static integrity, executable preflight and distribution contract gates before packaging; regenerate SHA256SUMS only for reviewed changes.
11. Treat prior shooting trial as elastic-band data. Shooting algorithms were not changed by the Equipment work.

Native macOS live UI, camera and BLE acceptance is still required on the user's Mac.

12. Enforce R7 regression closure rules in AGENTS.md. Current false-positive shot label is still missing; do not guess. Preserve new transaction, filmstrip and persistence tests and the diagnostic fixture provenance.

13. Read `../docs/astra_review_20261001/R8_Astra_Delta_Review_TH.md` and `../docs/lineage/R8_P1_LINEAGE_PROVENANCE.json`. M01-M04/M06/M07 findings are mandatory forward constraints. Pure/offline shadow work may continue; browser/live/native/field promotion remains blocked until its gates are explicitly passed.

14. Read `phase01/repair_p106/CHANGE_LOG.md`, `CLOSURE_MATRIX.md`, `KNOWN_LIMITATIONS.md` and current repair test/provenance artifacts before any next phase. Do not call P1-06 complete. Pure/offline RT-01..RT-08 repairs are scoped; legacy M01-M04/F01-F12, durable IndexedDB writer/log, actual browser/native runtime and field gates remain open.

15. Read `phase01/claude_repair_20261002/ARCHITECTURE_STATE.md`, `DECISION_LOG.md`, `CLOSURE_MATRIX.md`, `TEST_RESULTS.md`, and `KNOWN_LIMITATIONS.md`. Claude C01-C20 pure/offline findings have permanent regressions; R8C-18 production legacy repair remains a separate owner-authorized track. Do not infer Chromium/native/camera/field acceptance from VM/compile results.

16. Read `phase01/claude_code_r8_p1_07_20261002/` (CHANGE_LOG, DECISION_LOG, CLOSURE_MATRIX, TEST_RESULTS, KNOWN_LIMITATIONS, ROLLBACK, ARCHITECTURE_STATE). R8 P1-07 closed the round-2 findings and the production evidence path (M01/M03/M04/F03) in software. Status ceiling: Software Candidate Ready for Field Validation. Next gate is `FIELD_TEST_INSTRUCTIONS.md` on the user's Mac. P-07 (cross-source clock identity) and P-08 (null coercion in decision modules) stay untouched until Mac measurement / labeled data. Build artifacts only with `app/tests/phase01/build_r8_artifact.py` (class-aware pose policy; QA snapshots + provenance + SHA256SUMS regenerated from final bytes).
