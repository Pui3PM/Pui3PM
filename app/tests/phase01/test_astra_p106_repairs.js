'use strict';
const assert=require('assert'),crypto=require('crypto');
const {frameUID:nodeUID}=require('../../shadow/contracts/identity'),{frameUID:webUID}=require('../../shadow/contracts/identity_browser');
const {RoleRing}=require('../../shadow/ring/role_ring'),{AnalysisScheduler}=require('../../shadow/scheduler/priority_scheduler');
const {InMemoryShotEventLog}=require('../../shadow/event_log/in_memory_event_log'),{initialCycle,reduceCycle}=require('../../shadow/decision/shot_cycle_reducer');
const {InMemoryEvidenceWriter}=require('../../shadow/evidence_writer/in_memory_writer'),{sha256Canonical}=require('../../shadow/contracts/canonical_json'),{project25}=require('../../shadow/projector/logical25'),{buildReviewView}=require('../../shadow/review/view_model');
const F=require('./_shadow_fixture');
(async()=>{
 const invalid={runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'18446744073709551616'};assert.throws(()=>nodeUID(invalid));await assert.rejects(()=>webUID(invalid,crypto.webcrypto));
 const ring=new RoleRing({role:'side',byteBudget:20,maxLeasedBytes:15,retentionUs:100,leaseTtlUs:10});const fr=F.frame(1,{mappedMasterTime:0});ring.add(fr,{byteLength:10});ring.lease(fr.frameUID);ring.advance(1000);assert.equal(ring.totalBytes,0);
 const sch=new AnalysisScheduler({executor:async d=>d.messageType});assert.throws(()=>sch.submit('overhead',()=>{},{}),/functions/);
 let cy=initialCycle({runId:'r',cycleId:'c',masterClockId:'m',namespace:'shadow/n',policyVersion:'p',configDigest:'cfg'});let rr=reduceCycle(cy,{runId:'r',cycleId:'c',eventType:'confirmed',eventId:'e',decidedAtMasterTime:1,recordedAtMasterTime:2,supportingObservationIds:['o']});const log=new InMemoryShotEventLog();log.append(rr.event,{expectedPreviousSeq:'0'});assert(Object.isFrozen(log.cycle('c',{namespace:'shadow/n',runId:'r'})[0].supportingObservationIds));
 const w=new InMemoryEvidenceWriter(),cand=F.candidate(1,0),payload={candidates:[cand]},cmd={commandId:'id',namespace:'shadow/n',runId:'r',cycleId:'c',role:'side',operation:'addCandidates',expectedRecordVersion:0,payload,payloadDigest:sha256Canonical(payload)};w.execute(cmd);assert.throws(()=>w.execute({...cmd,cycleId:'other'}),/SCOPE|DIGEST|CONFLICT/);
 const args={runId:'r',cycleId:'c',masterClockId:'m',role:'side',releaseTime:0,roleBindings:[F.binding()]};const p=project25({...args,candidates:[cand],projectionId:'p',configDigest:'cfg'});assert.equal(p.uniqueRealCount,1);assert.doesNotThrow(()=>buildReviewView(p));
 console.log('Astra P1-06 repair regressions: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
