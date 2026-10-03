# TEST RESULTS — R8 P1-08 (Claude Code, 2026-10-03)

Environment: Linux container, Node v22.22.0, Python 3, Playwright 1.56.1 + Chromium 141 headless (`/opt/pw-browsers/chromium-1194`). macOS, Swift, AVFoundation, real camera, real archer: **not available → NOT RUN**.
Packaging results (both classes, run by `build_r8_artifact.py` on the **fresh unzip of the final ZIP bytes**) are in `<zip>.BUILD_REPORT.json` next to each ZIP in the delivery; they cannot be embedded here without changing the bytes they attest.

## RED on the audited P1-07 bytes (before any fix)
| Test | RED result |
|---|---|
| `test_p108_h01_chronology.js` | 8 of 9 scenarios FAIL (e.g. persisted `[99100,100800,102000,99940,…]`) |
| `test_p108_h02_identity.js` | 10 of 13 FAIL (ID-SOURCE 2→1, ID-GENERATION 2→1, ID-CLONE 1→2, worker 25→1, native control duplicate, fixed25 30→15, stale generation) |
| `test_p108_h03_native_generation.js` | 5 of 8 interleavings FAIL (bridge gen null / facade active gen 2) |
| `test_p108_m02_alignment_anchor.js` | 3 of 4 FAIL |
| `test_p108_astra_probes.js` (verbatim probes) | core 7 RED, production 4 RED, native race RED, Anchor RED |
| `test_p108_m05_migration_compat.js` | FAIL (stored misorder kept by P1-07 core) |
| `test_p108_m05_launcher_profile.js` | FAIL (no isolation block) |
| `p108_browser/run_fullapp_gate_chromium.cjs` | FAIL: `requiredModulesLoaded`, `p108CoresActive` (module absent), `idbMixedClockPhysicalOrder`, `anchorConsistentNoTarget`, `shotSwitchPhysicalOrder` |

## GREEN on the P1-08 development tree
| Suite | Result |
|---|---|
| P1-08 regressions H-01/H-02/H-03/M-02/M-05×2 | PASS |
| M-01 / M-04 characterization | PASS as characterization (OPEN: frozen sampler 240 FPS → 13; bridge facts pinned) |
| Astra probes gate | PASS: core 7/8 invariants + 1 documented conflict (D-108-06), production path 4 runs, native race, Anchor |
| Verbatim audit probes (raw output) | core 7/8 `invariantPass:true` (WORKER-NULL inline = conflict); production: epochs `[99100,99940,99973,100006,100039,102000]`, Recovery last, no duplicates, gen-switch bundle bound to gen 1; native race: hw gen 2 = facade gen 2; Anchor unknown target: no jump + Missing message; frozen sampler 13 (M-01 OPEN) |
| `repro_astra_legacy_gaps.js` | PASS (all 4 gaps closed incl. P-07) |
| Phase01 `test_*.js` | 15/15 PASS |
| Phase0 runner | all passed/closed incl. F01 dynamic Chromium |
| Legacy runner `run_regressions.py` (113 files) | 110/113 — the 3 failures are the policy pose sentinels of the development class (trace-seam `pose.js`); field class must be 113/113 (strict packaging gate) |
| `static_integrity_x282.py` | PASS |
| `test_mac_preflight_r5`, `test_runtime_truth_ble43881` | PASS |
| Distribution contract | checked on fresh unzip (SHA256SUMS regenerated at packaging) |

## Browser (Chromium 141 headless, backend test double) — development tree
| Gate | Result |
|---|---|
| `p108_browser/run_fullapp_gate_chromium.cjs` (25 assertions) | PASS 25/25 |
| `run_fullpage_smoke_chromium_r8c.cjs` | LOADED (liveness only, M-03) |
| `run_anchor_ownership_chromium.cjs` | SINGLE_OWNER |
| `run_f01_chromium_r8c.cjs` | PASS |
| `run_identity_parity_chromium_r8c.cjs` | PASS |
| `run_shadow_bundle_chromium.cjs` | PASS (10 checks) |

The same matrix is re-run on the unzipped field build; results in the delivery `BROWSER_RUNTIME_MATRIX.md`.
