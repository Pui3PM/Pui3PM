# P0-06 — Approved pose.js narrow thaw

## Authority
Project owner approved the thaw on 2026-10-01 with the condition that changes may proceed only when they improve the program/measurement path without breaking existing behavior.

## Scope
Changed only `app/static/pose.js` in the previously frozen set. `app.js`, `core_runtime.js`, and Analyzer binaries remain baseline-identical.

The seam records developer-only metadata around the exact object already selected by `inferenceSource` and passed to `landmarker.detectForVideo(input, ts)`. It does not replace the inference input, does not change the timestamp passed to MediaPipe, and does not alter thresholds or phase/release policy.

The external trace callback is never invoked before `detectForVideo`; this prevents a slow diagnostic callback from changing which live video frame the legacy inference sees. Callback failure is caught and cannot break the production path.

## Exact-frame truthfulness
- `canvas-snapshot` / `video-frame`: can be marked stable for synchronous read of the same input object.
- `video-direct`: marked `blocked-live-direct-video`; no claim of immutable exact raster is made.

## Hash evidence
- HV3 baseline pose.js: `22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d`
- P0-06 pose.js: `ca544eb05f68e309de2b8c6b0855448b211788230d7820edb651f7c7c4e5cb50`
- `app/tests/phase01/test_pose_narrow_thaw.js` removes only the approved trace block/calls and verifies the reconstructed file equals the baseline hash byte-for-byte.

## QA status
- Syntax: PASS (`node --check`).
- Phase01 trace seam test: PASS.
- Contract foundation: PASS.
- Original 99 legacy JS tests: 96 PASS, 3 FAIL only because they intentionally assert the old frozen pose hash.
- Diagnostic-only copies of those 3 tests with only the expected pose hash substituted: downstream assertions PASS.
- Legacy static integrity: expected FAIL on pose.js hash only; baseline expectations were not refreshed.
- macOS live camera / real archer: NOT RUN in this environment.
