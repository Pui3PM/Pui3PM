# FIELD TEST INSTRUCTIONS — 3PM Analyzer R8 FIELD TEST BUILD (NOT PRODUCTION)

สถานะ: **Software Candidate Ready for Field Validation** — ผ่าน software gates บน Linux/Chromium แล้ว แต่ **ยังไม่เคยรันบน Mac, กล้องจริง หรือนักยิงจริง**
ไม่มีการอ้างความแม่นยำใด ๆ · Legacy Shot Decision ยังเป็นผู้ตัดสินช็อตเพียงตัวเดียว · ระบบ shadow ไม่เขียนอะไรลงช็อตจริง

## 0. ก่อนเริ่ม (ห้ามข้าม)
1. **อย่าลบ/ทับ** โฟลเดอร์ R7 หรือเวอร์ชันที่ใช้อยู่ และอย่าลบ sessions/DB เดิม — แตก ZIP นี้เป็นโฟลเดอร์ใหม่แยกต่างหาก
2. แตก ZIP ไว้ใน path ที่ **มีช่องว่าง** เช่น `~/Desktop/3PM Field Test/` (เป็นหนึ่งในเกณฑ์ทดสอบ)
3. ตรวจ SHA-256 ของ ZIP ให้ตรงกับรายงานส่งมอบ: `shasum -a 256 3PM_Analyzer_R8_FIELD_TEST_20261002.zip`
4. บันทึกทุกอย่างลงตาราง §4 (รุ่น Mac, macOS, browser, กล้อง, แสง, ระยะ)

## 1. Launcher และกล้อง Side (native)
1. ดับเบิลคลิก `START_3PM.command` (ไฟล์ .command มีไฟล์เดียวในแพ็กเกจ)
2. ใน Terminal ให้คัดลอกบรรทัด `Opening verified X2.8.2 UI: http://127.0.0.1:<port>/...` เก็บไว้ (ใช้ใน §3)
3. ยืนยันว่า browser เปิดหน้าแอปเองและ **หน้าโหลดเสร็จ ใช้งานได้** (เวอร์ชันก่อนหน้านี้ใน Chromium หน้าค้างไม่โหลด)
4. เปิดกล้อง Side ผ่าน native → เปิดแท็บ **Diagnostics** แล้วจด: backend (ต้องเป็น `native-avfoundation`), capture fps, raw fps, dropped frames, clock domain
5. ถ้าไม่ได้ native ให้จดเหตุผลที่แสดงบนหน้าจอ — ห้ามสรุปว่า "ผ่าน"

## 2. ยิง 10 ช็อต (ใช้ elastic band หรือคันจริงก็ได้ แต่ต้องระบุให้ถูก)
- ระบุชนิดทุกช็อต: `live-bow release` / `elastic-band release` / `let-down` / `collapse` (ข้อมูล band ห้ามติดป้ายว่าเป็น live-bow)
- โค้ชบันทึกผลตัดสินเองทุกช็อต (release หรือ let-down) โดยไม่ดูผลของแอป — ใช้เป็น label อิสระ
- หลังแต่ละช็อต เปิด Review ของช็อตนั้นแล้วตรวจและจด:
  - [ ] ทุก role ที่เปิดอยู่มี **25 slots** (slot ที่ไม่มีภาพต้องขึ้น Missing — ห้ามมีภาพซ้ำเติมแทน)
  - [ ] จำนวนภาพจริง (real) ต่อ role
  - [ ] **Recovery มีอยู่**: มีเวลา follow-through end และมีภาพ End Shot / recovery-end
  - [ ] **ไม่มีภาพซ้ำ** (ภาพเดียวกันโผล่สองช่อง)
  - [ ] ปุ่ม **Prev / Next** เลื่อนภาพได้ถูกลำดับเวลา ไม่กระโดดย้อน
  - [ ] ปุ่ม **Anchor** ไปที่ภาพช่วง Anchor (ไม่ใช่ Draw) หรือแจ้ง Missing ถ้าไม่มีหลักฐาน; กดซ้ำได้ผลเดิม
  - [ ] แอปยังตอบสนอง ไม่ค้าง (เลื่อนหน้า/กดปุ่มได้ทันที)
- ถ้าช็อตไหนผิด ให้จด shot id, เวลา, role, ภาพหน้าจอ — **อย่าแก้ค่าอะไรในแอปเพื่อให้ผ่าน**

## 3. Browser gates บน Mac (ถ้ามี Node.js)
```bash
cd "<โฟลเดอร์ที่แตก ZIP>"
npm i -g playwright            # ครั้งเดียว
export NODE_PATH="$(npm root -g)"
export CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="<URL จากข้อ 1.2>"
node app/tests/phase01/run_fullpage_smoke_chromium_r8c.cjs "$URL" "$CHROMIUM_PATH"   # ต้องได้ LOADED
node app/tests/phase01/run_anchor_ownership_chromium.cjs "$URL" "$CHROMIUM_PATH"     # ต้องได้ SINGLE_OWNER
node app/tests/phase01/run_f01_chromium_r8c.cjs "$CHROMIUM_PATH"                      # ต้องได้ PASS
node app/tests/phase01/run_shadow_bundle_chromium.cjs "$CHROMIUM_PATH"                # ต้องได้ PASS
```
เก็บ output ทั้งหมดส่งกลับมา (ถ้าไม่มี Node ให้ข้ามและเขียนว่า NOT RUN)

## 4. ตารางบันทึก (ส่งกลับ)
| รายการ | ค่า |
|---|---|
| Mac รุ่น / chip / macOS | |
| Browser + version | |
| กล้อง Side (รุ่น, ความละเอียด, fps ที่ตั้ง) | |
| Diagnostics: backend / capture fps / raw fps / dropped | |
| ช็อต 1–10: ชนิด (label โค้ช) / ผลแอป / 25 slots? / real count / Recovery? / ซ้ำ? / Prev-Next / Anchor | |
| Browser gates §3 | |
| ปัญหาที่พบ (shot id + ภาพหน้าจอ) | |

## 5. หยุดทดสอบทันทีเมื่อ
แอปทำให้ข้อมูล session เดิมหาย, หน้าค้างซ้ำ, หรือผลตัดสินช็อตต่างจากเวอร์ชันเดิมอย่างเห็นได้ชัด → กลับไปใช้เวอร์ชันเดิม (ดู ROLLBACK.md) แล้วส่งบันทึกกลับมา

สิ่งที่การทดสอบนี้ **ยังไม่ได้** พิสูจน์: ความแม่นยำ release/let-down, Windows, multi-camera load/thermal, dataset ที่มี label — ต้องทำเป็นขั้นต่อไป
