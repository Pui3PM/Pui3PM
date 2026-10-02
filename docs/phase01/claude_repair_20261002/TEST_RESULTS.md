# Test Results — Claude Repair

- `contract_foundation`: **PASSED** — Phase01 contract foundation: PASS
- `p101_contract_clock`: **PASSED** — P1-01 contract + clock hardened: PASS
- `p102_replay_identity`: **PASSED** — P1-02 replay identity/discontinuity: PASS
- `p103_ring_scheduler`: **PASSED** — P1-03 ring + descriptor scheduler hardened: PASS
- `p104_decision_eventlog`: **PASSED** — P1-04 scoped immutable event log hardened: PASS
- `p105_writer_projector`: **PASSED** — P1-05 writer/projector hardened: PASS
- `p106_review_archive`: **PASSED** — P1-06 review/archive hardened: PASS
- `astra_repairs`: **PASSED** — Astra P1-06 repair regressions: PASS
- `claude_c01_c20`: **PASSED** — Claude R8 C01-C20 converted regressions: PASS
- `projector_optimality_10000`: **PASSED** — Projector optimality oracle: PASS 10000/10000
- `projector_input_reversal_3360`: **PASSED** — {"kind":"input-reversal-invariance","checked":3360,"counterexample":null,"optimalityClaim":false}
- `browser_bundle_vm`: **PASSED** — Browser-portable shadow bundle VM (no require/Buffer/process): PASS
- `pose_narrow_thaw`: **PASSED** — Phase 0 pose narrow-thaw seam: PASS
- `phase0_repros`: **PASSED** — Phase0 repro statuses: contract_foundation=passed, F01_source_characterization=passed, F02_budget_direct=passed, F02_upstream_temporal=open_confirmed, F03_null_clock=passed, F04_stale_writer=passed, F01_dynamic_chromium=blocked
- `legacy_103`: **EXPECTED_POLICY_FAILURES** — JS regressions: 100/103 PASS; 3 original legacy tests stop only at the pre-thaw `pose.js` frozen-hash sentinel. Their assertions were not changed. `test_pose_narrow_thaw.js` separately proves the approved seam strips back to the frozen baseline byte-for-byte.
- `static_integrity`: **PASSED** — X2.8.2 static/launch integrity: PASS · frozen Dev4 JS hashes exact · runtime binary SHA baseline pinned
- `cpp_shared_ring_compile`: **PASSED**
- `cpp_shared_ring_run`: **PASSED**
- `windows_adapter_sentinel_compile`: **PASSED**
- `swift_native_bridge_parse`: **PASSED**
- `actual_chromium_f01`: **BLOCKED**

## Scope note
PASS means only the named deterministic/static test. Chromium/native camera/real archer/field acceptance are not inferred from compile/VM results.
