# R8 Lineage Delta Review — Astra
วันที่ 1 ตุลาคม 2026 · Review-only · ไม่แก้ application code / ไม่สร้าง build

## Lineage verdict
**กลยุทธ์ lineage ถูกต้องและยังรักษาเจตนา Option 2: EL18 → R7 parent → selective HV3 merge → Phase 0/P1 rebase. แต่การ merge ยังไม่ผ่าน end-to-end semantic integrity.** เก็บ R7 transaction/negative-control repairs เป็นฐานถูกต้องกว่าใช้ HV3 ทับ R7 ทั้งชุด; ไม่จำเป็นต้อง redesign architecture ใหม่

**คำตัดสิน: CONDITIONAL GO สำหรับ continued development ของ P1-02..P1-06 แบบ pure/offline shadow เท่านั้น.** ก่อนใช้ P1-01 เป็น foundation ที่ผ่านแล้ว ต้อง harden validators/immutability และแก้ baseline/known-failure records ตามรายการด้านล่าง เริ่มเขียน repro, tests และ isolated modules ได้ทันที แต่ห้ามนำผลนี้ไปอ้าง production/live-shooting approval, เปิด live native shadow หรือเรียก F02/F04 ว่าปิดแล้วทั้งระบบ

### ขอบเขตหลักฐานที่ตรวจจริง
- อ่าน PROMPT_FOR_ASTRA, reconciliation, embedded Audit/Contract, lineage/results และ source/tests ของจุด merge, R7 persistence, HV3 native/timeline, pose trace และ P1-01
- R8 DEV ZIP SHA-256 ตรง HASHES.txt: `035d5ed7dc954e688572023d362983966caa84d69e06892ace33362303e1bc87`
- Manifest และ results ด้านนอก ZIP ตรงกับสำเนาใน candidate
- เทียบทุก path ใน `hv3_runtime_imported` กับ HV3 ZIP เดิมได้ byte-identical ทั้งหมด
- `app.js`, `core_runtime.js` และ Analyzer binaries สอง architecture ยังตรง frozen HV3 baseline; pose เปลี่ยนตาม trace seam
- Critical parent snapshots ช่วยตรวจ conflicts 4 ไฟล์ แต่ review pack ไม่มี full R7/EL18 parent ZIP จึงไม่อ้างว่า independently พิสูจน์ three-way inventory ทุกไฟล์หรือ R7-only boolean ทุกตัวครบแล้ว ตัวเลข 153/23/30/15 เป็น manifest assertions ที่ต้องเสริม per-file hashes/provenance
- รัน JS/stress เดิมซ้ำ: **100/103 PASS**. Fail 3 ตัวตรง pose hash เท่านั้นในรอบนี้. Diagnostic continuation ใน memory แทนเฉพาะ expected pose hash แล้วทั้ง 3 ผ่าน; ไม่แก้ test ต้นฉบับ
- `test_contract_foundation.js`, `test_p101_contract_clock.js`, `test_pose_narrow_thaw.js` ผ่าน. ข้อสรุปจำกัดตาม assertions ไม่ใช่ full contract/runtime equivalence
- เพิ่ม review-only probes นอก application tree: พบ edge failures ตามด้านล่าง; actual HV2 script บน Chromium isolated DOM ยัง self-trigger ถึง watchdog 100 callbacks
- ไม่รัน macOS/Windows native camera, live archer หรือ production acceptance. C++/Swift syntax outcomes ในแพ็กเป็น supplied evidence ไม่ใช่ runtime proof. Application inspection copy ไม่มี content ต่างจาก ZIP ก่อนชุด review-only probes และ probes/diagnostic continuations ไม่เขียน application files

## Critical merge findings

### M01 — HIGH: F02 แก้ใน budget core แต่ upstream ยังทำข้อมูลหาย
`app/static/evidence_budget_core.js/canonicalUnique` รักษา strict null และลบ epoch≤8ms rule จริง ทดสอบ 25 null-identity frames และ 25 unique 240 FPS frames ได้ 25 ทั้งคู่ ส่วน reserved-witness direct test ผ่าน

แต่ HV3 `temporal_evidence_core.js/canonicalFrames,mergeEvidence` ยังมี Number(null)=0 และ epoch tolerance 8 ms อยู่ และ native/browser augmentation ยังเรียกมันก่อน budget:

| Probe | Expected | R8 actual |
|---|---:|---:|
| Budget core only: 25 null identities | 25 | 25 |
| Budget core only: 25 unique @240 FPS | 25 | 25 |
| Temporal merge → budget: 25 null identities | 25 | **1** |
| Temporal merge → budget: 25 unique @240 FPS | 25 | **13** |

ดังนั้นข้อความ test “F02 fixed” และ claim “no epoch-proximity identity rule” ใช้ได้เฉพาะ budget core ไม่ใช่ capture→persist path. แก้ downstream ไม่สามารถนำภาพที่ upstream ลบไปแล้วกลับมาได้

### M02 — HIGH: Budget merge ยังไม่มี source/generation identity และ strict total ordering
Source: `evidence_budget_core.js/cameraCompare,canonicalUnique,key,fillMaxGap,selectFixedBudget`.

1. `sameMedia` ไม่ตรวจ source/generation: สอง frames คนละ source แต่ mediaTime=1 ถูกเหลือ **1** แม้ frameSeq ต่างกัน
2. `sameSeq` ตรวจเพียง source string ไม่ตรวจ generation: seq=1 จาก generation g1 และ g2 ถูกเหลือ **1**
3. `cameraCompare` เลือก media เมื่อทั้งคู่มี แต่ fallback epoch เมื่ออีกฝ่ายไม่มี ทำให้ comparator ไม่ transitive. Probe A=(epoch1000,media1), B=(epoch2000,media null), C=(epoch3000,media0.5) ได้ A<B, B<C, C<A; สลับ input order แล้วผล canonical order เปลี่ยน `[1000,2000,3000]` กับ `[3000,1000,2000]`
4. `key()` ยัง fallback เป็น epoch: 30 distinct object/blob frames ที่ epoch=5000 และ identity unknown ผ่าน canonical pool ได้ 30 แต่ selectFixedBudget เหลือ **1** เมื่อเข้า fillMaxGap. การลบ “proximity” ไม่ได้ลบการใช้เวลาเป็น identity ทุกจุด
5. sourceRank ยังให้ native-avfoundation คะแนนสูงสุด; Windows-native ไม่เท่ากัน ไม่ตรง backend-neutral intent. Number(frameSeq) ยังไม่รับประกัน U64 precision
6. Reserved witnesses เลือกด้วย epoch ไม่ใช่ identity; จึงไม่รับประกันว่าจะรักษา physical witness ถูกตัวเมื่อ epoch ซ้ำ/corrected/streams mixed. Test ที่มี unique epoch เป็นบวกที่จำกัดขอบเขต; ห้ามกล่าว witness protection สมบูรณ์ทุก input

ข้อ 1–3 มีรากใน chronology assumptions ของ HV3; ข้อ 4 เป็น semantic edge ของ reconciliation key/fill path ปัจจุบัน. ไม่ควรเหมารวมว่าทั้งหมดเป็นบั๊กที่ R8 สร้างใหม่ แต่ R8 ต้องไม่รับรองว่าปิดแล้ว

### M03 — HIGH: HV3 native writer bypasses R7 queue
`temporal_evidence_layer.js/putRecord` ของ R7 ส่งเข้า `evidenceDbMerge` จริง; R7 ยังแก้ mergeEvidenceFrames, exact release matching/recovery retry และ tests persistence ผ่าน

แต่ `native_capture_layer.js/collectBundle,putRecord` ที่ import byte-identical HV3 อ่าน record → await fetch blobs → direct IndexedDB put ทั้ง record และหา shot ด้วย session/role/epoch ±400ms. เส้นนี้ไม่ผ่าน R7 queue จึงยังเสี่ยง stale overwrite Recovery และผิด cycle ได้

การเก็บ R7-only files byte-identical ไม่ป้องกัน writer ใหม่ที่ไม่ร่วม contract. ต้องเพิ่ม integrated native+browser+Recovery interleaving test. Existing R7 persistence PASS ไม่ได้พิสูจน์ native HV3 path. ระดับหลักฐานรอบนี้คือ source-confirmed bypass และ separate queue regressions; ไม่อ้างว่าจำลองเหตุการณ์สูญ Recovery ในสนามของผู้ใช้แล้ว

### M04 — HIGH: HV2 UI ถูก import กลับมาพร้อม loop และแย่ง Anchor handler
`index.html` โหลด `evidence_integrity_repair_layer.js` ของ HV2 และ `evidence_timeline_baseline_layer.js` ของ R7 ในหน้าเดียวกัน

- HV2 observer ดู subtree ที่ renderRail ล้าง/สร้างปุ่มใหม่เอง; isolated browser probe ใช้ script R8 จริง ได้ 100 self-trigger callbacks ก่อน harness disconnect. เป็น same-source confirmed F01 ไม่ใช่ full-app timing benchmark
- HV2 `rebindAnchor` clone ปุ่มและผูก `correctedAnchorJump` ของตน จึงลบ listener เดิมและข้าม R7 `jumpReplayAnchor/settledAnchorPick`. Minimal click harness ยืนยัน old/R7-dispatch handler ไม่ถูกเรียกหลัง rebind
- R7 เลือก anchor-focus ก่อน Hold boundary เพื่อเหลือ distinct Hold witness; HV2 เลือก forward-biased Anchor/Hold และยัง fallback any forward frame. จึงมีสองความหมายของ Anchor และ interaction regression risk แม้สองไฟล์แต่ละตัวถูกเก็บครบ

ต้องเลือก owner/navigation contract เดียวและทดสอบ actual click wiring; ไม่สรุปจากฟังก์ชัน R7 ยังอยู่ในไฟล์. Pure shadow review ห้าม reuse renderer นี้; live candidate evaluation ยัง blocked โดย F01/handler conflict

### M05 — MEDIUM: Cache/preflight/authority metadata ไม่สอดคล้อง candidate
- Budget key เปลี่ยนเป็น `r8merge1` ถูกต้อง; R7 modules ที่ byte-identical คง key เดิมได้; HV3 imports ใช้ hv1/hv2/hv3 keys ตาม lineage ได้
- **pose.js เปลี่ยนแล้วแต่ index ยัง `pose.js?v=x281lg`**. Root `?build=...&launch=...` ไม่ได้เปลี่ยน URL ของ subresource โดยตัวมันเอง จึงเป็น stale-cache risk หาก origin/cache headers เอื้อ ไม่ใช่หลักฐานว่าเกิด stale delivery แล้ว ต้องตรวจ served bytes/digest และ bump pose-specific key ก่อน browser evaluation
- `start_analyzer.sh` ตรวจ R7 adaptive v16 + HV3 marker แต่เป็น marker preflight ไม่ใช่ validation ของ script order/writer ownership/served asset hashes
- `AGENTS` ยังเขียน pose frozen; Decision Log D-006/D-007 บันทึก owner-approved narrow thaw. ให้ record exception พร้อม exact hashes/scope แทน blanket rebaseline. Pack เป็นหลักฐานการบันทึก approval ไม่ใช่อนุญาตเพิ่ม scope
- `ARCHITECTURE_AUTHORITY.md` และ D-002 ยังบอก HV3 baseline/rollback; ต้องเปลี่ยนให้แยก immutable original HV3 audit, R7-parent R8 dev candidate และ rollback artifact ชัดเจน
- Manifest class `all_same` รวม pose ได้ถ้าหมายถึงสาม parent ก่อน rebase แต่ไม่มี candidate hash overlay จึงตีความว่า candidate unchanged ได้ผิด ต้องระบุ parent classification กับ rebase result คนละ field
- New shadow CommonJS `require('crypto')/Buffer` ยัง Node-only entrypoints; ไม่มี shadow imports ใน production index ซึ่งดีต่อ isolation แต่ยังไม่พิสูจน์ browser-worker portability. ก่อน P1-02 browser adapter ให้มี platform-neutral facade กับ same golden vectors ไม่ copy identity algorithm อีกชุดเอง

### M06 — HIGH for dependent shadow work: P1-01 validators ยังไม่บังคับ contract ครบ
Review probes ของ modules จริงยืนยัน:
- U64 รับ `18446744073709551616` (เกิน 2^64−1); I64 รับ `9223372036854775808`; รับ `-0` ทำ integer canonical representation กำกวม
- FrameEnvelope รับ sourcePTS=null, mappingStatus=validated, mappedMasterTime=0, mappingId known และ uncertainty=null. ทำให้ “unknown source” ถูกแสดงเป็น mapped validated โดยไม่มี source basis. ต้อง reject inconsistent combinations; อย่าเติม arrival เป็น source workaround
- validateFrameEnvelope freeze แค่ top-level; แก้ `validated.quality.decodeValid` หลัง validate ได้ และ nested refs ยัง alias input. ไม่ผ่าน immutable published-envelope invariant
- ClockMapping validator ไม่มี calibration method/sample refs/residual/transport provenance ตาม Contract 2.2; `mapTicks(mapping,ticks)` ไม่รับ envelope clock/generation จึงยังต้องมี checked binding layer ก่อน consumer. อย่าใช้ numeric mapping success เป็น proof ว่าตรง clock
- required common `createdByVersion` ไม่ถูก enforce ใน FrameEnvelope validator; unknown extensions/backend-other naming, nested flags types และรายละเอียดอื่นยังไม่ครบ contract coverage

แก้ pure contract modules/tests ได้ใน Phase 1 ตาม scope ไม่ต้อง backend source หรือ production patch. ให้เป็น dependency blocker ก่อนรับ real adapter output/สร้าง durable shadow records บน foundation นี้ ไม่จำเป็นต้องหยุดเขียน fixture/repro/scaffolding อื่น

### M07 — MEDIUM: Trace seam test พิสูจน์ diff scope ไม่เท่ากับ enabled equivalence
Narrow-thaw test reconstruct baseline hash ได้จริง, default-off, callbacks หลัง detectForVideo และ exceptions ถูก catch. แต่ enabled trace emit เกิด **ก่อน computeMetrics ซึ่งใช้ Date.now()** จึงมี observer-effect ต่อ metric epoch ได้; hook cost ยังรวมใน perf.cost. exposeResultRef เปิดทางแก้ landmarks ก่อน engine ใช้; exposeMetricsRef เปิดทางแก้ metrics ก่อน onPoseMetrics. Try/catch ไม่ป้องกัน object mutation หรือ delay

คำว่า equivalence ควรจำกัดเป็น “source reconstruction + isolated helper tests”. Live enabled invariance ต้องวัดและใช้ immutable snapshots/bounded enqueue; direct HTMLVideoElement ถูกระบุ blocked-live-direct-video อย่างซื่อสัตย์อยู่แล้ว. Canvas same input object sync-read ก็ยังไม่ใช่ durable raster archive โดยอัตโนมัติ ห้าม advance live matched-frame certification จาก test นี้

## F01–F12 delta table

สถานะหมายถึง finding ทั้งเรื่อง ไม่ใช่เฉพาะหนึ่งฟังก์ชัน. ไม่มีข้อใดมีหลักฐานพอให้ปิดทั้ง finding ว่า fixed in candidate ในรอบนี้

| Finding | Status | เหตุผลจาก R8 |
|---|---|---|
| F01 DOM loop | **still valid** | HV2 source unchanged, active script wiring, Chromium probe100callbacks |
| F02 null/high-FPS dedup | **partially mitigated** | Budget direct25/25 ผ่าน; temporal→budget ยัง 1/13; crosssource/generation/key edges ยังเสีย |
| F03 clocks | **partially mitigated** | P1-01 utilities+trace เพิ่ม observability; productioncomputeMetrics ยัง processingepoch; timeline null master ยัง 0; validation gaps |
| F04 multiple writers | **partially mitigated** | R7 browser merge queue/recovery repairs มี tests; HV3 native directput ยัง bypass |
| F05 logical slots | **partially mitigated** | R7 witnesses และ persisted25filmstrip ดีขึ้น แต่ slots ยัง frames[i]+tailMissing ไม่ใช่ phase-targetprojection |
| F06 evidence resolution | **still valid** | Swift480/640JPEG/time ring import unchanged;ไม่ใช่ fullresoriginal |
| F07 auxiliary compute | **still valid** | pose loop ยัง serial detectForVideo บน sharedthread;trace ไม่ใช่ schedulerrefactor |
| F08 Windows runtime | **still valid** | native start ยัง E_NOTIMPL;sentinel ไม่ใช่ captureimplementation |
| F09 mixed routing | **still valid** | browser release ยังเรียกตาม Sidebackend;Side-native+aux-browser ไม่ถูกแก้โดย merge |
| F10 archive provenance | **still valid** | frozenapp export/import ยังเก็บ epoch/offset/blob ไม่ครบ sourceclock/seq/tags |
| F11 bridge boundary/concurrency | **still valid** | Swift unchanged;explicitloopback/auth/origin/managerownership ยังไม่ปิด;ไม่กล่าวว่ามี actualleak |
| F12 matched-frame shadow | **still valid** | latest/near-timecomparison เดิมยังอยู่;trace เพิ่ม token แต่ไม่ทำ native/browser เป็น samesample |

## QA และ claims ที่ต้องลดระดับ

1. **100/103 + 3 expected hash failures ยืนยันได้** และ diagnostic continuation ผ่านทั้งสาม. เป็น intentional validation-policy mismatch ตาม narrow-thaw ที่ pack บันทึก ไม่ใช่หลักฐาน behavioral regression ของ classifier ใน 3tests นี้ แต่ไม่ใช่ 103unmodifiedPASS
2. “all_non_hash_behavior_gates_pass=true” ต้องอ่านว่าเฉพาะ assertions ใน submittedsuite; review probes เพิ่มพบ failures ชัดเจน. เปลี่ยนคำรายงานให้ scoped และเพิ่ม tests ก่อนอ้าง closure
3. Test runtime truth เพิ่ม markers และเปลี่ยน buildtag เป็นการตาม metadata ที่สมเหตุผล ไม่เห็นการลบ behavioralassertions ใน criticaltestdiff;แต่ไม่ตรวจ nativewriterqueue,Anchorlistener หรือ posecachekey
4. Pose reconstruction pass ไม่พิสูจน์ enabledhook ไม่มี observereffect;P008 ที่ระบุ NOT RUN ยังถูกต้องและต้องคงไว้
5. 683-recordequipmenttests ผ่านไม่ได้ validatecatalogtechnicalcompleteness;ไม่อยู่ scope ให้ rewrite
6. Distributionmanifest/oldhashgates ยังไม่ promote ตาม pack ยอมรับ;ไม่เปลี่ยน hashgate ให้เขียวใน review และไม่ใช้ devZIP เป็น releasepackage
7. Three-waymanifest เป็น inventory ไม่ใช่ attestation ที่สมบูรณ์: เพิ่ม parentZIP hashes ที่อ่านได้จริง+perfileparent/candidatehash+mergeclassification+resolutionreason+rebaseoverlay;fullR7parent ยังต้องตรวจเพื่อยืนยัน R7-onlypreservation ทั้งหมด

## Contract amendments — แก้เฉพาะข้อที่เกี่ยวข้อง ไม่ redesign

| Clause / work step | Amendment ที่ต้องทำ |
|---|---|
| Source of Truth / P0-00 | เพิ่ม R8 developmentcandidatehash กับ parentchainEL18/R7/HV3. AuditHV3 เดิมเป็น historicalevidence ห้ามเขียนทับ. ไม่เรียก R8productionbaseline |
| Authority / rollback / D-002 | กำหนด R7-parentproductionpolicy ใน candidate กับ pure-shadowauthority แยก;เก็บ originalparent/approvedtapartifact สำหรับ rollback ระบุว่า R7 ยังมี knownfieldlimitations ไม่ใช้คำ safe โดยไม่มีหลักฐาน |
| P0-01/P0-03, T-F01/F02/F03 | เก็บ originalHV3repro;เพิ่ม R8results:budgetnull/highFPSgreen แต่ upstreamred,UIloopred,clocknullred. ห้ามทำ expected-failureassertion ของ HV3 มาใช้กับ R8 แล้วซ่อนความต่าง |
| P0-04 / T-F04 / Ownership Matrix | ยอมรับ R7browserqueue/recoverywork ที่มีแล้ว;เพิ่ม native+browser+Recoverycross-writerrepro. ห้ามเขียนว่า allwritersjoinqueue เพียงเห็น R7testPASS |
| P0-06 / §4.4 / checklist06 | เปลี่ยนจาก“รออนุญาต pose ทั้งหมด”เป็น“pack บันทึก approvednarrowthaw ตาม D006–008”;pinold/newhashes+diffscope. การขยาย tap/immutabletee ยังต้อง scopeapproval ที่เกี่ยวข้อง ไม่อนุญาตเปลี่ยน algorithm |
| P0-08 | เพิ่ม enabled-hooklatency/mutationcounterexamples และ actualservedposehash;reconstructiontest ไม่แทน runtimegate |
| §2.1–2.2 / INV001–008 / P1-01 / D01–02 | enforceI64/U64range,canonical−0policy,deepimmutable/defensivecopy,source/mapping/statuscrossfieldrules,checkedclockgenerationbinding,calibrationprovenance,commonfields |
| §2.5 / INV013–014 / P1-05 | คง singlewritercontract;R7queue เป็น legacycompatibilitylayer ไม่ใช่ implementation ใหม่ที่เสร็จแล้ว;addnativewriterbypassnegativecase |
| §2.6 / P1-05 / D05 | witnessidentity ต้อง UID ไม่ใช่ epoch;comparator ต้อง totalorder ที่ไม่ crossdomains;pool/selection ห้าม epochfallbackdedup;logical25plan เดิมคงไว้ |
| INV026–027 / P1-06 / D06 | เพิ่ม actualAnchorbuttonlistenerintegrationtest และ oneownerpolicy;pureReviewUI ไม่ reuseHV2observerloop |
| P1-02 / §5.4 / D08–09 | sharedcontractbrowser/native/replaygoldens;Nodecryptoimplementation ต้องมี browserportableentrypoint ก่อน workeruse;exactraster และ crossstreamdistinction คงเดิม |
| §5.6 / §6 gates | เพิ่ม reviewregressions เป็น promotiongates;สถานะ 3posehashfailures ต้องแยก expectedpolicyfailure จาก newbehaviorfailure;native/live/field ยัง NOT RUN |

## GO / CONDITIONAL GO / NO-GO และ exact next actions

| งาน | Verdict | เงื่อนไข |
|---|---|---|
| เพิ่ม repros,fixtures,contractamendment,manifest/known-failurereport | **GO** | isolateddev/reviewoutputs;ไม่แก้ production เพียงเพื่อให้ reportgreen |
| P1-02 replayadapter และ P1-03..06 pure/offlineshadow | **CONDITIONAL GO** | hardenP1-01 ก่อนใช้เป็น acceptedboundary; namespace และ productiondenialtests ต้องอยู่ตั้งแต่แรก;ใช้ fullcandidatepool ไม่ป้อนผ่าน legacydedup แล้วอ้าง rawtruth |
| browseradapter/liveexact-frameA/B | **NO-GO ตอนนี้** | ต้องแก้ servedassetidentity/traceisolation/exactsampletee+runtimeobservereffect ตาม scope ก่อน |
| native live shadow / production rollout / live shooting | **NO-GO** | F01/M03/M04,F11,runtime/fieldgates และ Windowscapability ยังไม่ครบ |

ลำดับ implementer:
1. Freeze R8 ZIP เป็น reviewed development artifact;เพิ่ม report นี้และ reviewprobes/results เป็น evidence ไม่ rename เป็น release
2. Amend authority/parentmanifest/poseexception/knownfailures ก่อนอ้าง closure;ตรวจ fullR7parenthashes เมื่อมี artifact ไม่รื้อ R7repairs กลับเป็น HV3
3. เพิ่ม failingtests ของ M01/M02/M04/M06/M07. M03 ต้อง integratednative/browse/Recoveryschedule ไม่หยุดที่ source-stringtest
4. Hardening pure P1-01: boundedinteger+canonicalidentity,deepimmutability,crossfieldclockconstraints และ mappingprovenance; goldenvectors ต้องเหมือนกันใน Node/browser และ OSadapters
5. ทำ P1-02replay บน immutablecommoninput มี FrameUID/derivation/clockbinding จริง ไม่ใช้ pose-token แทน physicalFrameUID
6. ทำ P1-03independentrings/queues;P1-04singledecisionowner/eventlog ใน shadow;P1-05singlewriter+logical25pool;P1-06pureUI/archive โดยคง Equipment/Athlete/Session
7. ใช้ R7/R8legacy path เป็น comparison ที่มี knownlimitations ไม่เรียก legacyoutputgroundtruth. Replaycontract แก้ source-time ได้ใน shadow เท่านั้นและ versionpolicy ชัด
8. ก่อน browser/liveintegration ให้แก้ cachekey/handlerownership/nativewriterjoin และ securehelper ในงานที่ได้รับอนุญาตแยก ไม่แอบเพิ่ม productionpatch ใน pure-shadow งาน
9. ส่ง dossier ใหม่แยก unmodifiedtests,hash-onlydiagnostics,newreviewregressions,platform/runtime/fieldcoverage. Promote ตาม stageapproval เท่านั้น
10. Rollbackpure-shadow ด้วย disable/unload+keepread-onlynamespace;rollbacktap ด้วย approvedbase/hash และ run ใหม่;เก็บ originalparentZIPs และ traces ไม่ลบ sessiondata เพื่อให้การทดสอบผ่าน

**ผล review นี้ยืนยันว่าเลือก lineage ถูกทิศทาง แต่ยังต้องแก้ช่องว่างของการเชื่อมระบบและ contract foundation ก่อนเชื่อผล end-to-end. ไม่ได้อนุมัติ R8 สำหรับ production หรือการยิงจริง.**
