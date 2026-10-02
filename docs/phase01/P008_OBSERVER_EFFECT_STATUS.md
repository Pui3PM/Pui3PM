# P0-08 — Observer-effect / runtime baseline status

## Completed offline checks

- Original HV3 baseline before development additions: 99/99 JavaScript regressions PASS.
- After approved pose narrow-thaw: 96/99 legacy regressions PASS; all 3 failures are frozen-hash sentinels for `pose.js`.
- Diagnostic-only copies of those 3 tests with only the expected approved pose hash substituted proceed through all downstream assertions PASS.
- The trace seam is default-off and invokes no external callback before `detectForVideo`.
- Trace callback exceptions are isolated from the legacy inference/decision path.
- Equivalence test reconstructs the exact original HV3 pose.js hash when only approved trace additions are removed.

## Not measured here

The current environment cannot establish target-device observer effect for:
- macOS live camera capture/inference;
- Side p95/p99 latency with trace on/off;
- GPU/thermal contention;
- 1/2/3 real-camera operation;
- Windows native runtime;
- real archer / live bow behavior.

These are `NOT RUN`, not PASS.

## Stop rule

If target runtime shows the enabled trace seam changes production decisions or exceeds the approved Side latency budget, live tracing must be disabled and Phase 1 comparison must use offline common-input fixtures until a lower-overhead tee is available.
