'use strict';
const {immutablePlainCopy,isShadowNamespace,isU64String,isId}=require('../contracts/strict_types');
const {sha256Canonical}=require('../contracts/canonical_json');
const {derivedIdempotencyKey}=require('../event_log/in_memory_event_log');
const TERMINAL=new Set(['confirmed','rejected','uncertain']);
function initialCycle({runId,cycleId,authorityRole='side',namespace,activeRoleSnapshot=[],policyVersion,configDigest,masterClockId=null}){
  if(!runId||!cycleId||!isShadowNamespace(namespace)||!policyVersion||!configDigest||!masterClockId)throw new TypeError('cycle identity/policy required');
  return immutablePlainCopy({runId,cycleId,masterClockId,authorityRole,namespace,state:'candidate',eventSeq:'0',terminalEventId:null,lastEventDigest:null,activeRoleSnapshot:[...activeRoleSnapshot],policyVersion,configDigest,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:[]});
}
function reduceCycle(cycle,proposal){
  if(!cycle||!proposal||proposal.cycleId!==cycle.cycleId||proposal.runId!==cycle.runId)throw new TypeError('cycle proposal mismatch');if(TERMINAL.has(cycle.state))return {cycle,event:null,status:'terminal_immutable'};const type=proposal.eventType;if(!['candidate','confirmed','rejected','uncertain'].includes(type))throw new TypeError('invalid eventType');
  // S-12 shadow evidence gate (contract §2.4). Shadow namespace only; this is NOT the legacy production decision.
  const trigger=proposal.trigger??'evidence';if(!['evidence','timeout','stream_reset'].includes(trigger))throw new TypeError('invalid proposal trigger');
  if(type==='confirmed'&&trigger!=='evidence'){const e=new Error('CONFIRMED_REQUIRES_EVIDENCE: a timeout/reset may produce uncertain, never confirmed');e.code='CONFIRMED_REQUIRES_EVIDENCE';throw e;}
  if(type==='confirmed'&&!(Array.isArray(proposal.supportingObservationIds)&&proposal.supportingObservationIds.length>0)){const e=new Error('CONFIRMED_REQUIRES_EVIDENCE: confirmed needs supporting observations');e.code='CONFIRMED_REQUIRES_EVIDENCE';throw e;}const nextSeq=(BigInt(cycle.eventSeq)+1n).toString();
  const pre={eventId:proposal.eventId,runId:cycle.runId,cycleId:cycle.cycleId,masterClockId:cycle.masterClockId,seq:nextSeq,eventType:type,sourceEventTime:proposal.sourceEventTime??null,sourceInterval:proposal.sourceInterval??null,uncertaintyUs:proposal.uncertaintyUs??null,decidedAtMasterTime:proposal.decidedAtMasterTime,recordedAtMasterTime:proposal.recordedAtMasterTime,supportingObservationIds:[...(proposal.supportingObservationIds||[])],contradictingObservationIds:[...(proposal.contradictingObservationIds||[])],reasonCodes:[...(proposal.reasonCodes||[])],policyVersion:cycle.policyVersion,configDigest:cycle.configDigest,eventNamespace:cycle.namespace,idempotencyKey:'',previousEventDigest:cycle.lastEventDigest};
  if(typeof pre.eventId!=='string'||!pre.eventId)throw new TypeError('eventId required');if(!Number.isSafeInteger(pre.decidedAtMasterTime)||!Number.isSafeInteger(pre.recordedAtMasterTime))throw new TypeError('decision times required');pre.idempotencyKey=derivedIdempotencyKey(pre);if(proposal.idempotencyKey!==undefined&&proposal.idempotencyKey!==pre.idempotencyKey)throw new Error('PROPOSAL_IDEMPOTENCY_KEY_MISMATCH');const event=immutablePlainCopy({...pre,eventDigest:sha256Canonical(pre)});
  const merged=(a,b)=>[...new Set([...(a||[]),...(b||[])])];const next=immutablePlainCopy({...cycle,state:type,eventSeq:nextSeq,terminalEventId:TERMINAL.has(type)?event.eventId:null,lastEventDigest:event.eventDigest,supportingObservationIds:merged(cycle.supportingObservationIds,event.supportingObservationIds),contradictingObservationIds:merged(cycle.contradictingObservationIds,event.contradictingObservationIds),reasonCodes:merged(cycle.reasonCodes,event.reasonCodes)});return {cycle:next,event,status:'applied'};
}
// S-12: Side generation change / source clock discontinuity -> a non-terminal cycle becomes
// uncertain(reason=authority_stream_reset). The next cycle must reacquire; history is not continued.
const STREAM_EVENT_KINDS=new Set(['side_generation_changed','clock_discontinuity']);
function applyStreamEvent(cycle,streamEvent){
  if(!cycle||!streamEvent||!STREAM_EVENT_KINDS.has(streamEvent.kind))throw new TypeError('stream event kind must be side_generation_changed|clock_discontinuity');
  if(TERMINAL.has(cycle.state))return {cycle,event:null,status:'terminal_immutable'};
  const r=reduceCycle(cycle,{runId:cycle.runId,cycleId:cycle.cycleId,eventType:'uncertain',trigger:'stream_reset',eventId:streamEvent.eventId,sourceEventTime:streamEvent.sourceEventTime??null,decidedAtMasterTime:streamEvent.decidedAtMasterTime,recordedAtMasterTime:streamEvent.recordedAtMasterTime,supportingObservationIds:[],contradictingObservationIds:[],reasonCodes:['authority_stream_reset',streamEvent.kind]});
  return {...r,status:'stream_reset'};
}
// S-12: Side inference results may arrive out of order. They are released in Side frameSeq order within one
// generation, waiting at most maxWaitUs of arrival time (virtual clock supplied by the caller; no timers).
// After the wait the missing seqs are skipped with an explicit gap event. Results older than the watermark are
// returned as `late` (kept for offline reassessment) and are never applied. Pure: state in, state + outputs out.
const REORDER_POLICY_VERSION='shadow-reorder-v1-200ms';
function initialReorderState({generation,startSeq='0',maxWaitUs=200000}={}){
  if(!isId(generation)||!isU64String(startSeq)||!Number.isSafeInteger(maxWaitUs)||maxWaitUs<0)throw new TypeError('reorder state requires generation, U64 startSeq, maxWaitUs');
  return Object.freeze({policyVersion:REORDER_POLICY_VERSION,generation,nextSeq:startSeq,maxWaitUs,waiting:Object.freeze([])});
}
function drain(state,outputs){let next=BigInt(state.nextSeq);const waiting=[...state.waiting];for(;;){const i=waiting.findIndex(w=>BigInt(w.frameSeq)===next);if(i<0)break;outputs.push(Object.freeze({kind:'result',frameSeq:waiting[i].frameSeq,result:waiting[i].result}));waiting.splice(i,1);next+=1n;}return Object.freeze({...state,nextSeq:next.toString(),waiting:Object.freeze(waiting)});}
function reorderAdvance(state,nowUs){
  if(!Number.isSafeInteger(nowUs))throw new TypeError('nowUs required');const outputs=[];let s=state;
  for(;;){
    if(!s.waiting.length)break;const oldest=s.waiting.reduce((a,b)=>a.arrivalUs<=b.arrivalUs?a:b);if(nowUs-oldest.arrivalUs<s.maxWaitUs)break;
    const lowest=s.waiting.reduce((a,b)=>BigInt(a.frameSeq)<=BigInt(b.frameSeq)?a:b);
    outputs.push(Object.freeze({kind:'gap',generation:s.generation,fromSeq:s.nextSeq,toSeq:(BigInt(lowest.frameSeq)-1n).toString(),policyVersion:s.policyVersion,atUs:nowUs}));
    s=drain(Object.freeze({...s,nextSeq:lowest.frameSeq}),outputs);
  }
  return {state:s,outputs:Object.freeze(outputs)};
}
function reorderPush(state,{generation,frameSeq,arrivalUs,result}){
  if(!isU64String(frameSeq)||!Number.isSafeInteger(arrivalUs))throw new TypeError('reorder input requires U64 frameSeq and arrivalUs');
  if(generation!==state.generation)return {state,outputs:Object.freeze([Object.freeze({kind:'stale_generation',generation,frameSeq,result})])};
  const seq=BigInt(frameSeq);
  if(seq<BigInt(state.nextSeq)||state.waiting.some(w=>w.frameSeq===frameSeq)){const adv=reorderAdvance(state,arrivalUs);return {state:adv.state,outputs:Object.freeze([...adv.outputs,Object.freeze({kind:'late',generation,frameSeq,result})])};}
  const outputs=[];let s=drain(Object.freeze({...state,waiting:Object.freeze([...state.waiting,Object.freeze({frameSeq,arrivalUs,result})])}),outputs);
  const adv=reorderAdvance(s,arrivalUs);return {state:adv.state,outputs:Object.freeze([...outputs,...adv.outputs])};
}
module.exports={initialCycle,reduceCycle,applyStreamEvent,initialReorderState,reorderPush,reorderAdvance,REORDER_POLICY_VERSION,TERMINAL};
