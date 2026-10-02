# KNOWN_LIMITATIONS — R8 P1-07 (Claude Code, 2026-10-02)

Status ceiling of this block: **Software Candidate Ready for Field Validation**. Not Production Ready.

| # | Limitation | Status |
|---|---|---|
| 1 | No macOS runtime at all: launcher, native AVFoundation Side, fps/drops/thermal, reconnect, generation change, physical clocks | NOT RUN (no Mac in this environment) — runbook in `docs/FIELD_TEST_INSTRUCTIONS.md` |
| 2 | Windows Media Foundation adapter is a stub | NOT RUN; must report `unavailable` |
| 3 | Real camera, real archer, labeled field dataset (release vs let-down vs elastic band vs collapse/occlusion) | NOT RUN; no accuracy claim |
| 4 | Browser evidence is Linux headless Chromium 141 (Playwright `chromium-1194`), not Safari/Chrome on macOS | Re-run browser gates on the Mac browser used in the field |
| 5 | P-07 cross-source same-mediaTime merge in `evidence_budget_core.canonicalUnique` | OPEN by mandate; needs Mac measurement of native PTS vs browser mediaTime |
| 6 | P-08 loose null→0 coercion in 12 production modules incl. decision logic | OPEN by mandate; changing it changes shot authority |
| 7 | `camera_timeline_core.num()` for fps/jitter (null fps → 0 → 50 ms tolerance) | OPEN (OPEN_RISKS R-05) |
| 8 | Scheduler isolation proven at contract level in Node/Chromium only; no real Web Worker executor; Side p95/p99 under aux load not measured. A hung executor that ignores `signal` keeps its lane degraded until it settles — a real Worker executor must terminate/restart the worker | Runtime gate |
| 9 | Shadow durability: IndexedDB `3pm-shadow-v1` single writer, fencing, journal, quota, crash recovery not implemented; writer/log/archive are in-memory models | OPEN |
| 10 | `view_model.buildReviewView` accepts a bare projection; the projection-binding guarantee holds for projections that came through the writer or archive. Any future path that feeds Review from another source must call `verifyProjectionBinding` first | Design constraint |
| 11 | Writer memo pruning deletes the `commandId → aggregate` scope entry of pruned aggregates; a *reused* commandId in a different live aggregate after pruning is not detected as `COMMAND_SCOPE_CONFLICT` (command ids are expected to be unique) | Accepted |
| 12 | Cancelled-generation memory keeps the last 64 generations; a job from an older cancelled generation that settles later would be reported `completed`, not `stale_discarded` (the running job of a cancelled generation is aborted at cancel time, so this needs >64 cancels while one job is still pending) | Accepted |
| 13 | Shadow hot-path cost on Node/Linux: `ring.add` p50 124 µs / p99 429 µs / max 3.4 ms; `project25` 58 ms @ 530 candidates; archive 512 MB validate ≈ 28 s. Must stay off the Side capture/decision thread | Runtime gate |
| 14 | R8C side effect: native writes through `evidenceDbMerge` re-union live frames that native `replaceDense` dropped (same as the R7 browser temporal path) | Accepted R7 semantics (OPEN_RISKS R-12) |
| 15 | All reviews so far are AI-only (Astra, Sol, Claude chat, Claude Code); not independent evidence | Needs runtime/field tests and coach acceptance |
| 16 | Static-server browser runs have no backend: one HTML "Error response" page error and failed `/health`, `/vision/*` requests are environmental | Compare with baseline under the same server |
