# R8 P1-06 — Independent Delta / Red-team Review
วันที่ 1 ตุลาคม 2026 · Review only · ไม่มี application patch หรือ release build

## 1. Lineage verification

**ยืนยันแนวทาง R7 parent + selective HV3 merge และยังไม่พบเหตุให้เลิก Option 2.** ปัญหาที่พบเป็น implementation/contract gaps ไม่ใช่หลักฐานว่าสถาปัตยกรรมที่เลือกผิด

ตรวจ actual parent ZIPs ครบทั้งสามครั้งนี้:

| Artifact | SHA-256 verified |
|---|---|
| EL18 | `4ff83455870a0fc6072b926e432ae88d078b4b9984c30e1d7ae897cfe3302d59` |
| R7 | `c329e98a3d92640b6cfbca37fba47781c4653ce5b24c1dec716069219f10c34c` |
| HV3 | `1bc31b86216222c5691b3d7bd1e649d1294595b17e67260ec72e9ff15082ffcd` |
| Candidate | `a9c07505b1b37770d1fab82e4ad103d6ddef42231154aadd96afb63a0676f690` |

Independent classification ตรง counts เดิม: all-same153, R7-only23, HV3-only30, conflicts15. R7-only production static files ทั้ง 6 ไฟล์ยัง byte-identical: adaptive_release_core, capture_integrity_layer, coach_keyframe25_backfill_layer, evidence_timeline_baseline_layer, foundation_guard_layer, temporal_evidence_layer. HV3-only runtime/native imports คงเดิม; HV3-only tests2 ไฟล์ต่างเฉพาะข้อความ preflight ให้ตรง R8 (`static_integrity_x282.py`, `test_mac_preflight_r5.js`) ไม่ใช่การลบ behavior assertions. Parent all-same ที่เปลี่ยนใน candidate คือ pose.js ตาม trace seam. Missing candidate2paths เป็น QA เก่า `docs/qa/r6_distribution_checks.json`, `docs/qa/r6_results.json` ไม่ใช่ runtime

**แต่ provenance manifest ยังไม่ตรง final artifact:** candidate hashes ของ 7 ไฟล์ไม่ตรงที่ประกาศ: `AGENTS.md`, `PROJECT_STATE.md`, `docs/HANDOFF_NEXT_CHAT.md`, `docs/QA_CURRENT.md`, `docs/architecture/ARCHITECTURE_AUTHORITY.md`, `docs/architecture/DECISION_LOG.md`, `docs/phase01/PHASE0_PLAN.md`. Parent hashes ถูกต้อง;ความคลาดเคลื่อนอยู่เอกสาร candidate. ต้อง generate manifest หลังแก้เอกสารจบ แล้ว verify จาก final ZIP อีกรอบ พร้อมกติกา exclude self-referential manifest ให้ชัด ไม่ใช่หลักฐานว่า R7runtime สูญหาย แต่ยังใช้ manifest นี้เป็น finalattestation ไม่ได้

### Independent execution
- Legacy JS/stress **100/103 PASS**;อีก 3 หยุดที่ oldposehash ตรงรายงาน
- Pure Phase0/P1 tests **8/8 PASS** → รวม **108/111 PASS** ในรอบนี้
- In-memory diagnostic continuation เปลี่ยนเฉพาะ expectedposehash: **3/3 PASS**;ไม่แก้ test ต้นฉบับ
- Actual Chromium isolated WebCrypto positive UID ตรง Node;negative validation ไม่ตรงตามส่วน 2
- Review-only probes พบ defects ตามส่วน 4; matching brute-force oracle3360 ชุดเล็กไม่พบ cardinality/absolute-costcounterexample ในชุดนั้น แต่พบ input-order tie violation ด้วย probe แยก จึงห้ามสรุป matching ครบ contract
- NativeSDK/camera/realarcher ไม่ได้ทดสอบ. SuppliedC++/Swiftparse/preflight ไม่ใช้แทน runtimeacceptance. ไม่มี accuracyclaim

## 2. P1-01 verdict — M06 ยังปิดได้เพียงบางส่วน

**ดีขึ้นจริง:** `strict_types.js` บังคับ U64/I64bounds และปฏิเสธ-0; `contract_v1.js` บังคับ createdByVersion, unknownsource→unmapped, validated→knownuncertainty, defensiveplaincopy และ deepfreeze; `clock_mapper.js` เพิ่ม calibrationfields และ run/master/clock/generationbinding. Tests ที่เคยชี้ช่องโหว่ของ FrameEnvelope ในรอบก่อนมีการแก้จริง ไม่ใช่เปลี่ยน expectedoutput อย่างเดียว

**ยังไม่ปิดทั้ง boundary:**

1. **Node/browser input validation ไม่เท่ากัน.** Node identity ใช้ strict validator แต่ `identity_material.js/tuple` ทำ `.map(String)` และ browserentry ไม่ validate. ProbeframeSeq=`18446744073709551616`: Node reject, browser/WebCrypto accept และออก UID. ยืนยันทั้ง Nodewebcrypto และ Chromium จริงใน isolatedpage. Positive golden vector เท่ากันไม่ได้พิสูจน์ negativeparity. ต้องแชร์ validation ก่อน encoding ทั้งสอง entry;undefined/null/boolean/overflow/−0/emptyID ต้อง reject เหมือนกัน
2. **Mapping provenance ครบชื่อ field แต่ยังไม่ validatedsemantics ครบ.** Calibration sample IDs ว่างได้,method เป็น arbitrarystring;ไม่มี validation ว่า bound สอดคล้องกับ residual/transport หรือ validityinterval เพียงพอภายใต้ method นั้น. ต้อง method-specificcontract สำหรับ trustedAPI conversion กับ sample-basedcalibration ไม่บังคับว่าทุก API จำเป็นต้องมี sample เหมือนกัน และไม่เรียก non-nullbound ว่าเป็น uncertainty ที่พิสูจน์แล้ว
3. `mapBoundSourceTime` ตรวจ 4identityfields ดีขึ้น แต่ mapping ไม่ได้ bindsourceTimebase/timestampKind โดยชัดแจ้ง. เปลี่ยนหน่วย tick ภายใต้ clockId เดียวกันจะให้ตัวเลขผ่านได้ถ้า upstream ไม่รับประกัน;เพิ่ม mappinginputunit/clockdefinition และ discontinuitytest
4. Deep immutable boundary ของ FrameEnvelope ไม่ได้ถูกใช้ต่อเนื่องใน writer/eventlog/projector/archive;modulesthoseacceptplainpartialobjects เอง. จึงปิด M06 เฉพาะบาง corevalidators ไม่ได้เท่ากับ immutablepipeline
5. Wire/schema ยังต้องปฏิเสธ unknownfields นอก extensions และตรวจ nestedschemas ตาม Contract;อย่าใช้ JSONdigest เป็น schema validation

**Verdict:** repaired integer/deep-copy/source-null vectors PASS; **full P1-01 boundary closure = PARTIAL** จน negativeNode/browserparity และ mappingsemanticcontract ผ่าน

## 3. Trace-seam verdict — M07 mitigated สำหรับ offline แต่ยังไม่ใช่ live proof

Source ปัจจุบันเลิกส่ง input/result/metricsRef แล้ว เก็บ scalarcopies และ immutablepayloads. emit เลื่อนไป microtask หลัง productionprocessing;boundedqueue128entries. Strip-onlyreconstructiontest ผ่านและสาม hash-sentinelcontinuations ผ่าน จึงลด mutationrisk เดิมและเหมาะให้ทำ offline/common-inputmeasurement ต่อ

ข้อจำกัดที่ยังต้องระบุ:
- Synchronous trace preparation/summarycopy ยังมีต้นทุนก่อน/ระหว่าง processing;callback ไม่แทรกก่อน computeMetrics แล้วแต่เวลารอบต่อไปยังเปลี่ยนได้
- Microtask ยังอยู่ thread เดียวกับ browser. flush ใช้ while drain ทั้ง queue,ไม่มี wall-timebudget ต่อ flush;callback ช้าอาจ blockSide รอบต่อไป. Entrycountbound ไม่ใช่ latencybound
- ไม่มี reference leak ใหม่จาก emittedpayload ที่อ่าน แต่ globalcfg ยัง mutable และ callback สามารถทำ arbitrarywork ได้;ต้อง freezeconfig/capturecallbackidentity ตาม policy และ enforceboundedconsumeroffcriticalthread ก่อน live
- ไม่ส่ง pixels หรือ FrameUID ของ acquisitionsample ใน trace. Canvas sync-read label ไม่ใช่หลักฐานว่าผู้รับได้ immutableimage ชุดเดียวกัน;directvideo ยัง blocked ตามที่ source ประกาศ
- Offlinecommon-inputfixture ต้องมาจาก replaypayload ที่ hash/identity/provenance ตรวจได้ ไม่ใช้ pose-token แทน FrameUID

**Verdict:** CONDITIONAL GO สำหรับ offline trace/replay work; enabledliveequivalence/observer-effect ยัง NOT RUN. ไม่ต้องรื้อ architecture หรือแก้ production ใน review นี้

## 4. P1-02..P1-06 red-team findings

### RT-01 — HIGH — Replay เติมข้อมูลที่ไม่ทราบและซ่อน invalidinput
Source `app/shadow/adapters/replay/replay_adapter.js/envelope`:
- explicit mirror=null กลายเป็น false
- width=0,height=0 กลายเป็น 1920×1080 แทน reject
- ไม่มี arrivalmetadata แล้วสร้าง arrival ticks จาก frameSeq (`"1"`ใน probe), sourceclock เป็น replay-arrival;ไม่มี explicitsyntheticarrivalsemantics
- defaultdecodeValid=true ทั้งที่ไม่มี payloadverification;frameSeq ถูก String()ก่อน validator ทำให้ typedinput ผิดแบบบางชนิดถูกยอมรับ

Fixturedefaults ทำได้เฉพาะเมื่อ declared อย่างชัดใน fixtureprofile แต่ห้ามเรียก provenance-preservingadapter เมื่อ inputunknown ถูกแทน known เงียบ ๆ. ให้ requiredimensions/identity, preservemirrorunknown, สร้าง virtualarrival ผ่าน virtualclock และ marksynthetic, validatepayloadrefs/digests;duplicatedUID แต่ differentpayload ต้อง conflict ก่อน consumer

### RT-02 — HIGH — RoleRing byte limit ไม่เป็น hard bound และ lease retention ไม่ครบ
Source `ring/role_ring.js/_evict,lease`.

ProbebyteBudget=10,frame แรก 10bytes และ lease ค้าง จากนั้น add20frames×10bytes: **totalBytes=210**,count21. เมื่อ releaselease แล้ว **ยัง 210** จนมี operation อื่น trigger eviction. `_evict`หยุดทันทีเมื่อ oldestpinned จึงไม่ลอง evictunpinned อื่นและไม่ rejectadmission

ต้อง boundedleasebudget/TTL หรือ explicitrejectnew/dropwithreason,evicteligibleunpinnedrows,triggercleanup เมื่อ release และ timer/clockadvance. Bufferwithoutnewframes ยังต้อง expire;out-of-orderbooktime/masterclock/generationmix ต้อง validate. ปัจจุบัน add คืน mutableinternalrow และเก็บ frameinput โดยตรง จึงยังไม่เป็น immutableownershipboundary. `byteLength=0`default ทำให้ memoryaccounting ขาดได้หาก payload จริงแต่ caller ไม่บอกขนาด

### RT-03 — HIGH before threaded integration — Scheduler แยกคิว แต่ไม่แยก compute
Source `scheduler/priority_scheduler.js`.

Asynclane+drop-old+auxround-robin มี foundation จริง แต่ job.run รัน Promise microtask บน thread เดียวทั้งหมด. Probeaux ทำ synchronouswork20ms และ Side เข้าคิวต่อ: order=`aux-start,aux-end,side`. จึงไม่มี Sidepreemption/computeisolation จากโค้ดนี้

ใช้ได้เป็น logicaldispatchcontroller เมื่อ job.run เป็น nonblockingworker-dispatchstub ที่ contract บังคับไว้;ต้องใส่ assertion/workerboundary และ testauxhang/drop-old/fairness/cancelgeneration. ตอนนี้ไม่มี generationcancellation,erroroutcome/leasecleanupcallback และ swallowjoberrors;aux ที่ never-resolves ทำให้ aux อีก role รอถาวรแม้ Sideasyncqueue ยังเดินได้. P1-03 จึง partialfoundation ไม่ใช่ INV019/runtimeproof

### RT-04 — HIGH — Decision/log ยังรับ state proposal และ digest โดยเชื่อ caller
Source `decision/shot_cycle_reducer.js`, `event_log/in_memory_event_log.js`.

Reducer เป็น transitionhelper รับ confirmed/rejected/uncertain ตาม proposal ไม่ได้ประเมิน Observation หรือ legacyalgorithm. ไม่มี run/master/sourceintervalschemas ครบ,role/namespace ยังไม่ restricted,ไม่มี Sidegenerationreset/200msreorderwatermark. อย่าเรียกว่ามี releaseclassifier/singledecisionservice ครบแล้ว

Logkey เป็น cycleId อย่างเดียวและ idempotencyglobal;ไม่ตรวจ namespace/runbinding หรือ previousEventDigestchain,ไม่ recomputeeventDigest. Probeappendconfirmed แล้ว retrykey/digest เดิมแต่ eventType=rejected →คืน existing โดยไม่ rejectpayloadconflict. StoredsupportingObservationIds แก้ผ่าน array เดิมได้หลัง append. Reducerfreezenestedinput บางส่วนยังไม่ defensivecopy;terminalretryignoreproposal ไม่แทน logvalidation

ต้อง validatedimmutableevents,canonicaldigestcomputedatboundary,scope-qualifiedkeys+sequence/digestchain+singleownerwiring. In-memorylog ยังไม่มี durability/crashrecovery;คำว่า committed ต้องระบุ memory-only

### RT-05 — HIGH — Writer command scope และ immutable snapshot ยังผิด
Source `evidence_writer/in_memory_writer.js`.

- SamecommandId+operation+payloaddigest แต่เปลี่ยน cycleId →คืน `status=committed`ของ cycle เดิม ทั้งที่ cycle ใหม่ไม่มี record. Namespace/run/role/targetidentity ไม่ได้อยู่ใน idempotencycomparison
- Candidate nestedobject ถูกแก้หลัง execute จาก inputreference ได้: probe บันทึก nested.x=1 แล้วแก้ input เป็น 99;storedsnapshot กลายเป็น 99 โดย version/digest ไม่เปลี่ยน
- key ใช้ rawstringjoin`|`ทั้งที่ IDcontract ไม่ห้าม delimiter จึงควรใช้ canonicaltuple หรือ length-prefix
- ไม่ validatecandidate→commandrun/cycle/role/clock/bloblineage;phaseclaims/projection ก็ shallowfreeze. `finalized`ยังไม่ defineallowedlatecommands;record/map เปิด public

Versionconflict และ samecandidateId/differentdigestchecks มีแล้ว แต่ต้อง deepcopy+scopevalidation ก่อน memoization และ replayconflict ของ fullcommandtarget. นี่เป็น in-memorysimulation ไม่ใช่ singlepersistentwriter: IndexedDBtransactions,locks/fencing,journal,quota/crashgates ยังไม่สร้าง ห้ามใช้ foundationPASS แทน D04/D24

### RT-06 — HIGH — Logical25 ยังรับ real slot ที่ไม่มีหลักฐานครบ
Source `projector/logical25.js`.

Probes ยืนยัน:
- candidate ไม่มี blob/payloadRef/digest/frame-envelopeprovenance → `uniqueRealCount=1`
- candidate ระบุ wrongrun/wrongmasterclock/oldgeneration →ยังได้ real1 เพราะ filter เพียง role
- mappingUncertainty=-100 →ยัง eligible (ตรวจ safeinteger และ≤50000 แต่ไม่ตรวจ≥0)
- validderivation ขนาดเล็กกับ invaliddecode ขนาดใหญ่ UID เดียวกัน →เลือก invalid ก่อน eligibility แล้วสูญ validframe เหลือ real0
- candidatesA ที่ target−1 และ B ที่ target+1:input `[A,B]`เลือก S15=A,reverse เลือก S15=B. Tie-break ใช้อันดับ input ไม่ใช่ lexicalUID จึงผิด deterministicprojectioncontract

ยังมี source-confirmedgaps:
- cadence คำนวณจาก pool รวมต่าง source/generation ได้;ใช้ maxuncertainty ของทุก frame เป็น tolerance ร่วม ดังนั้น badunrelatedcandidate สามารถขยาย threshold ของ goodcandidate ได้ ต้อง per-edge/per-sourcecadence+uncertainty
- ไม่มี activeRoleSnapshot/bindinginterval,source-unobservable/payloadmissing/unique-frame-exhaustedreasonmapping ครบ,masterClockId/per-slotprojectionversion/inputdigests/lineagefields ยังไม่ครบ. inactivebranch ไม่เติม run/cycle/role ใน slot เช่น activebranch
- `match`ใช้ residualnegativecostedges กับ shortestpathroutine ที่ไม่ระบุ negativeedge-safeproof. Rank ยังไม่ lexical และ sumrank ไม่ใช่ lexicographicassignment;costweight อาจไม่รับประกัน priority ของ totaldelta เหนือ secondaryrank สำหรับหลาย slots
- Independentbrute-force3360 กรณี 3frames/3anchors ไม่พบ maximum-cardinality/absolute-costerror ในชุดนั้น จึงไม่อ้างว่าพิสูจน์ optimalitybug แล้ว แต่ต้องขยาย oracle และใช้ algorithm ที่พิสูจน์ lexicographicobjective ตาม contract ได้

ต้อง strictEvidenceCandidatevalidator+trustedblob/frameledger+run/clock/generationbinding ก่อน matching แล้วแยก eligibility ออกจาก bestderivationselection. การยอมรับ record ที่ไม่มี payload เป็น real ไม่ได้พิสูจน์ว่ามีภาพปลอมถูกใช้ในสนาม แต่แปลว่า INV016 ยังไม่ถูก enforce

### RT-07 — MEDIUM — Review Anchor เชื่อ slotnumber แทน phaseproof
Source `review/view_model.js`. ไม่มี DOMobserver จึงไม่ inheritF01 โดยตรง และปกติเลือก S03–S05 ตาม plan แต่ buildReviewView ตรวจเพียง slots.length25. ProbeS03 ที่ phase=draw,status=real → anchorTarget คืน draw-frame เป็น realAnchor

ต้อง validateprojection/schema/planversion/phaseproofofselectedslot ก่อนสร้าง view. slotid เพียงอย่างเดียวไม่เป็น physicalproof. Inactive ถูก label ว่า Missing ด้วยแม้ counts แยก;แก้ semantics ก่อน actualUI. playbackOrder ต้อง rejectunknownclock/invalidtimes และใช้ contracttie-order. Pureviewmodeltest ไม่ใช่ DOMrender/actualbuttonacceptance

### RT-08 — HIGH before importer/filesystem use — Archive มี checksum แต่ไม่มีกลไกตรวจ provenancegraph ครบ
Source `archive/shadow_archive.js`.

Checksum/bytecorruptionchecks มีและ roundTrip รักษา JSON ตามที่รับได้ แต่ `records` เป็น arbitraryobject ไม่บังคับ run/frame/mapping/transform/slotrefs. ProbeframepayloadRef=missing,files={} ยัง validate=true. Baseline digest ที่ไม่ใช่ hash ก็สร้าง archive ได้

Builder กรอง path บางแบบ แต่ `validateArchive`ไม่กรอง path ซ้ำ: สร้าง manifest ที่ digest ถูกต้องและ path=`../escape` →accepted. ยังไม่มี filesystemextractor จึงไม่ใช่ proof ว่ามี filewrite นอกโฟลเดอร์แล้ว แต่เป็น importboundarydefect ที่ต้องปิดก่อนต่อ extractor. ต้อง validatepath ทั้ง build/import รวม Windowsdrive/backslash,duplicatepaths,unknownschemas,maxentries/bytes,base64strictness และ referentialintegrity. ไม่ใช้ hash เป็น authentication/trust

Archive กลับคืนเป็น JSONobject ไม่ใช่ transactionalimport เข้าสู่ newnamespace,duplicate-importidempotency/quarantine/legacyreader ยังไม่มี. Manifestnestedrecords ยัง aliasmutableinput;deepimmutablecopy และ schema-validation จำเป็น. Formatv1foundation จึงไม่ผ่าน archivecontract ทั้งหมด

## 5. Contract gap table

สถานะ Implemented หมายถึงส่วนที่ระบุผ่านหลักฐานใน scope เท่านั้น ไม่ใช่ releaseacceptance

| Contract / Invariants | Status | ขอบเขตและช่องว่าง |
|---|---|---|
| §2.1 boundedints, INV001 | Implemented in Node validators / Partial overall | browseridentity ไม่ rejectinvalid;replay ยัง coerce/default |
| §2.2 immutableFrameEnvelope | Implemented for validated frame objects | ไม่ครอบ writer/log/archive/projectorinput |
| INV002–004 identity/generation | Partial | positivegoldens และ newgenerationUID ผ่าน;negativeparity/streamlifecycle/stalejobcancellation ยังขาด |
| INV005–008 clock | Partial | fields/bindings ดีขึ้น;timebase/calibrationvalidity,liveclockmapper,replayarrivaltruth ยังขาด |
| §2.3 Observation | Missing full implementation | ไม่มี completeproducers/schema/transform/corroborationworkflow |
| INV009–012 decision | Partial | transitionhelper เท่านั้น;legacy-policyreplay/observationowner/watermark/reset/strictlog ยังขาด |
| INV013–014,024 writer/persistence | Partial prototype | version/digestchecks บางส่วน;scope,deepcopy,DBatomicity/fencing/journal ยังขาด |
| INV015 slot cardinality | Implemented for project25 outputs | 25 rows/role และ inactivecounts ใน puretests;input/outputschema ยังไม่ครบ |
| INV016–018 evidence truth | Partial / violated by probes | payload/run/clock/generation/negativeuncertainty/tieinvalidderivationproblems |
| INV019–021 multicamera | Partial | independentlogicalqueues;computeisolation/cancellation/mixedbackendrouter ยังขาด |
| INV022–023 crossplatform | Partial | validNode/browserUIDgolden ผ่านจริง;invalidparity และ nativeWindows ยังขาด |
| INV025 archive | Partial / violated by probes | bytes checksum มี;schema/refgraph/path/importtransaction ขาด |
| INV026–027 UI | Partial | pureVM ไม่มี observerloop;trustedprojection/Anchorproof/actualDOMgates ยังขาด |
| INV028 matchedframe | Missing end-to-end | identityutilities ไม่เท่ากับ same-pixelfanout+comparisoncoverage |
| INV029 resourcebounds | Partial / violated | ringpin ทำเกิน budget;tracedrain ไม่มี timebound;schedulererrors ไม่มี outcome |
| INV030 isolation | Static separation present | productionindex ไม่ wirepuremodules;ยังต้อง capability-denial/integrationtests ก่อน host จริง |
| INV031 sensor | Missing new adapter integration | legacytransport ไม่ใช่ newObservation/clockfusionimplementation |
| INV032 nativeboundary | Missing / legacy open | isolatedP1-07testtargets คือขั้นถัดไป ไม่ถือว่า secure แล้ว |
| INV033–034 truth/reporting | Partial | NOT RUN/legacyred ระบุถูกต้อง;“closedshadowfoundation”ควรลด scope;manifeststale7files |

LegacyF01–F12 และ M01–M04 จาก review ก่อนยัง OPEN ตาม checkpoint ไม่ได้ถูก puremodulestests ปิด. ไม่ต้องแก้ production เพื่อให้ puregates เขียว และไม่เปลี่ยน expectedlegacyfailures เป็น accuracyclaim

## 6. Stage-specific verdicts

| Scope | Verdict | เงื่อนไข |
|---|---|---|
| Continued pure/offline shadow refinement | **GO for repairs/refinement; NO-GO to declare P1-06 complete** | ใช้ findings นี้เป็น redtests ก่อนแก้,รักษา productionisolation,ห้ามต่อ consumer โดยถือ boundary ปัจจุบัน trusted ครบ |
| P1-07 native-adapter/security work in separate test targets | **CONDITIONAL GO** | เริ่ม protocol/auth/origin/loopback/serialized-manager/generationconformancetests ได้ แยก process/storage;ต้องแก้ commonidentity/clockvalidation ก่อนรับ data จริงเข้าทางใหม่;ไม่ replaceproductionhelper |
| Browser live shadow | **NO-GO** | ringbound,schedulerworkerboundary,traceobservereffect,strictprojection/identity,servedassetcache และ legacyUIconflict ยังไม่ผ่าน |
| Native live shadow | **NO-GO** | security/concurrency/nativeclock/capability/runtimeacceptance ยังไม่มี;Windowsstub ยังไม่ใช่ runtime |
| Live shooting / field test with this candidate | **NO-GO** | ยังไม่มี target-runtime/fielddatasetacceptance;ไม่ใช้ candidate นี้รายงาน reliablecapture หรือ productionreadiness |

การเตรียม labeledofflinevideos/testplan ทำต่อได้;NO-GO จำกัดการใช้ candidate นี้เป็นระบบที่ผ่านการตรวจ ไม่ใช่ห้ามเก็บ groundtruth ด้วยวิธีอื่นที่แยกจาก candidate

## 7. Exact next actions — dependency order

1. **Checkpoint truth:** เก็บ ZIP นี้ immutable;แก้ status เป็น purefoundations/partial ไม่ใช่ closure ทุกข้อ. Regenerateprovenance จาก finalfiles แล้ว verifyagainstfinalZIP;ไม่เปลี่ยน parenthashes หรือ legacytests เพื่อให้ green
2. **Shared validation:** ทำ validator ชุดเดียวก่อน Node/WebCryptoencoding;เพิ่ม negativegoldens+actualbrowsertests. Locksourceclock/timebase/calibration-methodsemantics. ให้ typedrecordvalidators ใช้ defensivecopy จริงทุก consumer
3. **Replay/Observation provenance:** requirefixturemetadata หรือ explicitdefaultsprofile;preservenulls/rejectinvalid;virtualarrival ต้องแยกจาก sourcetime. ตรวจ payloadref/digest และ duplicateUIDpayloadconflict;สร้าง Observation/Candidate/Projection/Eventschemas ก่อน bindingmodules
4. **Identity/scope integrity:** เปลี่ยน writer/logkey และ idempotencycomparison ให้รวม namespace/run/cycle/role/target ตาม contract;recomputeevent/commanddigest,validatechain,deepfreezeisolatedcopies;testcrossscoperetries/nestedmutations
5. **Resource guarantees:** hardadmissionbudget และ leasepolicy,release/timer-eviction,out-of-order/generationtimehandling;rejectmissingbyteaccounting. Scheduler รับเฉพาะ workerdispatch หรือแยก purepolicy ออกจาก executor ชัด;มี cancel/error/finallyleasecleanup และ fairnesstest
6. **Projector correctness:** filterverifiedeligiblecandidates ก่อน bestderivation;ตรวจ ledger/payload/run/master/generation/uncertainty;per-sourcecadence/per-edgeT;stablelexicaltie+exactobjective;testinputpermutations,invalidlargederivation และ brute-forceoracle. เติม slotlineage/version/missingreasons ครบ
7. **Review/archive:** validateprojection ก่อน Anchor;inactive ไม่ labelMissing. Validatearchiveonimport ทั้ง paths/schema/referencegraph/bloblimits ก่อน staging;เก็บ immutableoriginalrecords และทำ idempotentnewnamespaceimport
8. **Durability implementation:** in-memorywriter/log ใช้เป็น testdouble ต่อได้ แต่เพิ่มจริง IndexedDBtransaction/fencing/journal/quota/crashrecovery ก่อนกล่าว D04/D24 ผ่าน. ไม่ rewriteEquipment/Athlete/Session
9. **P1-07 parallel preparation:** ทำ OSadapterconformance/securitystandalone ตาม sharedcontract;ไม่มี productionrouting/authoritypromotion;runtimeSDKtests ต้องแยก Mac/Windows และประกาศ NOT RUN ตามจริง
10. **Trace/live readiness later:** boundedflushwork/workerconsumer,configimmutability,latency/captureFPSobserver-effect,immutableexactframeacquisition,cachekey+servedhashproof. ห้ามเรียก queueMicrotask ว่า non-blockingcompute
11. **Next review packet:** ส่ง source+finalmanifest+newred/greenprobes+contractgapstatus+legacy103results+hashdiagnostics แยก,actualbrowsernegativeparity,crash/resource/assignmenttests. ยังคง NOT RUN สำหรับกล้อง/นักยิงจนมีหลักฐาน
12. **Rollback:** ปิด/unloadshadow และ keepnamespace อ่านอย่างเดียว;revertapprovedtracecommit เมื่อ observereffect เกิน budget และเริ่ม run ใหม่. เก็บ originalZIPs/sessions/traces;ไม่ใช้การลบข้อมูลหรือการเปลี่ยน labels ทำให้ gate ผ่าน

ผลสรุป: มีความคืบหน้าที่พิสูจน์ได้ทั้ง lineage และ P1-01/trace hardening แต่ P1-02..06 ยังเป็น foundations ที่มี correctnessgaps สำคัญ ต้องทำ repair/refinement ต่อก่อนเชื่อผล pipeline หรือเปิด live. Option2 ยังเหมาะสม ไม่ต้องเริ่มออกแบบทั้งระบบใหม่
