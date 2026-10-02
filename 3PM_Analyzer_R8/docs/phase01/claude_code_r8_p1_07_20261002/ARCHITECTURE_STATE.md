# ARCHITECTURE_STATE — R8 P1-07 (Claude Code, 2026-10-02)

## Authority
- **Legacy Shot Decision is the only production authority.** `app/static/**` never imports `app/shadow/**` (asserted by round-2 S-12 block and by the packaging verification on the final ZIP).
- Shadow pipeline (`app/shadow/**`) is pure/offline, in-memory, shadow namespaces only. No dual production commit, no shadow write to real shots, no shadow change to Equipment/Athlete/Session.
- No biomechanics/release/let-down threshold changed. P-08 (loose null coercion inside decision modules) intentionally untouched.

## Production evidence path (Track P, R8C patch applied unmodified)
| Module | State |
|---|---|
| `temporal_evidence_core.js` | strict unknown (null/false/''/undefined never 0); `sameSeq` same-source only; epoch nearness folds only a cross-pipeline duplicate when mediaTime is not comparable; per-source seq inversion |
| `camera_timeline_core.js` | strict `known()` for clock/sequence; `num()` for fps/jitter unchanged (OPEN_RISKS R-05) |
| `native_capture_layer.js` | `putRecord → evidenceDbMerge` (R7 frozen per-record queue, fail-closed with visible `s.error`); bridge JSON nulls stay null |
| `evidence_integrity_repair_layer.js` | rail renders only when its signature (index, count, offsets) changes → no MutationObserver feedback loop; Anchor button single owner |
| `app.js`, `core_runtime.js`, `pose.js` (dev), binaries | byte-identical to baseline |

## Shadow trust boundaries (Track S)
- **Identity**: FrameUID `f1/<64 lower-hex>` only; every real projection slot's UID is recomputed from `(runId, sourceId, streamGeneration, frameSeq)`; injective on the canonical UID.
- **Clock**: validated mapping uncertainty covers each declared component; fixture mappings only in `shadow/replay` or below.
- **Namespace invariant**: one predicate `isShadowNamespace` (strict_types) used by event log, writer, reducer, archive events, importer; constructor may only narrow.
- **Projection binding** (`projector/projection_binding.js`): writer `saveProjection {projection, timeline, releaseTime}` and archive `records.timelines` → slot targets, refs, time, uncertainty, signed delta, tolerance (≤ 50 ms), phase interval containment and phaseProof are re-derived; `timelineDigest` must match; non-contract timeline fields rejected.
- **Archive** `records.schemaVersion: 2`: typed timelines, payload bytes bound to `contentDigest`, shadow-only events, unique projection ids; v1 → `ARCHIVE_SCHEMA_UNSUPPORTED`. Base64 is linear (no size cliff; 64 MiB tested).
- **Scheduler**: executor contract `executor(descriptor, meta, {signal, jobId})`; timeout/stale cancel abort; hung (timed-out, unsettled) lane is `degraded` and drops new work as `worker_unresponsive`; Side and aux lanes are separate slots; generations bounded (64); descriptors deep plain data.
- **Writer idempotency**: memos per aggregate, cap per aggregate, pruning only after finalize + retention, `COMMAND_EXPIRED` for pruned.
- **Reducer (shadow)**: evidence-gated `confirmed`; timeout/reset can never confirm; `applyStreamEvent` → `uncertain(authority_stream_reset)`; pure reorder buffer (Side frameSeq within generation, 200 ms arrival window, gap events, late/stale outputs never applied).
- **Anchor proof** (D-A option 1): `anchorIntervalKind:'settled-anchor-interval'`.

## Packaging
- `PACKAGE_CONTRACT.json` `artifact_class` ∈ {`development_not_release`, `field_test_not_production`} selects the marker file and the pose pin; pins are hard-coded in the gates.
- `app/tests/phase01/build_r8_artifact.py` builds from a staged copy, refreshes QA snapshots from a real run, regenerates provenance (schema 2) then `SHA256SUMS.txt`, and verifies a fresh unzip of the final bytes.
- QA runners never write into the attested package (`THREEPM_QA_OUT`).
