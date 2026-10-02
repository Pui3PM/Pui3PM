'use strict';
const T=require('./strict_types');
const {frameUID}=require('./identity');
const PLAN='logical25-v1-shadow';
const EXPECTED_PHASES=[...Array(2).fill('draw'),...Array(3).fill('anchor'),...Array(3).fill('hold'),...Array(2).fill('expansion'),...Array(9).fill('release_window'),...Array(5).fill('follow_through'),'recovery'];
function fail(m){const e=new TypeError(m);e.code='SHADOW_RECORD_INVALID';throw e;}
function ids(a,label){if(!Array.isArray(a)||!a.every(T.isId))fail(`${label} must be ID[]`);}
function requireKeys(x,req,label){if(!x||typeof x!=='object'||Array.isArray(x))fail(`${label} object required`);for(const k of req)T.requireField(x,k);}
function strictKeys(x,allowed,label){try{T.assertNoUnknownFields(x,allowed,label);}catch(e){fail(e.message);}}
function time(v,label,{nullable=true,nonnegative=false}={}){if(v===null&&nullable)return null;if(!Number.isSafeInteger(v)||(nonnegative&&v<0))fail(`${label} must be ${nullable?'TimeUs/null':'TimeUs'}`);return v;}
function interval(v,label){requireKeys(v,['start','end','clockDomain'],label);strictKeys(v,['start','end','clockDomain'],label);time(v.start,`${label}.start`);time(v.end,`${label}.end`);if(!T.isId(v.clockDomain))fail(`${label}.clockDomain`);if(v.start!==null&&v.end!==null&&v.start>v.end)fail(`${label} start>end`);return v;}
function validateObservation(x){
  const req=['observationId','runId','masterClockId','kind','role','frameUIDs','sensorSampleUIDs','sourceInterval','inferenceStart','inferenceEnd','receivedAt','producer','status','confidence','payloadSchema','payload','reasonCodes'];
  requireKeys(x,req,'observation');strictKeys(x,[...req,'extensions'],'observation');
  for(const k of ['observationId','runId','masterClockId','payloadSchema'])if(!T.isId(x[k]))fail(`invalid ${k}`);
  if(!['pose','motion','hand','sensor'].includes(x.kind))fail('invalid observation kind');
  if(!(x.role===null||['side','overhead','rear'].includes(x.role)))fail('invalid role');
  if(!Array.isArray(x.frameUIDs)||!x.frameUIDs.every(T.isFrameUID))fail('frameUIDs must be FrameUID[]');
  ids(x.sensorSampleUIDs,'sensorSampleUIDs');interval(x.sourceInterval,'sourceInterval');
  time(x.inferenceStart,'inferenceStart');time(x.inferenceEnd,'inferenceEnd');time(x.receivedAt,'receivedAt',{nullable:false});
  if(x.inferenceStart!==null&&x.inferenceEnd!==null&&x.inferenceStart>x.inferenceEnd)fail('inferenceStart>inferenceEnd');
  if(!['valid','partial','unobservable','invalid'].includes(x.status))fail('invalid status');
  if(!(x.confidence===null||(T.isFiniteNumber(x.confidence)&&x.confidence>=0&&x.confidence<=1)))fail('invalid confidence');
  ids(x.reasonCodes,'reasonCodes');return T.immutablePlainCopy(x);
}
function candidateAllowed(){return ['candidateId','frameUID','frameEnvelopeRef','frameSeq','sourcePTS','derivationId','runId','cycleId','role','masterClockId','sourceId','streamGeneration','payloadRef','payloadState','contentDigest','actualMasterTime','mappingStatus','mappingUncertainty','decodeValid','width','height','measuredFPS','phaseEvidenceRefs','sourceTimebase','clockId','timestampKind','extensions'];}
function validateEvidenceCandidate(x,{runId=null,cycleId=null,role=null}={}){
  const req=['candidateId','frameUID','frameEnvelopeRef','frameSeq','sourcePTS','derivationId','runId','cycleId','role','masterClockId','sourceId','streamGeneration','payloadRef','payloadState','contentDigest','actualMasterTime','mappingStatus','mappingUncertainty','decodeValid','width','height','measuredFPS','phaseEvidenceRefs'];
  requireKeys(x,req,'candidate');strictKeys(x,candidateAllowed(),'candidate');
  for(const k of ['candidateId','frameEnvelopeRef','derivationId','runId','cycleId','masterClockId','sourceId','streamGeneration','payloadRef'])if(!T.isId(x[k]))fail(`candidate ${k} required`);
  if(!T.isFrameUID(x.frameUID))fail('candidate frameUID invalid');if(!T.isU64String(x.frameSeq))fail('candidate frameSeq invalid');if(!(x.sourcePTS===null||T.isI64String(x.sourcePTS)))fail('candidate sourcePTS invalid');
  if(runId&&x.runId!==runId||cycleId&&x.cycleId!==cycleId||role&&x.role!==role)fail('candidate scope mismatch');if(!['side','overhead','rear'].includes(x.role))fail('candidate role');
  if(x.payloadState!=='available'||x.decodeValid!==true)fail('candidate payload/decode');if(x.mappingStatus!=='validated'||!Number.isSafeInteger(x.actualMasterTime)||!Number.isSafeInteger(x.mappingUncertainty)||x.mappingUncertainty<0||x.mappingUncertainty>50000)fail('candidate mapping');
  if(!T.isSha256(x.contentDigest))fail('candidate digest');if(!Number.isInteger(x.width)||x.width<=0||!Number.isInteger(x.height)||x.height<=0)fail('candidate dimensions');if(!(x.measuredFPS===null||(T.isFiniteNumber(x.measuredFPS)&&x.measuredFPS>0)))fail('candidate measuredFPS');ids(x.phaseEvidenceRefs,'phaseEvidenceRefs');
  const computed=frameUID({runId:x.runId,sourceId:x.sourceId,streamGeneration:x.streamGeneration,frameSeq:x.frameSeq});if(computed!==x.frameUID)fail('candidate FrameUID tuple mismatch');
  return T.immutablePlainCopy(x);
}
function validatePhaseClaim(x,{runId=null,cycleId=null,role=null}={}){
  const req=['claimId','runId','cycleId','role','phase','frameUID','evidenceRef'];requireKeys(x,req,'phaseClaim');strictKeys(x,[...req,'extensions'],'phaseClaim');
  for(const k of ['claimId','runId','cycleId','evidenceRef'])if(!T.isId(x[k]))fail(`phaseClaim ${k}`);if(!T.isFrameUID(x.frameUID))fail('phaseClaim frameUID');if(!['side','overhead','rear'].includes(x.role))fail('phaseClaim role');if(!['draw','anchor','hold','expansion','release_window','follow_through','recovery'].includes(x.phase))fail('phaseClaim phase');if(runId&&x.runId!==runId||cycleId&&x.cycleId!==cycleId||role&&x.role!==role)fail('phaseClaim scope mismatch');return T.immutablePlainCopy(x);
}
function validateShotEvent(x){
  const req=['eventId','runId','cycleId','masterClockId','seq','eventType','eventNamespace','idempotencyKey','eventDigest','policyVersion','configDigest','previousEventDigest','sourceEventTime','sourceInterval','uncertaintyUs','decidedAtMasterTime','recordedAtMasterTime','supportingObservationIds','contradictingObservationIds','reasonCodes'];
  requireKeys(x,req,'event');strictKeys(x,[...req,'extensions'],'event');
  for(const k of ['eventId','runId','cycleId','masterClockId','eventNamespace','idempotencyKey','policyVersion','configDigest'])if(!T.isId(x[k]))fail(`event ${k} required`);
  if(!T.isSha256(x.eventDigest)||!(x.previousEventDigest===null||T.isSha256(x.previousEventDigest)))fail('event digest/chain');if(!T.isU64String(x.seq)||!['candidate','confirmed','rejected','uncertain'].includes(x.eventType))fail('event seq/type');
  time(x.sourceEventTime,'sourceEventTime');if(x.sourceInterval!==null)interval(x.sourceInterval,'sourceInterval');time(x.uncertaintyUs,'uncertaintyUs',{nonnegative:true});time(x.decidedAtMasterTime,'decidedAtMasterTime',{nullable:false});time(x.recordedAtMasterTime,'recordedAtMasterTime',{nullable:false});if(x.recordedAtMasterTime<x.decidedAtMasterTime)fail('recordedAtMasterTime before decision');
  ids(x.supportingObservationIds,'supportingObservationIds');ids(x.contradictingObservationIds,'contradictingObservationIds');ids(x.reasonCodes,'reasonCodes');return T.immutablePlainCopy(x);
}
function validateProjection(x){
  const req=['projectionId','projectionVersion','planVersion','runId','cycleId','masterClockId','role','slots','uniqueRealCount','missingCount','inactiveCount'];requireKeys(x,req,'projection');strictKeys(x,[...req,'inputCandidateCount','eligibleCandidateCount','inputCandidateDigest','timelineDigest','configDigest','extensions'],'projection');
  if(!T.isId(x.projectionId)||!Number.isInteger(x.projectionVersion)||x.projectionVersion<1||x.planVersion!==PLAN||!T.isId(x.runId)||!T.isId(x.cycleId)||!T.isId(x.masterClockId)||!['side','overhead','rear'].includes(x.role)||!Array.isArray(x.slots)||x.slots.length!==25)fail('invalid projection');
  const seen=new Set();let real=0,missing=0,inactive=0;
  x.slots.forEach((s,i)=>{
    const reqS=['slotId','phase','targetMasterTime','targetPhaseEvidenceRefs','status','actualFrameUID','derivationId','candidateId','actualMasterTime','signedDelta','missingReason','mappingUncertaintyUs','toleranceUs','actualPhaseEvidenceRefs','selectionReason','phaseProof'];requireKeys(s,reqS,`slot ${i}`);strictKeys(s,[...reqS,'sourceId','streamGeneration','frameSeq','contentDigest','frameEnvelopeRef','contributingReasons','runId','cycleId','masterClockId','role','projectionId','projectionVersion','planVersion'],`slot ${i}`);
    if(s.slotId!==`S${String(i+1).padStart(2,'0')}`||s.phase!==EXPECTED_PHASES[i])fail('projection slot plan mismatch');if(!Array.isArray(s.targetPhaseEvidenceRefs)||!s.targetPhaseEvidenceRefs.every(T.isId))fail('target phase refs');time(s.targetMasterTime,'targetMasterTime');if(!['real','missing','inactive'].includes(s.status))fail('invalid slot status');
    if(s.status==='real'){real++;if(!T.isFrameUID(s.actualFrameUID)||seen.has(s.actualFrameUID))fail('projection duplicate/invalid FrameUID');seen.add(s.actualFrameUID);for(const k of ['derivationId','candidateId','sourceId','streamGeneration','frameEnvelopeRef'])if(!T.isId(s[k]))fail(`real slot ${k}`);if(!T.isU64String(s.frameSeq)||!T.isSha256(s.contentDigest))fail('real slot identity metadata');let tupleUid;try{tupleUid=frameUID({runId:x.runId,sourceId:s.sourceId,streamGeneration:s.streamGeneration,frameSeq:s.frameSeq});}catch(e){fail('real slot identity tuple invalid');}if(tupleUid!==s.actualFrameUID)fail('real slot FrameUID tuple mismatch');time(s.actualMasterTime,'actualMasterTime',{nullable:false});time(s.signedDelta,'signedDelta',{nullable:false});time(s.mappingUncertaintyUs,'mappingUncertaintyUs',{nullable:false,nonnegative:true});time(s.toleranceUs,'toleranceUs',{nullable:false,nonnegative:true});if(!Number.isSafeInteger(s.targetMasterTime)||s.signedDelta!==s.actualMasterTime-s.targetMasterTime)fail('real slot signedDelta mismatch');if(s.missingReason!==null)fail('real slot missingReason must be null');ids(s.actualPhaseEvidenceRefs,'actualPhaseEvidenceRefs');if(s.phase!=='release_window'){if(!s.phaseProof||s.phaseProof.phase!==s.phase||s.phaseProof.intervalCheck!=='inside'||!Array.isArray(s.phaseProof.timelineRefs)||!s.phaseProof.timelineRefs.every(T.isId))fail('real slot phaseProof');if(s.phase==='anchor'&&s.phaseProof.anchorIntervalKind!=='settled-anchor-interval')fail('anchor settled proof required');}else if(!(s.phaseProof===null||typeof s.phaseProof==='object'))fail('release phaseProof');
    }else{if(s.status==='missing')missing++;else inactive++;for(const k of ['actualFrameUID','derivationId','candidateId','actualMasterTime','signedDelta','mappingUncertaintyUs','toleranceUs','sourceId','streamGeneration','frameSeq','contentDigest','frameEnvelopeRef'])if(Object.prototype.hasOwnProperty.call(s,k)&&s[k]!==null)fail('non-real slot must not reference frame');if(!T.isId(s.missingReason))fail('missing/inactive reason required');if(s.phaseProof!==null)fail('non-real phaseProof must be null');}
  });
  if(x.uniqueRealCount!==real||x.missingCount!==missing||x.inactiveCount!==inactive||real+missing+inactive!==25)fail('projection counts mismatch');return T.immutablePlainCopy(x);
}
module.exports={PLAN,EXPECTED_PHASES,validateObservation,validateEvidenceCandidate,validatePhaseClaim,validateShotEvent,validateProjection};
