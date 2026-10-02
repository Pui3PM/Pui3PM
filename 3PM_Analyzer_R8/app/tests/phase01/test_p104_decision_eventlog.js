'use strict';
const assert=require('assert');
const {initialCycle,reduceCycle}=require('../../shadow/decision/shot_cycle_reducer');
const {InMemoryShotEventLog}=require('../../shadow/event_log/in_memory_event_log');
const {sha256Canonical}=require('../../shadow/contracts/canonical_json');
function proposal(type,n){return {runId:'r',cycleId:'c',eventType:type,eventId:`e${n}`,sourceEventTime:1000+n,decidedAtMasterTime:1100+n,recordedAtMasterTime:1200+n,supportingObservationIds:[`o${n}`],contradictingObservationIds:[],reasonCodes:[]};}
let cycle=initialCycle({runId:'r',cycleId:'c',masterClockId:'m',namespace:'shadow/x/r',activeRoleSnapshot:['side'],policyVersion:'p1',configDigest:'cfg'}),log=new InMemoryShotEventLog(),r=reduceCycle(cycle,proposal('candidate',1));cycle=r.cycle;
assert.equal(log.append(r.event,{expectedPreviousSeq:'0'}).status,'appended');assert.equal(log.append(r.event,{expectedPreviousSeq:'1'}).status,'existing');const mutated=JSON.parse(JSON.stringify(r.event));mutated.eventType='rejected';assert.throws(()=>log.append(mutated),/DIGEST|IDEMPOTENCY/);
r=reduceCycle(cycle,proposal('confirmed',2));cycle=r.cycle;assert.equal(log.append(r.event,{expectedPreviousSeq:'1'}).status,'appended');assert.equal(log.cycle('c',{namespace:'shadow/x/r',runId:'r'}).length,2);assert(Object.isFrozen(log.cycle('c',{namespace:'shadow/x/r',runId:'r'})[0].supportingObservationIds));assert.throws(()=>log.cycle('c',{namespace:'shadow/x/r'}),/namespace and runId/);
assert.throws(()=>initialCycle({runId:'r',cycleId:'x',masterClockId:'m',namespace:'production',policyVersion:'p',configDigest:'c'}),/identity|policy/);
const badBody={eventId:'raw',runId:'r',cycleId:'x',masterClockId:'m',seq:'1',eventType:'confirmed',eventNamespace:'production',idempotencyKey:'x',policyVersion:'p',configDigest:'c',previousEventDigest:null,sourceEventTime:null,sourceInterval:null,uncertaintyUs:null,decidedAtMasterTime:1,recordedAtMasterTime:1,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:[]};assert.throws(()=>log.append({...badBody,eventDigest:sha256Canonical(badBody)}),/NAMESPACE|IDEMPOTENCY/);
console.log('P1-04 scoped immutable event log hardened: PASS');
