'use strict';
const {immutablePlainCopy}=require('../contracts/strict_types');
const {validateFrameEnvelope}=require('../contracts/contract_v1');
const {sha256Canonical}=require('../contracts/canonical_json');
function identityRecord(f){return {frameUID:f.frameUID,sourceId:f.sourceId,streamGeneration:f.streamGeneration,frameSeq:f.frameSeq,sourcePTS:f.sourcePTS,contentDigest:f.contentDigest??null};}
class RoleRing{
  constructor({role,retentionUs=6500000,byteBudget=64*1024*1024,maxLeasedBytes=null,leaseTtlUs=1000000}={}){
    if(!['side','overhead','rear'].includes(role))throw new TypeError('valid role required');
    if(!Number.isSafeInteger(retentionUs)||retentionUs<=0||!Number.isSafeInteger(byteBudget)||byteBudget<=0||!Number.isSafeInteger(leaseTtlUs)||leaseTtlUs<=0)throw new TypeError('invalid ring limits');
    this.role=role;this.retentionUs=retentionUs;this.byteBudget=byteBudget;this.maxLeasedBytes=maxLeasedBytes??Math.max(1,Math.floor(byteBudget*0.75));if(!Number.isSafeInteger(this.maxLeasedBytes)||this.maxLeasedBytes<=0||this.maxLeasedBytes>=byteBudget)throw new TypeError('maxLeasedBytes must reserve unleased ring capacity');this.leaseTtlUs=leaseTtlUs;this.rows=[];this.byUid=new Map();this.totalBytes=0;this.latestBookTime=null;this.masterClockId=null;
    this.metrics={added:0,duplicateDelivery:0,uidConflict:0,evicted:0,evictedBytes:0,rejectedAdmission:0,overBudgetPinned:0,expiredOnAdvance:0,leaseRevoked:0};
  }
  _bookTime(frame){
    if(frame.mappingStatus==='validated'&&Number.isSafeInteger(frame.mappedMasterTime))return frame.mappedMasterTime;
    if(Number.isSafeInteger(frame.arrivalTime?.masterTime))return frame.arrivalTime.masterTime;
    throw new TypeError('ring requires a mapped master-domain source or arrival time');
  }
  _leasedBytes(){return this.rows.reduce((n,r)=>n+(r.leases>0?r.byteLength:0),0);}
  _expireLeases(nowUs){for(const r of this.rows){if(r.leases>0&&Number.isSafeInteger(r.leaseUntilUs)&&r.leaseUntilUs<=nowUs){r.leases=0;r.leaseUntilUs=null;this.metrics.leaseRevoked++;}}}
  _evict(nowUs,{countExpiry=false}={}){
    this._expireLeases(nowUs);const cutoff=nowUs-this.retentionUs;let progress=true;
    while(progress){progress=false;for(let i=0;i<this.rows.length;i++){
      const r=this.rows[i],dueTime=r.bookTimeUs<cutoff,dueBytes=this.totalBytes>this.byteBudget;if(!dueTime&&!dueBytes)continue;
      if(r.leases>0){if(dueBytes)this.metrics.overBudgetPinned++;continue;}
      this.rows.splice(i,1);this.byUid.delete(r.frame.frameUID);this.totalBytes-=r.byteLength;r.evicted=true;this.metrics.evicted++;this.metrics.evictedBytes+=r.byteLength;if(countExpiry&&dueTime)this.metrics.expiredOnAdvance++;progress=true;break;
    }}
  }
  add(frame,{byteLength}={}){
    const validated=validateFrameEnvelope(frame);if(validated.role!==this.role)throw new TypeError('frame role mismatch');if(!Number.isSafeInteger(byteLength)||byteLength<=0)throw new TypeError('byteLength must be explicit positive integer');
    if(this.masterClockId===null)this.masterClockId=validated.masterClockId;else if(validated.masterClockId!==this.masterClockId)throw new Error('RING_MASTER_CLOCK_CONFLICT');
    const identityDigest=sha256Canonical(identityRecord(validated)),existing=this.byUid.get(validated.frameUID);if(existing){if(existing.identityDigest!==identityDigest){this.metrics.uidConflict++;throw new Error('FRAME_UID_CONFLICT');}this.metrics.duplicateDelivery++;return existing.snapshot;}
    if(byteLength>this.byteBudget){this.metrics.rejectedAdmission++;return Object.freeze({admitted:false,reason:'frame_exceeds_budget'});}
    const bt=this._bookTime(validated);this.latestBookTime=this.latestBookTime===null?bt:Math.max(this.latestBookTime,bt);this._evict(this.latestBookTime);
    if(bt<this.latestBookTime-this.retentionUs){this.metrics.rejectedAdmission++;return Object.freeze({admitted:false,reason:'buffer_expired'});}
    while(this.totalBytes+byteLength>this.byteBudget){const idx=this.rows.findIndex(r=>r.leases===0);if(idx<0){this.metrics.rejectedAdmission++;return Object.freeze({admitted:false,reason:'capacity_pinned'});}const r=this.rows[idx];this.rows.splice(idx,1);this.byUid.delete(r.frame.frameUID);this.totalBytes-=r.byteLength;r.evicted=true;this.metrics.evicted++;this.metrics.evictedBytes+=r.byteLength;}
    const frozenFrame=immutablePlainCopy(validated);const row={frame:frozenFrame,identityDigest,byteLength,bookTimeUs:bt,leases:0,leaseUntilUs:null,evicted:false,snapshot:null};row.snapshot=Object.freeze({frame:frozenFrame,byteLength,bookTimeUs:bt,retentionClock:'master'});this.rows.push(row);this.byUid.set(frozenFrame.frameUID,row);this.totalBytes+=byteLength;this.metrics.added++;this._evict(this.latestBookTime);return row.snapshot;
  }
  advance(masterTimeUs){if(!Number.isSafeInteger(masterTimeUs))throw new TypeError('advance master time required');this.latestBookTime=this.latestBookTime===null?masterTimeUs:Math.max(this.latestBookTime,masterTimeUs);this._evict(this.latestBookTime,{countExpiry:true});return this.snapshot();}
  lease(frameUID,{ttlUs=this.leaseTtlUs}={}){const row=this.byUid.get(frameUID);if(!row||row.evicted)return null;if(!Number.isSafeInteger(ttlUs)||ttlUs<=0)throw new TypeError('lease ttl required');if(this._leasedBytes()+row.byteLength>this.maxLeasedBytes)throw new Error('RING_LEASE_BUDGET_EXCEEDED');row.leases++;const now=this.latestBookTime??row.bookTimeUs;row.leaseUntilUs=Math.max(row.leaseUntilUs??0,now+ttlUs);let done=false;return Object.freeze({frame:row.frame,retentionClock:'master',expiresAtUs:row.leaseUntilUs,release:()=>{if(done)return;done=true;row.leases=Math.max(0,row.leases-1);if(row.leases===0)row.leaseUntilUs=null;if(this.latestBookTime!==null)this._evict(this.latestBookTime);}});}
  snapshot(){return Object.freeze({role:this.role,count:this.rows.length,totalBytes:this.totalBytes,retentionUs:this.retentionUs,byteBudget:this.byteBudget,leaseTtlUs:this.leaseTtlUs,leasedBytes:this._leasedBytes(),masterClockId:this.masterClockId,metrics:Object.freeze({...this.metrics}),frames:Object.freeze(this.rows.map(r=>r.frame))});}
}
module.exports={RoleRing,identityRecord};
