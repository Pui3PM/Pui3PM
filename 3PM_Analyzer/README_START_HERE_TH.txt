CURRENT 2026-10-05 POST-P108 R4 (Claude Code): MAC BENCH CANDIDATE (as R3) + Equipment EL19 — owner equipment list merged (879 records: 674 verified + 205 owner-list UNVERIFIED; EL18 kept, 9 duplicates folded with aliases), Equipment Form duplicate/restore/core fixes (D-EL19-01). Source tree: DEV 116/119 (3 pose-policy sentinels by design), phase01 15/15, contract/static PASS, Chromium EL19 equipment gate 18/18; fresh-unzip results of the delivered ZIPs are in the external 3PM_POST_P108_R4_VERIFICATION.json. NOT field-validated: Mac launch, Swift compile, camera, archer NOT RUN. No live shooting until docs/FIELD_TEST_INSTRUCTIONS.md §0–§1 pass on the Mac. Read docs/post_p108_r4/DELIVERY_REPORT.md. Older readiness text below (incl. docs/post_p108_r3, docs/post_p108_r2, docs/post_p108) is HISTORICAL.
วิธีเริ่ม (R4): แตก ZIP ที่ชื่อมี MAC_BENCH เป็นโฟลเดอร์ใหม่ แล้วดับเบิลคลิก START_3PM.command ไฟล์เดียว
ทำตาม docs/FIELD_TEST_INSTRUCTIONS.md §0–§1 ด้วยข้อมูลทดสอบที่ทิ้งได้เท่านั้น · ห้ามยิงจริงจนกว่า §0–§1 ผ่านบน Mac · รายงาน: docs/post_p108_r4/DELIVERY_REPORT.md · อุปกรณ์ EL19: docs/post_p108_r4/EQUIPMENT_EL19_REVIEW.md (อุปกรณ์ 205 รายการที่มาจากรายการของเจ้าของยังไม่ได้ยืนยัน ฟอร์มจึงไม่เติมน้ำหนักหรือสเปกให้อัตโนมัติ)
ข้อความด้านล่างเส้นนี้เป็นประวัติ (HISTORICAL) ของ P1-08
----------------------------------------------------------------

3PM Analyzer R8 — R8 P1-08 Narrow Integration Repair (Claude Code, 2026-10-03)
สถานะ: Software Candidate Ready for Restricted Field Validation — NOT PRODUCTION
ขอบเขตที่อนุญาต: macOS · กล้อง Side ตัวเดียว · 30 FPS · ข้อมูลทดสอบแยก/ทิ้งได้ · เครือข่ายแยก (engineering bench)

ดูไฟล์ marker ที่ root ก่อนเสมอ:
- DEV_NOT_RELEASE.txt            = development source (มี pose.js trace seam) ห้ามใช้ยิงจริง
- FIELD_TEST_NOT_PRODUCTION.txt  = FIELD TEST BUILD — NOT PRODUCTION ใช้ทดสอบภาคสนามตาม docs/FIELD_TEST_INSTRUCTIONS.md เท่านั้น
ชื่อแพ็กเกจจริงอยู่ใน PACKAGE_ID.txt และ Terminal จะแสดงชื่อ + class เดียวกันตอนเปิด

อย่าใช้แพ็กเกจนี้แทนเวอร์ชันที่ใช้งานอยู่ อย่าลบ sessions/DB เดิม แตกเป็นโฟลเดอร์ใหม่แยกต่างหาก
Launcher มีไฟล์เดียว: START_3PM.command (field build เปิด Chrome/Edge ด้วย browser profile แยกของแพ็กเกจนี้)
Legacy Shot Decision ยังเป็นผู้ตัดสินช็อตเพียงตัวเดียว ระบบ shadow ไม่เขียนลงช็อตจริง และไม่แตะ Equipment/Athlete/Session

Lineage: EL18 → R7 TransactionRepair parent → selective HV3 merge → R8

รอบนี้แก้ตามผล independent audit 2026-10-03 (P1-07 field build ถูกตัดสิน BLOCKED BEFORE FIELD TEST — ห้ามใช้):
- H-01 Recovery มาก่อน Release, H-02 ตัวตนเฟรมไม่คงทน (ยุบ/ซ้ำ), H-03 คำตอบ open ที่ค้างปิดกล้องตัวใหม่ — ปิดแล้วในระดับ software
- M-02 Anchor/alignment เมื่อไม่มีเป้าหมาย, M-03 browser gate, L-01 ชื่อ build — ปิดแล้ว; M-05 ข้อมูล — ลดความเสี่ยงด้วย profile แยก
- ยังเปิด: M-01 (high FPS ใน app.js ที่ frozen) → ใช้ 30 FPS เท่านั้น; M-04 (native bridge ไม่จำกัด origin/interface) → ใช้เครือข่ายแยก
- ยังไม่ได้รัน: Mac runtime, Mac browser, Windows, กล้องจริง, นักยิงจริง, dataset ที่มี label

อ่านตามลำดับ:
1. PROJECT_STATE.md
2. docs/FIELD_TEST_INSTRUCTIONS.md  (§0 ต้องผ่านก่อนยิง)
3. docs/phase01/claude_code_r8_p1_08_20261003/CLOSURE_MATRIX.md
4. docs/phase01/claude_code_r8_p1_08_20261003/KNOWN_LIMITATIONS.md
5. docs/phase01/claude_code_r8_p1_08_20261003/ROLLBACK.md
