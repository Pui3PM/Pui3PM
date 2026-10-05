'use strict';
// Claude independent red-team probes for R8 P1-06 repair. Review-only; does not modify source.
const path=require('path'),crypto=require('crypto');
const ROOT=process.argv[2]||path.resolve(__dirname,'../run/app');
const R=p=>require(path.join(ROOT,'shadow',p));
const {frameUID:nodeUID}=R('contracts/identity');const {frameUID:webUID}=R('contracts/identity_browser');
const {validateFrameEnvelope,SCHEMA}=R('contracts/contract_v1');const CM=R('contracts/clock_mapper');
const {immutablePlainCopy}=R('contracts/strict_types');const {sha256Canonical}=R('contracts/canonical_json');
const {RoleRing}=R('ring/role_ring');const {AnalysisScheduler}=R('scheduler/priority_scheduler');
const {InMemoryShotEventLog}=R('event_log/in_memory_event_log');const {initialCycle,reduceCycle}=R('decision/shot_cycle_reducer');
const {InMemoryEvidenceWriter}=R('evidence_writer/in_memory_writer');const {project25}=R('projector/logical25');
const VM=R('review/view_model');const AR=R('archive/shadow_archive');const RV=R('contracts/record_validators');
const out={};const H='a'.repeat(64),H2='b'.repeat(64);
function rec(id,confirmedDefect,detail){out[id]={defectReproduced:confirmedDefect,...detail};}
function tryv(f){try{return {ok:true,v:f()};}catch(e){return {ok:false,err:String(e.message||e)};}}
function cand(id,t,x={}){return {candidateId:'c'+id,frameUID:'f'+id,derivationId:'d',runId:'r',cycleId:'c',role:'side',masterClockId:'m',sourceId:'cam',streamGeneration:'g',payloadRef:'blob/'+id,payloadState:'available',contentDigest:H,actualMasterTime:t,mappingStatus:'validated',mappingUncertainty:0,decodeValid:true,width:10,height:10,measuredFPS:30,phaseEvidenceRefs:['proof'],...x};}
const anchorTL={anchor:{status:'verified',start:0,end:300000,refs:['tl-anchor']}};
(async()=>{
// C-01 lone-surrogate identity collision (both entrypoints)
{const a={runId:'run\uD800',sourceId:'s',streamGeneration:'g',frameSeq:'1'},b={runId:'run\uFFFD',sourceId:'s',streamGeneration:'g',frameSeq:'1'};
 const na=nodeUID(a),nb=nodeUID(b),wa=await webUID(a,crypto.webcrypto),wb=await webUID(b,crypto.webcrypto);
 rec('C01_lone_surrogate_uid_collision',na===nb&&wa===wb,{distinctRunIds:a.runId!==b.runId,nodeEqual:na===nb,webEqual:wa===wb,canonicalJsonDiffers:sha256Canonical(a)!==sha256Canonical(b)});}
// C-02 clonePlain __proto__ : silent drop + mutable inherited payload in "immutable" copy
{const src=JSON.parse('{"a":1,"__proto__":{"payloadRef":"ghost"}}');const c=immutablePlainCopy(src);
 const ownKeys=Object.keys(c);const inherited=c.payloadRef;let mutated=false;try{Object.getPrototypeOf(c).payloadRef='changed';mutated=c.payloadRef==='changed';}catch{}
 const digestSrc=sha256Canonical(src),digestCopy=(()=>{try{return sha256Canonical(c);}catch(e){return 'ERR';}})();
 // archive: dangling ref hidden via __proto__
 const base=crypto.createHash('sha256').update('b').digest('hex');
 const arc=tryv(()=>AR.buildArchive({archiveId:'x',baselineDigest:base,records:JSON.parse('{"frames":{"__proto__":{"payloadRef":"missing.bin"}}}'),files:{}}));
 const imp=require('child_process').execFileSync(process.execPath,[require('path').join(__dirname,'proto_import_probe.cjs')],{encoding:'utf8'});
 rec('C02_proto_key_silent_drop_and_mutable_prototype',!ownKeys.includes('__proto__')&&mutated&&/"storedBodyDigestMatchesManifestDigest":false/.test(imp),{archiveImportProbe:imp.trim(),ownKeys,inheritedPayloadRef:inherited,prototypeMutableAfterFreeze:mutated,digestSourceVsCopyDiffer:digestSrc!==digestCopy,archiveWithHiddenDanglingRefAccepted:arc.ok});}
// C-03 clock mapping: scale not bound to sourceTimebase; trusted-api validated without residual/transport; fixture method can be 'validated'
{const base={mappingId:'m1',version:1,runId:'r',masterClockId:'M',clockId:'c',streamGeneration:'g',sourceTimebase:{numerator:'1',denominator:'90000'},scale:{numerator:'1',denominator:'1'},offsetUs:0,validStartTick:null,validEndTick:null,calibrationMethod:'trusted-api',calibrationSampleIds:[],residualBoundUs:null,transportBoundUs:null,uncertaintyBoundUs:0,timestampKind:'presentation',status:'validated',createdByVersion:'v'};
 const v1=tryv(()=>CM.validateClockMapping(base));
 const m=tryv(()=>CM.mapBoundSourceTime(base,{runId:'r',masterClockId:'M',clockId:'c',streamGeneration:'g',sourceTimebase:{numerator:'1',denominator:'90000'},timestampKind:'presentation',sourcePTS:'90000'}));
 const fx=tryv(()=>CM.validateClockMapping({...base,calibrationMethod:'fixture',calibrationSampleIds:['s1'],uncertaintyBoundUs:0}));
 rec('C03_clock_scale_timebase_unbound',v1.ok&&m.ok&&m.v.mappedMasterTime!==1000000,{validatedWithZeroUncertainty:v1.ok,onesecondOf90kHzMapsToUs:m.ok?m.v.mappedMasterTime:m.err,expectedUs:1000000,fixtureMethodValidatedAccepted:fx.ok});}
// C-04 mapTicks(null) returns non-null uncertainty that contract_v1 forbids for unknown source time
{const mp={mappingId:'m1',version:1,runId:'r',masterClockId:'M',clockId:'c',streamGeneration:'g',sourceTimebase:{numerator:'1',denominator:'1000000'},scale:{numerator:'1',denominator:'1'},offsetUs:0,validStartTick:null,validEndTick:null,calibrationMethod:'trusted-api',calibrationSampleIds:[],residualBoundUs:null,transportBoundUs:null,uncertaintyBoundUs:500,timestampKind:'presentation',status:'validated',createdByVersion:'v'};
 const r=CM.mapTicks(mp,null);rec('C04_null_ticks_nonnull_uncertainty',r.mappingUncertainty!==null,{result:r,note:'contract_v1 requires mappingUncertainty=null when sourcePTS=null'});}
// C-05 scheduler: any function with self-declared dispatchKind runs synchronously on caller thread; Side blocked by aux
{const order=[];const s=new AnalysisScheduler();
 s.submit('overhead',()=>{order.push('aux-start');const t=Date.now();while(Date.now()-t<30){}order.push('aux-end');},{dispatchKind:'worker-dispatch'});
 s.submit('side',()=>{order.push('side');},{dispatchKind:'worker-dispatch'});
 await new Promise(r=>setTimeout(r,80));
 rec('C05_scheduler_label_only_boundary',order.join(',')==='aux-start,aux-end,side',{order,note:'default dispatch executes task() inline; dispatchKind is caller-asserted string'});}
// C-06 scheduler: never-resolving dispatch wedges lane forever (no watchdog); stale active generation result delivered as completed
{const outcomes=[];const s=new AnalysisScheduler({dispatch:(t,m)=>t(),onOutcome:(j,st)=>outcomes.push([j.meta.id,st])});
 s.submit('side',()=>new Promise(()=>{}),{dispatchKind:'worker-dispatch',id:'hang',generation:'g1'});
 s.submit('side',async()=>1,{dispatchKind:'worker-dispatch',id:'next',generation:'g2'});
 s.cancelGeneration('g1');await new Promise(r=>setTimeout(r,50));const snap=s.snapshot();
 const s2=new AnalysisScheduler({dispatch:(t)=>t(),onOutcome:(j,st)=>outcomes.push([j.meta.id,st])});let rel;s2.submit('side',()=>new Promise(r=>rel=r),{dispatchKind:'worker-dispatch',id:'old',generation:'g1'});await new Promise(r=>setImmediate(r));s2.cancelGeneration('g1');rel(42);await new Promise(r=>setTimeout(r,10));
 rec('C06_scheduler_hang_and_stale_completion',snap.sideActive&&snap.sidePending&&outcomes.some(o=>o[0]==='old'&&o[1]==='completed'),{sideWedged:snap.sideActive,nextStillPending:snap.sidePending,outcomes});}
// C-07 scheduler: throwing onOutcome -> unhandled rejection
{let unhandled=null;const h=e=>{unhandled=String(e&&e.message||e);};process.once('unhandledRejection',h);
 const s=new AnalysisScheduler({dispatch:async()=>1,onOutcome:()=>{throw new Error('observer-throw');}});s.submit('side',{},{dispatchKind:'worker-dispatch'});
 await new Promise(r=>setTimeout(r,30));process.removeListener('unhandledRejection',h);
 rec('C07_scheduler_observer_throw_unhandled_rejection',unhandled==='observer-throw',{unhandled,note:'Node >=15 default terminates the process on unhandled rejection'});}
// C-08 ring: duplicate frameUID with different payload digest silently deduped; cross-clock-domain book times; late frame admitted then instantly evicted
{const r=new RoleRing({role:'side',byteBudget:1000,retentionUs:1000});
 const a=r.add({role:'side',frameUID:'U',mappingStatus:'validated',mappedMasterTime:10,contentDigest:H},{byteLength:10});
 const b=r.add({role:'side',frameUID:'U',mappingStatus:'validated',mappedMasterTime:10,contentDigest:H2},{byteLength:10});
 const r2=new RoleRing({role:'side',byteBudget:1000,retentionUs:1000});
 r2.add({role:'side',frameUID:'A',mappingStatus:'validated',mappedMasterTime:5000000},{byteLength:10});
 const late=r2.add({role:'side',frameUID:'B',mappingStatus:'unmapped',mappedMasterTime:null},{byteLength:10,bookkeepingTimeUs:0});
 const bStill=r2.snapshot().frames.some(f=>f.frameUID==='B');
 const unvalidated=tryv(()=>new RoleRing({role:'side'}).add({role:'side',frameUID:'',mappingStatus:'x'},{byteLength:1,bookkeepingTimeUs:0}));
 rec('C08_ring_dedup_conflict_and_clock_mix',b.frame.contentDigest===H&&!bStill,{conflictingDuplicateReturnedOldSnapshot:b===a,duplicateMetric:r.metrics.duplicateDelivery,lateCallerClockFrameReturnedButEvictedImmediately:!bStill,returnedSnapshotRetentionClock:late.retentionClock,emptyFrameUIDAndUnvalidatedFrameAccepted:unvalidated.ok});}
// C-09 ring: lease has no TTL; leaked lease pins forever; Side admission throws
{const r=new RoleRing({role:'side',byteBudget:20,retentionUs:10});r.add({role:'side',frameUID:'a',mappingStatus:'validated',mappedMasterTime:0},{byteLength:20});r.lease('a');r.advance(1e12);
 const ad=tryv(()=>r.add({role:'side',frameUID:'b',mappingStatus:'validated',mappedMasterTime:1e12},{byteLength:1}));
 rec('C09_ring_leaked_lease_pins_forever',!ad.ok,{afterHugeAdvanceTotalBytes:r.totalBytes,sideAddResult:ad.ok?'ok':ad.err});}
// C-10 event log: cycle() with namespace but no runId leaks across namespaces; append bypassing reducer lacks time/clock validation
{const log=new InMemoryShotEventLog();for(const ns of ['shadow/A','prod/B']){const cy=initialCycle({runId:'r',cycleId:'c1',masterClockId:'m',namespace:ns,policyVersion:'p',configDigest:'x'});const ev=reduceCycle(cy,{runId:'r',cycleId:'c1',eventType:ns==='prod/B'?'rejected':'confirmed',eventId:'e'+ns,idempotencyKey:'k',decidedAtMasterTime:1,recordedAtMasterTime:1}).event;log.append(ev);}
 const q=log.cycle('c1',{namespace:'shadow/A'});
 const body={eventId:'raw',runId:'r',cycleId:'c9',seq:'1',eventType:'confirmed',eventNamespace:'production',idempotencyKey:'k',policyVersion:'p',configDigest:'x',previousEventDigest:null,reasonCodes:[]};
 const raw=tryv(()=>log.append({...body,eventDigest:sha256Canonical(body)}));
 rec('C10_eventlog_scope_leak_and_unvalidated_append',q.length===2&&raw.ok,{namespaceFilteredQueryReturned:q.map(e=>[e.eventNamespace,e.eventType]),rawConfirmedIntoProductionNamespaceWithoutTimesOrClockAccepted:raw.ok});}
// C-11 writer: saveProjection accepts fabricated real slots not backed by record candidates + duplicate FrameUIDs
{const w=new InMemoryEvidenceWriter();const pr=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',candidates:[]});const fake=JSON.parse(JSON.stringify(pr));fake.projectionId='fake';
 for(const i of [2,3]){Object.assign(fake.slots[i],{status:'real',actualFrameUID:'f1/forged',actualMasterTime:0,signedDelta:0,actualPhaseEvidenceRefs:['x'],missingReason:null});}
 const payload={projection:fake};const r=tryv(()=>w.execute({commandId:'p',namespace:'shadow/n',runId:'r',cycleId:'c',role:'side',operation:'saveProjection',expectedRecordVersion:0,payload,payloadDigest:sha256Canonical(payload)}));
 const vm=tryv(()=>VM.buildReviewView(fake));
 const claims={claims:[{claimId:'x',runId:'r',cycleId:'c',role:'side',phase:'banana',frameUID:42}]};const pc=tryv(()=>w.execute({commandId:'q',namespace:'shadow/n',runId:'r',cycleId:'c',role:'side',operation:'addPhaseEvidence',expectedRecordVersion:r.ok?1:0,payload:claims,payloadDigest:sha256Canonical(claims)}));
 rec('C11_writer_and_view_accept_forged_duplicate_real_slots',r.ok&&vm.ok,{writerAcceptedForgedProjection:r.ok,reviewViewAcceptedDuplicateFrameUID:vm.ok,realCount:vm.ok?vm.v.realCount:null,schemaFreePhaseClaimAccepted:pc.ok});}
// C-12 projector: stale generation accepted when allowedBindings omitted (default [] = no restriction)
{const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',releaseTime:0,candidates:[cand('old',0,{streamGeneration:'g-OLD'}),cand('old2',33333,{streamGeneration:'g-OLD'})]});
 rec('C12_projector_generation_binding_opt_in',p.uniqueRealCount>0,{uniqueRealCountFromOldGenerationOnly:p.uniqueRealCount});}
// C-13 projector: same frameUID, conflicting contentDigest/source -> silently picks one; frameUID not bound to source tuple
{const a=cand('X',0,{derivationId:'d1',contentDigest:H,width:10,height:10}),b=cand('X',0,{derivationId:'d2',contentDigest:H2,width:20,height:20,sourceId:'other-cam'});
 const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',releaseTime:0,candidates:[a,b,cand('Y',33333)]});
 rec('C13_projector_uid_conflict_silent',p.slots.some(s=>s.actualFrameUID==='fX'),{selectedDerivation:p.slots.find(s=>s.actualFrameUID==='fX')?.derivationId,note:'two derivations with same frameUID but different digest+sourceId: no conflict raised; candidate frameUID never recomputed from tuple'});}
// C-14 projector: cadence estimated from candidate spacing, not source cadence -> sparse candidates widen tolerance up to 50ms cap
{const tl={anchor:{status:'verified',start:0,end:400000,refs:['tl']}};const sparse=[60000,260000].map((t,i)=>cand('s'+i,t,{measuredFPS:30}));const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:tl,candidates:sparse});
 const used=p.slots.filter(s=>s.status==='real');rec('C14_projector_cadence_from_candidate_gaps',used.some(s=>Math.abs(s.signedDelta)>16667),{tolerancesUs:[...new Set(used.map(s=>s.toleranceUs))],realSlots:used.map(s=>[s.slotId,s.signedDelta]),declaredMeasuredFPS:30,sourceHalfPeriodUs:16667});}
// C-15 Anchor proof = any non-empty candidate-asserted string; projector-real anchor frame w/o refs shown as missing anchor
{const args={runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:anchorTL};
 const p1=project25({...args,candidates:[cand('a',75000,{phaseEvidenceRefs:['not-anchor-anything']}),cand('b',108333),cand('c2',141666)]});
 const t1=VM.anchorTarget(VM.buildReviewView(p1));
 const p2=project25({...args,candidates:[cand('a',75000,{phaseEvidenceRefs:[]}),cand('b',108333,{phaseEvidenceRefs:[]})]});
 const v2=VM.buildReviewView(p2),t2=VM.anchorTarget(v2);
 rec('C15_anchor_proof_semantics',t1.status==='real'&&t2.status==='missing'&&v2.slots.slice(2,5).some(s=>s.status==='real'),{arbitraryRefAccepted:t1,anchorSlotsRealInProjection:v2.slots.slice(2,5).map(s=>s.status),anchorTargetWhenRefsEmpty:t2.status,timelineRefsAvailable:p2.slots[2].targetPhaseEvidenceRefs});}
// C-16 projector missing reason inaccuracies
{const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',releaseTime:0,candidates:[]});const p2=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',releaseTime:0,candidates:[cand('only',0),cand('o2',33333)]});
 rec('C16_missing_reason_coarse',p.slots[14].missingReason==='no_frame_in_tolerance',{noCandidatesAtAllReason:p.slots[14].missingReason,exhaustedReasonExample:p2.slots.filter(s=>s.phase==='release_window'&&s.status==='missing').map(s=>s.missingReason).slice(0,3)});}
// C-17 archive: case/Unicode-normalization collisions accepted; extra unvalidated payloads smuggled through roundTrip; non-frame refs unchecked
{const base=crypto.createHash('sha256').update('b').digest('hex');
 const c1=tryv(()=>AR.buildArchive({archiveId:'a',baselineDigest:base,records:{},files:{'Frame.jpg':Buffer.from('1'),'frame.jpg':Buffer.from('2'),'caf\u00e9.jpg':Buffer.from('3'),'cafe\u0301.jpg':Buffer.from('4'),'CON':Buffer.from('5'),'x.':Buffer.from('6')}}));
 const arc=AR.buildArchive({archiveId:'a',baselineDigest:base,records:{proj:{slots:[{actualFrameUID:'f1/nonexistent'}]}},files:{}});
 const sm=JSON.parse(JSON.stringify(arc));sm.payloads['../../evil']='!!!not-base64!!!'.repeat(1000);const rt=tryv(()=>AR.roundTrip(sm));
 rec('C17_archive_fs_collisions_and_smuggling',c1.ok&&rt.ok&&('../../evil' in rt.v.payloads),{caseAndNfcNfdCollisionsAndWindowsReservedAccepted:c1.ok,extraPayloadKeyRetainedAfterRoundTrip:rt.ok&&('../../evil' in rt.v.payloads),danglingFrameUIDRefAccepted:true});}
// C-18 validators: Observation time fields unvalidated (source vs inference time); EvidenceCandidate frameUID unbound
{const o=tryv(()=>RV.validateObservation({observationId:'o',runId:'r',masterClockId:'m',kind:'pose',role:'side',frameUIDs:[],sensorSampleUIDs:[],sourceInterval:'yesterday',inferenceStart:{x:1},inferenceEnd:-5,receivedAt:'now',producer:null,status:'valid',confidence:null,payloadSchema:'p',payload:null,reasonCodes:[]}));
 const c=tryv(()=>RV.validateEvidenceCandidate(cand('any',0,{frameUID:'not-a-uid'})));
 rec('C18_validator_gaps',o.ok&&c.ok,{observationWithGarbageTimesAndNoFramesValid:o.ok,candidateWithNonUIDframeUIDValid:c.ok});}
console.log(JSON.stringify(out,null,1));
const n=Object.values(out).filter(x=>x.defectReproduced).length;console.error(`Claude red-team: ${n}/${Object.keys(out).length} probes reproduced a defect`);
})().catch(e=>{console.error('PROBE HARNESS ERROR',e);process.exit(2);});
