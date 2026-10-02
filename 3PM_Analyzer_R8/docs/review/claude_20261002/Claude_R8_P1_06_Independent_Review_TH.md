# 3PM Analyzer R8 P1-06 Repair — Independent Claude Review
วันที่ 2 ตุลาคม 2026 · **Review only** · ไม่ได้แก้ source · ไม่ใช่ release · ไม่ใช่การรับรอง Production Ready

Reviewer: Claude (independent architect / code reviewer / real-time CV reviewer)
Implementation owner ที่จะรับ findings: GPT-5.6 Sol

---

## 0. สิ่งที่ตรวจจริง และสิ่งที่ไม่ได้ตรวจ

| Artifact | SHA-256 ที่ตรวจได้ | หมายเหตุ |
|---|---|---|
| `3PM_Analyzer_R8_P1_06_Repair_DEV_20261001.zip` (source) | `5b53886f…e6dc` | ตรงกับสำเนาใน nested Astra pack byte-for-byte |
| `R8_P1_06_Astra_Review_Evidence.zip` | `4ca9a33c…8899` | ตรงกับสำเนาใน nested pack |
| `R8_P1_06_Astra_Review_TH.md` | `b23dd5c4…a09a` | **เป็น review ฉบับก่อน repair** (ที่ใช้เป็นฐานของ repair) ไม่มี Astra re-review หลัง repair ใน pack |

ข้อจำกัดของ pack: ไม่มี parent ZIP (EL18/R7/HV3) และไม่มี base candidate `a9c07505…` จึง **ยืนยัน lineage ด้วยตนเองจาก parent bytes ไม่ได้** ยืนยันได้เพียง (ก) `test_r8_lineage_merge.js` PASS, (ข) repair provenance manifest ตรงกับ tree สุดท้าย, (ค) changed-paths ของรอบนี้อยู่ใน `app/shadow/**`, `app/tests/phase01/**`, docs เท่านั้น

### 0.1 ผลรันซ้ำโดย Claude (Linux container, Node v22.22.2, Python 3.12.3)

| ระดับ | ผล | รายละเอียด |
|---|---|---|
| Source/static verification | **ทำแล้ว** | อ่าน `app/shadow/**` ทุกไฟล์ (20 modules) และ Phase0/P1 tests ทั้งหมด |
| Repair provenance manifest | **PASS** | 317/317 ไฟล์ hash ตรง, missing 0, unlisted มีเฉพาะตัว manifest เอง (self-excluded ตามประกาศ) → finding manifest-stale-7 ของ Astra **ปิดแล้ว** สำหรับ manifest นี้ |
| Changed-path scope | **PASS (current side)** | 45 paths ทั้งหมดอยู่ใน shadow/tests/docs; `current_sha256` ตรงทุกไฟล์. `base_sha256` ตรวจไม่ได้ (ไม่มี base ZIP). หมายเหตุ: provenance บอก `changed_count=46` แต่ไฟล์ list มี 45 |
| Pure/offline tests | **9/9 PASS + oracle PASS (=10/10)** | ตรงกับที่รายงาน แต่ดู R8C-17 เรื่องสิ่งที่ oracle พิสูจน์จริง |
| Legacy JS | **100/103 PASS** | 3 ตัวที่ fail: `test_field_resilience_ble43894`, `test_multicamera_skeleton_ble4362`, `test_multiview_corroboration_integration_ble43895` — ทั้งหมดหยุดที่ frozen pose hash ตามที่ประกาศ. Diagnostic continuation: **NOT RUN by Claude** |
| `run_phase0_repros.py` | **F02_null_highfps = FAILED**, F01 dynamic = BLOCKED | ไม่ถูกรายงานใน checkpoint (ดู R8C-17) |
| `static_integrity_x282.py` | **FAIL** | pose.js hash `fe8cafae…8f02` ≠ frozen (คาดไว้ตาม narrow-thaw แต่เป็น gate ตาม AGENTS rule 6) |
| `test_distribution_contract_r6.py` | **FAIL** | root file `DEV_NOT_RELEASE.txt` ไม่อยู่ใน `PACKAGE_CONTRACT.json` |
| `SHA256SUMS.txt` (package manifest) | **FAIL** | 20 ไฟล์ hash ไม่ตรง, shadow modules และหลายไฟล์ไม่อยู่ใน list (manifest เก่า) |
| Native C++ ring sentinel | **compile+run rc=0** (g++) | ไม่ใช่ native runtime acceptance |
| Swift parse / Windows sentinel | **NOT RUN** | ไม่มี toolchain |
| Astra original repro scripts บน source ใหม่ | **ไม่สามารถรันจนจบ** | `redteam.cjs` หยุดที่ `RING_CAPACITY_PINNED` (= พฤติกรรมใหม่ fail-closed ตามที่ควร), `matching_oracle.cjs` หยุดเพราะ API ใหม่ต้องการ `masterClockId`, `browser_identity.cjs` ต้องการ Chromium ที่ไม่มี. ดังนั้น "green-after" ของ RT ทั้งหมดพิสูจน์โดย tests ใหม่ของ implementer ไม่ใช่ script ต้นฉบับ |
| Claude independent probes | **20/20 probe reproduce defect** | ไฟล์ `Claude_R8_P106_probes.zip` (`claude_redteam_r8.cjs` + ผล JSON) |
| Browser verification | **NOT RUN** | ไม่มี Chromium ใน container นี้ |
| Mac runtime / Windows runtime | **NOT RUN** | |
| Real camera | **NOT RUN** | |
| Real archer / labeled field | **NOT RUN** | |

ไม่มีข้อใดในรายงานนี้ infer PASS จาก claim ของผู้ส่ง ถ้าไม่ได้รันเอง เขียนว่า NOT RUN

---

## 1. Executive summary

Repair รอบนี้ **มีความคืบหน้าจริงและตรวจสอบได้**: shared identity validation, hard ring admission, digest-recompute + chain ใน event log, writer scope memo, strict candidate filter ก่อน derivation selection, archive path/ref check บน import และ provenance manifest ที่ตรงกับ tree แล้ว ไม่พบการลด assertion ของ test เดิมเพื่อให้ผ่าน และไม่พบการแตะ production static ในรอบนี้

แต่ closure matrix **อ้างเกินหลักฐานในหลายจุด** โดยเฉพาะ:

1. **RT-03 scheduler** — "worker-dispatch boundary" เป็นเพียง string ที่ caller ประกาศเอง; default dispatcher รัน `task()` inline บน thread เดียวกัน; Side ยังถูก aux synchronous work บล็อกได้ (reproduce แล้ว)
2. **RT-06 generation binding** — ยัง opt-in; ถ้าไม่ส่ง `allowedBindings` candidate จาก generation เก่ายังกลายเป็น real slot
3. **FrameUID identity integrity** — UID เดียวกันที่มี content/source time ต่างกันผ่าน replay, ring, projector ได้โดยไม่ conflict (INV-002)
4. **Real-slot truth ข้าม module** — writer `saveProjection` และ Review view-model รับ projection ที่มี real slot ปลอมและ FrameUID ซ้ำ (INV-016/017)
5. **Projector ไม่ตรง contract §2.6** ใน 2 จุดที่ตรวจได้ด้วย oracle: tolerance คำนวณจากระยะห่างของ candidates แทน observed capture cadence, และ tie-break ไม่ใช่ lexicographic ตามที่ contract กำหนด
6. **Gates ที่ AGENTS rule 6 บังคับ** (static integrity, distribution contract, SHA256SUMS) **fail** และ phase0 repro runner มี F02 = failed แต่ไม่อยู่ในสรุป

ไม่พบหลักฐานที่ทำให้ต้องเลิก Option 2 / redesign ทั้งระบบ ปัญหาทั้งหมดซ่อมได้ภายใน module boundary เดิม

---

## 2. Verdict ต่อ RT-01..RT-08 (หลัง repair)

| RT | Claim ใน closure matrix | Claude verdict | เหตุผลสั้น |
|---|---|---|---|
| RT-01 replay defaults | REPAIRED offline | **PARTIAL** | dimension/mirror/decode explicit แล้ว ✔ แต่ `role` ยัง default `'side'`, UID ซ้ำที่ source time ต่างกันผ่าน, ไม่มี discontinuity check (R8C-02, R8C-19) |
| RT-02 ring bound | REPAIRED pure | **PARTIAL** | hard byte admission ✔, cleanup on release ✔ แต่ lease ไม่มี TTL, clock-domain ผสมใน retention เดียว, duplicate UID ต่าง content ถูก dedup เงียบ (R8C-08) |
| RT-03 scheduler | REPAIRED as boundary contract | **OPEN** | boundary เป็น label; inline execution ยังทำได้และเป็น default (R8C-01) |
| RT-04 event log | REPAIRED in-memory | **PARTIAL** | digest/chain/terminal ✔ แต่ไม่มี namespace policy, `cycle()` query รั่วข้าม namespace, reducer ยังเป็น transition helper (R8C-05) |
| RT-05 writer | REPAIRED in-memory | **PARTIAL** | scope memo ✔ deep copy ✔ แต่ projection/phase-claim ไม่ถูก validate เชิงเนื้อหา (R8C-03, R8C-14) |
| RT-06 logical25 | REPAIRED tested cases | **PARTIAL** | eligibility-before-derivation ✔ reversal stable ✔ แต่ generation opt-in, UID conflict เงียบ, tolerance และ tie-break ไม่ตรง contract (R8C-02, R8C-04, R8C-10, R8C-11) |
| RT-07 Anchor | REPAIRED pure VM | **PARTIAL** | plan/phase check ✔ Inactive label ✔ แต่ "phase proof" คือ string ใดก็ได้ที่ candidate อ้างเอง และไม่ตรวจ UID ซ้ำ (R8C-03, R8C-11) |
| RT-08 archive | REPAIRED pure import-validation | **PARTIAL** | `../` และ dangling `payloadRef` ✔ แต่ case/NFD/Windows-reserved collision, payload smuggling, `__proto__` corruption, refs อื่นไม่ตรวจ (R8C-06, R8C-13) |
| M06 Node/browser parity | REPAIRED Node/WebCrypto | **PARTIAL** | parity ของ FrameUID ✔ (Node+WebCrypto) แต่ lone-surrogate collision ทั้งสอง entry และ validators อื่นยังเป็น Node-only (R8C-15, R8C-16). Chromium NOT RUN |

---

## 3. Findings

รูปแบบ: Severity · Status (Confirmed = reproduce ด้วย probe แล้ว / Likely / Risk) · Probe ID อ้างอิงไฟล์ `claude_redteam_r8.cjs`

### R8C-01 — HIGH · Confirmed · Scheduler isolation เป็นเพียง label (RT-03 ยัง OPEN)
- **ที่:** `app/shadow/scheduler/priority_scheduler.js` — `AnalysisScheduler.constructor` (default `dispatch`), `submit`, `LatestLane._start`, `_startAux`
- **พฤติกรรม:**
  - `dispatchKind:'worker-dispatch'` เป็น string ที่ caller ประกาศเอง ไม่มีการตรวจว่า task เป็น worker message จริง
  - default dispatch: `if(typeof task==='function') return await task()` → รัน function ของ caller **inline บน main thread**
  - Probe C05: aux task busy-loop 30 ms แล้ว submit Side → order `aux-start, aux-end, side` (Side ถูกบล็อกเหมือนก่อน repair)
  - Probe C06: dispatch ที่ไม่ resolve ทำให้ Side lane ค้างถาวร (`sideActive=true`, งานถัดไป pending ตลอด); `cancelGeneration` ยกเลิกเฉพาะ pending ส่วน active job ของ generation ที่ถูก cancel ยังถูกรายงาน `completed` ภายหลัง
  - Probe C07: `onOutcome` ที่ throw → unhandled rejection (Node ≥15 default terminate process)
  - Test `test_p103_ring_scheduler.js` และ RT-03 regression ใช้ `dispatch: async task=>task()` เอง จึงพิสูจน์ได้เพียงว่า "ถ้าไม่ใส่ meta จะ throw"
- **ผลกระทบ:** INV-019 ("Side decision ไม่รอ auxiliary") ไม่ได้ถูก enforce. ถ้าต่อ live shadow ด้วย scheduler นี้ Side latency จะขึ้นกับ aux compute และ aux ที่ค้างทำให้ lane หยุดถาวร
- **Repair boundary:** แยก pure policy (`LaneController`: queue/drop/fairness/generation) ออกจาก executor. Executor ต้องรับเฉพาะ descriptor ที่ serialize ได้ (`{workerId, messageType, payloadRef}`) และห้ามรับ function. เพิ่ม per-job deadline/watchdog (versioned policy), stale-generation result → `stale_discarded` ไม่ใช่ `completed`, observer callback ห่อ try/catch และนับ `observerErrors`
- **Regression ที่ต้องเพิ่ม:** (1) submit function ต้อง throw แม้มี meta ถูกต้อง; (2) aux dispatch ที่ไม่ resolve → หลัง deadline lane เดินต่อและรายงาน `timed_out`; (3) cancel active generation → ผลกลับมาเป็น `stale_discarded`; (4) onOutcome throw ไม่ทำให้เกิด unhandledRejection; (5) ใน browser QA: Side p95 latency ภายใต้ aux worker load (runtime gate, ไม่ใช่ unit)

### R8C-02 — HIGH · Confirmed · FrameUID เดียวกันแต่ content/time ต่างกันผ่านทุกชั้นโดยไม่ conflict
- **ที่:** `adapters/replay/replay_adapter.js` `envelope()`; `ring/role_ring.js` `add()`; `projector/logical25.js` `bestDerivations()`; `contracts/record_validators.js` `validateEvidenceCandidate()`
- **พฤติกรรม:**
  - C19: replay ส่ง `frameSeq=10` สองครั้งที่ `sourcePTS` 1 s และ 9 s → ได้ envelope 2 ตัว UID เดียวกัน mapped time ต่างกัน. Conflict check ทำงานเฉพาะเมื่อมีทั้ง `payloadRef` และ `contentDigest`. ไม่มีการตรวจ frameSeq/PTS ย้อนหลังภายใน generation (C19: seq 10→5, PTS 1 s→0.5 s ผ่าน)
  - C08: ring รับ UID ซ้ำที่ `contentDigest` ต่างกัน → คืน snapshot เดิมและนับเป็น `duplicateDelivery`
  - C13: projector มี 2 derivations UID เดียวกันแต่ `contentDigest` และ `sourceId` ต่างกัน → เลือกตัวใหญ่กว่าเงียบ ๆ
  - C18: candidate ที่ `frameUID:'not-a-uid'` ผ่าน validator; candidate ไม่มี `frameSeq` จึง recompute UID จาก tuple ไม่ได้
- **ผลกระทบ:** INV-002/003 (UID immutable ต่อ sample เดียว). ถ้า upstream bug ส่ง UID ซ้ำ ระบบจะเลือกภาพผิดโดยไม่มีสัญญาณ ซึ่งเป็นปัญหาตระกูลเดียวกับ legacy M01/F02 ที่กำลังหนีอยู่
- **Repair boundary:** นิยาม "frame identity record" = `(frameUID, sourceId, streamGeneration, frameSeq, sourcePTS, contentDigest|null)` และให้ทุก consumer (replay, ring, writer, projector) เปรียบเทียบ identity record เต็ม: เท่ากัน = idempotent duplicate, ต่างกัน = `FRAME_UID_CONFLICT` + quarantine. Candidate ต้องอ้าง `frameEnvelopeRef` ตาม contract §2.5 และ validator ต้อง recompute UID จาก tuple. Replay ต้องตรวจ monotonic frameSeq ภายใน generation และ PTS ย้อน → `mappingStatus:'discontinuous'` หรือ reject ตาม policy
- **Regression:** C19/C08/C13 กลับขั้วเป็น assert throw/quarantine; เพิ่ม fixture "PTS ย้อนใน generation เดียว"

### R8C-03 — HIGH · Confirmed · Writer และ Review รับ real slot ปลอมและ FrameUID ซ้ำ
- **ที่:** `evidence_writer/in_memory_writer.js` `execute()` (operation `saveProjection`, `addPhaseEvidence`); `contracts/record_validators.js` `validateProjection()`; `review/view_model.js` `validateProjection()`
- **พฤติกรรม (C11):** projection ที่ S03 และ S04 เป็น `real` ด้วย `actualFrameUID:'f1/forged'` เดียวกัน, ไม่มี candidate ใน record → writer commit สำเร็จ และ `buildReviewView` แสดง `realCount=2`. `record_validators.validateProjection` ตรวจแค่ shell + `slots.length===25`. Phase claim ที่ `phase:'banana', frameUID:42` ก็ commit ได้
- **ผลกระทบ:** INV-016 (real slot ต้อง resolve ถึงภาพจริง) และ INV-017 (UID เดียวห้ามอยู่สอง real slot) ไม่ถูก enforce ที่ boundary ที่เก็บและแสดงผล. ปัจจุบันมี validateProjection **สองชุดที่ไม่เท่ากัน** (writer vs view) ซึ่งเป็นจุดเกิด drift
- **Repair boundary:** validator projection ชุดเดียวใน `record_validators.js`: per-slot schema ตาม §2.6, slot plan, injectivity ของ `actualFrameUID`, `derivationId/candidateId` required iff real, `signedDelta === actualMasterTime − targetMasterTime`, counts รวม 25. Writer `saveProjection` ต้อง cross-check ว่าทุก real slot อ้าง candidate ที่อยู่ใน aggregate เดียวกัน (UID+derivation+digest ตรง). View-model ใช้ validator ตัวเดียวกัน
- **Regression:** forged/duplicate projection → writer reject + view reject; phase claim schema corpus

### R8C-04 — HIGH · Confirmed · Generation/role-binding filter ยังเป็น opt-in
- **ที่:** `projector/logical25.js` `strictCandidate()` / `project25()` default `allowedBindings=[]`
- **พฤติกรรม (C12):** เรียก `project25` โดยไม่ส่ง `allowedBindings` → candidates จาก `streamGeneration:'g-OLD'` ได้ `uniqueRealCount=2`
- **ผลกระทบ:** Astra RT-06 "old generation ยังได้ real" ปิดเฉพาะเมื่อ caller จำส่ง binding. Contract §2.6 Eligibility: "frame อยู่ role binding interval ของ cycle" เป็นเงื่อนไขบังคับ ไม่ใช่ optional. INV-004 stale generation
- **Repair boundary:** `activeRoleSnapshot` + `roleBindingHistory` เป็น required input ของ `project25`; empty/missing → throw หรือทุก slot `missing` + `generation_mismatch`. Binding ต้องมี time interval ไม่ใช่แค่ `(sourceId, generation)`
- **Regression:** omit bindings → reject; candidate นอก binding interval → ineligible; reason `generation_mismatch`

### R8C-05 — MEDIUM-HIGH · Confirmed · Event log ไม่มี namespace policy และ query รั่ว
- **ที่:** `event_log/in_memory_event_log.js` `append()`, `cycle()`; `decision/shot_cycle_reducer.js`
- **พฤติกรรม (C10):**
  - `cycle('c1',{namespace:'shadow/A'})` (ไม่ส่ง runId) คืน events ของ `prod/B` ด้วย เพราะ branch ที่ไม่ครบทั้งคู่ไป aggregate ทุก scope
  - append event `confirmed` ตรง ๆ (ไม่ผ่าน reducer) ใน `eventNamespace:'production'` ได้ โดยไม่มี `decidedAtMasterTime`, `recordedAtMasterTime`, `masterClockId`
  - `idempotencyKey`/`eventId` เป็นค่าที่ caller ส่งมา ไม่ derive จาก `[namespace,runId,cycleId,seq,eventType,policyVersion]` ตาม §2.4
  - reducer ยังไม่มี Side generation reset → `uncertain(authority_stream_reset)` และ 200 ms watermark (Astra RT-04 ส่วนนี้ยังเปิด)
- **ผลกระทบ:** INV-009 (shadow ไม่มี commit capability), INV-030 (shadow ห้ามเขียน legacy namespace). One-decision-owner ไม่ถูก enforce ที่ log
- **Repair boundary:** log construct ด้วย `allowedNamespacePrefix='shadow/'` (ปฏิเสธ `legacy-production` และอื่น ๆ); `cycle()` บังคับ namespace+runId; `validateShotEvent` ตรวจ field เวลา/clock ตาม §2.4 และ derive idempotencyKey ที่ boundary. Reducer reset/watermark เป็นงาน P1-04 ที่ยังค้าง ให้แยกเป็น item ของตัวเอง ไม่ต้องรวมกับ log
- **Regression:** namespace deny corpus; partial-scope query → throw; raw append ไม่มี decision times → reject; derived key ต่างจาก supplied → reject

### R8C-06 — MEDIUM · Confirmed · `clonePlain`/`immutablePlainCopy` จัดการ key `__proto__` ผิด (ทุก boundary)
- **ที่:** `contracts/strict_types.js` `clonePlain()` และ `deepFreeze()`; กระทบ writer, event log, archive, projector, ring
- **พฤติกรรม (C02 + `proto_import_probe.cjs`):** JSON ที่มี own key `"__proto__"` → `out[k]=…` ไปตั้ง prototype แทนสร้าง own property. ผล: (1) ข้อมูลหายจาก own keys, (2) `deepFreeze` ไม่ freeze prototype จึงแก้ค่าที่ "immutable copy" มองเห็นได้, (3) `InMemoryArchiveImporter.stage` บันทึก archive ที่ digest ไม่ตรง manifest และ **revalidate ตัวเองไม่ผ่าน** (`MANIFEST_DIGEST_MISMATCH`)
- **ผลกระทบ:** immutability/round-trip (INV-025) และ "unknown fields ไม่ drop เงียบ" ถูกละเมิดด้วย input ที่เป็น JSON ถูกต้อง. ความเสี่ยงหลักคือ import archive จากภายนอก
- **Repair boundary:** ใน `clonePlain` สร้าง output ด้วย `Object.create(null)` หรือใช้ `Object.defineProperty`, หรือปฏิเสธ key `__proto__`/`constructor`/`prototype` อย่างชัด (แนะนำ reject + reason). ทำครั้งเดียวที่ strict_types ทุก consumer ได้ผลพร้อมกัน
- **Regression:** corpus `{"__proto__":…}` ในทุก record kind; archive stage→validate ต้องคงสภาพ

### R8C-07 — MEDIUM · Confirmed · Clock mapping semantics ยังไม่ปิด
- **ที่:** `contracts/clock_mapper.js` `validateClockMapping()`, `mapTicks()`
- **พฤติกรรม:**
  - C03: `sourceTimebase=1/90000` กับ `scale=1/1` ผ่านเป็น `validated` → 1 วินาทีของ source (90000 ticks) map เป็น 90 000 µs แทน 1 000 000 µs. ไม่มีการตรวจว่า `scale` สอดคล้องกับ timebase (nominal scale = timebase × 10⁶ × drift ที่ bounded)
  - `uncertaintyBoundUs:0` + `residual/transport=null` ผ่าน `validated`; method `fixture` ก็ออก `validated` ได้
  - C04: `mapTicks(m,null)` คืน `mappingUncertainty:500` ในขณะที่ `contract_v1` บังคับให้เป็น `null` เมื่อ `sourcePTS=null` → output ของ mapper ป้อนกลับเข้า envelope validator ไม่ได้ (inconsistency ระหว่าง module)
  - ไม่มี mapping revision/supersede และ `validEndTick=null` = valid ตลอดไป
- **ผลกระทบ:** INV-006/007. Validated time ที่ผิดหน่วย 11 เท่าจะทำให้ projector เลือกเฟรมผิดทั้งหมดโดยดูเหมือนถูกต้อง
- **Repair boundary:** บังคับ `|scale − timebase·10⁶| ≤ declaredDriftBound` (เก็บ drift bound เป็น field), validated ต้องมี components ที่ไม่ null สำหรับ `sample-affine`; `fixture` ห้ามเป็น `validated` นอก replay namespace; `trusted-api` ต้องอ้าง `trustedApiId` + bound ที่อธิบายที่มา. `mapTicks(null)` → uncertainty `null`. เพิ่ม `supersedes` + monotonic version
- **Regression:** scale/timebase mismatch → reject; null ticks → null uncertainty และ round-trip ผ่าน `validateFrameEnvelope`

### R8C-08 — MEDIUM · Confirmed · RoleRing: clock-domain ผสม, frame ไม่ validate, late frame หายทันที
- **ที่:** `ring/role_ring.js` `_bookTime()`, `add()`, `_evict()`
- **พฤติกรรม (C08):** retention ใช้ `latestBookTime=max(...)` ข้าม 3 clock domain (`source-master`, `arrival-master`, `caller-bookkeeping`). Frame A ที่ mapped 5 s แล้ว add frame B ด้วย bookkeeping 0 → B ถูกรับ, ถูก evict ภายใน `add()` เดียวกัน แต่ `add()` ยังคืน snapshot ของ B ราวกับเก็บอยู่. `add()` ไม่เรียก `validateFrameEnvelope` (`frameUID:''` ผ่าน). Duplicate UID ต่าง content → ดู R8C-02
- **ผลกระทบ:** INV-029 (dropped telemetry ต้องมี), ผู้เรียกเชื่อว่ามี frame ใน ring ทั้งที่ไม่มี → lease ต่อมาได้ `null` แบบอธิบายไม่ได้
- **Repair boundary:** ring ผูก retention กับ clock domain เดียว (ประกาศตอน construct); frame จาก domain อื่น → reject พร้อม reason. ถ้า frame เก่ากว่า cutoff ตอน admission → ไม่รับและคืน `{admitted:false, reason:'buffer_expired'}`. `add()` รับเฉพาะ envelope ที่ validated แล้ว (หรือ branded object จาก validator)
- **Regression:** C08 กลับขั้ว; mixed-domain add → reject

### R8C-09 — MEDIUM · Confirmed · Lease ไม่มี TTL → lease รั่วตัวเดียวทำให้ Side admission throw ถาวร
- **ที่:** `ring/role_ring.js` `lease()`, `add()`
- **พฤติกรรม (C09):** budget 20, frame 20 bytes ถูก lease แล้วไม่ release; `advance(1e12)` ไม่คืนพื้นที่; add ถัดไปของ Side → `RING_CAPACITY_PINNED` throw. `maxLeasedBytes` default = byteBudget จึงกินได้ทั้ง ring และไม่ validate (NaN/negative = ไม่จำกัด)
- **ผลกระทบ:** Side capture path ล้มด้วย exception จาก consumer ที่ลืม release (เช่น aux job ที่ค้างตาม R8C-01) ซึ่งขัด "Side must not be blocked by auxiliary"
- **Repair boundary:** lease TTL (versioned), `maxLeasedBytes < byteBudget` บังคับ (สำรองที่ให้ Side admission), forced revoke เมื่อหมดอายุ + metric `leaseRevoked`. ตัดสินใจ policy ว่า Side admission ภายใต้ pressure คือ drop-with-reason ไม่ใช่ throw
- **Regression:** leaked lease หลัง TTL ถูก revoke และ add ผ่าน; maxLeasedBytes invalid → constructor throw

### R8C-10 — MEDIUM · Confirmed · Tie-break ไม่ใช่ lexicographic ตาม contract §2.6
- **ที่:** `projector/logical25.js` `match()` — cost = `|delta|·weight + j`
- **พฤติกรรม (C20, `lexi_oracle.cjs`):** ใน 6 กรณีสุ่มแรกพบ counterexample: frames `fC@125000, fD@250000, fE@150000, fG@250000` (anchor 0–400000, T=50000) — ทั้งสอง matching มี 3 slots และ total delta 125000 เท่ากัน contract ต้องการ `S03|fC, S04|fD, S05|fG` (ordered list เล็กกว่า) แต่ได้ `S03|fC, S04|fE, S05|fD`. Secondary term `+j` เท่ากับ "sum ของ index frame ที่ใช้" ซึ่งเป็นกฎคนละตัว
- **ผลกระทบ:** deterministic ภายใน implementation นี้ ✔ แต่ไม่ตรง spec ที่ประกาศไว้ ถ้า Windows/native หรือ re-implementation ใด ๆ เขียนตาม contract จะได้ golden คนละชุด (INV-022)
- **Repair boundary:** หลังหา (max cardinality, min total delta) ให้ทำ lexicographic refinement: เดิน slot ตามลำดับ S01→S25, ลอง fix คู่ (slot, frame) ที่เล็กสุดแล้วตรวจว่า optimum ยังเท่าเดิม (re-solve) — ขนาด 25×F ทำได้สบาย. หรือแก้ contract ให้ตรงกับ implementation อย่างเป็นทางการ (ต้องเป็นการตัดสินใจของ owner ไม่ใช่ของ implementer)
- **Regression:** brute-force oracle ที่ตรวจทั้ง cardinality, total delta และ lexicographic rule (ใช้ `lexi_oracle.cjs` เป็นฐาน, ≥10 000 cases, frames ≤6)

### R8C-11 — MEDIUM · Confirmed · Tolerance ใช้ cadence จาก candidate spacing แทน observed capture interval
- **ที่:** `projector/logical25.js` `cadenceBySource()`, `edgeTolerance()`
- **พฤติกรรม (C14):** source `measuredFPS:30` แต่ candidates ห่างกัน 200 ms → `periodUs=200000` → T ถูก cap ที่ 50 000 µs. Slot S03/S05 ได้ real ที่ `signedDelta=−40000` ทั้งที่ครึ่ง period จริงคือ 16 667 µs. `measuredFPS` ถูกใช้เป็น fallback เท่านั้น
- **ผลกระทบ:** contract §2.6: "P = 1,000,000/measuredFPS จาก observed capture intervals… J ใน generation เดียว". Candidate set เป็น subset ที่ถูกเลือกมาแล้ว spacing จึงไม่ใช่ cadence → slot รับภาพที่ห่าง target เกินความจริงและรายงานว่า "in tolerance"
- **Repair boundary:** cadence เป็น input ของ projector ต่อ `(sourceId, generation)` มาจาก ring/capture telemetry (observed interval median + p95 jitter) พร้อม flag `negotiated` เมื่อไม่มี observed; ไม่มีทั้งคู่ → `cadence_unknown`
- **Regression:** sparse candidates + declared 30 fps → T ≤ ceil(16667+J+U)

### R8C-12 — MEDIUM · Confirmed · "Anchor phase proof" คือ string ที่ candidate อ้างเอง
- **ที่:** `review/view_model.js` `anchorTarget()`; `projector/logical25.js` (copy `phaseEvidenceRefs` จาก candidate)
- **พฤติกรรม (C15):** candidate ที่ `phaseEvidenceRefs:['not-anchor-anything']` ใน S03 → `anchorTarget` คืน real. กลับกัน frame ที่อยู่ใน verified anchor interval แต่ candidate ไม่มี refs → projector ให้ S03 เป็น real แต่ Anchor button บอก Missing ทั้งที่ timeline refs (`tl-anchor`) มีอยู่
- **ผลกระทบ:** contract: "Anchor button เลือก real S03–S05 ที่ผ่าน settled-anchor constraint". ตอนนี้ proof ไม่ผูกกับ timeline และ projection กับ Review ขัดกันเอง
- **Repair boundary:** Projector เป็นผู้รับผิดชอบ phase proof: บันทึก `phaseProof={timelineRefs, intervalCheck:'inside', settledAnchorBoundary}` ใน slot. View-model ตรวจ field นั้น ไม่ดู refs ที่ candidate อ้าง. `actualPhaseEvidenceRefs` ต้องผ่าน validator ว่าอ้าง phase evidence ที่ phase ตรงกันจริง
- **Regression:** arbitrary candidate ref → Anchor missing; valid timeline interval + no candidate ref → Anchor real ถ้า policy อนุญาต (owner ต้องตัดสิน)

### R8C-13 — MEDIUM (HIGH ก่อนต่อ filesystem extractor) · Confirmed · Archive boundary ยังมีช่อง
- **ที่:** `archive/shadow_archive.js` `safePath()`, `validateManifestBody()`, `roundTrip()`, `collectPayloadRefs()`
- **พฤติกรรม (C17):** ผ่านทั้งหมด: `Frame.jpg`+`frame.jpg` (ชนกันบน APFS case-insensitive ซึ่งเป็น default ของ Mac), `café.jpg` NFC+NFD (ชนกันบน macOS), `CON`, `x.` (Windows). `payloads['../../evil']` ที่ไม่มีใน fileTable และไม่ใช่ base64 ถูกคงไว้หลัง `roundTrip`/`stage` โดยไม่นับใน size limit. Ref อื่นนอกจาก key ชื่อ `payloadRef` (เช่น `actualFrameUID` ใน projection) ไม่ถูกตรวจ. `records` ยังไม่ผ่าน schema validator ใด ๆ
- **ผลกระทบ:** INV-025 และ contract §2.7. ปัจจุบันยังไม่มี extractor จึงยังไม่ใช่ file write จริง แต่เป็น defect ที่ต้องปิดก่อนมี extractor บน Mac/Windows
- **Repair boundary:** path policy = NFC-normalize + case-fold uniqueness + Windows reserved names/trailing dot/space/`:` + NUL deny; reject payload keys ที่ไม่อยู่ใน fileTable; validate `records` ด้วย typed validators (frames/candidates/events/projections) และตรวจ referential integrity ทั้ง frameUID/candidateId/mappingId
- **Regression:** C17 corpus กลับขั้ว

### R8C-14 — MEDIUM · Confirmed · Validator coverage ยังไม่ครอบ INV-005
- **ที่:** `contracts/record_validators.js`
- **พฤติกรรม (C18):** `validateObservation` รับ `sourceInterval:'yesterday'`, `inferenceStart:{x:1}`, `inferenceEnd:-5`, `receivedAt:'now'` — field ถูก require แต่ไม่ถูกตรวจชนิด/ลำดับ. Unknown fields ใน Observation/Candidate/Event/Projection ไม่ถูกปฏิเสธ (ต่างจาก FrameEnvelope). `validateShotEvent` ไม่ตรวจ `masterClockId`, decision/record times, `previousEventDigest` format
- **ผลกระทบ:** INV-005 "source time, arrival, inference start/end, decision time เป็นคนละ field" มี field แต่ไม่มี enforcement ซึ่งเป็นข้อกำหนดหลักของ prompt นี้
- **Repair boundary:** typed interval schema `{start:TimeUs|null,end:TimeUs|null,clockDomain}` + `start≤end`, `inferenceStart≤inferenceEnd`, ห้าม `inference*` ถูกใช้แทน `sourceInterval`; strict unknown-field policy (`extensions` เท่านั้น) สำหรับทุก record kind
- **Regression:** type corpus ต่อ field; unknown field → reject

### R8C-15 — MEDIUM · Confirmed · Lone surrogate ทำให้ FrameUID ชนกัน (ทั้ง Node และ WebCrypto)
- **ที่:** `contracts/identity_material.js` `isId()`, `utf8()`
- **พฤติกรรม (C01):** `runId:'run\uD800'` และ `'run\uFFFD'` เป็น string ต่างกัน แต่ `TextEncoder` แทน lone surrogate ด้วย U+FFFD → UID เท่ากันทั้ง Node และ WebCrypto ในขณะที่ canonical JSON digest ต่างกัน
- **ผลกระทบ:** parity ของสองฝั่ง ✔ แต่ identity injectivity ✘ (INV-002). ความเสี่ยงจริงต่ำใน ID ที่ระบบสร้างเอง แต่สูงขึ้นเมื่อ import archive / native string จาก adapter
- **Repair boundary:** `isId` บังคับ well-formed UTF-16 (`String.prototype.isWellFormed` หรือ regex surrogate check) และพิจารณา charset/length limit ของ ID ใน contract
- **Regression:** negative golden vector สำหรับ lone surrogate ทั้งสอง entry

### R8C-16 — MEDIUM · Confirmed (static) · Browser portability มีแค่ FrameUID
- **ที่:** `contracts/contract_v1.js`, `clock_mapper.js`, `canonical_json.js` (ใช้ Node `crypto`/`Buffer`), `record_validators.js`, `projector`, `writer`, `log`, `archive`, `telemetry/event_tape.js` (`Buffer.byteLength`)
- **พฤติกรรม:** เฉพาะ `identity_material.js` + `identity_browser.js` เป็น UMD; ส่วนอื่นเป็น CommonJS และพึ่ง Node API. Browser shadow จึงยังรัน envelope/mapping/record validation และ canonical digest ไม่ได้
- **ผลกระทบ:** "Node vs browser validation parity" ที่อ้างใน closure matrix จริงเฉพาะ identity. INV-022 ต้องการ shared semantics ทุก module
- **Repair boundary:** แยก pure core (ไม่มี `require('crypto')`, digest เป็น injected async function หรือ sync SHA-256 แบบ pure JS ที่มี golden) + thin Node/browser entry; ไม่ต้อง redesign
- **Regression:** load ทุก pure module ใน `vm` context ที่ไม่มี `require`/`Buffer`; golden parity ของ canonical digest. Chromium run: **NOT RUN**

### R8C-17 — MEDIUM · Confirmed · รายงาน PASS/closure ที่ทำให้เข้าใจผิด หรือ gate ที่ fail แต่ไม่ถูกรายงาน
- **ข้อเท็จจริงที่ตรวจได้:**
  1. `run_phase0_repros.py` ให้ `F02_null_highfps=failed` (ไฟล์ `docs/phase01/phase0_repro_results.json` ใน tree ก็บันทึก failed). สาเหตุ: script ยัง assert พฤติกรรม HV3 ของ `evidence_budget_core.canonicalUnique` ซึ่ง R7 lineage แก้แล้ว (ตอนนี้คืน 25/25). Gap จริงย้ายไปอยู่ `temporal_evidence_core.mergeEvidence` ซึ่ง `repro_astra_legacy_gaps.js` ยืนยันว่ายัง 25→1 และ 25→13. ผลคือ runner แดงด้วยเหตุผลที่ผิด และไม่ปรากฏใน CHECKPOINT
  2. `static_integrity_x282.py` และ `test_distribution_contract_r6.py` **FAIL** — AGENTS rule 6 บอกว่าเป็น gate ที่ block delivery แต่ checkpoint ไม่กล่าวถึง (dev package ไม่ใช่ release ก็จริง แต่ต้องรายงาน)
  3. `SHA256SUMS.txt` เก่า: 20 mismatches และไม่มี shadow modules ทั้งหมด. ตอนนี้มี manifest สองชุดที่ขัดกัน (repair provenance ✔ vs package SHA256SUMS ✘)
  4. "3360-case oracle" (`projector_oracle_postrepair.cjs`) ตรวจเพียง `project(input) == project(reverse(input))` ไม่ได้เทียบกับ brute-force optimum และไม่ได้ตรวจ tie rule. Closure matrix เขียนว่า "3360-case oracle no counterexample" ซึ่งอ่านได้เหมือน optimality oracle ของ Astra
  5. RT-03 test ใช้ `dispatch: task=>task()` (ดู R8C-01)
  6. provenance `changed_count=46` vs list 45
- **Repair boundary (documentation/QA เท่านั้น):** แก้ repro F02 ให้ชี้ `temporal_evidence_core` หรือ mark superseded อย่างโปร่งใส (ห้ามแก้ให้เขียวโดยลด assertion), รวม phase0 runner + rule-6 gates ในสรุปพร้อมสถานะจริง, regenerate SHA256SUMS หรือประกาศว่า dev package ใช้ provenance manifest แทนและ SHA256SUMS เป็น legacy, เปลี่ยนชื่อ oracle เป็น "input-reversal invariance" และเพิ่ม optimality oracle จริง

### R8C-18 — HIGH (สำหรับ field) · Confirmed · Production legacy gaps ยังอยู่ใน path ที่ field build จะใช้
- **ที่:** `app/static/temporal_evidence_core.js` (M01/F02), `camera_timeline_core.js` (F03), legacy writer (F04/M03), legacy UI observer (F01/M04)
- **พฤติกรรม (รันซ้ำวันนี้ `repro_astra_legacy_gaps.js`):** null-time 25 frames → 1, 240 fps 25 → 13, `frameTimeMs({masterTimeMs:null})` → **0** (null กลายเป็น 0 ตรงข้าม INV-001), cross-source media identity → 1. F04 stale writer repro ยัง reproduce
- **ผลกระทบ:** shadow ไม่ได้ต่อเข้า production ดังนั้น field build ใด ๆ จาก tree นี้คือ legacy path ที่มี gaps เหล่านี้ทั้งหมด. ผลต่อการเก็บข้อมูลสนามโดยตรง: evidence 25 slots อาจหายเหลือภาพเดียวเมื่อ timing เป็น null, ที่ 240 fps เสียเกือบครึ่ง
- **สถานะ:** OPEN BY DESIGN ในรอบนี้ ยอมรับได้สำหรับ pure work แต่เป็น blocker ของ live shooting (ดู §5)

### R8C-19 — LOW · Confirmed/Risk · ข้อย่อยที่ควรเก็บพร้อมกัน
- Writer: `quarantine.push` เกิดก่อน throw จึงมี side effect จาก command ที่ล้มเหลว; `finalizeCycle` ซ้ำด้วย commandId ใหม่ bump version; scope-conflict scan วนทุก command (O(n)) และ `commands` โตไม่จำกัด; finalize ไม่ต้องมี projection
- Projector missing reasons (C16): ไม่มี candidate เลยก็ยังได้ `no_frame_in_tolerance`; ไม่เคยออก `unique_frame_exhausted`, `generation_mismatch`, `payload_missing`, `clock_uncertain` ทั้งที่ projector มีข้อมูลพอ (มันกรอง candidates เองอยู่แล้ว) ควรเก็บ `ineligibleReasons` ต่อ candidate และ map เป็น contributingReasons
- Projector: release window step 33 333 µs คงที่ตาม contract ✔ แต่ timeline ไม่มี `masterClockId` ของตัวเอง จึงรับ timeline ต่าง clock ได้; projection ไม่มี input candidate digest / timeline digest / config digest ตาม §2.6
- `playbackOrder` tie ใช้ time → UID ขณะที่ contract ระบุ time → source/generation/frameSeq/UID (slot ไม่มี frameSeq)
- Replay: `role` default `'side'`, `createdByVersion`/`backendVersion` default; `decodeValid:true` ได้ทั้งที่ `payloadRef=null`
- `pose.js` trace seam ไม่เปลี่ยนจากที่ Astra ประเมิน: flush ยัง drain ทั้ง queue ใน microtask เดียวไม่มี time budget, `cfg.emit` อ่านจาก object ที่ mutable ทุก flush (M07 PARTIAL ตามเดิม)
- EventTape `snapshot()` shallow copy

---

## 4. R7 lineage / HV3 regression check
- ไม่พบการ reintroduce HV3 behavior ใน production static รอบนี้ (production static changes = 0 ตาม provenance และ changed-path list ที่ hash ตรงกับ tree)
- R7 repairs ที่ตรวจทางอ้อมได้: `evidence_budget_core.canonicalUnique` เก็บ 25/25 ทั้ง null-time และ 240 fps (นี่คือเหตุที่ F02 repro แบบเก่า fail) แสดงว่า R7 fix ยังอยู่; `test_persistence_r7.js`, `test_filmstrip_r7.js`, `test_r8_lineage_merge.js` PASS
- Equipment: `test_equipment_*` PASS ทั้งหมด; ไม่พบการเปลี่ยนแปลงใน changed paths
- ข้อจำกัด: ยืนยันกับ parent bytes ไม่ได้เพราะไม่มี parent ZIP ใน pack

---

## 5. Final verdict

| Scope | Verdict | เงื่อนไข / เหตุผล |
|---|---|---|
| **1. Continued pure/offline development** | **CONDITIONAL GO** | GO สำหรับ repair/refinement ต่อใน `app/shadow/**` และ tests. เงื่อนไข: แก้ closure matrix ตาม §2 (RT-03 กลับเป็น OPEN, อื่นเป็น PARTIAL), อย่าต่อ consumer ใหม่บน boundary ที่ยังไม่ปิด (R8C-01..05) และทำ R8C-17 ให้ตัวเลขรายงานตรงความจริงก่อน review รอบหน้า |
| **2. Mac FIELD TEST BUILD (NOT PRODUCTION)** | **NO-GO จาก tree นี้** | (ก) rule-6 gates fail: distribution contract, static integrity, SHA256SUMS stale; (ข) 3 legacy tests แดง; (ค) production path ยังมี M01/F02, F03 (null→0), F04 ที่ทำให้หลักฐานภาพในสนามหายหรือเวลาผิดโดยไม่มีสัญญาณ; (ง) ไม่มี Mac runtime/camera run แม้แต่ครั้งเดียว. การเก็บวิดีโอ ground truth ด้วยกล้อง/โปรแกรมอื่นที่แยกจาก candidate นี้ทำได้และควรทำคู่ขนาน |
| Browser live shadow | NO-GO | R8C-01, 08, 09, 16 และ Chromium NOT RUN |
| Native live shadow | NO-GO | P1-07 security/concurrency/native clock ยังไม่มี |
| Live shooting | NO-GO | ไม่มี runtime/field acceptance |

ไม่มีส่วนใดของรายงานนี้ที่อ้าง Production Ready

### 5.1 Exact blockers ก่อน live shooting (ทุกข้อต้องมีหลักฐานจริง ไม่ใช่ claim)
1. Package gates เขียวตาม AGENTS rule 6 ด้วยวิธีที่ถูกต้อง: distribution contract (ตัดสินเรื่อง `DEV_NOT_RELEASE.txt` อย่างเป็นทางการ), static integrity กับ pose hash ที่ owner อนุมัติ **พร้อม** strip-reconstruction proof, SHA256SUMS ที่ตรงทุกไฟล์, legacy 103/103 โดยไม่แก้ expected hash เดิม (ต้องมี owner sign-off สำหรับ hash ใหม่ หรือ revert seam ใน field build)
2. M01/F02 ใน `temporal_evidence_core.mergeEvidence` ปิด: null-time และ 240 fps ไม่ dedup เหลือ 1/13 (characterization test เปลี่ยนเป็น regression ที่ assert 25/25)
3. F03: null master time ห้ามเป็น 0 ใน `camera_timeline_core.frameTimeMs`
4. F04/M03: writer ทุกตัวเข้า per-record queue ตาม R7 rule; stale whole-record ไม่ทับ Recovery
5. F01/M04: DOM observer loop ปิดด้วย Chromium test จริง (ไม่ใช่ source characterization)
6. Mac runtime smoke บนเครื่องจริง: launcher เดียว, กล้องจริงอย่างน้อย Side, capture FPS/latency ที่วัดได้ และไม่มี regression ของ shot authority
7. Named labeled cycles (release / let-down / band) อย่างน้อยชุดแรกที่ยืนยันโดยโค้ช แยก band ออกจาก live bow ตาม AGENTS rule 8–9
8. ถ้าจะเปิด shadow คู่ใน field: R8C-01, 04, 05, 08, 09 ต้องปิดก่อน และ shadow ต้องอยู่ origin/IndexedDB แยกตาม §2.5

### 5.2 ทำได้ทันทีโดยไม่ต้อง redesign
R8C-06 (`clonePlain`), R8C-15 (`isId` well-formed), R8C-07 ส่วน `mapTicks(null)` และ scale↔timebase check, R8C-05 ส่วน namespace prefix + `cycle()` scope, R8C-03 (validator projection ชุดเดียว + injectivity + writer cross-check), R8C-04 (bindings required), R8C-02 (identity record comparison + replay monotonic check), R8C-11 (cadence เป็น input), R8C-12 (projector-owned phase proof), R8C-13 (path policy + payload key check), R8C-14 (typed intervals + unknown fields), R8C-17 (ความถูกต้องของรายงาน), R8C-19 (ข้อย่อย). R8C-10 ทำได้ทันทีถ้า owner ยืนยันว่าจะยึด contract ไม่แก้ contract

ต้องมีการตัดสินใจเชิงนโยบายก่อน (ไม่ใช่ redesign): R8C-01 (executor contract + watchdog policy), R8C-09 (Side admission ภายใต้ pressure = drop หรือ throw), R8C-12 (Anchor อนุญาต timeline-only proof หรือไม่), R8C-10 (แก้ code หรือแก้ contract)

### 5.3 Prioritized repair list สำหรับ implementer (ลำดับตาม dependency)
1. **R8C-17** — ทำตัวเลขรายงานให้ตรง (closure matrix, F02 repro, gates, oracle naming). ไม่ต้องแตะ logic
2. **R8C-06, R8C-15** — ซ่อม primitive ใน `strict_types` / `identity_material` เพราะทุก module พึ่ง
3. **R8C-14 + R8C-03** — typed validators ชุดเดียว (Observation intervals, Candidate ที่อ้าง frameEnvelopeRef, ShotEvent, Projection แบบ per-slot + injective) แล้วให้ writer/view/archive ใช้ร่วม
4. **R8C-02** — identity record comparison ข้าม replay/ring/writer/projector + replay discontinuity
5. **R8C-07** — clock mapping semantics
6. **R8C-04, R8C-11, R8C-12, R8C-10** — projector: bindings required, cadence input, phase proof, lexicographic refinement + brute-force oracle จริง
7. **R8C-05** — event log namespace policy/scope/derived keys; จากนั้น reducer reset/watermark เป็น item แยก
8. **R8C-08, R8C-09** — ring clock domain, admission result, lease TTL
9. **R8C-01** — scheduler executor contract + watchdog + stale discard (ต้องเสร็จก่อนต่อ worker จริง)
10. **R8C-13** — archive path policy / payload keys / record schema / refs (ต้องเสร็จก่อนมี extractor)
11. **R8C-16** — แยก pure core ให้ browser โหลดได้ + Chromium negative parity ในเครื่องที่มี browser
12. Durability (IndexedDB writer/log, fencing, journal, quota, crash) — ตาม Known Limitations #3 หลังข้อ 1–9
13. **R8C-18 / §5.1** — production legacy gaps เป็น track แยก ต้องได้ owner อนุญาตแตะ production ก่อน

ข้อห้ามที่ย้ำ: ห้ามลด assertion หรือเปลี่ยน expected value เพื่อให้เขียว; probe ทั้ง 20 ตัวใน zip ควรถูกแปลงเป็น regression แบบ red→green โดยกลับขั้ว assertion ไม่ใช่ลบทิ้ง

---

## 6. Appendix — probe index

| Probe | Finding | ผลบน source ที่ review |
|---|---|---|
| C01 lone surrogate UID | R8C-15 | defect reproduced |
| C02 + proto_import_probe | R8C-06 | defect reproduced |
| C03 scale/timebase, fixture validated | R8C-07 | defect reproduced |
| C04 null ticks uncertainty | R8C-07 | defect reproduced |
| C05 inline aux blocks Side | R8C-01 | defect reproduced |
| C06 hang / stale completion | R8C-01 | defect reproduced |
| C07 observer unhandled rejection | R8C-01 | defect reproduced |
| C08 ring dedup conflict / clock mix | R8C-02, R8C-08 | defect reproduced |
| C09 leaked lease | R8C-09 | defect reproduced |
| C10 log scope leak / raw append | R8C-05 | defect reproduced |
| C11 forged + duplicate real slots | R8C-03 | defect reproduced |
| C12 generation opt-in | R8C-04 | defect reproduced |
| C13 UID conflict in projector | R8C-02 | defect reproduced |
| C14 cadence from candidates | R8C-11 | defect reproduced |
| C15 Anchor proof | R8C-12 | defect reproduced |
| C16 missing reason | R8C-19 | defect reproduced |
| C17 archive collisions/smuggling | R8C-13 | defect reproduced |
| C18 validator gaps | R8C-14, R8C-02 | defect reproduced |
| C19 replay UID reuse/order | R8C-02 | defect reproduced |
| C20 lexicographic oracle | R8C-10 | counterexample found |

รันซ้ำ: `node claude_redteam_r8.cjs <tree>/app` (ดู README ใน zip)
