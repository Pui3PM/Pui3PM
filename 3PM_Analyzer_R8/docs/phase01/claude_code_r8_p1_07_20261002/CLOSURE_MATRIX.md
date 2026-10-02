# CLOSURE_MATRIX — R8 P1-07 (Claude Code, 2026-10-02)

> สรุป: ทุก finding ใน FINAL_REVIEW_FOR_CLAUDE_CODE.md ถูก reproduce RED บน baseline 1904f87d ก่อนแก้ แล้ว GREEN หลังแก้ พร้อม regression ถาวร
> P-07/P-08 บันทึกไว้เท่านั้นตามคำสั่ง (ต้องใช้ข้อมูล Mac/field จริง) — "Closed" ในตารางนี้หมายถึง software/test closure ไม่ใช่ field acceptance

Evidence files are under `evidence/` of the delivery ZIP (`00_*` = baseline before any edit, `*_RED*` = defect reproduced, `final/` = final run).

| ID | Sev | RED on baseline (evidence) | GREEN / permanent regression | Status |
|---|---|---|---|---|
| Q-01 | M | contract FAIL after runner: `Unreviewed content change: docs/phase01/phase0_repro_results.json` (`00_Q01_RED.log`, `Q01_RED.log`) | `test_qa_runner_isolation.js` | Closed |
| Q-02 | M | `F01_dynamic_chromium=blocked` with `CHROMIUM_PATH` set and Chromium working (`Q02_RED.log`) | `test_qa_browser_discovery.js` | Closed |
| Q-03 | L | no RED today (guard true); mutation check: removing the fixture slot now fails `C11 precondition` | `test_claude_r8_repairs.js` C11 | Closed |
| S-01 | M | `largestDecodableBytes 3,355,238`, archive `RangeError` (Node); Chromium 4/16 MiB false (`S01_RED_probe.json`, `00_chromium_round2.json`) | round-2 S-01 (0…64 MiB vs Buffer, 16 MiB archive, `QR==`), Chromium `archive16MB:true` | Closed |
| S-02 | M | N03 tuple mismatch + upper-case UID accepted (`00_round2_probes_RED.json`, `S02_RED.log`) | round-2 S-02 | Closed |
| S-03 | M | N04 accepted (`S03_RED.log`) | round-2 S-03; `test_p101` unchanged | Closed |
| S-04 | M | N05 legacy-prefix sinks commit (`S04_S05_RED.log`) | round-2 S-04 | Closed |
| S-05 | L-M | N12 legacy event staged into shadow import (`S04_S05_RED.log`) | round-2 S-05 | Closed |
| S-06 | **H** | N01 Draw frame saved as verified Anchor (`S06_RED.log`) | round-2 S-06 (incl. forged-with-honest-timeline, archive, v1 schema, 150 randomized honest projections) + Chromium gate | Closed |
| S-07 | M | N02 wrong image accepted (`S07_RED.log`) | round-2 S-07 + Chromium gate | Closed |
| S-08 | M | N06 8 outstanding executor jobs, 50 generations retained (`S08_S09_RED.log`) | round-2 S-08 (25/25 stable runs) | Closed (contract level; real Worker latency = runtime gate) |
| S-09 | L | N07 nested function accepted (`S08_S09_RED.log`) | round-2 S-09 | Closed |
| S-10 | M | N09 new cycle unwritable `COMMAND_MEMO_CAPACITY` (`S10_RED.log`) | round-2 S-10 (3,500-shot session) | Closed |
| S-11 | L | N10 `canonical JSON unsupported type: undefined` (`S11_RED.log`) | round-2 S-11 | Closed |
| S-12 | M | N11 evidence-free confirmed applied; no reset/watermark (`S12_RED.log`) | round-2 S-12 | Closed (shadow only) |
| S-13 | L | N08 flag hard-coded (`S13_RED.log`) | round-2 S-13 | Closed per D-A option 1 (documentation truth; behaviour intentionally unchanged) |
| P-01 | **H** | temporal 25→1 / 25→13 (`P01_P03_RED.log`, 11 bug assertions on unpatched static) | `test_evidence_identity_writer_r8c.js`, `repro_f02_upstream_temporal_closed.js` | Closed (software) |
| P-02 | **H** | null master clock → 0; null frameSeq 5→1 (`P01_P03_RED.log`) | same + `repro_f03_null_clock_closed.js` | Closed (software) |
| P-03 | **H** | late native bundle erases Recovery; native null → 0 (`P01_P03_RED.log`) | `test_evidence_identity_writer_r8c.js` (runs frozen `app.js` queue in VM) | Closed (software; Mac runtime NOT RUN) |
| P-04 | **H** | Chromium: F01 harness never loads; full app never reaches `load`; anchor ownership not inspectable (`P04_*_RED.json`) | `run_f01_chromium_r8c.cjs` PASS 8/8, `run_fullpage_smoke_chromium_r8c.cjs` LOADED, `run_anchor_ownership_chromium.cjs` SINGLE_OWNER | Closed (Linux headless Chromium 141) |
| P-05 | M | runner `characterization_failed`/`failed` after patch; closure scripts fail on baseline (`P05_RED_on_baseline.log`) | `*_closed.js`, runner shows `closed` | Closed |
| P-06 | **H** pkg | baseline static gate rejects frozen pose (`P06_RED_static_frozen_pose.log`) | `test_artifact_class_policy.js`; field build legacy 104/104 | Closed |
| P-07 | rec | `crossSource=1` (cross-source same-mediaTime merge) | — | OPEN by mandate (needs Mac clock measurement) |
| P-08 | rec | loose `Number.isFinite(Number(v))` in 12 production modules incl. decision logic | — | OPEN by mandate (needs labeled data + owner approval) |

Round-2 regressions live in `app/tests/phase01/test_claude_round2_repairs.js` (one block per ID). Reviewer probes are archived byte-identical in `docs/review/claude_round2_20261002/claude_round2_probes.original.cjs`; `claude_round2_probes.postfix.cjs` differs only by wrapping the N05 constructors and the N11 `reduceCycle` call in `tryv`, because the repaired code rejects by throwing (allowed by §S-04/§S-12). Final: 0/12 probes reproduce a defect.
