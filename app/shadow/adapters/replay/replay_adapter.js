'use strict';
const {SCHEMA,validateFrameEnvelope}=require('../../contracts/contract_v1');
const {frameUID}=require('../../contracts/identity');
const {mapBoundSourceTime}=require('../../contracts/clock_mapper');
const {isU64String,isI64String,isId,immutablePlainCopy}=require('../../contracts/strict_types');
const {sha256Canonical}=require('../../contracts/canonical_json');

function requiredSampleField(sample,key){if(!Object.prototype.hasOwnProperty.call(sample,key))throw new TypeError(`replay sample missing ${key}`);return sample[key];}
function validateDigest(v){return v===null||(typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v));}
function identityRecord(raw){return immutablePlainCopy({frameUID:raw.frameUID,runId:raw.runId,sourceId:raw.sourceId,streamGeneration:raw.streamGeneration,frameSeq:raw.frameSeq,sourcePTS:raw.sourcePTS,contentDigest:raw.contentDigest,payloadRef:raw.payloadRef});}
class ReplayAdapter{
  constructor({runId,masterClockId,sourceId,streamGeneration,role,createdByVersion,backendVersion,mapping=null}={}){
    for(const [k,v] of Object.entries({runId,masterClockId,sourceId,streamGeneration,createdByVersion,backendVersion}))if(!isId(v))throw new TypeError(`${k} required`);
    if(!['side','overhead','rear'].includes(role))throw new TypeError('role required');
    this.cfg={runId,masterClockId,sourceId,streamGeneration,role,createdByVersion,backendVersion};this.mapping=mapping;this.uidRecords=new Map();this.lastFrameSeq=null;this.lastSourcePTS=null;
  }
  envelope(sample){
    if(!sample||typeof sample!=='object')throw new TypeError('sample required');
    const frameSeq=requiredSampleField(sample,'frameSeq');if(!isU64String(frameSeq))throw new TypeError('frameSeq must be canonical U64 string');
    const width=requiredSampleField(sample,'width'),height=requiredSampleField(sample,'height'),mirror=requiredSampleField(sample,'mirror'),arrivalTime=requiredSampleField(sample,'arrivalTime');
    if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0)throw new TypeError('replay dimensions must be explicit positive integers');
    if(!(mirror===null||typeof mirror==='boolean'))throw new TypeError('replay mirror must be explicit boolean/null');
    const payloadRef=requiredSampleField(sample,'payloadRef');const contentDigest=requiredSampleField(sample,'contentDigest');
    if(!(payloadRef===null||isId(payloadRef)))throw new TypeError('payloadRef must be ID/null');if(!validateDigest(contentDigest))throw new TypeError('contentDigest must be sha256/null');
    if((payloadRef===null)!==(contentDigest===null))throw new TypeError('payloadRef/contentDigest must both be known or both null');
    const quality=requiredSampleField(sample,'quality');if(!quality||typeof quality.decodeValid!=='boolean')throw new TypeError('replay quality.decodeValid must be explicit');if(payloadRef===null&&quality.decodeValid!==false)throw new TypeError('decodeValid cannot be true without replay payload');
    const sourcePTS=Object.prototype.hasOwnProperty.call(sample,'sourcePTS')?sample.sourcePTS:null;if(!(sourcePTS===null||isI64String(sourcePTS)))throw new TypeError('sourcePTS must be I64/null');
    if(this.lastFrameSeq!==null&&BigInt(frameSeq)<=BigInt(this.lastFrameSeq))throw new Error('REPLAY_FRAMESEQ_DISCONTINUITY');
    if(sourcePTS!==null&&this.lastSourcePTS!==null&&BigInt(sourcePTS)<BigInt(this.lastSourcePTS))throw new Error('REPLAY_SOURCEPTS_DISCONTINUITY');
    const raw={
      schemaVersion:SCHEMA,recordKind:'frame',runId:this.cfg.runId,createdByVersion:this.cfg.createdByVersion,
      role:this.cfg.role,sourceId:this.cfg.sourceId,streamGeneration:this.cfg.streamGeneration,frameSeq,frameUID:'',identityKind:'source-sample',
      sourcePTS,sourceTimebase:sourcePTS===null?null:requiredSampleField(sample,'sourceTimebase'),clockId:requiredSampleField(sample,'clockId'),
      timestampKind:requiredSampleField(sample,'timestampKind'),sourceTimeMissingReason:sourcePTS===null?requiredSampleField(sample,'sourceTimeMissingReason'):null,
      masterClockId:this.cfg.masterClockId,mappedMasterTime:null,mappingUncertainty:null,mappingId:null,mappingVersion:null,mappingStatus:'unmapped',
      arrivalTime,width,height,rotation:requiredSampleField(sample,'rotation'),mirror,pixelFormat:requiredSampleField(sample,'pixelFormat'),
      nominalFPS:Object.prototype.hasOwnProperty.call(sample,'nominalFPS')?sample.nominalFPS:null,measuredFPS:Object.prototype.hasOwnProperty.call(sample,'measuredFPS')?sample.measuredFPS:null,
      quality,dropCounters:requiredSampleField(sample,'dropCounters'),
      backend:{id:'replay',version:this.cfg.backendVersion,platform:'offline',adapterInstanceId:`replay:${this.cfg.sourceId}:${this.cfg.streamGeneration}`},
      payloadRef,payloadState:payloadRef?'available':'unavailable',transformId:requiredSampleField(sample,'transformId'),contentDigest
    };
    raw.frameUID=frameUID(raw);const rec=identityRecord(raw),recDigest=sha256Canonical(rec),prior=this.uidRecords.get(raw.frameUID);if(prior&&prior!==recDigest)throw new Error('REPLAY_FRAME_UID_CONFLICT');
    if(this.mapping&&raw.sourcePTS!==null){const mapped=mapBoundSourceTime(this.mapping,raw);const {reason,...fields}=mapped;Object.assign(raw,fields);if(reason)raw.extensions={...(raw.extensions||{}),mappingReason:reason};}
    const validated=validateFrameEnvelope(raw);this.uidRecords.set(raw.frameUID,recDigest);this.lastFrameSeq=frameSeq;if(sourcePTS!==null)this.lastSourcePTS=sourcePTS;return validated;
  }
  *frames(samples=[]){for(const s of samples)yield this.envelope(s);}
}
module.exports={ReplayAdapter,identityRecord};
