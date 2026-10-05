# 3PM R8 Post-P108 R3 delivery — 2026-10-05 (Claude Code)

**Status: MAC BENCH CANDIDATE.** Every software gate that can run on Linux passes on a fresh unzip of the delivered ZIPs
(field class 117/117). **NOT field-validated and NOT production:** Mac launch, Swift compile, camera, BLE, archer and
labeled data are NOT RUN. No live shooting and no real athlete data until `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 pass on
the Mac.

Lineage: delivered Post-P108 (Codex `42a24800`, 106/116) -> R2 (identity defects R2-01..R2-05 repaired, 112/117, red =
owner policy decision only) -> R3 (owner decided D-R2-01 = option 1). Source: GitHub `Pui3PM/Pui3PM`, branch
`claude/magical-rubin-bovhje`, folder `3PM_Analyzer/`. Exact ZIP hashes and the final fresh-unzip run are in the external
`3PM_POST_P108_R3_SHA256SUMS.txt` and `3PM_POST_P108_R3_VERIFICATION.json` (a manifest cannot hold its own hash).

## 1. What R3 changes (on top of R2)
- **D-R2-01 = option 1** (owner authorization, 2026-10-05; `docs/architecture/DECISION_LOG.md`). The Post-P108 H02 rule
  governs 8 legacy assertions in 5 files. Each original assertion stays verbatim in a comment; each intent is re-asserted
  on production-shaped data:
  - `test_transaction_r7.js`: same media without source+generation -> 2 rows; same media inside an explicit domain -> 1
    ("same real media frame must not count twice" kept).
  - `test_evidence_identity_writer_r8c.js`, `test_p108_h02_identity.js` (pipeline fold): rows 5 ms apart are both kept; a
    healthy worker window replaces the sparse row of the same instant (new check), Recovery kept.
  - `test_p108_h02_identity.js` ID-CLONE and fixed-25-with-clones: rows go through the shipped writer (FrameUID), so a
    stored row and its readback clone are one frame and clones never fill slots; UID-less equal epoch+size rows stay apart.
  - `test_p108_astra_probes.js`: WORKER-NULL-MAPPING is now asserted GREEN (the auditor's expected 25); the verbatim
    ID-CLONE probe is pinned as superseded at its exact value 2, intent proven on the production path.
  - `test_p108_m05_migration_compat.js`: the P1-07 0/0 characterization flips to "both real rows kept" plus a migration
    frame-set check.
- `build_post_p108_engineering.py`: `--field-label`, `--field-status-line`.
- No production file changed in R3 (`app/static`, Swift, launcher identical to R2).

R2 content (still in force): `frame_identity_core.js` v4, `evidence_identity_persistence_layer.js` v2 (provenance
FrameUID + deterministic read stamp for historical rows), Swift `CaptureManager` lock, cache keys, harness fidelity,
M-04 re-pin, `test_post_p108_r2_identity.js`, Chromium R2 identity gate, fresh-unzip verifier. See
`docs/post_p108_r2/` (historical for status, current for the defect analysis).

Byte-identical to the delivered Post-P108 build: `app.js`, `core_runtime.js`, both runtimes, `pose.js` per class,
`evidence_budget_core.js`, `temporal_evidence_layer.js`, `capture_integrity_layer.js`, Equipment EL18 (683), launcher,
internal scripts. No biomechanics, release, let-down, scoring or Legacy Shot Decision change.

## 2. Checks actually run (Linux, Node 22.22, Python 3.11, Chromium 141.0.7390.37 headless; fresh unzip, path with spaces)
| Gate | MAC BENCH (field class) | DEV |
|---|---|---|
| JS regressions (all `test*.js`, `stress*.js`) | **117/117** | 114/117 — the 3 pose-policy sentinels (DEV ships the approved trace seam by design) |
| Phase01 | 15/15 | 15/15 |
| Distribution contract, static integrity, executable Mac preflight, ZIP member modes | PASS | PASS |
| Chromium: full-app 25/25, Post-P108 7/7, R2 identity 12/12 | PASS | PASS |
| Chromium: identity parity, F01, shadow bundle, Anchor SINGLE_OWNER, full-page LOADED | PASS | PASS |
| Swift syntax (tree-sitter-swift, both helpers) | PASS (syntax only) | — |
| Mac launch, Swift compile, camera, BLE, Windows, archer, labeled data | **NOT RUN** | **NOT RUN** |
Backend = documented test double; frames = synthetic canvas/Blob fixtures. Not camera or backend acceptance.

## 3. Open (cannot be closed from Linux)
- Mac bench §0–§1: launcher, native helper compile (`build_failed` falls back to browser capture), `lsof` 127.0.0.1 only,
  Origin 403, rapid camera reopen, no duplicate/missing frames after refresh and after Recovery.
- M-01 frozen high-FPS sampler (use 30 FPS). M-04 no request authentication (loopback + Origin allow-list in source).
- Release/let-down accuracy needs independently labeled live-bow data (elastic-band data is not live-bow evidence).
- Historical rows already duplicated by older builds stay as separate rows (no proof to collapse them).

## 4. Start
Extract `3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005.zip` to a NEW folder and open `START_3PM.command` (only
launcher). It opens Chrome/Edge with a new isolated profile named after this package. Follow
`docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 with disposable data and send back the Terminal output, the last 30 lines of
`~/Library/Logs/3PM Form Analyzer Native Capture.log`, the `lsof`/`curl` results and screenshots of any Review problem.

## 5. Rollback
Close this version (its Terminal window) and open `START_3PM.command` of the untouched P1-08 / Post-P108 / R2 folder.
Field-class packages use separate isolated browser profiles per `PACKAGE_ID.txt`. Never delete sessions, databases,
profiles or older folders. Git: revert the R3 commit to return to R2 (identity repairs kept, 8 assertions red but
unedited); revert to commit `d6af163` for the delivered Post-P108 bytes.
