# BROWSER / PLATFORM / RUNTIME MATRIX — R8 P1-08

| Platform / runtime | Dev tree | Field build (fresh unzip) | Notes |
|---|---|---|---|
| Node VM harness (shipped static files + frozen app.js queue + IDB double) | PASS | PASS (build gate) | production evidence path |
| Chromium 141 headless Linux + backend test double | PASS 6/6 gates | PASS 6/6 gates (full-app 25/25, LOADED, SINGLE_OWNER, F01, identity parity, shadow bundle 10) | real `index.html`, real IndexedDB |
| macOS runtime / launcher / Swift bridge | NOT RUN | NOT RUN | Mach-O + AVFoundation unavailable |
| Mac Chrome / Safari | NOT RUN | NOT RUN | FIELD_TEST_INSTRUCTIONS §3 |
| Real camera (Side, 30 FPS) | NOT RUN | NOT RUN | field step |
| Real archer / labeled data | NOT RUN | NOT RUN | |
| Windows | NOT RUN (unsupported) | NOT RUN | out of scope |
| High FPS 60/120/240 end-to-end | integration 25/25, frozen sampler 13 @240 | — | M-01 OPEN; not in scope |

P1-07 baseline on the same full-app gate: FAIL (`idbMixedClockPhysicalOrder`, `anchorConsistentNoTarget`, `shotSwitchPhysicalOrder`, plus module checks) — `evidence/browser/p107_baseline/fullapp_gate.json`.
