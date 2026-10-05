# 3PM R8 Post-P108 delivery — 2026-10-05

## 1. Results and usable files
Complete Mac engineering package with ARM64/x64 frozen runtimes, offline assets/models, all source and one public launcher START_3PM.command. New package; P1-08 is preserved.
**UNPROMOTED / SOFTWARE REGRESSION GATE BLOCKED. Not Software Candidate Ready for Mac Bench; not restricted field validated; not Production Ready.**
Base commit: 0f3ee6d08ab59a1cca98611762d2d7947b012bb5. Working branch: codex/3pm-r8-post-p108-20261005.
Use the external SHA256SUMS and PROVENANCE manifests for exact delivered artifact hashes and source commit.

## 2. Changes and reasons
- H02: timestamps/sizes/near epochs no longer prove identity; require durable FrameUID or an explicitly identified device/source/generation clock domain. Unknown aliases cannot join two durable UIDs. Unknown selection keys are object-specific, so distinct equal-time/size inputs do not collapse in the 25-frame selection map.
- Persistent identity: assign identity before calling the existing R7 serialized evidence writer. Readback/retry retains that ID and bytes. Real camera data are never fabricated. This adds a production writer adapter; direct unstamped legacy records remain conservatively distinct.
- H03: Swift reserves lifecycle ownership before camera permission waits; hardware start work is serialized; token checked before and after startRunning; scoped close cancels pending work and fences closed generations. Stale outputs/encode/Vision completion cannot publish into a successor.
- M06: require successful /diag, matching generation, explicit active=true and no error. Opening/unconfirmed is not active. Subsequent diagnostic failures demote readiness. Final close is sent even following unconfirmed fallback.
- End grouping: UI policy sets six analysis shots/end independently of Impact scoring. Frozen app.js remains byte-identical. No biomechanics/release/let-down thresholds or Legacy Shot Decision authority changed. Equipment EL18 and native runtime binaries remain byte-identical.
- Adjacent M04: bind to loopback; reject non-loopback browser origins; require generation in close. No bearer authentication added; malicious local processes remain a threat. Native compile/runtime are NOT RUN.

## 3. Checks actually run
Baseline P1-08 frozen-pose distribution: 113/113 legacy JS files PASS.
Authoritative DEV ZIP: 278 app/internal files match exact Git base bytes, zero mismatches; ZIP SHA b7ae1c5e4784052129d6bfb6bae1e815e1cbffe0465ab2254abc1f9d65bd08c3.
Closure Kit SHA: 8/8 PASS; its detached model tests: 10 checks PASS. Those model checks do not prove integration.
Phase01 tests: 15/15 PASS.
Full application Chromium 153 with backend test double: existing gate 25/25 PASS (actual UI interaction, IndexedDB, observer/URL hygiene).
New browser gate: analysis 6 versus scoring 3; browser process close/restart with persistent profile and real Blob bytes; FrameUID/provenance round-trip; 25 logical slots/Missing; session isolation; 30 FPS input received=30, unique=30, persisted=25, selected=25 PASS. Synthetic frame bytes, not real camera evidence.
New identity tests: 9 groups PASS, including adversarial permutations and 30/60/120/240 core retention. This is NOT production high-FPS sampler acceptance.
New M06 tests: 6 acknowledgement cases PASS against HTTP test double.
New H03 tests: 6 lifecycle model groups and Swift source fences PASS; model/source inspection is PARTIAL evidence, NOT execution of the Swift backend.
Unmodified legacy regression files remain FAIL where they require unsafe identity/unknown-domain ordering or pin the original exposed Swift implementation. Exact outputs are retained in TEST_RESULTS.json. All-green gate is NOT claimed.
Clean extraction verification and final commands/results are in the external delivery evidence/test report. SHA manifests cover delivered bytes; no missing models/assets/runtimes.

## 4. Limitations / open issues
- Full mandatory legacy regression suite is not green; no candidate promotion. Do not silently replace expected results. The new specification forbids several identities that old tests require. Source-less/generation-less historical records lack proof to collapse clones; retain them rather than delete evidence.
- A deterministic JS model is not a Swift lifecycle concurrency test. Swift compile, macOS SDK, permissions, camera/device changes, startRunning races, actual backend/runtime persistence, and real Mac browser acceptance: NOT RUN.
- Windows and real archer/field/labeled data: NOT RUN.
- M01 frozen upstream production sampler remains OPEN for 60/120/240 FPS. Restricted 30 FPS browser fixture processing only is tested; actual camera minimum cadence is NOT RUN.
- H03 assumes monotonically increasing frontend generation within one helper lifetime. On frontend generation reset, restart via START_3PM.command (relaunches helper); native automatic reconnect across a counter reset needs Mac verification.
- Local-origin commands still have no secret token. The loopback binding/Origin check reduces remote exposure but is not full local-process authentication.
- Old source/field gate documents are historical evidence; this report and current root status override their readiness claims.

## 5. Start / next validation
Extract the Mac engineering ZIP to a new folder; keep P1-08 installed separately. Open START_3PM.command (only public entry). macOS 13+; ARM64 and x64 runtimes included. Native helper is compiled locally by the existing launcher if a verified macOS Swift SDK is installed; failures explicitly fall back to browser capture. This behavior is not a precompiled native-helper build acceptance claim.
This package is for disposable engineering bench inspection only, not live shooting or promoted field use. The launcher keeps the existing isolated profile behavior; do not delete sessions or old profiles.
Collect launcher output, native capture diagnostic state, capture integrity trace and export/restore files. Validate permissions, repeated close/open, device switch/reconnect and generation reset on a real Mac. Field validation remains blocked until all mandatory software gates have an approved resolution and the Mac gate has actually passed.
Rollback: close this version; launch the untouched original P1-08 folder with its START_3PM.command. Keep separate browser profiles and all existing data. Git rollback reference is the authoritative base commit above; do not overwrite databases or reuse an older unsafe evidence writer on newer data.
