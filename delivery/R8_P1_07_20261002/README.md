# 3PM Analyzer R8 P1-07 — Claude Code delivery (2026-10-02)

**สถานะ: Software Candidate Ready for Field Validation — NOT Production Ready**

| ชั้น | สถานะ |
|---|---|
| Source repair (Q-01..Q-03, S-01..S-13, P-01..P-06) | DONE — ทุกข้อ RED บน baseline ก่อนแก้ แล้ว GREEN |
| Deterministic tests (pure/offline 15 ไฟล์, oracles) | PASS |
| Offline integration (legacy suite) | PASS — dev 101/104 (3 pose sentinels เดิม ไม่แตะ), field 104/104 |
| Browser verification | PASS — Linux headless Chromium 141 ทั้ง dev tree และ field build ที่แตกจาก ZIP |
| Mac runtime / Mac browser | NOT RUN |
| Windows runtime | NOT RUN (stub) |
| Real camera / real archer / labeled dataset | NOT RUN |
| P-07 / P-08 | OPEN ตามคำสั่ง (ต้องใช้ข้อมูล Mac / labeled data) |

## ไฟล์
- `artifacts/3PM_Analyzer_R8_FIELD_TEST_20261002.zip` — **Field Test Build (NOT PRODUCTION)**, SHA-256 `b6f0220ed81337c47ca12c611459df37f329841a433ef2784116e8a9ec3a2afc`
- `artifacts/3PM_Analyzer_R8_P1_07_DEV_20261002.zip` — final source (development class), SHA-256 `70ec292878eef46d16b4bf1c64aa1467c8a3567b055ff5db9c9bcdcb47017734`
- `artifacts/*.BUILD_REPORT.json` — การตรวจจาก ZIP bytes จริง
- `CHANGE_LOG.md`, `ARCHITECTURE_STATE.md`, `DECISION_LOG.md`, `CLOSURE_MATRIX.md`, `TEST_RESULTS.md`, `KNOWN_LIMITATIONS.md`, `BROWSER_PLATFORM_RUNTIME_MATRIX.md`, `ROLLBACK.md`
- `PROVENANCE_MANIFEST.json` — hash ของ input/output ทั้งหมด (in-ZIP provenance อยู่ที่ `docs/lineage/R8_P1_07_CLAUDE_CODE_PROVENANCE.json`)
- `evidence/` — log RED-before / GREEN-after (`00_*` = baseline ก่อนแก้, `*_RED*`, `final/`)
- `FIELD_TEST_INSTRUCTIONS.md` — ขั้นตอนทดสอบบน Mac (ขั้นต่อไป)
- `PROMPT_FOR_INDEPENDENT_REVIEW.md`

Owner decisions ใช้ค่า default ที่ handoff กำหนด: D-A option 1, D-B option 1 (field build ใช้ pose.js frozen), D-C ดำเนินการ Track P — ดู DECISION_LOG

Source ที่แก้แล้วพร้อม history ทีละ finding (ใช้ `git revert` ได้) อยู่ที่ `../../3PM_Analyzer_R8/` ใน repo นี้ (git bundle ใน ZIP ส่งมอบมี history ชุดเดียวกัน)
