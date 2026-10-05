CURRENT 2026-10-05 POST-P108 R4 (Claude Code): MAC BENCH CANDIDATE (as R3) + Equipment EL19 — owner equipment list merged (879 records: 674 verified + 205 owner-list UNVERIFIED; EL18 kept, 9 duplicates folded with aliases), Equipment Form duplicate/restore/core fixes (D-EL19-01). Source tree: DEV 116/119 (3 pose-policy sentinels by design), phase01 15/15, contract/static PASS, Chromium EL19 equipment gate 18/18; fresh-unzip results of the delivered ZIPs are in the external 3PM_POST_P108_R4_VERIFICATION.json. NOT field-validated: Mac launch, Swift compile, camera, archer NOT RUN. No live shooting until docs/FIELD_TEST_INSTRUCTIONS.md §0–§1 pass on the Mac. Read docs/post_p108_r4/DELIVERY_REPORT.md. Older readiness text below (incl. docs/post_p108_r3, docs/post_p108_r2, docs/post_p108) is HISTORICAL.

**CURRENT 2026-10-05: Post-P108 R3 — MAC BENCH CANDIDATE (software gates green on Linux; Mac NOT RUN).**
- D-R2-01 decided (option 1). Fresh unzip: field class 117/117, DEV 114/117 (3 pose-policy sentinels), phase01 15/15; contract, static integrity, Mac preflight, ZIP modes PASS; Chromium 141: full-app 25/25, Post-P108 7/7, R2 identity 12/12, identity parity, F01, shadow bundle, Anchor SINGLE_OWNER, full-page LOADED.
- NOT RUN: Swift compile, macOS runtime, camera, BLE, Windows, archer, labeled data. Details: `post_p108_r3/TEST_RESULTS.json`.

---

**HISTORICAL 2026-10-05: Post-P108 R2 — UNPROMOTED.**
- Fresh unzip (Linux, Node 22, Chromium 141): field class 112/117, DEV 109/117 (+3 pose-policy sentinels); red files = D-R2-01 only. Phase01 15/15. Distribution contract, static integrity, executable Mac preflight, ZIP modes PASS.
- Chromium: full-app 25/25, Post-P108 7/7, R2 identity 12/12, identity parity, F01, shadow bundle, Anchor SINGLE_OWNER, full-page LOADED.
- R2 identity gate on the delivered Post-P108 bytes: FAIL (re-persist 19 -> 25 rows with 19 distinct images; historical record 19 rows / 7 distinct images). On R2: 19 -> 19; 7 / 7.
- NOT RUN: Swift compile, macOS runtime, camera, BLE, Windows, archer, labeled data. Details: `post_p108_r2/TEST_RESULTS.json`.

---

**HISTORICAL 2026-10-03: R8 P1-08 Narrow Integration Repair — Software Candidate Ready for Restricted Field Validation (NOT Production Ready).**

- P1-08 regressions (`app/tests/test_p108_*.js`): H-01, H-02, H-03, M-02, M-05 GREEN (RED on the audited P1-07 bytes); M-01, M-04 characterized OPEN; Astra probes gate PASS (7/8 core invariants + 1 documented R7-contract conflict D-108-06).
- Legacy JS suite: development class all green except the 3 policy pose sentinels; field class must be all green (packaging gate, strict).
- Real Chromium 141 (Linux headless): full-app gate 25/25 (FAIL on P1-07), fullpage LOADED (liveness only), Anchor SINGLE_OWNER, F01 PASS, FrameUID parity PASS, shadow bundle PASS.
- Exact numbers, fresh-unzip results and ZIP hashes: `phase01/claude_code_r8_p1_08_20261003/TEST_RESULTS.md`.
- NOT RUN: macOS runtime, Mac browser, Swift bridge, Windows, real camera, real archer, labeled dataset.

---

**HISTORICAL 2026-10-02: R8 P1-07 Claude Code — claimed Software Candidate Ready for Field Validation; superseded by independent audit 2026-10-03 (BLOCKED BEFORE FIELD TEST).**

- Pure/offline phase01: 15/15 PASS (incl. round-2 regressions, QA runner isolation, browser discovery, artifact class policy).
- Legacy JS suite: development class 101/104 (only the 3 untouched pre-thaw `pose.js` sentinels); field class (frozen `pose.js`) **104/104**.
- Phase0 runner: F02 upstream and F03 `closed`, F01 dynamic Chromium `passed`.
- Real Chromium 141 (Linux headless): F01 harness PASS 8/8, full app LOADED, Anchor SINGLE_OWNER, FrameUID parity PASS, shadow bundle gate PASS 10/10 (incl. 16 MiB archive).
- Oracles: 10000/10000; independent full-25 oracle seeds 1/77/9001 × 10000 no counterexample. Reviewer probes: 0/12 reproduce.
- Distribution contract and static integrity PASS for both classes on a fresh unzip of the final ZIP (see BUILD_REPORT next to each ZIP).
- NOT RUN: macOS runtime, Mac browser, Windows, real camera, real archer, labeled dataset. Details: `phase01/claude_code_r8_p1_07_20261002/TEST_RESULTS.md`.
- QA runners now write to `$THREEPM_QA_OUT` (or system temp); committed snapshots under `docs/` are refreshed only by `app/tests/phase01/build_r8_artifact.py`.

---

**HISTORICAL 2026-10-02: R8 P1-06 Claude Repair DEV — NOT RELEASE / NOT FIELD BUILD.**

- Claude C01-C20 converted regressions PASS.
- 10,000-case brute-force projector optimality oracle PASS; historical 3360 test is input-reversal invariance only.
- Legacy regression suite remains 100/103 with the three original pre-thaw `pose.js` hash sentinels unchanged; `test_pose_narrow_thaw.js` independently reconstructs the frozen baseline byte-for-byte and the active static gate pins the approved trace-seam hash.
- Static integrity PASS. Distribution contract is regenerated/verified only after final SHA256SUMS generation.
- Phase0 truth: F02 budget core = 25/25, upstream legacy temporal path remains OPEN_CONFIRMED at 1/13. F01 actual Chromium remains BLOCKED.
- Browser-portable shadow bundle VM without require/Buffer/process PASS; this is not Chromium runtime acceptance.
- No production `app/static/**`, Equipment, Athlete, Session or native runtime binary changes in this repair block.
- R8C-18 production gaps remain OPEN and block Field Test Build.

---

**Historical dev status (2026-10-01): NOT RELEASE / NO LIVE SHOOTING.** The R7 section below remains historical parent evidence. Astra delta review found open integration gaps; current pure/offline P1 tests do not close legacy F01-F12.

# Current QA — R8 P1 Harden DEV over R7 Transaction Repair + EL18

Status: FIELD CANDIDATE. Software regressions passed; the user's current expansion-then-lower false positive remains OPEN until its captured shot is identified and independently labeled. No live-camera or live-bow accuracy claim.

- Input R6_EL18 baseline: 93/93 JavaScript files passed BEFORE repairs. This demonstrates why old green tests were insufficient.
- R7: 96/96 JavaScript regression files passed. Full output in `qa/r7_results.json`.
- New transaction test: cached/strong native proof loses to pre-commit collapse, wrists-low, lost posture/extension, or native post let-down; positive control remains admitted. Checks fixed-budget witness preservation and no null-media conflation.
- New evidence contract test: actual field timestamps with explicitly SYNTHETIC encoder tags; distinct Hold in its physical interval is usable; missing Hold and known Recovery without a frame remain incomplete. This is not a replay of unprovided pixels/tags.
- New filmstrip test executes the frozen app's original renderer plus the shipped R7 overlay against a DOM model: 25 clickable frames despite 15 legacy backend thumbnails; 25 slots for Side/Rear/Overhead; 15 frames + 10 Missing; reused-release isolation; asynchronous selection race; URL cleanup. Old EL18 fails at 15 versus 25. This is not a Chromium/macOS interactive test.
- New persistence test executes the frozen write queue plus temporal overlay: late stale snapshot preserves Recovery; null mediaTime does not collapse separate frames; exact release matching defeats reused eventId=1; early and late Recovery; auxiliary rejection; failed-write retry.
- New transaction test fails on old EL18's collapse acceptance. Persistence test fails on old EL18's null-media merge. Original behavioral assertions were not weakened; exact build/version and cache-key expectations were updated to the intentional R7 metadata.
- Frozen Dev4 JS / native hashes and static integrity PASS.
- Actual shipped Mac launcher preflight executed on Linux PASS; Mach-O executables not run.
- Final distribution checks and ZIP verification recorded in `qa/r7_distribution_checks.json` after reviewed manifest regeneration.
- Equipment EL18 files/catalog unchanged from input: 683 entries, Champion 11 spines, Hoyt Velos configs and EL18 form fixes preserved.

OPEN: identify the reported false-positive shot among saved 1/2/3; labeled band/live-bow test cases; Foundation/lifecycle disagreement; explicit end-to-end backend save state; real Mac camera/BLE/GUI acceptance. See ROOT_CAUSE_REVIEW_TH.md.


## 2026-10-01 R8 P1 hardening checkpoint
- Full lineage provenance now includes actual EL18/R7/HV3 ZIP hashes and per-file candidate hashes. All R7-only production `app/static/` changes are byte-identical in the current candidate; the only R7-only non-byte-exact path is QA result output.
- P1-01 through P1-06 pure/offline foundation tests PASS.
- Existing JS suite remains 100/103 because three original tests intentionally pin old frozen pose hash. Diagnostic continuation changing only the expected pose hash in memory passes downstream assertions.
- Known legacy repro remains red by design: temporal->budget null identities 25->1, 240 FPS 25->13, null master time -> 0, cross-source same-media collapse.
- No production legacy repair, live browser/native shadow, target-OS camera runtime or archer field validation is claimed by this checkpoint.

## 2026-10-01 P1-06 Astra repair checkpoint
- Direct RT-01..RT-08 regression suite: PASS in pure/offline scope.
- P1 contract/replay/ring/scheduler/event/writer/projector/review/archive tests: PASS with explicit metadata; no silent fixture defaults.
- Legacy JS suite: 100/103 PASS; only the three pre-existing old-pose-hash sentinels fail. Temporary diagnostic continuations changing only the expected approved pose hash: 3/3 PASS.
- Node/WebCrypto negative identity parity: PASS through shared validator. Actual Chromium attempt: BLOCKED/NOT RUN because headless Chromium did not terminate under hard timeout in this container.
- C++ shared ring compile/run, Windows adapter sentinel compile, Swift source parse: PASS; none is a real native camera runtime acceptance.
- No production authority change, no live shooting, no macOS/Windows camera acceptance, no labeled field accuracy claim.
- Known legacy M01-M04/F01-F12 and persistent durability gaps remain OPEN as detailed in `phase01/repair_p106/CLOSURE_MATRIX.md` and `KNOWN_LIMITATIONS.md`.
