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

---
## Delivery addendum (outside the ZIPs) — final artifacts

| Artifact | SHA-256 | Bytes |
|---|---|---|
| `3PM_Analyzer_R8_P1_08_FIELD_TEST_20261003.zip` (field_test_not_production) | `3445c12850313946d8313a7589b52c152aebc3b302c3632ea4d762a5cb280fc7` | 19,815,287 |
| `3PM_Analyzer_R8_P1_08_DEV_20261003.zip` (development_not_release) | `b7ae1c5e4784052129d6bfb6bae1e815e1cbffe0465ab2254abc1f9d65bd08c3` | 19,812,158 |

### Packaging gates (build tool, fresh unzip of the final ZIP bytes) — `artifacts/*.BUILD_REPORT.json`
| Gate | FIELD | DEV |
|---|---|---|
| Legacy runner at packaging | **113/113** (strict) | 110/113 (3 policy pose sentinels) |
| Phase0 runner | all passed/closed | all passed/closed |
| p006 runner | 113/113 | 110/113 (same sentinels) |
| Distribution contract | PASS | PASS |
| Static integrity | PASS (`artifact_class=field_test_not_production`) | PASS |
| Pose guard / pose.js | PASS / `22ee024b…` frozen, seam marker absent | PASS / `fe8cafae…` trace seam |
| Provenance `R8_P1_08_CLAUDE_CODE_PROVENANCE.json` | 403/403 exact | 403/403 exact |
| Protected files (12, incl. 2 explicit thaws) | 12/12 | 12/12 |
| Shadow isolation, sole launcher, class marker | PASS | PASS |
| P1-08 gates (10 files) on fresh unzip | PASS (M-01/M-04 characterization) | PASS |

### Independent fresh unzip of the FIELD ZIP (path with spaces), same bytes (`SHA256SUMS.txt` verified first)
Phase01 15/15 · verbatim Astra probes: core 7/8 `invariantPass` (WORKER-NULL = D-108-06), production epochs `[99100,99940,99973,100006,100039,102000]`, native race gen 2 = 2, Anchor no jump · static + distribution PASS · banner `3PM_Analyzer_R8_P1_08_FIELD_TEST [field_test_not_production]` · Chromium 141: full-app 25/25 PASS, LOADED, SINGLE_OWNER, F01 PASS, identity parity PASS, shadow bundle PASS (10). Logs: `evidence/browser/p108_field/`, `evidence/astra_probes/p108_field/`.

### Reproducibility
A second field build from the same commit produced a different ZIP hash (`a244be0c…`). `diff -r` of the two unzipped trees: only `docs/qa/r7_results.json` and `docs/phase01/p006_js_regressions.json` differ (a random record id printed by `test_persistence_r7.js` into the captured log text), plus `SHA256SUMS.txt` and the provenance file that hash them. All application, launcher, test and record files are byte-identical. Report: `evidence/packaging/rebuild_check_FIELD.BUILD_REPORT.json`.

## Final self-audit (answers with evidence)
| Question | Answer | Evidence |
|---|---|---|
| Can Recovery still come before Release? | Not in any tested path (native+browser mix, late Recovery, retry, browser-only, sparse+dense, media-clock reset, DB reload, Chromium real IndexedDB, boot migration of P1-07 records). Residual: cross-domain order depends on two Mac clocks whose offset is unmeasured (KNOWN_LIMITATIONS). | H-01 test, full-app gate, M-05 compat |
| Is identity stable across IndexedDB? | Yes for structuredClone round trip + re-merge + retry (no duplicates, no merges) in the VM and in Chromium. | H-02 IDB test, `idbReadbackMergeNoDuplicates` |
| Can generation collision still false-merge? | No: different generations never equal; FrameUID decides when present. | H-02 ID-GENERATION, ID-SOURCE |
| Can a stale native request still close the successor? | Not from the JS facade (reopen sends no `/close`; stale success/error ignored; ack required). The Swift `/close` itself is still unscoped, so another client could (M-04 OPEN). | H-03 8 interleavings; M-04 characterization |
| Any remaining null→0 in an adapter? | None in identity/clock paths. Remaining `Number(x)||0` is the generation counter (always an integer from `capture_integrity_layer`), `last_frame_seq` is diagnostics-only and maps to null. Frozen `app.js` sampler still treats null media as 0 (M-01 OPEN, not an adapter we may edit). | grep audit in this session; M-01 characterization |
| Can fixed25 still duplicate a real image? | No in tests: clones/readbacks count once, empty slots are Missing; distinct frames sharing an epoch are kept (30 distinct → 25 real). | H-02 fixed25 tests |
| Is R7 TransactionRepair intact? | Yes: R7 persistence/transaction tests pass (field 113/113); `test_transaction_r7.js:56` semantics kept (D-108-04). | legacy runner |
| Was any assertion reduced? | No. One pre-existing assertion changed: P-07 characterization `crossSource 1 → 2` (gap closed; designed to flip; D-108-05). No test deleted or skipped; Astra probes kept verbatim. | `git diff 511cfdb -- app/tests` |
| Does the field build really use the frozen pose? | Yes: `pose.js` `22ee024b…`, seam marker absent, checked on fresh unzip twice. | BUILD_REPORT, independent unzip |
| Is the package the same bytes the tests checked? | Yes: packaging gates and the independent matrix ran on unzips of the final ZIP (`SHA256SUMS.txt` verified before running). | BUILD_REPORT, this addendum |
