# ข้อความส่งต่องาน 3PM Analyzer ให้ AI/ผู้พัฒนาคนถัดไป (คัดลอกทั้งหมดด้านล่างเส้นไปวาง)

ไฟล์ที่ต้องแนบไปด้วย:
1. `3PM_Analyzer_R8_POST_P108_R3_DEV_20261005.zip` — **จำเป็น** (มี source, เทสต์, เอกสาร และ AGENTS.md ครบ)
2. `3PM_POST_P108_R3_DELIVERY_REPORT_TH.md`, `3PM_POST_P108_R3_SHA256SUMS.txt`, `3PM_POST_P108_R3_VERIFICATION.json` — **จำเป็น**
3. `3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005.zip` — แนบเมื่อต้องทดสอบบน Mac หรือตรวจแพ็กเกจที่ส่งจริง
4. ผลทดสอบบน Mac ถ้ามี: ข้อความใน Terminal, log ของ Native Capture, ผล lsof/curl และภาพหน้าจอ
ถ้า AI ตัวถัดไปเข้า GitHub ได้ ให้ใช้ `Pui3PM/Pui3PM` branch `claude/magical-rubin-bovhje` โฟลเดอร์ `3PM_Analyzer/` แทนไฟล์ข้อ 1
ไม่ต้องส่ง ZIP ชุด Codex, R2 หรือ Post-P108 เพราะถูกแทนแล้ว และประวัติอยู่ใน `docs/` ของ DEV ZIP ครบ

---

คุณรับงานต่อจากโปรเจกต์ 3PM Archery Form Analyzer (R8 Post-P108 R3, 5 ต.ค. 2026)
สถานะ: **MAC BENCH CANDIDATE** — ด่านตรวจซอฟต์แวร์บน Linux ผ่านครบ (แพ็กเกจ Mac ได้ 117/117) แต่ยังไม่เคยรันบน Mac, ยังไม่เคย compile Swift และยังไม่เคยใช้กล้องจริง **ห้ามใช้ยิงจริงหรือใช้ข้อมูลนักกีฬาจริง**

## ก่อนแก้อะไร
1. ตรวจ SHA-256 ของ ZIP เทียบกับ `3PM_POST_P108_R3_SHA256SUMS.txt` ถ้าไม่ตรงให้หยุดแล้วแจ้ง
2. อ่านตามลำดับ: `AGENTS.md` → `PROJECT_STATE.md` → `docs/post_p108_r3/` → `docs/architecture/DECISION_LOG.md` (D-R2-01) → `docs/HANDOFF_NEXT_CHAT.md` ข้อ 19 → `docs/FIELD_TEST_INSTRUCTIONS.md`
3. รันฐานเอง ห้ามเชื่อรายงานของ AI รอบก่อน (รวมของผม): `python3 app/tests/run_regressions.py` ใน DEV ต้องได้ 114/117 โดยไม่ผ่านเฉพาะ pose sentinel 3 ไฟล์ตามนโยบาย DEV ถ้าไม่ตรงให้หยุดและรายงาน

## งานถัดไป (งานเดียวที่ยังค้างอยู่)
**Mac bench** — ทำได้เฉพาะบน Mac จริง ถ้าคุณรันอยู่บน Linux หรือ cloud ให้บอกผู้ใช้ตรง ๆ ว่าทำส่วนนี้ไม่ได้
- ทำตาม `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 ด้วยข้อมูลที่ทิ้งได้ และเก็บผลต่อไปนี้:
  - ผล compile Swift ใน `~/Library/Logs/3PM Form Analyzer Native Capture.log` และสถานะใน `app/static/3pm_native_capture_state.json`
  - `lsof -nP -iTCP:48735 -sTCP:LISTEN` ต้องเห็น `127.0.0.1` เท่านั้น และ curl ที่ใส่ `Origin: https://example.com` ต้องได้ 403
  - เปิด-ปิดกล้องและสลับกล้องเร็ว ๆ 3 ครั้ง ภาพสดต้องยังอยู่และ Diagnostics ต้องตรงกับกล้องที่เลือก
  - Review ทุกช็อต: ต้องมี 25 ช่อง ไม่มีภาพซ้ำ จำนวนภาพไม่เปลี่ยนหลังรีเฟรชและหลัง Recovery และเรียงเป็น Release → Follow → Recovery
- ถ้าพบปัญหา ให้แก้จากหลักฐานจริงของ Mac เช่น compiler error หรือ log ห้ามเดาแก้ แล้วเพิ่มเทสต์ที่ทำให้ปัญหาเกิดซ้ำได้ก่อนแก้
- ทุกครั้งที่ส่งมอบ ให้ build และตรวจจาก ZIP ที่แตกใหม่ (browser gate ต้องมี Playwright และตั้ง NODE_PATH ถ้าไม่มีจะขึ้น BLOCKED และนับว่าไม่ผ่าน):
```bash
python3 app/tests/phase01/build_post_p108_engineering.py --out <โฟลเดอร์นอก source> --commit <sha> \
  --name 3PM_Analyzer_R8_POST_P108_R4 --date <YYYYMMDD> --branch <branch> --base <commit ก่อนหน้า> \
  --status "<สถานะจริง>" --status-doc docs/<โฟลเดอร์รอบใหม่>/DELIVERY_REPORT.md --field-label MAC_BENCH --field-status-line "<สถานะจริง>"
python3 app/tests/phase01/verify_package_fresh_unzip.py <ZIP ทั้งสอง> --chromium <path ของ Chromium> --out VERIFICATION.json
```

## ข้อห้าม (ละเมิดแล้วงานถือว่าไม่ผ่าน)
- ห้ามแก้ไฟล์ที่ล็อกไว้ ได้แก่ `app/static/app.js`, `core_runtime.js`, `pose.js` (ยกเว้น trace seam ที่อนุมัติแล้ว), runtime ทั้งสองตัว, `evidence_budget_core.js`, `temporal_evidence_layer.js`, `capture_integrity_layer.js` และ Equipment EL18 (683 records) ถ้าจำเป็นต้องขอ explicit thaw พร้อมวิธี rollback
- ต้องมี launcher ไฟล์เดียวคือ `START_3PM.command` สคริปต์อื่นอยู่ใน `internal/` และห้ามตั้ง execute bit
- ห้ามระบุตัวตนของเฟรมจาก epoch ขนาดไฟล์ หรือเวลาที่ใกล้กัน ห้ามสุ่ม FrameUID ต่อ object และห้ามกลับไปบังคับใช้ device id กฎ D-R2-01 ตัดสินแล้ว (ทางเลือก 1) ห้ามย้อนกลับถ้าเจ้าของไม่สั่งใหม่
- test harness ต้องโหลด writer ชุดเดียวกับที่ `index.html` โหลด
- ห้ามลบหรือลดความเข้มของเทสต์เพื่อให้ผ่าน ห้ามประกาศว่าด่านตรวจผ่านถ้ายังไม่ผ่านจริง และห้ามอ้างผลบน Mac, กล้อง หรือความแม่นยำที่ไม่ได้รันจริง
- ห้ามลบ session, DB, profile หรือโฟลเดอร์เวอร์ชันเก่าของผู้ใช้

## การส่งมอบ
- รายงานภาษาไทย 5 หัวข้อ:
  1. ผลลัพธ์และไฟล์พร้อม SHA-256
  2. สิ่งที่เปลี่ยนและเหตุผล
  3. การตรวจที่ทำจริงและผล โดยแยกสิ่งที่รันจริงออกจากสิ่งที่ยังไม่ได้รัน
  4. ข้อจำกัดที่ยังเปิดอยู่
  5. วิธีเริ่มใช้งานและขั้นตอนถัดไป
- อัปเดต `PROJECT_STATE.md`, `docs/HANDOFF_NEXT_CHAT.md` และเอกสารรอบใหม่ให้ตรงกับผลจริง
