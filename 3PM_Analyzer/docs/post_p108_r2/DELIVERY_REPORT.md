# 3PM R8 Post-P108 R2 delivery — 2026-10-05 (Claude Code)

**Status: UNPROMOTED engineering package. Mandatory regression gate: 5 files red, all of them the owner policy
conflict D-R2-01 (`OWNER_DECISION_REQUIRED.md`). Mac / Swift compile / camera / archer: NOT RUN. No live shooting.**

Base: delivered Post-P108 build (Codex commit `42a24800`, DEV ZIP SHA-256 `7bd68668…adea`, Mac ZIP `78dd4aae…522e`).
Source of this build: GitHub `Pui3PM/Pui3PM`, branch `claude/magical-rubin-bovhje`, folder `3PM_Analyzer/`.
Exact ZIP hashes, source commit and fresh-unzip results: external `3PM_POST_P108_R2_SHA256SUMS.txt` and
`3PM_POST_P108_R2_VERIFICATION.json` delivered next to the ZIPs (a manifest cannot contain its own hash).

## 1. What was wrong in the delivered Post-P108 build (reproduced on a clean unzip, 106/116)
Five of the ten red files were not "old unsafe assertions": they were real defects of the Post-P108 change.
- **R2-01 repeated real frames in the fixed-25 rail.** `FrameIdentityCore.idKey()` keyed UID-less rows by object;
  the cores copy rows (`{...f}`), so `selectFixedBudget` saw copies as new frames and filled slots with the same
  image twice while dropping distinct frames (`test_p108_h02_identity` "duplicate real frame sparse-jpeg|99300|3").
- **R2-02 explicit domain required a device id that nothing emits.** v3 compared mediaTime/frameSeq and kept camera
  order only when a frame had source + generation + deviceID. No pipeline in this tree (frozen app.js, worker,
  native bridge) sends a device id, so native frames were ordered by jittered callback epoch
  (`test_evidence_integrity_hv2`, `test_r8_lineage_merge`, `test_p108_h01_chronology`).
- **R2-03 random FrameUID per frame object.** The writer adapter stamped `p1/<random>` on every frame object without
  a UID. The frozen app re-encodes native30 bitmaps to new JPEG Blobs on every persist and layers re-deliver copies,
  so each re-write of one capture became a new frame. Real Chromium, frozen `persistFullShotEvidence` run twice on the
  same buffers: delivered build 19 rows -> 25 rows with 19 distinct images; R2 19 -> 19.
- **R2-04 historical rows without FrameUID were multiplied.** Layers read records raw from IndexedDB (no UID) and
  merged them back; the adapter stamped those copies randomly. Real Chromium: 6 stored rows + 1 new frame ->
  delivered build 19 rows / 7 distinct images; R2 7 rows / 7 distinct images.
- **R2-05 Swift bridge data race (pre-existing, F11).** Each HTTP connection runs on its own queue and the JS facade
  downloads bundle frames 8-way in parallel; `CaptureManager.releaseRequests/bundles` (Swift dictionaries) were
  mutated concurrently. Now guarded by one lock.

## 2. Changes (all narrow; no protected file touched)
- `app/static/frame_identity_core.js` v4: explicit domain = known source AND generation (P1-08 contract D-108-04);
  camera identity decides inside it both ways; same Blob instance counts only when an agreeing camera label
  corroborates it; selection key stable across shallow copies; P1-08 lane chronology restored. All Post-P108
  negatives kept: equal time/size, unknown source/generation, near epochs never prove identity.
- `app/static/evidence_identity_persistence_layer.js` v2: FrameUID from capture provenance only — the same Blob
  instance, the same live dense-buffer entry across JPEG re-encodes (`evidenceFrameToBlob` hook), a deterministic UID
  for explicit-domain frames; deterministic read stamp `h2/<record>/<release>/<row>` for historical rows on every
  evidence-store read (IDBObjectStore/IDBIndex get+getAll hooks, `evidenceDbGet`). Never merges or drops a row.
- `app/native_capture_bridge/3PMNativeCaptureBridge.swift`: `tableLock` around `releaseRequests`/`bundles`.
  Syntax-checked with tree-sitter-swift only; NOT compiled (no macOS SDK here). If it fails to compile on the Mac the
  launcher reports `build_failed` and uses the browser fallback.
- `app/static/index.html`: cache keys bumped for the changed scripts (`p108r2`, `postp108r2`).
- Tests: new `test_post_p108_r2_identity.js` (red on the delivered bytes for R2-01..R2-04, green now) and
  `p108_browser/run_post_p108_r2_identity_chromium.cjs` (real IndexedDB, frozen persist path). The P1-08 harness and
  the R8C writer harness now load the shipped writer adapter and apply its read hook, as `index.html` does (they
  previously tested a writer stack that no longer ships). `test_p108_m04_bridge_exposure.js` re-pinned to the
  hardened source facts its own message asked for; M-04 stays OPEN (no request authentication).
- Tools: `phase01/verify_package_fresh_unzip.py` (repeatable fresh-unzip gate run), `phase01/swift_syntax_check.cjs`
  (optional syntax-only Swift check), `phase01/build_post_p108_engineering.py` parameterised.

Byte-identical: `app.js`, `core_runtime.js`, both runtimes, `pose.js` per class, `evidence_budget_core.js`,
`temporal_evidence_layer.js`, `capture_integrity_layer.js`, Equipment EL18 (683 records). No biomechanics, release,
let-down, scoring or Legacy Shot Decision change. No original assertion edited or removed.

## 3. Checks actually run (Linux, Node 22, Chromium 141 headless; fresh unzip of the candidate ZIPs)
| Gate | Mac bench (field class) | DEV |
|---|---|---|
| JS regressions | 112/117 — red: the 5 D-R2-01 files | 109/117 — same 5 + 3 pose-policy sentinels |
| Phase01 | 15/15 | 15/15 |
| Distribution contract / static integrity / executable Mac preflight | PASS | PASS |
| ZIP member modes (launcher + runtimes executable, internal scripts not) | PASS | PASS |
| Chromium: full-app gate 25/25, Post-P108 gate 7/7, R2 identity gate 12/12 | PASS | PASS |
| Chromium: identity parity, F01, shadow bundle, Anchor single owner, full-page liveness | PASS | PASS |
| Swift syntax (tree-sitter-swift, both helpers) | PASS (syntax only) | — |
| Swift compile, Mac runtime, camera, BLE, Windows, archer, labeled data | NOT RUN | NOT RUN |

## 4. Open
- **D-R2-01 owner decision** (8 legacy identity assertions in 5 files vs the Post-P108 H02 rule). See `OWNER_DECISION_REQUIRED.md`.
- Swift lifecycle/race fixes are source-level; compile + runtime on macOS NOT RUN.
- M-01 frozen high-FPS sampler OPEN (30 FPS only). M-04: loopback + Origin allow-list in source, no authentication.
- Synthetic canvas frames and a backend test double are not camera or backend acceptance.

## 5. Start / next step
Extract `…R2_MAC_BENCH_UNPROMOTED_…zip` to a NEW folder and open `START_3PM.command` (the only launcher). It opens
Chrome/Edge with a new isolated profile named after this package, so older data and caches are not touched. Keep
P1-08 and the delivered Post-P108 folders untouched for rollback. Follow `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 on
disposable data and send back the launcher output and the native-capture log. Rollback: `ROLLBACK.md`.
