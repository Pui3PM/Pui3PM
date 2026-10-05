# FIELD TEST INSTRUCTIONS — 3PM Analyzer R8 Post-P108 R3 MAC BENCH (NOT PRODUCTION)

สถานะปัจจุบัน (2026-10-05): **MAC BENCH CANDIDATE** — software gates บน Linux ผ่านครบ (field class 117/117) · ใช้ได้เฉพาะ *engineering bench* บน Mac ด้วยข้อมูลทดสอบที่ทิ้งได้ **ห้ามยิงจริง/ห้ามใช้ข้อมูลนักกีฬาจริง** จนกว่า §0–§1 ผ่านบน Mac จริง
ผ่าน software gates บน Linux/Chromium แล้ว แต่ **ยังไม่เคยรันบน Mac, ยังไม่เคย compile Swift, ยังไม่เคยใช้กล้องจริงหรือนักยิงจริง** · ไม่มีการอ้างความแม่นยำ · Legacy Shot Decision เป็นผู้ตัดสินช็อตเพียงตัวเดียว

**ขอบเขตที่อนุญาตในรอบนี้เท่านั้น:** macOS · กล้อง **Side ตัวเดียว** · **30 FPS** · ข้อมูลทดสอบที่ทิ้งได้ · engineering bench
**ห้าม:** Windows · 60/120/240 FPS · หลายกล้อง · ข้อมูลนักกีฬาจริง

## 0. Prerequisites (ต้องผ่านทุกข้อก่อนยิง — ถ้าไม่ผ่าน ให้หยุดและส่งผลกลับ)
1. แตก ZIP เป็นโฟลเดอร์ใหม่ใน path ที่มีช่องว่าง เช่น `~/Desktop/3PM Bench R3/` — **อย่าลบ/ทับ R7, P1-08 หรือ Post-P108 เดิม** และอย่าลบ sessions เดิม
2. ตรวจ SHA-256: `shasum -a 256 3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005.zip` ต้องตรงกับ `3PM_POST_P108_R3_SHA256SUMS.txt`
3. **สำรองข้อมูล backend ก่อนเปิดครั้งแรก:** ปิดแอป 3PM ทุกตัว แล้วคัดลอกโฟลเดอร์ข้อมูลของ runtime ที่ R7 ใช้อยู่ (ดู path ได้ในหน้า Settings → Storage ของ R7 หรือหาด้วย `mdfind -name 3PM_FormAnalyzer_Data`) ไปเก็บเป็นสำเนา เช่น `cp -R "<โฟลเดอร์ข้อมูล>" ~/Desktop/3PM_Data_BACKUP_$(date +%Y%m%d)`
   - เมื่อเปิด field build แล้ว ให้ดู Settings → Storage (ช่อง path): ต้องเป็นโฟลเดอร์ของแอปตัวนี้ (app folder) **ไม่ใช่** โฟลเดอร์/ไดรฟ์ภายนอกที่ R7 ใช้เก็บข้อมูลจริง ถ้าชี้ไปที่ของ R7 ให้กด app folder (internal) ก่อนสร้างข้อมูลใด ๆ และจดไว้
4. **Browser profile แยก (M-05):** ดับเบิลคลิก `START_3PM.command` แล้วดูใน Terminal ต้องมีบรรทัด
   `3PM UI browser: Google Chrome (isolated field-test profile: ~/Library/Application Support/3PM_FieldTest_Profiles/3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005)`
   และ banner ต้องแสดง `3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005 [field_test_not_production]`
   - Chrome ที่เปิดขึ้นต้องเป็นหน้าต่างใหม่ที่ไม่มี bookmark/บัญชีเดิม (โปรไฟล์ใหม่) — ถ้าเปิดในโปรไฟล์เดิม ให้หยุดและส่งผลกลับ
   - ถ้าไม่มี Chrome/Edge แอปจะ **ไม่เปิด browser เอง** (ตั้งใจ) ให้ติดตั้ง Chrome ก่อน อย่าใช้ `THREEPM_USE_DEFAULT_PROFILE=1` ในรอบนี้
5. **ตรวจ native helper และ bridge exposure (M-04)** ขณะแอปเปิดอยู่ ใน Terminal ใหม่:
   ```bash
   tail -n 30 "$HOME/Library/Logs/3PM Form Analyzer Native Capture.log"   # จด: compile สำเร็จหรือ build_failed + บรรทัด compiler
   cat "<โฟลเดอร์ที่แตก ZIP>/app/static/3pm_native_capture_state.json"      # ต้องเป็น "ready"; ถ้า build_failed/compiler_unavailable = ใช้ browser fallback
   lsof -nP -iTCP:48735 -sTCP:LISTEN          # ที่ต้องการ: 127.0.0.1:48735 เท่านั้น (ถ้าเห็น *:48735 = หยุดและส่งผลกลับ)
   curl -s -m 3 http://127.0.0.1:48735/health  # ต้องตอบ ok
   curl -s -m 3 -i -H 'Origin: https://example.com' http://127.0.0.1:48735/health | head -1   # ที่ต้องการ: HTTP/1.1 403
   curl -s -m 3 -i -H 'Origin: http://127.0.0.1:8000' http://127.0.0.1:48735/health | head -1  # ที่ต้องการ: HTTP/1.1 200
   ```
   และจาก **เครื่องอื่นในเครือข่ายเดียวกัน**: `curl -s -m 3 http://<IP ของ Mac>:48735/health` — ที่ต้องการคือ **ต่อไม่ได้**
   - bridge ยังไม่มีการยืนยันตัวตน (M-04 OPEN): โปรแกรมอื่นบนเครื่องเดียวกันยังสั่งได้ — ระหว่างทดสอบอย่าเปิดเว็บไซต์อื่นใน browser profile นี้
6. **ทดสอบ Export/Restore บนข้อมูลทิ้งได้ก่อน:** สร้าง athlete/session ทดสอบ → ยิงทดสอบ 1–2 ช็อต → Settings → *Export Backup* และ Data Export → *Download JSON* → ปิดแอป → ลบโฟลเดอร์โปรไฟล์ทดสอบ `~/Library/Application Support/3PM_FieldTest_Profiles/3PM_Analyzer_R8_POST_P108_R3_MAC_BENCH_20261005` → เปิดใหม่ → *Import Backup* → ตรวจว่า session/ช็อต/ข้อมูลที่ export กลับมาตรง (จดสิ่งที่กลับมาและสิ่งที่ไม่กลับมา เช่นภาพ evidence ใน browser) — ถ้าคืนค่าไม่ได้ ห้ามใช้ข้อมูลจริง
7. ตั้งกล้อง Side ที่ **30 FPS** และจดรุ่น/ความละเอียด

## 1. Launcher และกล้อง Side (native)
1. คัดลอกบรรทัด `Opening verified X2.8.2 UI: http://127.0.0.1:<port>/...` จาก Terminal (ใช้ใน §3)
2. หน้าแอปต้องโหลดเสร็จและตอบสนอง
3. เปิดกล้อง Side → แท็บ **Diagnostics** จด: backend (`native-avfoundation`), capture fps, raw fps, dropped frames, clock domain
4. ลอง **เปลี่ยนกล้อง/ปิด-เปิดกล้องเร็ว ๆ 3 ครั้ง** (ทดสอบ H-03) — หลังจบต้องยังเห็นภาพสดและ Diagnostics ต้องตรงกับกล้องที่เลือก ถ้าแสดง active แต่ภาพค้าง ให้จดเวลาและภาพหน้าจอ
5. ถ้าไม่ได้ native ให้จดเหตุผลที่แสดง — ห้ามสรุปว่า "ผ่าน"

## 2. ยิง 10 ช็อต (Side, 30 FPS)
- ระบุชนิดทุกช็อต: `live-bow release` / `elastic-band release` / `let-down` / `collapse` (band ห้ามติดป้าย live-bow)
- โค้ชบันทึกผลตัดสินเองโดยไม่ดูผลแอป (label อิสระ)
- หลังแต่ละช็อต เปิด Review ของช็อตนั้นแล้วตรวจและจด:
  - [ ] **25 slots** (ช่องที่ไม่มีภาพต้องขึ้น Missing — ห้ามมีภาพซ้ำเติม)
  - [ ] **ลำดับเวลา: Release → Follow-through → Recovery** (H-01) — Recovery ต้องไม่อยู่ก่อน Release ทั้งตอนเปิดครั้งแรก และหลัง **รีเฟรชหน้า (Cmd+R)** แล้วเปิดช็อตเดิมอีกครั้ง
  - [ ] **ไม่มีภาพซ้ำ** และจำนวนภาพจริงไม่เพิ่ม/ไม่ลดหลังรีเฟรช และหลังรอ Recovery บันทึกเสร็จ (H-02, R2-03/R2-04)
  - [ ] Prev / Next / Play เลื่อนตามเวลา ไม่กระโดดย้อน
  - [ ] ปุ่ม **Anchor** ไปภาพช่วง Anchor หรือแจ้ง Missing; กดซ้ำได้ผลเดิม (M-02)
  - [ ] สลับไปช็อตอื่นแล้วกลับมา ภาพไม่ปนช็อตเดิม
- ถ้าผิด ให้จด shot id, เวลา, ภาพหน้าจอ และกด **Export Phase Trace** — **อย่าแก้ค่าในแอปเพื่อให้ผ่าน**

## 3. Browser gates บน Mac (ถ้ามี Node.js)
```bash
cd "<โฟลเดอร์ที่แตก ZIP>"
npm i -g playwright
export NODE_PATH="$(npm root -g)"
export CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="<URL จาก §1.1>"
node app/tests/phase01/run_fullpage_smoke_chromium_r8c.cjs "$URL" "$CHROMIUM_PATH"   # LOADED (liveness เท่านั้น)
node app/tests/phase01/run_anchor_ownership_chromium.cjs "$URL" "$CHROMIUM_PATH"     # SINGLE_OWNER
node app/tests/p108_browser/run_fullapp_gate_chromium.cjs "$CHROMIUM_PATH"            # PASS (ใช้ backend test double ไม่ใช่ backend จริง)
node app/tests/p108_browser/run_post_p108_r2_identity_chromium.cjs "$CHROMIUM_PATH"   # PASS (ไม่มีภาพซ้ำเมื่อบันทึกซ้ำ / record เก่า)
node app/tests/phase01/run_f01_chromium_r8c.cjs "$CHROMIUM_PATH"                      # PASS
node app/tests/phase01/run_shadow_bundle_chromium.cjs "$CHROMIUM_PATH"                # PASS
python3 app/tests/run_regressions.py                                                  # R3 field build: ต้องได้ 117/117
```
เก็บ output ทั้งหมด (ถ้าไม่มี Node ให้เขียน NOT RUN)

## 4. ตารางบันทึก (ส่งกลับ)
| รายการ | ค่า |
|---|---|
| Mac รุ่น / chip / macOS | |
| Browser + version, ยืนยัน isolated profile (§0.4) | |
| Bridge exposure (§0.5: lsof / remote curl / Origin) | |
| Export/Restore (§0.6): อะไรกลับมา / ไม่กลับมา | |
| กล้อง Side (รุ่น, ความละเอียด, 30 fps) | |
| Diagnostics: backend / capture fps / raw fps / dropped | |
| Rapid reopen/device switch (§1.4) | |
| ช็อต 1–10: label โค้ช / ผลแอป / 25 slots / real count ก่อน-หลังรีเฟรช / ลำดับ R→F→Rec / ซ้ำ? / Anchor | |
| Browser gates §3 | |
| ปัญหาที่พบ (shot id + ภาพหน้าจอ + phase trace) | |

## 5. หยุดทันทีเมื่อ
ข้อมูล session เดิมหาย, หน้าค้างซ้ำ, Recovery มาก่อน Release, ภาพซ้ำ/หายหลังรีเฟรช, กล้องแสดง active แต่ไม่มีภาพ, หรือผลตัดสินต่างจาก R7 อย่างชัดเจน → ปิดแอป กลับไปใช้เวอร์ชันเดิม (`docs/post_p108_r3/DELIVERY_REPORT.md` §Rollback) แล้วส่งบันทึกกลับ

สิ่งที่รอบนี้ **ยังไม่ได้** พิสูจน์: Swift compile/runtime บน Mac, ความแม่นยำ release/let-down, high-FPS (M-01 ยังเปิด), การยืนยันตัวตนของ bridge (M-04 ยังเปิด), Windows, หลายกล้อง, dataset ที่มี label
