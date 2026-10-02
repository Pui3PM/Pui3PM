'use strict';
// ADAPTED COPY (Claude Code, 2026-10-02): identical to the reviewer probe except N05 wraps the two
// sink constructors in tryv, because S-04 makes the constructor reject a non-shadow prefix (allowed by
// FINAL_REVIEW §S-04), and N11 wraps reduceCycle in tryv because S-12 rejects an evidence-free confirmed by
// throwing. A rejection counts as 'not reproduced'. Original: claude_round2_probes.original.cjs
// Claude round-2 independent probes — 3PM R8 P1-06 ClaudeRepair DEV 20261002.
// Review-only: imports the tree read-only. Usage: node claude_round2_probes.cjs <tree>/app
// Each probe prints defectReproduced=true when the defect EXISTS in the tree under test.
// After repair, convert each probe into a regression with the assertion inverted (do not delete).
const path=require('path'),crypto=require('crypto');
const APP=path.resolve(process.argv[2]||'.');
const R=p=>require(path.join(APP,'shadow',p));
const F=require(path.join(APP,'tests/phase01/_shadow_fixture.js'));
const {sha256Canonical}=R('contracts/canonical_json');
const CM=R('contracts/clock_mapper');const RV=R('contracts/record_validators');
const {AnalysisScheduler}=R('scheduler/priority_scheduler');
const {InMemoryShotEventLog}=R('event_log/in_memory_event_log');
const {initialCycle,reduceCycle}=R('decision/shot_cycle_reducer');
const {InMemoryEvidenceWriter}=R('evidence_writer/in_memory_writer');
const {project25}=R('projector/logical25');const VM=R('review/view_model');const AR=R('archive/shadow_archive');
const {frameUID}=R('contracts/identity');
const out={};const rec=(id,defect,detail)=>{out[id]={defectReproduced:!!defect,...detail};};
const tryv=f=>{try{return {ok:true,v:f()};}catch(e){return {ok:false,err:String(e.message||e)};}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cmd=(w,op,payload,ver,id)=>w.execute({commandId:id,namespace:'shadow/n',runId:'r',cycleId:'c',role:'side',operation:op,expectedRecordVersion:ver,payload,payloadDigest:sha256Canonical(payload)});
const TL={masterClockId:'m',draw:{status:'verified',start:0,end:90000,refs:['tl-draw']},anchor:{status:'verified',start:100000,end:400000,refs:['tl-anchor']}};
const BIND=[F.binding({startMasterTime:0,endMasterTime:1000000,capturePeriodUs:100000,jitterUs:0})];
(async()=>{
// N01 — real candidate captured during DRAW is relabelled into an ANCHOR slot with forged time; writer + Review accept it.
{const w=new InMemoryEvidenceWriter();const drawCand=F.candidate(1,30000);cmd(w,'addCandidates',{candidates:[drawCand]},0,'a');
 const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,candidates:[drawCand],roleBindings:BIND,projectionId:'honest',configDigest:'cfg'});
 const honestSlot=p.slots.find(s=>s.status==='real');
 const forged=JSON.parse(JSON.stringify(p));forged.projectionId='forged';
 const src=forged.slots.find(s=>s.status==='real'),dst=forged.slots[2]; // S03 anchor target = 175000
 Object.assign(dst,{status:'real',actualFrameUID:src.actualFrameUID,derivationId:src.derivationId,candidateId:src.candidateId,actualMasterTime:dst.targetMasterTime,signedDelta:0,missingReason:null,mappingUncertaintyUs:0,toleranceUs:50000,actualPhaseEvidenceRefs:['tl-anchor'],selectionReason:'forged',sourceId:src.sourceId,streamGeneration:src.streamGeneration,frameSeq:src.frameSeq,contentDigest:src.contentDigest,frameEnvelopeRef:src.frameEnvelopeRef,contributingReasons:[],phaseProof:{phase:'anchor',timelineRefs:['tl-anchor'],intervalCheck:'inside',settledAnchorBoundary:true}});
 Object.assign(src,{status:'missing',actualFrameUID:null,derivationId:null,candidateId:null,actualMasterTime:null,signedDelta:null,missingReason:'no_frame_in_tolerance',mappingUncertaintyUs:null,toleranceUs:null,actualPhaseEvidenceRefs:[],selectionReason:'missing',sourceId:null,streamGeneration:null,frameSeq:null,contentDigest:null,frameEnvelopeRef:null,phaseProof:null});
 const saved=tryv(()=>cmd(w,'saveProjection',{projection:forged},1,'p'));const view=tryv(()=>VM.anchorTarget(VM.buildReviewView(forged)));
 rec('N01_forged_slot_time_phase_accepted',saved.ok&&view.ok&&view.v.status==='real',{candidateActualMasterTime:drawCand.actualMasterTime,honestPlacement:honestSlot&&[honestSlot.slotId,honestSlot.phase],forgedPlacement:['S03','anchor',dst.actualMasterTime],writerSaved:saved.ok?saved.v.status:saved.err,anchorButtonTarget:view.ok?view.v:view.err});}
// N02 — archive does not bind candidate/frame contentDigest to the payload file bytes (wrong image accepted).
{const imgA=Buffer.from('IMAGE-A-bytes'),imgB=Buffer.from('IMAGE-B-different');const dA=crypto.createHash('sha256').update(imgA).digest('hex');
 const fr=F.frame(7,{mappedMasterTime:30000,payloadRef:'blobs/7.jpg',contentDigest:dA,decodeValid:true});const c=F.candidate(7,30000,{payloadRef:'blobs/7.jpg',contentDigest:dA});
 const base=crypto.createHash('sha256').update('b').digest('hex');
 const r=tryv(()=>AR.buildArchive({archiveId:'x',baselineDigest:base,records:{frames:[fr],candidates:[c],events:[],projections:[]},files:{'blobs/7.jpg':imgB}}));
 rec('N02_archive_payload_not_bound_to_contentDigest',r.ok,{declaredContentDigest:dA.slice(0,16),actualFileSha256:crypto.createHash('sha256').update(imgB).digest('hex').slice(0,16),archiveBuilt:r.ok?'yes':r.err});}
// N03 — validateProjection (Review path) does not recompute FrameUID from its tuple and compares UIDs case-sensitively.
{const c=F.candidate(8,175000);const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,candidates:[c,F.candidate(9,250000)],roleBindings:BIND,projectionId:'q',configDigest:'cfg'});
 const reals=p.slots.filter(s=>s.status==='real');const f=JSON.parse(JSON.stringify(p));const rs=f.slots.filter(s=>s.status==='real');
 const tupleMismatch=JSON.parse(JSON.stringify(p));const t=tupleMismatch.slots.find(s=>s.status==='real');t.frameSeq='999';
 rs[1].actualFrameUID=rs[0].actualFrameUID.toUpperCase().replace('F1/','f1/');Object.assign(rs[1],{sourceId:rs[0].sourceId,streamGeneration:rs[0].streamGeneration,frameSeq:rs[0].frameSeq,contentDigest:rs[0].contentDigest,frameEnvelopeRef:rs[0].frameEnvelopeRef});
 const a=tryv(()=>VM.buildReviewView(tupleMismatch)),b=tryv(()=>VM.buildReviewView(f));
 rec('N03_projection_uid_not_canonical_or_tuple_bound',reals.length===2&&(a.ok||b.ok),{realSlots:reals.length,tupleMismatchAccepted:a.ok,sameImageTwiceViaUppercaseUidAccepted:b.ok});}
// N04 — trusted-api validated mapping: uncertainty bound below the declared transport bound is accepted when residual is null.
{const m=F.mapping({calibrationMethod:'trusted-api',calibrationSampleIds:[],trustedApiId:'avfoundation-host-time',residualBoundUs:null,transportBoundUs:5000,uncertaintyBoundUs:0,mappingNamespace:'shadow/live/test'});
 const r=tryv(()=>CM.validateClockMapping(m));const fx=tryv(()=>CM.validateClockMapping(F.mapping({mappingNamespace:'shadow/replayPRODUCTION'})));
 rec('N04_uncertainty_below_component_bound',r.ok,{transportBoundUs:5000,uncertaintyBoundUs:0,accepted:r.ok?'yes':r.err,fixtureNamespacePrefixLoose_shadow_replayPRODUCTION:fx.ok});}
// N05 — shadow event log / writer accept production namespaces when constructed with another prefix (capability is configurable).
{const mk=tryv(()=>new InMemoryShotEventLog({allowedNamespacePrefix:'legacy-'}));const log=mk.ok?mk.v:{append:()=>{throw new Error('constructor rejected: '+mk.err);}};const body={eventId:'e1',runId:'r',cycleId:'c1',masterClockId:'m',seq:'1',eventType:'confirmed',eventNamespace:'legacy-production',idempotencyKey:'',policyVersion:'p',configDigest:'cfg',previousEventDigest:null,sourceEventTime:null,sourceInterval:null,uncertaintyUs:null,decidedAtMasterTime:1,recordedAtMasterTime:1,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:[]};
 body.idempotencyKey=sha256Canonical({namespace:body.eventNamespace,runId:'r',cycleId:'c1',seq:'1',eventType:'confirmed',policyVersion:'p'});const r=tryv(()=>log.append({...body,eventDigest:sha256Canonical(body)}));
 const mkw=tryv(()=>new InMemoryEvidenceWriter({allowedNamespacePrefix:'legacy-'}));const w=mkw.ok?mkw.v:{execute:()=>{throw new Error('constructor rejected: '+mkw.err);}};const pay={candidates:[F.candidate(1,0)]};const wr=tryv(()=>w.execute({commandId:'x',namespace:'legacy-production',runId:'r',cycleId:'c',role:'side',operation:'addCandidates',expectedRecordVersion:0,payload:pay,payloadDigest:sha256Canonical(pay)}));
 rec('N05_shadow_sinks_namespace_policy_configurable',r.ok||wr.ok,{eventLogAcceptedConfirmedInLegacyProduction:r.ok,writerAcceptedLegacyProduction:wr.ok});}
// N06 — scheduler timeout frees the lane while the timed-out executor job keeps running: hung worker accumulates jobs.
{let running=0,peak=0;const s=new AnalysisScheduler({jobTimeoutMs:10,executor:()=>{running++;peak=Math.max(peak,running);return new Promise(()=>{});}});
 for(let i=0;i<8;i++){s.submit('overhead',{workerId:'aux',messageType:'hang',payloadRef:null},{id:'j'+i,generation:'g'+i});await sleep(14);}
 await sleep(30);for(let i=0;i<50;i++)s.cancelGeneration('gen-'+i);
 rec('N06_scheduler_timeout_does_not_cancel_executor',peak>1,{concurrentOutstandingExecutorJobs:peak,timedOut:s.snapshot().metrics.timedOut,cancelledGenerationsRetained:s.snapshot().cancelledGenerations.length});}
// N07 — descriptor "serializable" validation is shallow.
{const s=new AnalysisScheduler({executor:async()=>1});const d={workerId:'w',messageType:'m',payloadRef:null,extra:{fn(){return 1;}}};const r=tryv(()=>s.submit('side',d,{}));let cloneable=true;try{structuredClone(d);}catch{cloneable=false;}
 rec('N07_descriptor_validation_shallow',r.ok&&!cloneable,{accepted:r.ok,structuredCloneable:cloneable});}
// N08 — settledAnchorBoundary is hard-coded true for any anchor slot; the Review gate on it is vacuous.
{const tlUnsettled={masterClockId:'m',anchor:{status:'verified',start:100000,end:400000,refs:['raw-anchor-not-settled'],settled:false}};const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:tlUnsettled,candidates:[F.candidate(1,175000)],roleBindings:BIND,projectionId:'s',configDigest:'cfg'});
 const a=p.slots.find(s=>s.phase==='anchor'&&s.status==='real');rec('N08_settled_anchor_flag_not_derived',!!a&&a.phaseProof.settledAnchorBoundary===true,{timelineDeclaredSettled:false,slotSettledAnchorBoundary:a?.phaseProof?.settledAnchorBoundary,anchorButton:VM.anchorTarget(VM.buildReviewView(p)).status});}
// N09 — writer command-memo capacity is global and fail-closed: one long session makes every later cycle unwritable.
{const w=new InMemoryEvidenceWriter({maxCommandMemos:3});for(let i=0;i<3;i++){const pay={candidates:[F.candidate(1,0,{cycleId:'c'+i})]};w.execute({commandId:'k'+i,namespace:'shadow/n',runId:'r',cycleId:'c'+i,role:'side',operation:'addCandidates',expectedRecordVersion:0,payload:pay,payloadDigest:sha256Canonical(pay)});}
 const pay={candidates:[F.candidate(2,0,{cycleId:'new-shot'})]};const r=tryv(()=>w.execute({commandId:'new',namespace:'shadow/n',runId:'r',cycleId:'new-shot',role:'side',operation:'addCandidates',expectedRecordVersion:0,payload:pay,payloadDigest:sha256Canonical(pay)}));
 rec('N09_command_memo_capacity_global_failclosed',!r.ok,{newCycleWrite:r.ok?'ok':r.err});}
// N10 — one candidate carrying an undefined-valued field makes the whole projection throw (instead of classifying it invalid).
{const bad={...F.candidate(3,175000),extensions:undefined};const r=tryv(()=>project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,candidates:[F.candidate(4,250000),bad],roleBindings:BIND,projectionId:'u',configDigest:'cfg'}));
 rec('N10_projection_aborts_on_undefined_field',!r.ok,{result:r.ok?'projected':r.err});}
// N11 — shadow event can be confirmed with zero supporting observations; reducer has no Side generation reset / reorder watermark.
{let cy=initialCycle({runId:'r',cycleId:'z',masterClockId:'m',namespace:'shadow/x',policyVersion:'p',configDigest:'cfg'});const rr=tryv(()=>reduceCycle(cy,{runId:'r',cycleId:'z',eventType:'confirmed',eventId:'e',decidedAtMasterTime:1,recordedAtMasterTime:1}));const r=rr.ok?rr.v:{status:'rejected: '+rr.err};
 const src=require('fs').readFileSync(path.join(APP,'shadow/decision/shot_cycle_reducer.js'),'utf8');rec('N11_reducer_no_reset_watermark_or_evidence_gate',r.status==='applied'&&!/authority_stream_reset/.test(src),{confirmedWithoutObservations:r.status,hasAuthorityStreamReset:/authority_stream_reset/.test(src),hasWatermark:/watermark/.test(src)});}
// N12 — archive carries non-shadow event namespaces into a shadow import.
{const body={eventId:'e1',runId:'r',cycleId:'c1',masterClockId:'m',seq:'1',eventType:'confirmed',eventNamespace:'legacy-production',idempotencyKey:'k',policyVersion:'p',configDigest:'cfg',previousEventDigest:null,sourceEventTime:null,sourceInterval:null,uncertaintyUs:null,decidedAtMasterTime:1,recordedAtMasterTime:1,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:[]};
 const base=crypto.createHash('sha256').update('b').digest('hex');const r=tryv(()=>{const a=AR.buildArchive({archiveId:'ev',baselineDigest:base,records:{frames:[],candidates:[],events:[{...body,eventDigest:sha256Canonical(body)}],projections:[]},files:{}});return new AR.InMemoryArchiveImporter().stage(a,{namespace:'shadow/import'}).status;});
 rec('N12_archive_imports_non_shadow_events',r.ok,{staged:r.ok?r.v:r.err});}
console.log(JSON.stringify(out,null,1));
console.error(`round2: ${Object.values(out).filter(x=>x.defectReproduced).length}/${Object.keys(out).length} probes reproduced a defect`);
})().catch(e=>{console.error('PROBE HARNESS ERROR',e);process.exit(2);});
