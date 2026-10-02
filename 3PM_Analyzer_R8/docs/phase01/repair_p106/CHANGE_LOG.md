# R8 P1-06 Pure/Offline Repair Change Log — 2026-10-01

Status: DEVELOPMENT ONLY. No release build. No production authority promotion. No live-shooting approval.

Basis: `R8_P1_06_Astra_Review_TH.md` and evidence bundle supplied by Astra. Repairs are limited to `app/shadow/**`, Phase0/P1 tests, and development documentation. Production shot behavior, Equipment/Athlete/Session, `app/static/app.js`, `app/static/core_runtime.js`, native binaries, and legacy authority remain unchanged in this repair round.

## Implemented repairs
- Shared Node/Browser FrameUID validation moved into `identity_material.js`; overflow, booleans, null, empty IDs and non-canonical U64 are rejected before encoding in both entrypoints.
- Clock mapping now binds source timebase and timestamp kind, validates calibration method semantics, sample provenance and uncertainty component bounds.
- Replay adapter removed silent dimension/mirror/arrival/decode defaults; fixture metadata must be explicit. Frame sequence is not coerced through `String()`. Payload UID/digest conflicts are rejected.
- RoleRing now enforces hard byte admission, explicit byte accounting, bounded leases, eviction of eligible unpinned rows, cleanup on lease release, and explicit time advance for expiry.
- AnalysisScheduler now accepts only `worker-dispatch` task descriptors; arbitrary synchronous compute is rejected at the scheduler boundary. Cancellation/error/outcome accounting added for the pure controller.
- Shadow event log now uses namespace/run/cycle scoped identity, recomputes canonical event digest, validates previous-digest chain, and stores deep immutable copies.
- Evidence writer now scopes command memoization to namespace/run/cycle/role, rejects cross-scope command replay, deep-copies records, validates candidate/projection scope, and forbids late writes after finalization.
- Added central typed record validators for Observation, EvidenceCandidate, ShotEvent and logical25 Projection foundations.
- Logical25 projector now filters invalid candidates before derivation selection, requires payload/provenance/run/master-clock/source/generation evidence, rejects negative/unknown uncertainty for real slots, computes cadence per source-generation, uses deterministic frame ordering, and produces phase-plan metadata on every slot.
- Review view-model validates the logical25 plan before use; Anchor requires a real Anchor slot with phase evidence. Inactive is labeled Inactive, not Missing.
- Shadow archive now validates baseline SHA-256, safe/unique paths, strict base64, size/file-count limits and payload-reference integrity on build and import validation; records are deep-copied; in-memory idempotent namespace staging test-double added.

## Tests added/strengthened
- `test_astra_p106_repairs.js`: direct regression coverage for RT-01..RT-08.
- `projector_oracle_postrepair.cjs`: 3360 deterministic input permutations; no input-order discrepancy found in this bounded oracle set.
- Existing P1-01..P1-06 tests updated only to provide metadata newly required by the contract; assertions were not weakened.
- Original Astra evidence/repro scripts/results preserved under `docs/review/astra_p106_original_evidence/`.

## Explicit non-changes
- No production legacy UI, temporal evidence, native writer, release classifier, shot FSM, Equipment/Athlete/Session or native runtime was repaired/promoted in this round.
- `pose.js` was not expanded beyond the previously owner-approved trace seam.
- In-memory writer/event log remain test doubles; IndexedDB transaction/fencing/journal/quota/crash durability is not implemented by this repair.
