# Browser / platform / runtime matrix — R8 P1-07 (2026-10-02)

| Gate | Linux headless Chromium 141 — dev tree | Linux headless Chromium 141 — unzipped FIELD build | macOS Chrome/Safari | macOS native runtime | Windows |
|---|---|---|---|---|---|
| Shadow bundle (parity, 16 MiB archive, forged projection, payload digest, namespace) | PASS 10/10 | PASS 10/10 | NOT RUN | n/a | NOT RUN |
| F01 acceptance harness (8 checks) | PASS | PASS | NOT RUN | — | NOT RUN |
| Full app reaches `load`, responsive, rail 25 | LOADED | LOADED | NOT RUN | NOT RUN | NOT RUN |
| Anchor single click owner (CDP) | SINGLE_OWNER | SINGLE_OWNER | NOT RUN | NOT RUN | NOT RUN |
| FrameUID Node↔browser (11 vectors) | PASS | PASS | NOT RUN | — | NOT RUN |
| Launcher from path with spaces | contract test PASS (routing only, Linux) | contract test PASS (routing only, Linux) | — | NOT RUN | — |
| Native Side capture fps/drops/clock | — | — | — | NOT RUN | NOT RUN (stub) |
| 10 shots: 25 slots, Recovery, no duplicates, Review Prev/Next/Anchor | — | — | — | NOT RUN | NOT RUN |
| Real Web Worker executor, Side p95/p99 under aux load | — | — | NOT RUN | NOT RUN | NOT RUN |
| Real camera / real archer / labeled dataset | — | — | — | NOT RUN | NOT RUN |

Baseline (before this block) for the same Linux Chromium gates: shadow bundle archive 4/16 MiB FAIL; F01 harness FAIL (event loop starved); full app never reaches `load`; Anchor ownership not inspectable. Raw JSON: `evidence/00_chromium_round2.json`, `evidence/P04_*_RED.json`, `evidence/final/browser_*.json`, `evidence/final/field_browser_*.json`.
