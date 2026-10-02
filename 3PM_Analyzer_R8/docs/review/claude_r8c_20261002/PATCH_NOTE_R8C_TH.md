# R8C Production Evidence Patch — บันทึกการแก้ (Claude, 2 ตุลาคม 2026)

สถานะ: **DEVELOPMENT PATCH — ยังไม่ apply เข้า tree หลัก** ส่งเป็น diff ให้ owner/Sol ตัดสินใจ
ไม่ใช่ release · ไม่ใช่การอนุมัติยิงจริง · ไม่ได้แตะ `app.js`, `core_runtime.js`, `pose.js`, native binaries, Equipment/Athlete/Session

ฐาน: `3PM_Analyzer_R8_P1_06_Repair_DEV_20261001.zip` SHA-256 `5b53886f529353575835f56b04f46e2d84c3a8154a56ef60c246e8fe791ee6dc`

## 1. อาการและผลกระทบ
| ID | อาการ | ผลกระทบในสนาม |
|---|---|---|
| M01/F02 | `temporal_evidence_core.mergeEvidence` ยุบ 25 เฟรมเหลือ 1 เมื่อ mediaTime/frameSeq เป็น null และเหลือ 13 ที่ 240 fps | หลักฐานภาพของ shot หายก่อนถึงตัวเลือก 25 ช่อง โดยไม่มีสัญญาณเตือน |
| F02b | frameSeq-only ที่ 240 fps เหลือ 1; same-source ไม่มี identity ห่าง 4 ms ยุบ 10→4 | เหมือนข้างบน |
| F03 | `camera_timeline_core.frameTimeMs({masterTimeMs:null})` คืน 0; `canonicalFrames` ทิ้งทุกเฟรมยกเว้นเฟรมแรกเมื่อ frameSeq=null (5→1) | การจัดเรียงภาพข้ามกล้องผิดเวลา หรือหาเฟรมไม่เจอ |
| F04/M03 | `native_capture_layer.putRecord` เขียน IndexedDB ตรงด้วย record ที่อ่านไว้ก่อนดาวน์โหลด blob | Recovery (เวลา + เฟรม End Shot) ที่ถูกเขียนระหว่างนั้นถูกลบ บน path native AVFoundation ซึ่งเป็น path หลักของ Mac |
| native null | `Number(f.master_time_ms)` ฯลฯ ทำให้ null จาก bridge กลายเป็น 0 | เวลา/ลำดับปลอม = 0 แล้วไปทำให้ F02 ยุบเฟรม |
| F01/M04 | `evidence_integrity_repair_layer`: MutationObserver เฝ้า subtree ที่ `renderRail()` เขียนทับทุกครั้ง → render วนไม่จบ | **ใน Chromium 141 (Linux headless, ไม่มี backend, กล้อง fake) หน้า `index.html` ของ R8 ไม่ถึง `load` เลย** — ยืนยันสาเหตุด้วยการสลับไฟล์เดียว (base+แก้ F01 = โหลดได้; patched−แก้ F01 = ค้าง). Mac NOT RUN |

## 2. หลักฐานและต้นเหตุ
ต้นเหตุร่วมของ F02, F03 และ native null คือ idiom `Number.isFinite(Number(v))` ซึ่งถือว่า `null`, `false`, `''` เป็น 0 (ละเมิด INV-001) R7 แก้ปัญหานี้ใน `evidence_budget_core` แล้ว (strict `finite` + "epoch ไม่ใช่ identity") แต่**ไม่ได้แก้โมดูล upstream** `temporal_evidence_core` ซึ่งทำงานก่อน และไม่ได้แก้ `camera_timeline_core` กับ `native_capture_layer` ที่ HV3 นำเข้ามา

F02 ส่วน 240 fps เกิดจากกฎ `sameEpoch` (|Δepoch| ≤ 8 ms) ที่ใช้รวมเฟรมแม้ทั้งสองเฟรมมี mediaTime ต่างกันชัดเจน

F04: R7 บังคับให้ทุก writer เข้าคิว `evidenceDbMerge` และ `temporal_evidence_layer` ทำตามแล้ว แต่ `native_capture_layer` (มาจาก HV3) ยังใช้ `objectStore.put` ตรง

F01: `boot()` สร้าง `MutationObserver(refresh)` บน `#shotReplayPanel` (childList+characterData+attributes) และ `renderRail()` ทำ `rail.innerHTML=''` + `appendChild` ใน subtree เดียวกันทุก refresh → mutation → refresh → render ซ้ำเป็น microtask chain ที่ไม่ปล่อย event loop

## 3. วิธีแก้และเหตุผล (เล็กที่สุดที่ครอบต้นเหตุ)
1. `temporal_evidence_core.js`: `finite` แบบเข้มงวดเหมือน `evidence_budget_core`; `sameSeq` นับเฉพาะ source เดียวกัน; `sameEpoch` ใช้รวมได้เฉพาะ duplicate ข้าม pipeline (source ต่างกัน) และเฉพาะเมื่อเทียบด้วย mediaTime ไม่ได้; การตรวจ seq ย้อนหลังแยกต่อ source
   - **รักษาไว้:** sparse frame ที่ไม่มี identity กับ worker frame ในช่วง ±8 ms ยังรวมเป็นเฟรมเดียวโดยเก็บ worker และรวม tags; เฟรมที่ mediaTime เท่ากันยังรวม
2. `camera_timeline_core.js`: เพิ่ม `known()` แบบเข้มงวด ใช้เฉพาะใน `frameTimeMs` และ `chronologyKey` ส่วน `num()` สำหรับ fps/jitter **ไม่แก้** (ดู open item #3)
3. `native_capture_layer.js`: `putRecord` → `evidenceDbMerge` (fail-closed ถ้าไม่มี พร้อม `s.error` ที่มองเห็นได้); `fetchFrameBlobs` ใช้ `known()` ให้ null คงเป็น null
4. `evidence_integrity_repair_layer.js` (F01): `renderRail()` คำนวณ signature (index ที่เลือก + จำนวนเฟรม + offset ของแต่ละช่อง) และไม่เขียน DOM ถ้าเท่าเดิม; ไม่ได้ใช้ debounce/timeout ซ่อนอาการ. observer/interval เดิมคงไว้ ทำให้ rail ยังตามการเปลี่ยน record/index และสร้างใหม่ได้เมื่อ panel ถูก rebuild
5. `index.html`: เปลี่ยน `?v=` ของ 4 ไฟล์ที่แก้ (`-r8c1`) เพื่อไม่ให้ browser ใช้ไฟล์เก่าจาก cache (server เป็น binary frozen ตรวจ cache header ไม่ได้). หมายเหตุ: test 2 ตัวตรวจ marker `?v=hv3` / `?v=hv2` แบบ substring จึงยังผ่านโดยไม่ต้องแก้ test

## 4. การตรวจที่ทำจริง (Linux container, Node v22.22.2)
| ตรวจ | ก่อน patch | หลัง patch |
|---|---|---|
| `test_evidence_identity_writer_r8c.js` (ใหม่) | **FAIL 11/11 bug assertions** (preserve 2/2 ผ่าน) | **PASS** |
| Legacy JS (`run_regressions.py`) | 100/103 | **101/104** (ตัวใหม่ผ่าน; 3 ตัวเดิมหยุดที่ pose hash เหมือนเดิม) |
| Diagnostic continuation 3 ตัว (สำเนาชั่วคราว แทนเฉพาะ pose hash) | 3/3 | 3/3 |
| Pure Phase0/P1 9 ไฟล์ + oracle | 10/10 | 10/10 |
| `test_persistence_r7.js` | PASS | PASS |
| `repro_astra_legacy_gaps.js` | gap ยืนยัน | ปรับเป็น closure check: 3 ปิด, cross-source ยังเปิด 1 |
| **Chromium 141** `run_f01_chromium_r8c.cjs` (harness ใหม่ ใช้ MutationObserver/timer จริง) | **FAIL** — หน้า harness ค้าง | **PASS 8/8**: idle callbacks 0, rail 25, real count ตาม record, active ตาม replay, slot click, Anchor เลือกเฟรมที่ติด tag หลัง target, rebind หลัง panel rebuild, ไม่มี page error |
| Chromium: harness F01 เดิมของ Astra (`f01_dom_harness.html`) | 100 callbacks (ชนเพดาน) | 1 callback |
| Chromium: `run_fullpage_smoke_chromium_r8c.cjs` โหลด `index.html` ทั้งแอป (python static server) | **FAIL** ไม่ถึง load ใน 20 s | **LOADED**, ตอบสนอง, rail 25; page error 1 ตัว (HTML "Error response") ซึ่งเกิดเหมือนกันบน base+F01fix → มาจากไม่มี backend |
| Chromium: `run_identity_parity_chromium_r8c.cjs` FrameUID Node vs WebCrypto 11 vectors (positive + negative) | PASS (shadow ไม่ได้แก้) | PASS — **รายการ "Chromium negative-parity BLOCKED" เดิมปิดได้สำหรับ FrameUID** |

**NOT RUN:** Mac runtime (Safari/Chrome บน macOS), กล้องจริง, Windows, ข้อมูลสนามที่ติดป้าย. Chromium ที่ใช้คือ `/opt/pw-browsers/chromium-1194` (HeadlessChrome 141, Linux) — ผลบน Mac ต้องยืนยันซ้ำ

## 5. เหตุที่การตรวจเดิมพลาด
- F01: มีแค่ source characterization (regex) และ Phase0 runner ค้นหา browser ด้วย `which chromium` เท่านั้น จึงรายงาน BLOCKED ทั้งที่เครื่องมี Chromium ของ Playwright อยู่ (Claude รอบ review ก็พลาดจุดเดียวกัน) — runner ใหม่รับ path ของ browser ได้และแยก BLOCKED/FAIL/PASS ชัดเจน
- R7 แก้ที่โมดูลที่เห็นอาการ (`evidence_budget_core`) แต่ไม่ได้ไล่ทั้ง data path ย้อนขึ้นไป (`native/temporal layer → temporal_evidence_core → evidence_budget_core`)
- Test ของ native layer ใช้ mock `mergeEvidence:(a,b)=>[...a,...b]` และ `indexedDB:{}` จึงไม่เคยผ่าน path การเขียนจริง
- Characterization script ยืนยันว่าบั๊กยังอยู่ แต่ไม่มีใครถูกกำหนดให้เปลี่ยนมันเป็น regression

## 6. มาตรการที่เพิ่ม (รันได้)
- `app/tests/test_evidence_identity_writer_r8c.js` อยู่ใน `run_regressions.py` อัตโนมัติ (glob `test*.js`) และรัน write queue จริงจาก `app.js`
- กฎที่แนะนำให้เพิ่มใน AGENTS/handoff: **"ห้ามใช้ `Number(v)` / `Number.isFinite(Number(v))` กับ field เวลา, ลำดับ หรือ identity ใน production; ใช้ strict reader ที่ถือ null/boolean/'' เป็น unknown"** และควรมี lint/grep gate นับจุดที่เหลือ (ตอนนี้ยังมี 12 โมดูล ดูข้อ 7)

## 7. ข้อจำกัด / open items (ยังไม่แก้)
1. **Cross-source same mediaTime** ใน `evidence_budget_core.canonicalUnique` ยังรวม native กับ worker ที่ mediaTime เท่ากันเป็น 1 → ต้องรู้ก่อนว่า native AVFoundation PTS กับ browser mediaTime เป็น clock เดียวกันไหม (ต้องวัดบน Mac จริง)
2. **mediaTime inversion ข้าม source** ใน `temporal_evidence_core.canonicalFrames` ยังเทียบ mediaTime ข้าม clock ได้ (เรื่องเดียวกับข้อ 1)
3. `camera_timeline_core.num()` สำหรับ fps: fps=null เคยกลายเป็น 0 → tolerance ถูก cap ที่ 50 ms (กว้างสุด) โดยบังเอิญ การแก้จะทำให้ tolerance แคบลง = เปลี่ยนพฤติกรรม alignment → ต้องให้ owner ตัดสิน
4. ผลข้างเคียงที่รู้แล้ว (เหมือน R7 temporal path): เมื่อผ่าน `evidenceDbMerge` เฟรม live ที่ native `replaceDense` ตั้งใจตัดออกจะกลับมาใน union ก่อนการเลือก 25 ช่อง ไม่ใช่การสูญหาย แต่เปลี่ยนชุดเฟรมให้เลือก
5. Loose null coercion ยังอยู่ใน 12 โมดูล รวม decision logic (`side_lifecycle_core`, `shot_intent_core`, `activity_classifier_core`, `real_bow_anchor_bridge_core`, `pose_filter_core`) → **ห้ามแก้โดยไม่มีข้อมูลสนามติดป้าย** เพราะเปลี่ยน shot authority
6. F01 แก้แล้วในระดับ harness + full-page Chromium; ยังต้องยืนยันบน Mac กับ backend จริงด้วย `run_fullpage_smoke_chromium_r8c.cjs <launcher URL>`
7. Phase0 runner: `F02_null_highfps` (fail อยู่แล้วก่อน patch เพราะชี้โมดูลผิด) และ `F03_null_clock` (fail หลัง patch เพราะบั๊กหาย) เป็น script ที่ assert พฤติกรรม HV3 baseline ต้อง retarget ไปที่ baseline ที่เก็บถาวร ไม่ได้แก้เพื่อไม่แตะ Phase0 evidence record
8. `PROJECT_STATE.md` / `HANDOFF_NEXT_CHAT.md` ไม่ได้แก้ เพื่อไม่ให้มี writer สองคนบนเอกสารสถานะ ผู้ apply patch ต้องอัปเดต

## 8. วิธี apply / ตรวจ / ย้อนกลับ
```
cd <tree root>                                   # โฟลเดอร์ที่มี app/, docs/
patch -p1 --dry-run < R8C_production_evidence.diff
patch -p1 < R8C_production_evidence.diff
python3 app/tests/run_regressions.py             # คาด 101/104 (3 ตัวที่แดงคือ pose hash เดิม)
node app/tests/test_evidence_identity_writer_r8c.js
node app/tests/phase01/run_f01_chromium_r8c.cjs [chromium]                 # PASS / FAIL / BLOCKED
node app/tests/phase01/run_identity_parity_chromium_r8c.cjs [chromium]
node app/tests/phase01/run_fullpage_smoke_chromium_r8c.cjs <url> [chromium]  # บน Mac ใช้ URL ของ launcher จริง
```
ย้อนกลับทั้งหมด: `patch -p1 -R < R8C_production_evidence.diff`
