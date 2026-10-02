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
