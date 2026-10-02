# Phase 0 dossier — current offline checkpoint

## Completed

- P0-00 baseline/hash/layout pin.
- P0-01 baseline regression/static/distribution/preflight evidence.
- P0-02 strict shadow contract/null/identity/time foundation.
- P0-03 F01 source characterization, F02/F03 executable repros.
- P0-04 F04 controlled stale-writer interleaving + call graph.
- P0-05 bounded event tape + virtual clock foundation.
- P0-06 owner-approved, default-off pose inference trace seam with byte-for-byte baseline reconstruction test.
- P0-07 native source capability/security/concurrency inventory.
- P0-08 offline observer-effect evidence; target live runtime remains not-run.

## Known blockers / not-run

- Dynamic F01 Chromium execution in this container is blocked by the local Chromium runtime.
- No Go backend source/build recipe in the HV3 package.
- macOS live camera/BLE/runtime tests not run here.
- Windows native Media Foundation adapter remains `E_NOTIMPL` / not-supported.
- Real-archer / live-bow labeled field acceptance not run.
- Direct `<video>` inference cannot yet be certified as immutable exact-raster matched input without changing the legacy acquisition path; it is explicitly marked blocked.

## Production authority

Unchanged: HV3 legacy path remains the only production authority. Nothing in this Phase 0 development checkout is a production release.

## Phase 1 entry decision

Pure Phase 1 modules may proceed now: strict FrameEnvelope/clock mapper, replay adapter, independent role ring/scheduler, Observation contracts, deterministic shadow event log, single shadow Evidence Writer, logical 25-slot projector, isolated review/archive. Live native shadow and production promotion remain gated by the blockers above.
