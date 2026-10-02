# TEST_RESULTS — R8 P1-07 (Claude Code, 2026-10-02)

Environment (all results below were actually run here): Linux x86_64 container, Node v22.22.0, Python 3.11.15, Chromium 141.0.7390.37 headless via Playwright 1.56.1 (`/opt/pw-browsers/chromium-1194`). No macOS, no Windows, no camera.
Raw logs: delivery ZIP `evidence/` (`00_*` baseline before edits, `*_RED*`, `final/`).

## Baseline facts reproduced before any edit (FINAL_REVIEW §2)
Source ZIP SHA-256 `1904f87d…bf21` ✔ · 12/12 reviewer protected hashes ✔ · pure Phase0/P1 11/11 · oracle 10000/10000 · legacy 100/103 (3 pose sentinels) · static PASS · distribution PASS on pristine tree, FAIL after a runner (Q-01) · round-2 probes 12/12 RED · base64 limit 3,355,238 B · Chromium: bundle parity true, archive 4/16 MiB false, full app never reaches `load`. All matched the reviewer.

## Final — development class (`development_not_release`)
| Gate | Result |
|---|---|
| Pure/offline phase01 `test_*.js` | **15/15 PASS** (incl. `test_claude_round2_repairs.js` 13 blocks, `test_qa_runner_isolation.js`, `test_qa_browser_discovery.js`, `test_artifact_class_policy.js`) |
| Legacy JS suite `run_regressions.py` (104 files) | **101/104** — the 3 failures are exactly the pre-thaw `pose.js` sentinels (`test_field_resilience_ble43894`, `test_multicamera_skeleton_ble4362`, `test_multiview_corroboration_integration_ble43895`); identical set to baseline; no assertion edited |
| Phase0 runner | contract_foundation, F01_source, F02_budget, F04 = passed; F02_upstream_temporal, F03_null_clock = **closed**; F01_dynamic_chromium = **passed** (Playwright harness) |
| Static integrity | PASS (`artifact_class=development_not_release`) |
| Projector optimality oracle | 10000/10000 |
| Independent full-25 oracle SEED 1 / 77 / 9001 × 10000 | counterexample `null` ×3 |
| Reviewer probes (adapted copy) | **0/12** reproduce a defect (original harness exits at N05 by design, D-020) |
| base64 size probe | no failure up to 8 MiB tested; regression covers 64 MiB |
| Protected files (12) | byte-identical |
| `app/static` → `app/shadow` references | none |

## Final — field class (`field_test_not_production`, built by `build_r8_artifact.py`)
Legacy **104/104** · phase0 all passed/closed · static PASS · pose guard PASS (frozen HV3 `22ee024b…`, no seam) · distribution contract PASS on a fresh unzip of the final ZIP · provenance manifest exact · see `*.BUILD_REPORT.json` next to each ZIP for the final-bytes verification.

## Browser / platform / runtime matrix
| Gate | Command | Baseline | Final |
|---|---|---|---|
| Shadow bundle in real Chromium (parity, 16 MiB archive, forged projection rejected, payload digest bound, namespace fixed) | `run_shadow_bundle_chromium.cjs` | archive 4/16 MiB FAIL | **PASS 10/10** |
| Reviewer B1/B2/B3 | `docs/review/claude_round2_20261002/chromium_round2.cjs` | B2 4/16 MiB false, B3 never loads | B1 parity true, B2 1/4/16 MiB true, B3 reachedLoad true |
| F01 acceptance harness | `run_f01_chromium_r8c.cjs` | FAIL (event loop starved) | **PASS 8/8**, idle callbacks 0 |
| Full app `index.html` (static server) | `run_fullpage_smoke_chromium_r8c.cjs` | never reaches `load` | **LOADED**, responsive, rail 25 (1 environmental "Error response" page error — no backend) |
| Anchor button ownership | `run_anchor_ownership_chromium.cjs` | not inspectable (no load) | **SINGLE_OWNER** (1 listener at load and +3 s) |
| FrameUID Node↔Chromium | `run_identity_parity_chromium_r8c.cjs` | PASS | PASS 11 vectors |
| macOS runtime (launcher, native Side, 10 shots) | `docs/FIELD_TEST_INSTRUCTIONS.md` | NOT RUN | **NOT RUN** |
| macOS browser (Safari/Chrome) gates | same commands on the Mac | NOT RUN | **NOT RUN** |
| Windows runtime | — | stub | **NOT RUN** (stub, report `unavailable`) |
| Real Web Worker + Side p95/p99 | — | NOT RUN | **NOT RUN** |
| Real camera / real archer / labeled dataset | — | NOT RUN | **NOT RUN** |

## Performance reference (Node/Linux, not Mac/browser)
`ring.add` 1,560 rows p50 124 µs / p95 327 µs / p99 429 µs / max 3.4 ms · `project25` 21 ms @100, 58 ms @530 candidates · SHA-256 29 MB/s, base64 encode 13 MB/s, decode 47 MB/s (was ≈ 11–13 MB/s with the regex validator) · 512 MB archive validate ≈ 28 s (was ≈ 61 s).

## Test-integrity review
Pre-existing tests touched: `test_claude_r8_repairs.js` (Q-03 precondition assert; C10 fixture input +1 observation), `test_p105_writer_projector.js` / `test_p106_review_archive.js` (binding inputs added), `test_pose_narrow_thaw.js` (field-class branch; development branch unchanged), `repro_astra_legacy_gaps.js` (reviewer patch: closed-gap characterization → closure checks; P-07 still asserted open), gates `static_integrity_x282.py` / `test_distribution_contract_r6.py` (class-aware pin, hard-coded). No assertion removed or loosened; no expected value changed to hide a regression. The 3 legacy pose sentinels are untouched.

## Packaging verification of the delivered ZIP bytes (added at delivery)
| Artifact | SHA-256 | Legacy at packaging | From fresh unzip |
|---|---|---|---|
| `3PM_Analyzer_R8_FIELD_TEST_20261002.zip` | `b6f0220ed81337c47ca12c611459df37f329841a433ef2784116e8a9ec3a2afc` | 104/104 | distribution contract PASS · static PASS (field) · pose guard PASS (frozen `22ee024b…`) · provenance 376/376 exact · protected 12/12 · shadow isolation · 1 launcher · pure phase01 15/15 · Chromium: F01 PASS, full app LOADED, Anchor SINGLE_OWNER, FrameUID parity PASS, shadow bundle 10/10 |
| `3PM_Analyzer_R8_P1_07_DEV_20261002.zip` | `70ec292878eef46d16b4bf1c64aa1467c8a3567b055ff5db9c9bcdcb47017734` | 101/104 (3 pose sentinels) | distribution contract PASS · static PASS (dev) · pose guard PASS (seam reconstructs frozen) · provenance 376/376 exact · protected 12/12 · shadow isolation · 1 launcher · pure phase01 15/15 |

Found and fixed during delivery verification: `test_artifact_class_policy.js` assumed the development seam and failed inside the field package; it now runs 8 cases in a development package and the 5 applicable cases in a field package (commit "P-06 follow-up"). Both ZIPs were rebuilt after the fix and re-verified (results above).
