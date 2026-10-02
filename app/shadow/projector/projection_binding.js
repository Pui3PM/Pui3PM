'use strict';
// S-06: a projection crossing a trust boundary (evidence writer, archive, importer) is bound to the
// stored candidates and to the phase timeline it was projected from. Slot time, uncertainty, delta,
// tolerance, target, phase interval, evidence refs and phaseProof are recomputed, never trusted as data.
const {immutablePlainCopy,isId}=require('../contracts/strict_types');
const {sha256Canonical}=require('../contracts/canonical_json');
const {validateProjection}=require('../contracts/record_validators');
const {slotTargets,phaseInterval,phaseProofFor}=require('./logical25');
const PHASES=['draw','anchor','hold','expansion','release_window','follow_through','recovery'];
const MAX_TOLERANCE_US=50000;
function fail(code,detail){const e=new Error(detail?`${code}: ${detail}`:code);e.code=code;throw e;}
function validateTimeline(timeline,masterClockId){
  let tl;try{tl=immutablePlainCopy(timeline);}catch(e){fail('PROJECTION_TIMELINE_INVALID',e.message);}
  if(!tl||typeof tl!=='object'||Array.isArray(tl))fail('PROJECTION_TIMELINE_INVALID','timeline object required');
  for(const k of Object.keys(tl))if(k!=='masterClockId'&&!PHASES.includes(k))fail('PROJECTION_TIMELINE_INVALID',`unknown timeline key ${k}`);
  const phases=Object.keys(tl).filter(k=>k!=='masterClockId');
  for(const k of phases)if(!tl[k]||typeof tl[k]!=='object'||Array.isArray(tl[k]))fail('PROJECTION_TIMELINE_INVALID',`timeline.${k} must be an object`);
  if(phases.length&&tl.masterClockId!==masterClockId)fail('PROJECTION_TIMELINE_INVALID','timeline masterClockId must equal projection masterClockId');
  return tl;
}
function sameJson(a,b){return sha256Canonical(a===undefined?null:a)===sha256Canonical(b===undefined?null:b);}
function verifyProjectionBinding({projection,timeline,releaseTime,candidateById}){
  const p=validateProjection(projection);
  if(!(releaseTime===null||Number.isSafeInteger(releaseTime)))fail('PROJECTION_PHASE_MISMATCH','releaseTime must be TimeUs or null');
  const tl=validateTimeline(timeline,p.masterClockId);
  if(p.timelineDigest!==sha256Canonical(tl))fail('PROJECTION_TIMELINE_DIGEST_MISMATCH');
  const targets=slotTargets({timeline:tl,releaseTime});
  p.slots.forEach((s,i)=>{
    const t=targets[i];
    if(s.targetMasterTime!==t.targetMasterTime||!sameJson(s.targetPhaseEvidenceRefs,t.targetPhaseEvidenceRefs))fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} target does not follow the slot plan and timeline`);
    if(s.status!=='real')return;
    const cand=candidateById(s.candidateId);
    if(!cand||cand.frameUID!==s.actualFrameUID||cand.derivationId!==s.derivationId||cand.contentDigest!==s.contentDigest||cand.frameEnvelopeRef!==s.frameEnvelopeRef||cand.sourceId!==s.sourceId||cand.streamGeneration!==s.streamGeneration||cand.frameSeq!==s.frameSeq||cand.runId!==p.runId||cand.cycleId!==p.cycleId||cand.role!==p.role)fail('PROJECTION_CANDIDATE_MISMATCH',s.slotId);
    if(cand.masterClockId!==p.masterClockId||s.actualMasterTime!==cand.actualMasterTime||s.mappingUncertaintyUs!==cand.mappingUncertainty)fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} time/uncertainty not the candidate's`);
    if(s.signedDelta!==cand.actualMasterTime-s.targetMasterTime||s.toleranceUs>MAX_TOLERANCE_US||s.toleranceUs<cand.mappingUncertainty||Math.abs(s.signedDelta)>s.toleranceUs)fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} delta/tolerance`);
    if(s.phase==='release_window'){
      if(s.phaseProof!==null)fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} release slot carries a phaseProof`);
      if(!sameJson(s.actualPhaseEvidenceRefs,[...new Set([...t.targetPhaseEvidenceRefs,...(cand.phaseEvidenceRefs||[])])]))fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} evidence refs`);
      return;
    }
    const iv=phaseInterval(tl,s.phase);
    if(!iv||cand.actualMasterTime-cand.mappingUncertainty<iv.start||cand.actualMasterTime+cand.mappingUncertainty>iv.end)fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} candidate is not inside the verified ${s.phase} interval`);
    if(!sameJson(s.phaseProof,phaseProofFor(s.phase,iv.refs)))fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} phaseProof not derived from the timeline`);
    if(!sameJson(s.actualPhaseEvidenceRefs,[...new Set(t.targetPhaseEvidenceRefs)]))fail('PROJECTION_PHASE_MISMATCH',`${s.slotId} evidence refs`);
  });
  return {projection:p,timeline:tl,releaseTime};
}
module.exports={verifyProjectionBinding,validateTimeline,MAX_TOLERANCE_US};
