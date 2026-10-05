# 3PM R8 Post-P108 R4 delivery — 2026-10-05 (Claude Code)

**Status: MAC BENCH CANDIDATE (unchanged from R3) + Equipment EL19.** R4 = R3 plus the owner's equipment list merged into
the equipment database and the Equipment Form fixes found while reviewing it. Every software gate that can run on Linux is
re-run on a fresh unzip (results: external `3PM_POST_P108_R4_VERIFICATION.json`). **NOT field-validated and NOT
production:** Mac launch, Swift compile, camera, BLE, archer and labeled data are NOT RUN. No live shooting and no real
athlete data until `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 pass on the Mac.

Lineage: Post-P108 (Codex) -> R2 (identity repair) -> R3 (D-R2-01 option 1) -> R4 (D-EL19-01 equipment). Source: GitHub
`Pui3PM/Pui3PM`, branch `claude/magical-rubin-bovhje`, folder `3PM_Analyzer/`.

## 1. What R4 changes (on top of R3)
- **Equipment catalog EL19** (owner request 2026-10-05; `docs/architecture/DECISION_LOG.md` D-EL19-01). 879 records =
  683 EL18 − 9 folded duplicates + 205 owner-list records marked `owner_supplied_unverified`. Verified values are never
  overwritten (8 conflicts reported, verified kept); 12 ambiguous rows held for the owner; 32 doubtful owner records flagged.
  EL18 canonical JSON is byte-identical. Full review: `docs/post_p108_r4/EQUIPMENT_EL19_REVIEW.md`.
- **Equipment Form fixes** (`app/static/equipment_lab_layer.js`): duplicate selector entries removed (folds/renames with
  aliases); saved setups restore from pre-EL19 names (22/22 failed before, 0/22 after); the limb core is offered once per
  variant and only locked for one verified option; the saved limb core is restored (bug found by the new Chromium gate);
  unverified records never auto-fill or lock a mass/weight/spec and are labelled "· unverified" with the reported value as
  text (⚠ when doubtful); script cache keys bumped in `index.html` so browsers do not keep the EL18 catalog.
- New tests: `test_equipment_catalog_el19.js`, `test_equipment_form_el19.js`, Chromium gate
  `p108_browser/run_equipment_form_el19_chromium.cjs` (registered in `verify_package_fresh_unzip.py` and the package
  contract). Older equipment tests only widened their version check to accept EL19 (records ≥ 683, as their own rule says).
- Explicit thaw of protected `equipment_catalog.js` and `equipment_lab_layer.js`: new pins and previous pins (THAWED) in
  `build_r8_artifact.py`; EL19 canonical + audit pinned.

Byte-identical to R3: `app.js`, `core_runtime.js`, both runtimes, `pose.js` per class, `evidence_budget_core.js`,
`temporal_evidence_layer.js`, `capture_integrity_layer.js`, `frame_identity_core.js`, the evidence identity layer, Swift,
launcher, internal scripts. No capture, identity, biomechanics, release, let-down, scoring or Legacy Shot Decision change.

## 2. Checks actually run (Linux, Node 22.22, Python 3.11, Chromium 141 headless)
Source tree (before packaging): JS regressions DEV 116/119 (the 3 pose-policy sentinels fail in DEV by design), phase01
15/15, distribution contract PASS, static integrity PASS, Chromium EL19 equipment gate 18/18. Equipment tests 16/16.
Red-first evidence: EL18 layer restores 0/22 pre-EL19 names (EL19: 22/22); the pre-fix restore order fails the Chromium
gate 17/18; 6 deliberate defects are each caught by the new tests.
Fresh-unzip results for both ZIPs (field class, DEV, phase01, contract, static, preflight, ZIP modes, 9 Chromium gates):
external `3PM_POST_P108_R4_VERIFICATION.json` — a package cannot contain its own verification.
Backend = documented test double; frames = synthetic fixtures. Not camera or backend acceptance.

## 3. Open
- Owner confirmation: 12 held rows, 8 conflicts, 6 multi-model rows, placeholder-looking masses (review document).
- 205 owner records are unverified until a manufacturer source or a measurement exists.
- Unchanged from R3: Mac bench §0–§1, M-01 (use 30 FPS), M-04 (loopback + Origin allow-list, no request auth), release /
  let-down accuracy needs labeled live-bow data, historical duplicate rows stay separate.

## 4. Start
Extract `3PM_Analyzer_R8_POST_P108_R4_MAC_BENCH_20261005.zip` to a NEW folder and open `START_3PM.command` (only
launcher). Follow `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 with throw-away data. Rollback: the untouched R3 folder; for the
equipment change alone see D-EL19-01.
