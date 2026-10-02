# Phase 0 execution status / plan

Current target: complete P0 offline/instrumentation foundation without changing production shot authority.

- P0-00: baseline ZIP/hash/layout pinned — done.
- P0-01: existing 99 JS regressions + static integrity + distribution + Mac preflight baseline rerun — done on Linux host before development additions.
- P0-02: shadow contract/null/identity/time foundation — initial pure modules created; not wired to production.
- P0-03: F01/F02/F03 baseline characterization — F02/F03 dynamic pure repro done; F01 source characterization done, Chromium dynamic local run blocked by environment.
- P0-04: F04 writer call graph + controlled stale-write interleaving — done as source-characterized risk/repro model.
- P0-05: bounded event tape + deterministic virtual-clock replay foundation — initial pure modules created.
- P0-06: owner-approved narrow thaw of `pose.js` — trace-only inference input/result/metrics seam implemented in development checkout.
  - Trace default-off.
  - `detectForVideo(input, ts)` and `computeMetrics(...)` legacy arguments/ordering remain intact apart from guarded trace statements.
  - Trace callback cannot run before legacy inference.
  - Direct-video exact immutable raster remains blocked/honestly marked.
  - Equivalence test reconstructs exact HV3 baseline hash after stripping approved seam.
  - Legacy regression aggregate: 96/99 PASS; 3 failures are frozen-hash sentinels for `pose.js` only. Diagnostic-only copies with the approved hash substituted continue through all downstream assertions PASS.
- P0-07: native capability/security/concurrency inventory — next.
- P0-08: observer-effect/runtime baseline — offline/synthetic can proceed; target macOS live-camera measurement remains not-run here.
- P0-09: Phase 0 completion dossier after P0-07/P0-08 evidence.

## Astra delta review continuation — 2026-10-01
- Reviewed R8 merge artifact frozen separately; this tree is P1 hardening continuation only.
- P1-01 hardening: done for pure contract boundary; new tests PASS.
- P1-02 replay/portable identity foundation: done pure/offline; PASS.
- P1-03 independent rings/scheduler foundation: done pure/offline; PASS.
- P1-04 single decision owner/event-log foundation: done pure/offline; PASS.
- P1-05 single writer/logical25 projector foundation: done pure/offline; PASS.
- P1-06 pure review/archive foundation: done pure/offline; PASS.
- Legacy M01/M02/M03/M04 remain deliberately unpatched in production path at this checkpoint; repro is preserved rather than hidden.
- Live/browser/native/field work remains NO-GO pending next review and explicit stage approval.
