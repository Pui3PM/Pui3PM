# R8 P1 Harden Checkpoint — Pure/Offline through P1-06

Date: 2026-10-01
Status: DEVELOPMENT ONLY · NOT RELEASE · NO LIVE SHOOTING · NO LIVE NATIVE/BROWSER SHADOW

## Basis
Astra delta review verdict is CONDITIONAL GO for pure/offline P1-02..P1-06 after P1-01 hardening. The reviewed R8 merge candidate remains frozen separately; this tree is a continuation branch.

## Closed in the shadow foundation at this checkpoint
- P1-01 strict types: U64/I64 range enforcement, canonical `-0` rejection, deep immutable validated envelopes, required createdByVersion, source/mapping cross-field checks, bounded uncertainty for validated mappings, calibration provenance, checked run/master/clock/generation mapping binding.
- Trace-only pose seam hardening within owner-approved scope: no production object refs are exposed; trace payloads are immutable; external emit is deferred through a bounded microtask queue; stripping only the approved seam reconstructs frozen HV3 pose.js SHA-256 exactly.
- P1-02 replay + identity: one identity-material implementation feeds Node SHA-256 and browser/WebCrypto hashing; golden FrameUID vectors match; generation resets change FrameUID.
- P1-03 independent per-role ring + Side-priority scheduler pure foundation.
- P1-04 single shadow decision owner + terminal immutable/idempotent in-memory event-log foundation.
- P1-05 single-writer command semantics + deterministic logical25 projection foundation with injective real FrameUID assignment.
- P1-06 pure review view-model + archive manifest/blob integrity foundation. Anchor view never falls back to Draw.

## Intentionally still open in legacy/production path
Astra M01/M02/M03/M04 and F01-F12 are NOT declared fixed. Characterization still reproduces:
- temporal merge -> budget: 25 null-identity frames -> 1
- temporal merge -> budget: 25 unique 240 FPS frames -> 13
- camera_timeline null master time -> 0
- budget cross-source same-media identity collapse -> 1
- imported HV3 native writer bypass of R7 queue remains source-confirmed
- imported HV2 observer loop / Anchor handler conflict remains active in legacy UI
- production source-time, evidence resolution, shared-thread inference, Windows native runtime, mixed routing, archive provenance, native bridge security/concurrency, and exact matched-frame benchmark remain open

## QA truth
- Pure Phase0/P1 tests in `app/tests/phase01/test*.js`: PASS.
- Existing JS suite: 100/103 PASS. Three original failures stop only at the intentional old pose hash sentinel. Original tests remain unchanged.
- Diagnostic continuation compiled the same three tests in memory with only the current approved pose hash substituted; all downstream assertions PASS.
- `static_integrity_x282.py`: expected FAIL only at pose frozen hash policy mismatch.
- Mac launcher preflight on Linux host: PASS; Mach-O/native camera runtime not executed.
- C++ shared ring compile/run: PASS.
- Windows Media Foundation non-Windows build-host sentinel compile/run: PASS; actual Windows runtime remains E_NOTIMPL/not-supported.
- Swift native capture bridge syntax parse: PASS; not a macOS runtime test.
- Distribution contract: expected FAIL at pose old frozen hash; this development tree is not packaged/promoted.

## Lineage proof
`docs/lineage/R8_P1_LINEAGE_PROVENANCE.json` contains EL18/R7/HV3 parent ZIP hashes plus per-file parent/candidate hashes and classification. All R7-only production `app/static/` changes remain byte-identical; only R7 QA result output differs among R7-only paths.

## Next review question
Review whether P1-01 hardening and pure/offline P1-02..P1-06 foundations satisfy the amended contract well enough to proceed to the next controlled stage. Do not authorize live shooting/native/browser integration merely because pure tests pass. Specifically red-team identity portability, ring eviction/lease semantics, scheduler fairness/non-blocking, event idempotency/terminal state, writer merge/conflict behavior, logical25 assignment correctness, archive provenance, and trace observer isolation.
