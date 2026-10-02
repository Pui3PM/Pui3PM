'use strict';
const {immutablePlainCopy}=require('../contracts/strict_types');
const {sha256Canonical}=require('../contracts/canonical_json');
const {derivedIdempotencyKey}=require('../event_log/in_memory_event_log');
const TERMINAL=new Set(['confirmed','rejected','uncertain']);
function initialCycle({runId,cycleId,authorityRole='side',namespace,activeRoleSnapshot=[],policyVersion,configDigest,masterClockId=null}){
  if(!runId||!cycleId||!namespace||!namespace.startsWith('shadow/')||!policyVersion||!configDigest||!masterClockId)throw new TypeError('cycle identity/policy required');
  return immutablePlainCopy({runId,cycleId,masterClockId,authorityRole,namespace,state:'candidate',eventSeq:'0',terminalEventId:null,lastEventDigest:null,activeRoleSnapshot:[...activeRoleSnapshot],policyVersion,configDigest,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:[]});
}
function reduceCycle(cycle,proposal){
  if(!cycle||!proposal||proposal.cycleId!==cycle.cycleId||proposal.runId!==cycle.runId)throw new TypeError('cycle proposal mismatch');if(TERMINAL.has(cycle.state))return {cycle,event:null,status:'terminal_immutable'};const type=proposal.eventType;if(!['candidate','confirmed','rejected','uncertain'].includes(type))throw new TypeError('invalid eventType');const nextSeq=(BigInt(cycle.eventSeq)+1n).toString();
  const pre={eventId:proposal.eventId,runId:cycle.runId,cycleId:cycle.cycleId,masterClockId:cycle.masterClockId,seq:nextSeq,eventType:type,sourceEventTime:proposal.sourceEventTime??null,sourceInterval:proposal.sourceInterval??null,uncertaintyUs:proposal.uncertaintyUs??null,decidedAtMasterTime:proposal.decidedAtMasterTime,recordedAtMasterTime:proposal.recordedAtMasterTime,supportingObservationIds:[...(proposal.supportingObservationIds||[])],contradictingObservationIds:[...(proposal.contradictingObservationIds||[])],reasonCodes:[...(proposal.reasonCodes||[])],policyVersion:cycle.policyVersion,configDigest:cycle.configDigest,eventNamespace:cycle.namespace,idempotencyKey:'',previousEventDigest:cycle.lastEventDigest};
  if(typeof pre.eventId!=='string'||!pre.eventId)throw new TypeError('eventId required');if(!Number.isSafeInteger(pre.decidedAtMasterTime)||!Number.isSafeInteger(pre.recordedAtMasterTime))throw new TypeError('decision times required');pre.idempotencyKey=derivedIdempotencyKey(pre);if(proposal.idempotencyKey!==undefined&&proposal.idempotencyKey!==pre.idempotencyKey)throw new Error('PROPOSAL_IDEMPOTENCY_KEY_MISMATCH');const event=immutablePlainCopy({...pre,eventDigest:sha256Canonical(pre)});
  const merged=(a,b)=>[...new Set([...(a||[]),...(b||[])])];const next=immutablePlainCopy({...cycle,state:type,eventSeq:nextSeq,terminalEventId:TERMINAL.has(type)?event.eventId:null,lastEventDigest:event.eventDigest,supportingObservationIds:merged(cycle.supportingObservationIds,event.supportingObservationIds),contradictingObservationIds:merged(cycle.contradictingObservationIds,event.contradictingObservationIds),reasonCodes:merged(cycle.reasonCodes,event.reasonCodes)});return {cycle:next,event,status:'applied'};
}
module.exports={initialCycle,reduceCycle,TERMINAL};
