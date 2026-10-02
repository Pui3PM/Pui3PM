'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const {immutablePlainCopy,isShadowNamespace,shadowNamespacePolicy}=require('../contracts/strict_types');
const {validateEvidenceCandidate,validateProjection,validatePhaseClaim}=require('../contracts/record_validators');
function keyTuple(parts){return JSON.stringify(parts);}
function commandFingerprint(c){return sha256Canonical({namespace:c.namespace,runId:c.runId,cycleId:c.cycleId,role:c.role,operation:c.operation,expectedRecordVersion:c.expectedRecordVersion,payloadDigest:c.payloadDigest});}
function validateCandidate(item,c){return validateEvidenceCandidate(item,{runId:c.runId,cycleId:c.cycleId,role:c.role});}
class InMemoryEvidenceWriter{
  constructor({allowedNamespacePrefix,maxCommandMemos=10000}={}){this.allowedNamespacePrefix=shadowNamespacePolicy(allowedNamespacePrefix,'InMemoryEvidenceWriter');this.maxCommandMemos=maxCommandMemos;this.records=new Map();this.commands=new Map();this.commandScopes=new Map();this.quarantine=[];}
  _key(c){return keyTuple([c.namespace,c.runId,c.cycleId,c.role]);}
  execute(c){
    for(const k of ['commandId','namespace','runId','cycleId','role','operation','payloadDigest'])if(typeof c?.[k]!=='string'||!c[k])throw new TypeError(`command ${k} required`);if(!isShadowNamespace(c.namespace)||!c.namespace.startsWith(this.allowedNamespacePrefix))throw new Error('WRITER_NAMESPACE_DENIED');if(!['side','overhead','rear'].includes(c.role))throw new TypeError('invalid command role');if(!['addCandidates','addPhaseEvidence','saveProjection','finalizeCycle'].includes(c.operation))throw new TypeError('invalid operation');
    const payloadCopy=immutablePlainCopy(c.payload??null),digest=sha256Canonical(payloadCopy);if(digest!==c.payloadDigest)throw new Error('PAYLOAD_DIGEST_MISMATCH');const fingerprint=commandFingerprint(c),memoKey=keyTuple([c.namespace,c.runId,c.cycleId,c.role,c.commandId]),scopeKey=this.commandScopes.get(c.commandId);if(scopeKey&&scopeKey!==memoKey)throw new Error('COMMAND_SCOPE_CONFLICT');const prevCmd=this.commands.get(memoKey);if(prevCmd){if(prevCmd.fingerprint!==fingerprint)throw new Error('COMMAND_ID_CONFLICT');return prevCmd.result;}if(this.commands.size>=this.maxCommandMemos)throw new Error('COMMAND_MEMO_CAPACITY');
    const key=this._key(c),old=this.records.get(key)||{version:0,candidates:new Map(),phaseClaims:new Map(),projections:new Map(),finalized:false};if(!Number.isInteger(c.expectedRecordVersion)||c.expectedRecordVersion!==old.version)throw new Error('RECORD_VERSION_CONFLICT');if(old.finalized&&c.operation!=='finalizeCycle')throw new Error('EVIDENCE_RECORD_FINALIZED');
    if(c.operation==='finalizeCycle'&&old.finalized)return Object.freeze({status:'existing',recordVersion:old.version,commandId:c.commandId});
    const next={version:old.version,candidates:new Map(old.candidates),phaseClaims:new Map(old.phaseClaims),projections:new Map(old.projections),finalized:old.finalized};const pendingQuarantine=[];
    if(c.operation==='addCandidates'){
      if(!Array.isArray(payloadCopy?.candidates))throw new TypeError('candidates array required');for(const raw of payloadCopy.candidates){const item=validateCandidate(raw,c),d=sha256Canonical(item),prior=next.candidates.get(item.candidateId);if(prior&&prior.digest!==d){pendingQuarantine.push({kind:'candidate_conflict',candidateId:item.candidateId});throw new Error('CANDIDATE_ID_CONFLICT');}for(const entry of next.candidates.values())if(entry.value.frameUID===item.frameUID){const a=entry.value,b=item;if(a.sourceId!==b.sourceId||a.streamGeneration!==b.streamGeneration||a.frameSeq!==b.frameSeq||a.sourcePTS!==b.sourcePTS||a.contentDigest!==b.contentDigest||a.frameEnvelopeRef!==b.frameEnvelopeRef)throw new Error('FRAME_UID_CONFLICT');}if(!prior)next.candidates.set(item.candidateId,{digest:d,value:item});}
    }else if(c.operation==='addPhaseEvidence'){
      if(!Array.isArray(payloadCopy?.claims))throw new TypeError('claims array required');for(const raw of payloadCopy.claims){const item=validatePhaseClaim(raw,{runId:c.runId,cycleId:c.cycleId,role:c.role}),d=sha256Canonical(item),prior=next.phaseClaims.get(item.claimId);if(prior&&prior.digest!==d)throw new Error('PHASE_CLAIM_CONFLICT');if(!prior)next.phaseClaims.set(item.claimId,{digest:d,value:item});}
    }else if(c.operation==='saveProjection'){
      const p=validateProjection(payloadCopy?.projection);if(p.runId!==c.runId||p.cycleId!==c.cycleId||p.role!==c.role)throw new TypeError('projection scope/identity required');for(const s of p.slots){if(s.status!=='real')continue;const cand=next.candidates.get(s.candidateId)?.value;if(!cand||cand.frameUID!==s.actualFrameUID||cand.derivationId!==s.derivationId||cand.contentDigest!==s.contentDigest||cand.frameEnvelopeRef!==s.frameEnvelopeRef||cand.sourceId!==s.sourceId||cand.streamGeneration!==s.streamGeneration||cand.frameSeq!==s.frameSeq)throw new Error('PROJECTION_CANDIDATE_MISMATCH');}
      const d=sha256Canonical(p),prior=next.projections.get(p.projectionId);if(prior&&prior.digest!==d)throw new Error('PROJECTION_ID_CONFLICT');if(!prior)next.projections.set(p.projectionId,{digest:d,value:p});
    }else if(c.operation==='finalizeCycle'){
      if(next.projections.size===0)throw new Error('FINALIZE_REQUIRES_PROJECTION');next.finalized=true;
    }
    next.version=old.version+1;this.records.set(key,next);this.quarantine.push(...pendingQuarantine);const result=Object.freeze({status:'committed',recordVersion:next.version,commandId:c.commandId});this.commands.set(memoKey,{fingerprint,result});this.commandScopes.set(c.commandId,memoKey);return result;
  }
  snapshot({namespace,runId,cycleId,role}){const r=this.records.get(keyTuple([namespace,runId,cycleId,role]));if(!r)return null;return immutablePlainCopy({version:r.version,finalized:r.finalized,candidates:[...r.candidates.values()].map(x=>x.value),phaseClaims:[...r.phaseClaims.values()].map(x=>x.value),projections:[...r.projections.values()].map(x=>x.value)});}
}
module.exports={InMemoryEvidenceWriter};
