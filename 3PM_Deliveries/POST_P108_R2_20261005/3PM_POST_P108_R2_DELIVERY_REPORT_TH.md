# รายงานส่งมอบ 3PM R8 Post-P108 R2 — 5 ตุลาคม 2026 (Claude Code)

**สถานะ: ยังไม่เสร็จตาม Definition of Done — UNPROMOTED** · regression gate บังคับยังแดง 5 ไฟล์ ซึ่งทั้งหมดเป็นข้อขัดแย้งเชิงนโยบายที่ต้องให้เจ้าของโปรเจกต์ตัดสิน (D-R2-01) ไม่ใช่บั๊กที่ค้างอยู่ · Mac / Swift compile / กล้อง / นักยิงจริง: ยังไม่ได้รัน · **ห้ามใช้ยิงจริง**

## 1. ผลลัพธ์และไฟล์ที่ใช้งาน
| ไฟล์ | SHA-256 | ใช้ทำอะไร |
|---|---|---|
| `3PM_Analyzer_R8_POST_P108_R2_MAC_BENCH_UNPROMOTED_20261005.zip` | `b9799e64851cdde4b72bd9afd3fc95a63e21a5f791355dc95f73c9f1a51006c0` | แพ็กเกจ Mac ครบชุด (runtime ARM64/x64, source, model, assets) มี launcher เดียวคือ `START_3PM.command` สำหรับ engineering bench ด้วยข้อมูลทดสอบที่ทิ้งได้ |
| `3PM_Analyzer_R8_POST_P108_R2_DEV_20261005.zip` | `51a8aa47d43e292cef3edae1a369ec8e01655bf2c182fe89d0962c802dc5a9d7` | source/DEV ครบชุด (มี pose trace seam ตามที่อนุมัติไว้) |
| `3PM_POST_P108_R2_VERIFICATION.json` | `803484653efea5c3b23d0b96fc73f99bd7535bd297ab15241a8b7ca5e2095ed0` | ผลตรวจจริงจากการแตก ZIP ทั้งสองใหม่ทั้งหมด |

- Source อยู่บน GitHub แล้ว: `Pui3PM/Pui3PM` branch `claude/magical-rubin-bovhje` โฟลเดอร์ `3PM_Analyzer/` · commit `d6af163` = ไบต์ที่ Codex ส่งมาโดยไม่แก้ (Codex commit `42a24800` ไม่เคยถูก push) · ZIP ทั้งสองสร้างจาก commit `b4d115a`
- เทียบกับแพ็กเกจที่ส่งมา: ไฟล์ที่แอปใช้จริงเปลี่ยนแค่ 4 ไฟล์ (`frame_identity_core.js`, `evidence_identity_persistence_layer.js`, `index.html` เฉพาะ cache key, `3PMNativeCaptureBridge.swift`) · `app.js`, `core_runtime.js`, `pose.js`, runtime ทั้งสองตัว, `evidence_budget_core.js`, `temporal_evidence_layer.js`, `capture_integrity_layer.js`, Equipment EL18, launcher และ internal scripts ไบต์ตรงกันทั้งหมด

## 2. สิ่งที่เปลี่ยนและเหตุผล
รายงาน Codex ระบุว่า 10 ไฟล์ที่ล้ม "เพราะ assertion เก่าไม่ปลอดภัย" ผมแตก ZIP ใหม่แล้วรันซ้ำได้ 106/116 ตรงกัน แต่พอไล่ทีละ assertion พบว่าในนั้นมี **บั๊กจริงที่ Post-P108 เพิ่มเข้ามา** ซึ่งทำให้ภาพเดิมถูกบันทึกซ้ำ:

1. **R2-01 แถบ 25 ช่องมีภาพเดิมซ้ำ** — ตัวเลือกเฟรมใช้ key ผูกกับ object พอ core คัดลอกแถว (`{...f}`) ก็เห็นเป็นเฟรมใหม่ ภาพเดียวกันเลยไปอยู่ 2 ช่อง และเฟรมจริงบางเฟรมหลุดออกไป
2. **R2-02 บังคับ device id ที่ไม่มี pipeline ไหนส่งมา** — v3 ให้เทียบ mediaTime/frameSeq และเรียงตามกล้องเฉพาะเมื่อมี device id แต่ทั้ง app.js, worker และ native bridge ไม่มีใครส่งค่านี้ ผลคือเฟรม native ถูกเรียงตามเวลา callback ที่แกว่ง และเฟรมเดียวกันที่ส่งมาซ้ำกลายเป็นคนละเฟรม
3. **R2-03 สุ่ม FrameUID ใหม่ทุก object** — app.js (frozen) encode ภาพ native30 เป็น JPEG ใหม่ทุกครั้งที่บันทึก จึงได้ UID ใหม่ทุกครั้ง พิสูจน์ใน Chromium จริงด้วย `persistFullShotEvidence` ตัวจริงของ app.js บันทึก 2 รอบจาก buffer เดิม: เวอร์ชันที่ส่งมา **19 → 25 แถว แต่มีภาพไม่ซ้ำแค่ 19** · R2 ได้ **19 → 19**
4. **R2-04 record เก่าที่ไม่มี UID ถูกคูณซ้ำ** — layer อ่าน IndexedDB ดิบแล้วเขียนกลับ ทำให้ได้ UID สุ่มใหม่: record เก่า 6 แถว + เฟรมใหม่ 1 เฟรม เวอร์ชันที่ส่งมาได้ **19 แถว ภาพไม่ซ้ำแค่ 7** · R2 ได้ **7 แถว ไม่ซ้ำ 7**
5. **R2-05 race ใน Swift bridge (มีมาก่อนแล้ว)** — แต่ละ HTTP connection ทำงานคนละ queue และฝั่ง JS ดาวน์โหลดเฟรมพร้อมกัน 8 ทาง จึงเขียน dictionary ของ Swift พร้อมกันได้ ซึ่งอาจทำให้ helper crash ตอนดึงภาพ

วิธีแก้ (เปลี่ยนให้น้อยที่สุด และไม่แตะไฟล์ที่ล็อกไว้):
- **identity core v4:** domain ที่ระบุชัด = รู้ source และ generation (ตามสัญญา P1-08) · ใช้ Blob ตัวเดียวกันเป็นหลักฐานได้ก็ต่อเมื่อมี label กล้องยืนยัน · key ไม่เปลี่ยนเมื่อแถวถูกคัดลอก · **ข้อห้ามของ Post-P108 ยังอยู่ครบ** คือเวลาเท่ากัน ขนาดเท่ากัน epoch ใกล้กัน หรือไม่รู้ source/generation จะไม่ถือว่าเป็นเฟรมเดียวกัน
- **writer v2:** สร้าง FrameUID จากที่มาของภาพเท่านั้น (Blob ตัวเดิม, buffer entry เดิมแม้ encode ใหม่, UID แบบกำหนดได้ใน domain ที่ชัด) และ record เก่าจะได้ UID แบบกำหนดได้ทุกครั้งที่อ่าน · ไม่รวมและไม่ลบแถวใด
- **Swift:** เพิ่ม lock ครอบ `releaseRequests`/`bundles` (ตรวจด้วย syntax parser แต่ยัง compile ไม่ได้)
- **test harness:** ให้โหลด writer ตัวที่ส่งจริงตามลำดับใน `index.html` (ของเดิมทดสอบ writer ที่ไม่ได้ส่งแล้ว) · ปรับ pin M-04 ตามข้อความในตัวเทสต์เองที่บอกให้แก้เมื่อ hardening เข้าไปแล้ว (M-04 ยัง OPEN)
- **เพิ่มเทสต์และเครื่องมือ:** `test_post_p108_r2_identity.js` (แดงบนไบต์ที่ส่งมา เขียวบน R2), browser gate R2 (IndexedDB จริง + เส้นทาง persist จริงของ app.js), `verify_package_fresh_unzip.py` (รันตรวจ ZIP ซ้ำได้ด้วยคำสั่งเดียว), `swift_syntax_check.cjs`
- **ไม่มีการแก้หรือลบ assertion เดิมแม้แต่ข้อเดียว**

## 3. การตรวจที่ทำจริงและผล
ตรวจบน Linux container, Node 22.22, Python 3.11, Chromium 141.0.7390.37 headless โดยแตก ZIP ที่จะส่งจริงลงโฟลเดอร์ใหม่ที่ path มีช่องว่าง
| Gate | MAC BENCH (field class) | DEV |
|---|---|---|
| JS regressions | **112/117** — แดงเฉพาะ 5 ไฟล์ของ D-R2-01 | 109/117 — 5 ไฟล์เดียวกัน + pose sentinel 3 ไฟล์ตามนโยบาย DEV |
| Phase01 | 15/15 | 15/15 |
| Distribution contract / static integrity / Mac preflight / สิทธิ์ execute ใน ZIP | PASS | PASS |
| Chromium: full-app 25/25, Post-P108 7/7, R2 identity 12/12 | PASS | PASS |
| Chromium: identity parity, F01, shadow bundle, Anchor single owner, full-page LOADED | PASS | PASS |
| Swift syntax (tree-sitter, helper ทั้งสองตัว; ทดลองใส่ error 3 จุดแล้วตัวตรวจจับได้) | PASS (เฉพาะ syntax) | — |
| Swift compile, Mac runtime, กล้อง, BLE, Windows, นักยิง, ข้อมูลที่มี label | **ยังไม่ได้รัน** | **ยังไม่ได้รัน** |

ภาพที่ใช้ทดสอบเป็นภาพสังเคราะห์จาก canvas และ backend เป็นตัวจำลอง จึงไม่ได้รับรองกล้องจริงหรือ backend จริง

## 4. ข้อจำกัดและประเด็นที่ยังเปิดอยู่
- **ต้องการการตัดสินใจจากคุณ 1 ข้อ (D-R2-01):** มี assertion เดิม 8 ข้อใน 5 ไฟล์ ที่ให้ระบบรวมเฟรมจากเวลา/ขนาด/epoch ใกล้กัน หรือจาก mediaTime ที่ไม่รู้ source/generation ซึ่งขัดกับกฎ H02 ใหม่ของ Post-P108 โดยตรง (input มีรูปแบบเหมือนกันทุกประการ จึงไม่มีกฎที่สมเหตุผลข้อไหนผ่านได้ทั้งสองฝั่ง) AGENTS.md ห้ามแก้ข้อเหล่านี้หากไม่มีคำสั่ง ผมจึงไม่แตะ รายละเอียดอยู่ใน `docs/post_p108_r2/OWNER_DECISION_REQUIRED.md`
  - **ทางเลือก 1 (แนะนำ):** ใช้กฎ H02 ใหม่เป็นหลัก ปรับ 8 ข้อให้ตรงกฎใหม่ โดยเก็บข้อความเดิมและประวัติไว้ใน comment แล้ว build และรันทุก gate ใหม่ · เจตนาเดิมของแต่ละข้อยังได้รับการป้องกันใน production ผ่าน FrameUID ที่คงที่ ซึ่งพิสูจน์แล้วด้วยเทสต์ R2 และ Chromium
  - ทางเลือก 2: ปล่อยให้แดงต่อไป แพ็กเกจจะไม่มีวันผ่าน gate
  - ทางเลือก 3: กลับไปใช้กฎ P1-08 ซึ่งขัดคำสั่ง H02 และกลับมาเสี่ยงลบเฟรมจริงโดยไม่รู้ตัว
- Swift (lifecycle ของ Codex และ lock ของ R2) ยังไม่เคย compile ถ้า compile ไม่ผ่านบน Mac ระบบจะใช้ browser fallback และแสดง `build_failed` พร้อมบรรทัด error
- M-01 (high FPS ใน app.js ที่ frozen) ยังเปิด ให้ใช้ 30 FPS เท่านั้น · M-04 bridge ยังไม่มีการยืนยันตัวตน
- record ที่ build เก่าบันทึกซ้ำไว้แล้วจะถูกเก็บไว้ตามเดิม (ไม่มีหลักฐานพอจะรวม)

## 5. วิธีเริ่มใช้งานและขั้นตอนถัดไป
1. ตอบ D-R2-01 มาสั้น ๆ เช่น "D-R2-01 = 1" แล้วผมจะปรับ 8 ข้อตามนั้น build และรันทุก gate ใหม่
2. ระหว่างรอ (bench เท่านั้น): แตก `…R2_MAC_BENCH_UNPROMOTED_…zip` เป็นโฟลเดอร์ใหม่ แล้วดับเบิลคลิก `START_3PM.command` (มีไฟล์เดียว) ตัวนี้จะเปิด Chrome/Edge ด้วย profile ใหม่ที่ตั้งชื่อตามแพ็กเกจ จึงไม่แตะข้อมูลหรือ cache เดิม
3. ทำตาม `docs/FIELD_TEST_INSTRUCTIONS.md` §0–§1 แล้วส่งกลับมา: ผลจาก Terminal, 20–30 บรรทัดท้ายของ `~/Library/Logs/3PM Form Analyzer Native Capture.log`, ผล `lsof` (ต้องเห็น 127.0.0.1 เท่านั้น), ผล curl ที่ใส่ Origin (ต้องได้ 403) และผลตรวจว่าไม่มีภาพซ้ำหลังรีเฟรชหรือหลัง Recovery
4. Rollback: ปิดตัวนี้ แล้วเปิด `START_3PM.command` ของโฟลเดอร์ P1-08 หรือ Post-P108 เดิมที่ยังไม่ถูกแตะ · ห้ามลบ DB, session หรือ profile เดิม (`docs/post_p108_r2/ROLLBACK.md`)
