3PM Analyzer R8 — R8 P1-07 (Claude Code, 2026-10-02)
สถานะ: Software Candidate Ready for Field Validation — NOT PRODUCTION

ดูไฟล์ marker ที่ root ก่อนเสมอ:
- DEV_NOT_RELEASE.txt            = development source (มี pose.js trace seam) ห้ามใช้ยิงจริง
- FIELD_TEST_NOT_PRODUCTION.txt  = FIELD TEST BUILD — NOT PRODUCTION ใช้ทดสอบภาคสนามตาม docs/FIELD_TEST_INSTRUCTIONS.md เท่านั้น

อย่าใช้แพ็กเกจนี้แทนเวอร์ชันที่ใช้งานอยู่ อย่าลบ sessions/DB เดิม แตกเป็นโฟลเดอร์ใหม่แยกต่างหาก
Launcher มีไฟล์เดียว: START_3PM.command
Legacy Shot Decision ยังเป็นผู้ตัดสินช็อตเพียงตัวเดียว ระบบ shadow ไม่เขียนลงช็อตจริง และไม่แตะ Equipment/Athlete/Session

Lineage: EL18 → R7 TransactionRepair parent → selective HV3 merge → R8

ผลรอบนี้ (รันจริงบน Linux + Chromium 141 headless):
- findings Q-01..Q-03, S-01..S-13, P-01..P-06 ทุกข้อ RED บน baseline แล้ว GREEN พร้อม regression ถาวร
- แก้ production evidence path: เฟรมไม่ยุบเมื่อ mediaTime/frameSeq เป็น null หรือ 240 fps, นาฬิกา null ไม่กลายเป็น 0,
  native writer เข้า queue เดียวกับ R7 (Recovery ไม่หาย), หน้าแอปโหลดได้ใน Chromium, ปุ่ม Anchor มีเจ้าของเดียว
- Legacy suite: dev 101/104 (3 pose sentinels เดิม), field build 104/104
- ยังไม่ได้รัน: Mac runtime, Mac browser, Windows, กล้องจริง, นักยิงจริง, dataset ที่มี label

อ่านตามลำดับ:
1. PROJECT_STATE.md
2. docs/phase01/claude_code_r8_p1_07_20261002/CLOSURE_MATRIX.md
3. docs/phase01/claude_code_r8_p1_07_20261002/KNOWN_LIMITATIONS.md
4. docs/FIELD_TEST_INSTRUCTIONS.md
5. docs/phase01/claude_code_r8_p1_07_20261002/ROLLBACK.md
