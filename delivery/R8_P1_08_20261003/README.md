# 3PM Analyzer R8 P1-08 Narrow Integration Repair — Claude Code delivery (2026-10-03)

**สถานะ: Software Candidate Ready for Restricted Field Validation — NOT Production Ready**
ขอบเขตที่อนุญาต: macOS · Side camera ตัวเดียว · 30 FPS · ข้อมูลทดสอบแยก/ทิ้งได้ · เครือข่ายแยก · Legacy Shot Decision เป็น authority

| Finding | สถานะ |
|---|---|
| H-01 Recovery มาก่อน Release | CLOSED (software) |
| H-02 Frame identity (ยุบ/ซ้ำ/ข้าม IndexedDB) | CLOSED (software) |
| H-03 Stale native open ปิดกล้องใหม่ | CLOSED (software, JS facade) |
| M-01 High-FPS frozen sampler | OPEN → ใช้ 30 FPS เท่านั้น |
| M-02 Null target alignment/Anchor | CLOSED |
| M-03 Browser gate false-green | CLOSED (gate ใหม่ 25 assertions) |
| M-04 Native bridge origin/auth/interface | OPEN → field prerequisite: เครือข่ายแยก + ตรวจบน Mac |
| M-05 Data rollback | MITIGATED (profile แยก + migration compat) — ต้องทำ export/restore บน Mac |
| L-01 Build identity ปนกัน | CLOSED |
| Mac runtime / กล้องจริง / นักยิงจริง / labeled data / Windows | **NOT RUN** |

## ไฟล์
- `artifacts/3PM_Analyzer_R8_P1_08_FIELD_TEST_20261003.zip` — Field Test Build (NOT PRODUCTION) SHA-256 `3445c12850313946d8313a7589b52c152aebc3b302c3632ea4d762a5cb280fc7`
- `artifacts/3PM_Analyzer_R8_P1_08_DEV_20261003.zip` — final source (development class) SHA-256 `b7ae1c5e4784052129d6bfb6bae1e815e1cbffe0465ab2254abc1f9d65bd08c3`
- `artifacts/*.BUILD_REPORT.json` — gates ที่รันบน ZIP bytes จริงหลังแตกใหม่
- `CHANGE_LOG.md`, `ARCHITECTURE_STATE.md`, `DECISION_LOG.md`, `CLOSURE_MATRIX.md`, `TEST_RESULTS.md` (รวม self-audit), `KNOWN_LIMITATIONS.md`, `BROWSER_RUNTIME_MATRIX.md`, `CHANGED_FILES.md`, `ROLLBACK.md`, `FIELD_TEST_INSTRUCTIONS.md`, `PROMPT_FOR_INDEPENDENT_REVIEW.md`
- `PROVENANCE_MANIFEST.json`, `SHA256SUMS.txt`
- `evidence/red_green/` RED บน P1-07 / GREEN หลังแก้ · `evidence/astra_probes/` ผล probes ต้นฉบับบน P1-07, P1-08 dev, P1-08 field · `evidence/browser/` · `evidence/packaging/`

## ข้อมูลที่ไม่ได้รับ
`3PM_capture_integrity_trace_2026-10-03T04-55-23-580Z.json` ไม่ได้ถูกแนบมา — ใช้รูปแบบตามที่ audit อธิบายสร้างเป็น regression สังเคราะห์ ไม่อ้างเป็น runtime validation

Source พร้อม history ทีละ finding (revert ได้) อยู่ที่ `../../3PM_Analyzer_R8/` ใน branch `claude/3pm-analyzer-r8-qru71a`
