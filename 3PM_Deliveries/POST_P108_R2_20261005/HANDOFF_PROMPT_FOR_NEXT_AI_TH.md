# ข้อความส่งต่องาน 3PM Analyzer ให้ AI/ผู้พัฒนาคนถัดไป (คัดลอกทั้งหมดด้านล่างเส้นไปวาง)

ไฟล์ที่ต้องแนบไปด้วย:
1. `3PM_Analyzer_R8_POST_P108_R2_DEV_20261005.zip` — **จำเป็น** (source, เทสต์, เอกสาร, AGENTS.md ครบในไฟล์เดียว)
2. `3PM_POST_P108_R2_DELIVERY_REPORT_TH.md`, `3PM_POST_P108_R2_SHA256SUMS.txt`, `3PM_POST_P108_R2_VERIFICATION.json` — **จำเป็น**
3. `3PM_Analyzer_R8_POST_P108_R2_MAC_BENCH_UNPROMOTED_20261005.zip` — แนบเฉพาะเมื่อให้ตรวจแพ็กเกจที่ส่งจริงหรือทดสอบบน Mac
4. คำตอบ D-R2-01 ของคุณ และผลทดสอบบน Mac ถ้ามี (ผลจาก Terminal, log ของ Native Capture, ผล lsof/curl, ภาพหน้าจอ)
ถ้า AI ตัวถัดไปเข้า GitHub ได้ ใช้ `Pui3PM/Pui3PM` branch `claude/magical-rubin-bovhje` โฟลเดอร์ `3PM_Analyzer/` แทนข้อ 1 ได้
ไม่ต้องส่ง ZIP/รายงานชุด Post-P108 ของ Codex — ถูกแทนแล้ว และประวัติอยู่ใน `docs/post_p108/` ของ DEV ZIP แล้ว

---

คุณรับงานต่อจากโปรเจกต์ 3PM Archery Form Analyzer (R8 Post-P108 R2, 5 ต.ค. 2026) สถานะปัจจุบันคือ **UNPROMOTED engineering package ห้ามใช้ยิงจริง**

## ก่อนแก้อะไร
1. ตรวจ SHA-256 ของ ZIP ที่ได้รับเทียบกับ `3PM_POST_P108_R2_SHA256SUMS.txt` ถ้าไม่ตรงให้หยุดแล้วแจ้ง
2. แตก DEV ZIP แล้วอ่านตามลำดับ: `AGENTS.md` → `PROJECT_STATE.md` → `docs/post_p108_r2/` (DELIVERY_REPORT, OWNER_DECISION_REQUIRED, CLOSURE_MATRIX, KNOWN_LIMITATIONS, ROLLBACK, CHANGE_LOG, TEST_RESULTS.json) → `docs/HANDOFF_NEXT_CHAT.md` ข้อ 18 → `docs/FIELD_TEST_INSTRUCTIONS.md`
3. รันฐานเพื่อยืนยันว่าได้ไฟล์ถูกตัว (cwd = โฟลเดอร์ที่แตก):
   `python3 app/tests/run_regressions.py` — ต้องได้ DEV 109/117 (แดง 5 ไฟล์ D-R2-01 + pose sentinel 3 ไฟล์ตามนโยบาย DEV) ถ้าไม่ตรงให้หยุดและรายงาน
   ห้ามถือรายงานของ AI รอบก่อน (รวมของผม) เป็นหลักฐานว่างานเสร็จ ให้รันเอง

## งานที่ต้องทำ ตามลำดับ
**A. D-R2-01** (ทำเฉพาะเมื่อเจ้าของตอบแล้ว ถ้ายังไม่ตอบ ห้ามแตะ 8 assertion ใน `OWNER_DECISION_REQUIRED.md`)
- ถ้าตอบ "1": แก้ 8 assertion ใน 5 ไฟล์ให้ตรงกฎ H02 ใหม่ โดยเก็บข้อความ assertion เดิมไว้ใน comment พร้อมเหตุผลและอ้าง D-R2-01 (แนวเดียวกับ D-108-05) · บันทึกใน `docs/architecture/DECISION_LOG.md` และ `docs/post_p108_r2/` · ห้ามแก้ assertion อื่นนอก 8 ข้อนี้
- ถ้าตอบ "2": ไม่แก้เทสต์ · ถ้าตอบ "3": หยุดและถามก่อน เพราะขัดคำสั่ง H02 และเพิ่มความเสี่ยงลบเฟรมจริง

**B. Build + ตรวจแพ็กเกจจริง** (ทุกครั้งที่มีการเปลี่ยนแปลง)
```bash
python3 app/tests/phase01/build_post_p108_engineering.py --out <โฟลเดอร์นอก source> --commit <sha> \
  --name 3PM_Analyzer_R8_POST_P108_R3 --date <YYYYMMDD> --branch <branch> --base <commit ก่อนหน้า> \
  --status-doc docs/<โฟลเดอร์รอบใหม่>/DELIVERY_REPORT.md
python3 app/tests/phase01/verify_package_fresh_unzip.py <ZIP ทั้งสอง> --chromium <path ของ Chromium> --out VERIFICATION.json
```
browser gate ต้องมี Playwright (`npm i -g playwright` แล้ว `export NODE_PATH="$(npm root -g)"`) ถ้าไม่มีจะขึ้น BLOCKED และนับว่าไม่ผ่าน · ต้องรันจาก ZIP ที่แตกใหม่ ไม่ใช่โฟลเดอร์ที่ใช้พัฒนา · ถ้าตอบ D-R2-01 = 1 แล้ว field class ต้องได้ 117/117 จริง จึงจะเสนอเลื่อนสถานะได้

**C. Mac bench** (ทำได้เฉพาะเมื่อรันบน Mac จริง — Linux/cloud ทำไม่ได้)
ทำตาม `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 ด้วยข้อมูลทิ้งได้ และเก็บ:
- ผล compile Swift ใน `~/Library/Logs/3PM Form Analyzer Native Capture.log` และสถานะใน `app/static/3pm_native_capture_state.json`
- `lsof -nP -iTCP:48735 -sTCP:LISTEN` ต้องเห็น `127.0.0.1` เท่านั้น · curl ที่ใส่ `Origin: https://example.com` ต้องได้ 403
- Review ทุกช็อต: 25 ช่อง ไม่มีภาพซ้ำ จำนวนภาพไม่เปลี่ยนหลังรีเฟรชและหลัง Recovery ลำดับเป็น Release → Follow → Recovery
- ถ้า Swift compile ไม่ผ่าน ให้แก้จาก error จริงของ compiler แล้ว compile ซ้ำบน Mac — อย่าเดาแก้โดยไม่มี error

## ข้อห้าม (ละเมิดแล้วงานถือว่าไม่ผ่าน)
- ห้ามแก้ไฟล์ที่ล็อก: `app/static/app.js`, `core_runtime.js`, `pose.js` (ยกเว้น trace seam ที่อนุมัติไว้), runtime ทั้งสองตัว, `evidence_budget_core.js`, `temporal_evidence_layer.js`, `capture_integrity_layer.js`, Equipment EL18 (683 records) — ถ้าจำเป็นต้องขอ explicit thaw พร้อมวิธี rollback
- ห้ามสร้าง launcher อื่น ต้องมี `START_3PM.command` ไฟล์เดียว · สคริปต์อื่นอยู่ใน `internal/` และห้ามตั้ง execute bit
- ห้ามอนุมานตัวตนของเฟรมจาก epoch ขนาดไฟล์ หรือเวลาใกล้กัน · ห้ามสุ่ม FrameUID ต่อ object · ห้ามกลับไปบังคับใช้ device id · test harness ต้องโหลด writer ชุดเดียวกับ `index.html`
- ห้ามลบหรือลดความเข้มของเทสต์เพื่อให้ผ่าน · ห้ามประกาศว่า gate เขียวถ้ายังไม่เขียวจริง · ห้ามอ้างผล Mac/กล้อง/ความแม่นยำที่ไม่ได้รันจริง
- ห้ามลบ session, DB, profile หรือโฟลเดอร์เวอร์ชันเก่าของผู้ใช้

## การส่งมอบ
รายงานภาษาไทย 5 หัวข้อ: ผลลัพธ์และไฟล์ (พร้อม SHA-256) · สิ่งที่เปลี่ยนและเหตุผล · การตรวจที่ทำจริงและผล (แยกสิ่งที่รันจริงกับที่ยังไม่ได้รัน) · ข้อจำกัดที่ยังเปิด · วิธีเริ่มใช้และขั้นตอนถัดไป · อัปเดต `PROJECT_STATE.md`, `docs/HANDOFF_NEXT_CHAT.md` และเอกสารรอบใหม่ให้ตรงกับผลจริง
