# 3PM Analyzer — R8 P1 Harden Development State — 2026-10-01

**Status: DEVELOPMENT / PURE-OFFLINE SHADOW ONLY. NOT A RELEASE. NOT APPROVED FOR LIVE SHOOTING.**

Lineage is now explicit and evidence-backed: `EL18 -> R7 TransactionRepair parent -> selective HV3 merge -> owner-approved pose trace seam -> P1 hardening`. R7 is the parent policy because its transaction/persistence/negative-control repairs must not disappear. HV3 contributes native/timeline/multi-camera foundations selectively. Full per-file parent/candidate hashes are in `docs/lineage/R8_P1_LINEAGE_PROVENANCE.json`.

Parent ZIP SHA-256:
- EL18: `4ff83455870a0fc6072b926e432ae88d078b4b9984c30e1d7ae897cfe3302d59`
- R7: `c329e98a3d92640b6cfbca37fba47781c4653ce5b24c1dec716069219f10c34c`
- HV3: `1bc31b86216222c5691b3d7bd1e649d1294595b17e67260ec72e9ff15082ffcd`

## CURRENT — 2026-10-02 R8 P1-07 Claude Code implementation block
**Status: Software Candidate Ready for Field Validation. NOT Production Ready.** Field class artifact = `3PM_Analyzer_R8_FIELD_TEST_20261002.zip` (FIELD TEST BUILD — NOT PRODUCTION); development class = `3PM_Analyzer_R8_P1_07_DEV_20261002.zip`.
- Base `3PM_Analyzer_R8_P1_06_ClaudeRepair_DEV_20261002.zip` SHA-256 `1904f87d…bf21`; lineage EL18 → R7 parent → selective HV3 merge → R8 kept; R7 TransactionRepair behaviour untouched.
- All FINAL_REVIEW_FOR_CLAUDE_CODE findings Q-01..Q-03, S-01..S-13, P-01..P-06 reproduced RED on the base and closed GREEN with permanent regressions (`docs/phase01/claude_code_r8_p1_07_20261002/CLOSURE_MATRIX.md`). P-07, P-08 recorded only (need Mac clock measurement / labeled data).
- **M01/F02, F03, M03/F04, M04/F01 are closed in software** (R8C production evidence patch): temporal identity no longer collapses null/240 fps samples; null clocks stay null; native writer joins the frozen `evidenceDbMerge` queue; rail render is idempotent so the app reaches `load` in Chromium; Anchor has a single owner.
- Status by layer: source repair DONE · deterministic tests PASS · offline integration PASS (dev 101/104 = 3 pose sentinels; field 104/104) · browser verification PASS on Linux headless Chromium 141 · **Mac runtime NOT RUN · Windows runtime NOT RUN · real camera NOT RUN · real archer NOT RUN · labeled field dataset NOT RUN**.
- Owner decisions applied with their documented defaults: D-A option 1, D-B option 1 (field build ships frozen `pose.js`), D-C proceed.
- Next: run `docs/FIELD_TEST_INSTRUCTIONS.md` on the Mac. Read `docs/phase01/claude_code_r8_p1_07_20261002/` first.

---

## Astra Delta Review status
Astra verdict: CONDITIONAL GO for P1-02..P1-06 **pure/offline shadow only**. Live/browser/native shadow, production rollout and live shooting remain NO-GO. Review evidence is preserved under `docs/astra_review_20261001/`.

Confirmed legacy/integration gaps remain OPEN (as of 2026-10-01; **superseded 2026-10-02**: M01, M03, M04 and F03 closed in software by R8 P1-07 Track P — see CURRENT section):
- M01/F02 upstream `temporal_evidence_core` still collapses null/high-FPS frames before budget (25->1 / 25->13).
- M02 legacy budget identity/ordering still lacks full source+generation/UID semantics in production path.
- M03 imported HV3 native writer still bypasses R7 queue.
- M04 imported HV2 UI observer loop and Anchor handler ownership conflict remain active in legacy UI.
- F03 production clock path, F06 resolution, F07 shared-thread inference, F08 Windows E_NOTIMPL, F09 mixed routing, F10 archive provenance, F11 bridge security/concurrency, F12 exact matched-frame benchmark remain OPEN.

## P1 pure/offline progress
- P1-01 hardened: bounded U64/I64, reject `-0`, createdByVersion, deep immutable/defensive frame envelopes, source/mapping cross-field rules, validated uncertainty requirement, calibration provenance, checked run/master/clock/generation binding.
- Pose trace seam hardened: no mutable production refs exposed; external emit deferred through bounded microtask queue after production path; immutable payloads; baseline reconstruction test PASS.
- P1-02 replay adapter + shared identity material: Node SHA-256 and WebCrypto golden FrameUID vectors match.
- P1-03 independent role ring + Side-priority scheduler foundation PASS.
- P1-04 single shadow decision owner + idempotent terminal event log foundation PASS.
- P1-05 single writer command semantics + logical25 projector foundation PASS.
- P1-06 pure review view-model + archive byte/provenance integrity foundation PASS.

These modules are isolated under `app/shadow/`; they are not imported by production `index.html` and have no production mutation authority.

## QA truth
- Phase0/P1 pure tests: PASS (see current checkpoint results).
- Existing JS regressions: `100/103 PASS`; exactly three original tests stop at the intentional old `pose.js` frozen-hash sentinel. Diagnostic in-memory continuation substituting only the current approved pose hash passes all downstream assertions in those three tests. Original tests are not edited to hide the policy mismatch.
- Active static integrity gate PASS โดย pin owner-approved trace-seam hash และ `test_pose_narrow_thaw.js` reconstructs frozen pose baseline byte-for-byte; app.js/core_runtime.js/native binaries remain frozen. Original legacy tests are intentionally not rebaselined and therefore remain 100/103.
- Known legacy characterization still reproduces temporal 25->1 / 25->13, null master->0 and cross-source identity collapse. Do not call F01-F12 closed.
- No macOS/Windows live camera, browser live shadow, or real-archer acceptance has been run for this candidate.

Equipment source of truth remains EL18, 683 records; do not regress catalog lineage.

## 2026-10-01 P1-06 pure/offline repair after Astra red-team
Astra RT-01..RT-08 repair work has been applied only to `app/shadow/**` and Phase0/P1 development tests/docs. Shared Node/WebCrypto validation, strict replay metadata, hard-bounded ring/lease behavior, worker-dispatch scheduler boundary, scoped immutable event/writer semantics, stricter logical25 selection, Review validation and Archive validation are now covered by direct regression tests. This is a **repair checkpoint, not P1-06 completion**.

Current proof: pure/offline repair tests pass; legacy production suite remains 100/103 with exactly the three known old-pose-hash sentinels, and diagnostic continuations pass after substituting only the approved pose hash in temporary copies. Actual Chromium negative validation is BLOCKED in this container; native camera and real-archer acceptance remain NOT RUN. See `docs/phase01/repair_p106/`.


## 2026-10-02 Claude independent-review repair checkpoint
- Current artifact remains DEV / NOT RELEASE / NOT FIELD BUILD.
- Pure/offline R8C-01..R8C-17/R8C-19 repairs live under `app/shadow/**` and Phase01 tests only; production `app/static/**` remains unchanged from the reviewed parent.
- Legacy production R8C-18 remains OPEN pending owner authorization for a separate production-touching work block.
- F02 reporting is split truthfully: budget core 25/25; upstream legacy temporal path remains 1/13 OPEN.
- Browser-portable bundle VM proof exists, but actual Chromium/Mac/Windows/camera/archer runtime gates remain NOT RUN/BLOCKED.
