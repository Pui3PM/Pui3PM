'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const {validateShotEvent}=require('../contracts/record_validators');
const {isShadowNamespace,shadowNamespacePolicy}=require('../contracts/strict_types');
function scopeKey(e){return JSON.stringify([e.eventNamespace,e.runId,e.cycleId]);}
function idemKey(e){return JSON.stringify([e.eventNamespace,e.runId,e.cycleId,e.idempotencyKey]);}
function recomputeDigest(event){const {eventDigest,...body}=event;return sha256Canonical(body);}
function derivedIdempotencyKey(e){return sha256Canonical({namespace:e.eventNamespace,runId:e.runId,cycleId:e.cycleId,seq:e.seq,eventType:e.eventType,policyVersion:e.policyVersion});}
class InMemoryShotEventLog{
  constructor({allowedNamespacePrefix}={}){this.allowedNamespacePrefix=shadowNamespacePolicy(allowedNamespacePrefix,'InMemoryShotEventLog');this.byCycle=new Map();this.byIdempotency=new Map();}
  append(event,{expectedPreviousSeq=null}={}){
    const frozen=validateShotEvent(event);if(!isShadowNamespace(frozen.eventNamespace)||!frozen.eventNamespace.startsWith(this.allowedNamespacePrefix))throw new Error('EVENT_NAMESPACE_DENIED');if(frozen.eventType==='confirmed'&&frozen.supportingObservationIds.length===0)throw new Error('CONFIRMED_REQUIRES_EVIDENCE');
    const derived=derivedIdempotencyKey(frozen);if(frozen.idempotencyKey!==derived)throw new Error('EVENT_IDEMPOTENCY_KEY_MISMATCH');if(recomputeDigest(frozen)!==frozen.eventDigest)throw new Error('EVENT_DIGEST_MISMATCH');
    const sk=scopeKey(frozen),ik=idemKey(frozen),idem=this.byIdempotency.get(ik);if(idem){if(idem.eventDigest!==frozen.eventDigest||sha256Canonical(idem)!==sha256Canonical(frozen))throw new Error('IDEMPOTENCY_CONFLICT');return {status:'existing',event:idem};}
    const rows=this.byCycle.get(sk)||[],prev=rows.at(-1)||null;if(expectedPreviousSeq!==null&&String(prev?.seq||'0')!==String(expectedPreviousSeq))throw new Error('EVENT_SEQ_CONFLICT');if(BigInt(frozen.seq)!==BigInt(prev?.seq||'0')+1n)throw new Error('EVENT_SEQ_GAP');if((frozen.previousEventDigest??null)!==(prev?.eventDigest??null))throw new Error('EVENT_CHAIN_CONFLICT');if(prev&&['confirmed','rejected','uncertain'].includes(prev.eventType))throw new Error('TERMINAL_ALREADY_COMMITTED');rows.push(frozen);this.byCycle.set(sk,rows);this.byIdempotency.set(ik,frozen);return {status:'appended',event:frozen};
  }
  cycle(cycleId,{namespace,runId}={}){if(typeof namespace!=='string'||!namespace||typeof runId!=='string'||!runId)throw new TypeError('cycle query requires namespace and runId');return Object.freeze([...(this.byCycle.get(JSON.stringify([namespace,runId,cycleId]))||[])]);}
}
module.exports={InMemoryShotEventLog,recomputeDigest,derivedIdempotencyKey};
