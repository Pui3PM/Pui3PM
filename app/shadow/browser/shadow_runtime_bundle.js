(function(root){'use strict';
const M=Object.create(null),C=Object.create(null);
M["adapters/replay/replay_adapter.js"]=function(module,exports,require){
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

};
M["archive/shadow_archive.js"]=function(module,exports,require){
'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const Sha=require('../contracts/sha256_pure');
const Bin=require('../contracts/binary_pure');
const {immutablePlainCopy,isId}=require('../contracts/strict_types');
const {validateFrameEnvelope}=require('../contracts/contract_v1');
const {validateEvidenceCandidate,validateShotEvent,validateProjection}=require('../contracts/record_validators');
const FORMAT='3pm-shadow-archive-v1',MAX_FILES=10000,MAX_TOTAL_BYTES=512*1024*1024;
const WIN_RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function sha256Bytes(b){return Sha.hex(Bin.bytes(b));}
function normalizedPath(p){if(typeof p!=='string'||!p.length||p.includes('\\')||p.startsWith('/')||/^[A-Za-z]:/.test(p)||p.includes('\0'))return null;const n=p.normalize('NFC');const parts=n.split('/');if(parts.some(x=>!x||x==='.'||x==='..'||x.endsWith('.')||x.endsWith(' ')||x.includes(':')||WIN_RESERVED.test(x)))return null;return n;}
function safePath(p){return normalizedPath(p)!==null;}
function pathKey(p){const n=normalizedPath(p);return n===null?null:n.toLocaleLowerCase('en-US');}
function strictBase64(s){return Bin.base64Decode(s);}
function validateRecords(records,fileSet){
  if(!records||typeof records!=='object'||Array.isArray(records))throw new TypeError('archive records object required');for(const k of Object.keys(records))if(!['frames','candidates','events','projections'].includes(k))throw new TypeError(`unknown archive record collection: ${k}`);
  const frames=(records.frames||[]).map(validateFrameEnvelope),candidates=(records.candidates||[]).map(x=>validateEvidenceCandidate(x)),events=(records.events||[]).map(validateShotEvent),projections=(records.projections||[]).map(validateProjection);const frameByUid=new Map(frames.map(f=>[f.frameUID,f])),candById=new Map(candidates.map(c=>[c.candidateId,c]));
  for(const f of frames)if(f.payloadRef!==null&&!fileSet.has(f.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');for(const c of candidates){if(!fileSet.has(c.payloadRef))throw new Error('DANGLING_PAYLOAD_REF');const f=frameByUid.get(c.frameUID);if(!f||f.sourceId!==c.sourceId||f.streamGeneration!==c.streamGeneration||f.frameSeq!==c.frameSeq||f.contentDigest!==c.contentDigest)throw new Error('DANGLING_FRAME_REF');}
  for(const p of projections)for(const s of p.slots)if(s.status==='real'){const c=candById.get(s.candidateId);if(!c||c.frameUID!==s.actualFrameUID||c.derivationId!==s.derivationId)throw new Error('DANGLING_CANDIDATE_REF');if(!frameByUid.has(s.actualFrameUID))throw new Error('DANGLING_FRAME_REF');}
  return immutablePlainCopy({frames,candidates,events,projections});
}
function validateManifestBody(body,payloads){
  if(body.format!==FORMAT||!isId(body.archiveId)||!(/^[0-9a-f]{64}$/i.test(body.baselineDigest)))throw new TypeError('invalid archive identity');if(!Array.isArray(body.fileTable)||body.fileTable.length>MAX_FILES)throw new TypeError('invalid file table');const seenExact=new Set(),seenPortable=new Set();let total=0;
  for(const f of body.fileTable){const n=normalizedPath(f.path),pk=pathKey(f.path);if(n===null||n!==f.path||seenExact.has(n)||seenPortable.has(pk))throw new Error('UNSAFE_OR_DUPLICATE_PATH');seenExact.add(n);seenPortable.add(pk);if(!Number.isSafeInteger(f.byteLength)||f.byteLength<0||!/^[0-9a-f]{64}$/i.test(f.sha256)||typeof f.mime!=='string')throw new TypeError('invalid file entry');total+=f.byteLength;if(total>MAX_TOTAL_BYTES)throw new Error('ARCHIVE_SIZE_LIMIT');const bytes=strictBase64(payloads?.[f.path]);if(bytes.length!==f.byteLength||sha256Bytes(bytes)!==f.sha256)throw new Error('BLOB_INTEGRITY_ERROR');}
  const payloadKeys=Object.keys(payloads||{});if(payloadKeys.length!==seenExact.size||payloadKeys.some(k=>!seenExact.has(k)))throw new Error('UNLISTED_PAYLOAD_KEY');const records=validateRecords(body.records,seenExact);return records;
}
function buildArchive({archiveId,baselineDigest,records,files={}}){
  if(!isId(archiveId)||!baselineDigest||!records)throw new TypeError('archive identity/records required');if(!/^[0-9a-f]{64}$/i.test(baselineDigest))throw new TypeError('baselineDigest must be sha256');const fileTable=[],payloads={},portable=new Set();for(const [p,value] of Object.entries(files)){const n=normalizedPath(p),pk=pathKey(p);if(n===null||n!==p||portable.has(pk))throw new TypeError('unsafe/colliding archive path');portable.add(pk);const bytes=Bin.bytes(value);fileTable.push({path:p,mime:'application/octet-stream',byteLength:bytes.length,sha256:sha256Bytes(bytes)});payloads[p]=Bin.base64Encode(bytes);}
  fileTable.sort((a,b)=>a.path.localeCompare(b.path));const tempBody={format:FORMAT,archiveId,baselineDigest,records, fileTable};const validatedRecords=validateRecords(records,new Set(fileTable.map(f=>f.path)));const body=immutablePlainCopy({...tempBody,records:validatedRecords});validateManifestBody(body,payloads);return immutablePlainCopy({manifest:{...body,manifestDigest:sha256Canonical(body)},payloads});
}
function validateArchive(archive){if(archive?.manifest?.format!==FORMAT)throw new TypeError('unsupported archive format');const {manifestDigest,...body}=archive.manifest;if(sha256Canonical(body)!==manifestDigest)throw new Error('MANIFEST_DIGEST_MISMATCH');validateManifestBody(body,archive.payloads);return true;}
function roundTrip(archive){validateArchive(archive);const parsed=JSON.parse(JSON.stringify(archive));validateArchive(parsed);return immutablePlainCopy(parsed);}
class InMemoryArchiveImporter{constructor(){this.byArchive=new Map();}stage(archive,{namespace}){if(typeof namespace!=='string'||!namespace.startsWith('shadow/'))throw new TypeError('shadow namespace required');validateArchive(archive);const k=JSON.stringify([namespace,archive.manifest.archiveId]),digest=archive.manifest.manifestDigest,prev=this.byArchive.get(k);if(prev){if(prev.manifest.manifestDigest!==digest)throw new Error('ARCHIVE_ID_CONFLICT');return {status:'existing',archive:prev};}const copy=roundTrip(archive);this.byArchive.set(k,copy);return {status:'staged',archive:copy};}}
module.exports={FORMAT,buildArchive,validateArchive,roundTrip,InMemoryArchiveImporter,safePath,normalizedPath,validateRecords};

};
M["contracts/binary_pure.js"]=function(module,exports,require){
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ShadowBinary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytes(value){
  if(value instanceof Uint8Array)return new Uint8Array(value);
  if(value instanceof ArrayBuffer)return new Uint8Array(value.slice(0));
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));
  if(typeof value==='string')return new TextEncoder().encode(value);
  if(Array.isArray(value)&&value.every(x=>Number.isInteger(x)&&x>=0&&x<=255))return Uint8Array.from(value);
  throw new TypeError('binary value must be bytes, ArrayBuffer, byte array, or string');
}
function base64Encode(value){const b=bytes(value);let out='';for(let i=0;i<b.length;i+=3){const a=b[i],c=i+1<b.length?b[i+1]:0,d=i+2<b.length?b[i+2]:0,n=(a<<16)|(c<<8)|d;out+=ABC[(n>>>18)&63]+ABC[(n>>>12)&63]+(i+1<b.length?ABC[(n>>>6)&63]:'=')+(i+2<b.length?ABC[n&63]:'=');}return out;}
function base64Decode(s){
  if(typeof s!=='string'||s.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw new Error('INVALID_BASE64');
  const pad=s.endsWith('==')?2:s.endsWith('=')?1:0,out=new Uint8Array((s.length/4)*3-pad);let oi=0;
  for(let i=0;i<s.length;i+=4){const a=ABC.indexOf(s[i]),b=ABC.indexOf(s[i+1]),c=s[i+2]==='='?0:ABC.indexOf(s[i+2]),d=s[i+3]==='='?0:ABC.indexOf(s[i+3]);const n=(a<<18)|(b<<12)|(c<<6)|d;if(oi<out.length)out[oi++]=(n>>>16)&255;if(oi<out.length)out[oi++]=(n>>>8)&255;if(oi<out.length)out[oi++]=n&255;}
  return out;
}
function utf8ByteLength(s){if(typeof s!=='string')throw new TypeError('string required');return new TextEncoder().encode(s).length;}
return{bytes,base64Encode,base64Decode,utf8ByteLength};
});

};
M["contracts/canonical_json.js"]=function(module,exports,require){
'use strict';
const sha=require('./sha256_pure');
function canonicalize(value){if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('canonical JSON forbids non-finite numbers');return JSON.stringify(value);}if(Array.isArray(value))return '['+value.map(canonicalize).join(',')+']';if(value&&typeof value==='object'){const keys=Object.keys(value).sort();return '{'+keys.map(k=>JSON.stringify(k)+':'+canonicalize(value[k])).join(',')+'}';}throw new TypeError(`canonical JSON unsupported type: ${typeof value}`);}function sha256Canonical(value){return sha.hex(canonicalize(value));}module.exports={canonicalize,sha256Canonical};

};
M["contracts/clock_mapper.js"]=function(module,exports,require){
'use strict';
const {isId,isI64String,timeUsOrNull,durationUsOrNull,immutablePlainCopy}=require('./strict_types');
const {rational}=require('./time');
function fail(m){const e=new TypeError(m);e.code='SHADOW_CLOCK_INVALID';throw e;}
function roundHalfEvenRatio(num,den){
  if(den<=0n)fail('denominator must be positive');
  const neg=num<0n;let a=neg?-num:num;let q=a/den,r=a%den;const twice=r*2n;
  if(twice>den||(twice===den&&(q&1n)===1n))q+=1n;
  return neg?-q:q;
}
function validSampleIds(v){return Array.isArray(v)&&v.every(isId);}
function ratioParts(v,label){
  rational(v?.numerator,v?.denominator);
  const n=BigInt(v.numerator),d=BigInt(v.denominator);if(n<=0n||d<=0n)fail(`${label} must be positive`);return {n,d};
}
function scaleMatchesTimebase(sourceTimebase,scale,driftBoundPpm){
  const tb=ratioParts(sourceTimebase,'sourceTimebase'),sc=ratioParts(scale,'scale');
  if(!Number.isSafeInteger(driftBoundPpm)||driftBoundPpm<0||driftBoundPpm>100000)fail('invalid driftBoundPpm');
  const actualScaled=sc.n*tb.d; // scale numerator/den * tb denominator
  const nominalScaled=tb.n*1000000n*sc.d; // timebase * 1e6
  const diff=actualScaled>=nominalScaled?actualScaled-nominalScaled:nominalScaled-actualScaled;
  if(diff*1000000n>nominalScaled*BigInt(driftBoundPpm))fail('scale inconsistent with sourceTimebase/driftBoundPpm');
}
function validateClockMapping(input){
  if(!input||typeof input!=='object')fail('mapping object required');
  const required=['mappingId','version','runId','masterClockId','clockId','streamGeneration','sourceTimebase','scale','driftBoundPpm','offsetUs','validStartTick','validEndTick','calibrationMethod','calibrationSampleIds','residualBoundUs','transportBoundUs','uncertaintyBoundUs','timestampKind','status','createdByVersion','mappingNamespace','trustedApiId','supersedes'];
  for(const k of required)if(!Object.prototype.hasOwnProperty.call(input,k))fail(`missing ${k}`);
  if(!isId(input.mappingId)||!Number.isInteger(input.version)||input.version<1||!isId(input.runId)||!isId(input.masterClockId)||!isId(input.clockId)||!isId(input.streamGeneration)||!isId(input.createdByVersion)||!isId(input.mappingNamespace))fail('invalid mapping identity');
  scaleMatchesTimebase(input.sourceTimebase,input.scale,input.driftBoundPpm);
  if(!Number.isSafeInteger(input.offsetUs))fail('offsetUs must be safe integer');
  for(const k of ['validStartTick','validEndTick'])if(!(input[k]===null||isI64String(input[k])))fail(`${k} must be I64/null`);
  if(input.validStartTick!==null&&input.validEndTick!==null&&BigInt(input.validStartTick)>BigInt(input.validEndTick))fail('invalid valid tick interval');
  if(!(input.supersedes===null||isId(input.supersedes)))fail('invalid supersedes');
  if(!['trusted-api','sample-affine','fixture'].includes(input.calibrationMethod)||!validSampleIds(input.calibrationSampleIds))fail('invalid calibration provenance');
  if(['sample-affine','fixture'].includes(input.calibrationMethod)&&input.calibrationSampleIds.length===0)fail('sample-based calibration requires sample ids');
  durationUsOrNull(input.residualBoundUs);durationUsOrNull(input.transportBoundUs);durationUsOrNull(input.uncertaintyBoundUs);
  if(!['exposure','presentation','callback','unknown'].includes(input.timestampKind))fail('invalid timestampKind');
  if(!['validated','provisional','unmapped','discontinuous'].includes(input.status))fail('invalid status');
  if(input.status==='validated'){
    if(input.uncertaintyBoundUs===null)fail('validated mapping requires bounded uncertainty');
    if(input.calibrationMethod==='fixture'&&!input.mappingNamespace.startsWith('shadow/replay'))fail('fixture mapping cannot be validated outside shadow/replay');
    if(input.calibrationMethod==='sample-affine'&&(input.residualBoundUs===null||input.transportBoundUs===null))fail('sample-affine validated mapping requires residual and transport bounds');
    if(input.calibrationMethod==='trusted-api'&&(!isId(input.trustedApiId)||input.transportBoundUs===null))fail('trusted-api validated mapping requires trustedApiId and transport bound');
    if(input.residualBoundUs!==null&&input.transportBoundUs!==null&&input.uncertaintyBoundUs<input.residualBoundUs+input.transportBoundUs)fail('uncertainty bound smaller than component bounds');
  }
  if(input.calibrationMethod!=='trusted-api'&&input.trustedApiId!==null)fail('trustedApiId only valid for trusted-api');
  return immutablePlainCopy(input);
}
function mapTicks(mapping,ticks){
  const m=validateClockMapping(mapping);
  if(ticks===null)return {mappedMasterTime:null,mappingUncertainty:null,mappingStatus:'unmapped',mappingId:null,mappingVersion:null,reason:'source_time_unknown'};
  if(!isI64String(ticks))fail('ticks must be I64/null');
  if(m.status==='unmapped'||m.status==='discontinuous')return {mappedMasterTime:null,mappingUncertainty:m.uncertaintyBoundUs,mappingStatus:m.status,mappingId:m.mappingId,mappingVersion:m.version,reason:m.status};
  const t=BigInt(ticks);
  if(m.validStartTick!==null&&t<BigInt(m.validStartTick))return {mappedMasterTime:null,mappingUncertainty:m.uncertaintyBoundUs,mappingStatus:'discontinuous',mappingId:m.mappingId,mappingVersion:m.version,reason:'before_mapping_interval'};
  if(m.validEndTick!==null&&t>BigInt(m.validEndTick))return {mappedMasterTime:null,mappingUncertainty:m.uncertaintyBoundUs,mappingStatus:'discontinuous',mappingId:m.mappingId,mappingVersion:m.version,reason:'after_mapping_interval'};
  const n=BigInt(m.scale.numerator),d=BigInt(m.scale.denominator);
  const mapped=roundHalfEvenRatio(t*n,d)+BigInt(m.offsetUs);
  const out=Number(mapped);if(!Number.isSafeInteger(out))throw new RangeError('mapped master time exceeds JS safe integer');
  return {mappedMasterTime:out,mappingUncertainty:m.uncertaintyBoundUs,mappingStatus:m.status,mappingId:m.mappingId,mappingVersion:m.version,reason:null};
}
function mapBoundSourceTime(mapping,frame){
  const m=validateClockMapping(mapping);
  if(!frame||typeof frame!=='object')fail('frame binding required');
  if(frame.runId!==m.runId||frame.masterClockId!==m.masterClockId||frame.clockId!==m.clockId||frame.streamGeneration!==m.streamGeneration)fail('clock mapping binding mismatch');
  if(!frame.sourceTimebase||String(frame.sourceTimebase.numerator)!==String(m.sourceTimebase.numerator)||String(frame.sourceTimebase.denominator)!==String(m.sourceTimebase.denominator))fail('clock mapping timebase mismatch');
  if(frame.timestampKind!==m.timestampKind)fail('clock mapping timestamp kind mismatch');
  return mapTicks(m,frame.sourcePTS);
}
module.exports={validateClockMapping,mapTicks,mapBoundSourceTime,roundHalfEvenRatio,scaleMatchesTimebase};

};
M["contracts/contract_v1.js"]=function(module,exports,require){
'use strict';
const T=require('./strict_types');
const {frameUID}=require('./identity');
const {rational}=require('./time');
const SCHEMA='3pm.analyzer.shadow.v1';
const ROLES=new Set(['side','overhead','rear']);
const BACKENDS=new Set(['browser','avfoundation','mediafoundation','replay','other']);
function fail(msg){const e=new TypeError(msg);e.code='SHADOW_CONTRACT_INVALID';throw e;}
function validateRational(v,label){if(!v||typeof v!=='object')fail(`${label} rational required`);try{rational(v.numerator,v.denominator);}catch(e){fail(`${label} invalid rational`);}return v;}
function validateArrival(a){
  if(!a||typeof a!=='object')fail('arrivalTime object required');
  for(const k of ['clockId','ticks','timebase','masterTime','mappingId'])T.requireField(a,k);
  if(!T.isId(a.clockId)||!T.isI64String(a.ticks))fail('invalid arrival raw clock');
  validateRational(a.timebase,'arrivalTime.timebase');T.timeUsOrNull(a.masterTime);
  if(!(a.mappingId===null||T.isId(a.mappingId)))fail('invalid arrival mappingId');
}
function validateQuality(q){
  if(!q||typeof q!=='object'||typeof q.decodeValid!=='boolean'||!T.isId(q.qualitySchema)||!Array.isArray(q.flags)||!q.flags.every(x=>typeof x==='string'))fail('invalid quality');
  for(const k of ['trackingConfidence','blurScore'])if(!(q[k]===null||T.isFiniteNumber(q[k])))fail(`invalid quality.${k}`);
  if(!(q.exposureClipped===null||typeof q.exposureClipped==='boolean'))fail('invalid quality.exposureClipped');
}
function validateDrops(d){
  if(!d||typeof d!=='object'||!T.isId(d.counterScope))fail('invalid dropCounters');
  for(const k of ['source','transport','encoder'])if(!(d[k]===null||T.isU64String(d[k])))fail(`invalid dropCounters.${k}`);
}
function positiveNumberOrNull(v,label){if(v===null)return null;if(!T.isFiniteNumber(v)||v<=0)fail(`${label} must be positive number/null`);return v;}
function validateFrameEnvelope(input){
  if(!input||typeof input!=='object')fail('frame must be object');
  if(input.schemaVersion!==SCHEMA||input.recordKind!=='frame')fail('invalid frame schema/record kind');
  const required=['runId','createdByVersion','role','sourceId','streamGeneration','frameSeq','frameUID','identityKind','sourcePTS','sourceTimebase','clockId','timestampKind','sourceTimeMissingReason','masterClockId','mappedMasterTime','mappingUncertainty','mappingId','mappingVersion','mappingStatus','arrivalTime','width','height','rotation','mirror','pixelFormat','nominalFPS','measuredFPS','quality','dropCounters','backend','payloadRef','payloadState','transformId','contentDigest'];
  for(const k of required)T.requireField(input,k);
  const allowed=new Set(['schemaVersion','recordKind',...required,'extensions']);for(const k of Object.keys(input))if(!allowed.has(k))fail(`unknown frame field: ${k}`);
  if(!T.isId(input.runId)||!T.isId(input.createdByVersion)||!ROLES.has(input.role)||!T.isId(input.sourceId)||!T.isId(input.streamGeneration)||!T.isU64String(input.frameSeq)||!T.isId(input.frameUID))fail('invalid frame identity');
  if(!['source-sample','legacy-artifact'].includes(input.identityKind))fail('invalid identityKind');
  if(input.identityKind==='source-sample'&&frameUID(input)!==input.frameUID)fail('frameUID tuple mismatch');
  if(!(input.sourcePTS===null||T.isI64String(input.sourcePTS)))fail('sourcePTS must be I64 string/null');
  if(input.sourcePTS===null){if(input.sourceTimebase!==null)fail('sourceTimebase must be null when sourcePTS unknown');if(!T.isId(input.sourceTimeMissingReason))fail('unknown source time requires reason');}
  else {validateRational(input.sourceTimebase,'sourceTimebase');if(input.sourceTimeMissingReason!==null)fail('known source time requires null missing reason');}
  if(!T.isId(input.clockId)||!['exposure','presentation','callback','unknown'].includes(input.timestampKind)||!T.isId(input.masterClockId))fail('invalid clock identity/kind');
  T.timeUsOrNull(input.mappedMasterTime);T.durationUsOrNull(input.mappingUncertainty);
  if(!(input.mappingId===null||T.isId(input.mappingId)))fail('invalid mappingId');
  if(!(input.mappingVersion===null||(Number.isInteger(input.mappingVersion)&&input.mappingVersion>0)))fail('invalid mappingVersion');
  if((input.mappingId===null)!==(input.mappingVersion===null))fail('mappingId/version must be known together');
  if(!['validated','provisional','unmapped','discontinuous'].includes(input.mappingStatus))fail('invalid mappingStatus');
  if(input.sourcePTS===null){
    if(input.mappingStatus!=='unmapped'||input.mappedMasterTime!==null||input.mappingId!==null||input.mappingVersion!==null||input.mappingUncertainty!==null)fail('unknown source time cannot be mapped/validated');
  }else if(['validated','provisional'].includes(input.mappingStatus)){
    if(input.mappedMasterTime===null||input.mappingId===null)fail('mapped status requires mapped time+mapping identity');
    if(input.mappingStatus==='validated'&&input.mappingUncertainty===null)fail('validated mapping requires bounded uncertainty');
  }else if(input.mappedMasterTime!==null){
    fail('unmapped/discontinuous frame cannot have mapped time');
  }
  validateArrival(input.arrivalTime);
  if(!Number.isInteger(input.width)||input.width<=0||!Number.isInteger(input.height)||input.height<=0)fail('invalid dimensions');
  if(![0,90,180,270].includes(input.rotation))fail('invalid rotation');
  if(!(input.mirror===null||typeof input.mirror==='boolean'))fail('mirror must be boolean/null');
  if(!T.isId(input.pixelFormat))fail('pixelFormat required');
  positiveNumberOrNull(input.nominalFPS,'nominalFPS');positiveNumberOrNull(input.measuredFPS,'measuredFPS');
  validateQuality(input.quality);validateDrops(input.dropCounters);
  if(!input.backend||!BACKENDS.has(input.backend.id)||!T.isId(input.backend.version)||!T.isId(input.backend.platform)||!T.isId(input.backend.adapterInstanceId))fail('invalid backend');
  if(input.backend.id==='other'&&!T.isId(input.backend.name))fail('backend other requires namespaced name');
  if(!['available','unavailable','evicted'].includes(input.payloadState))fail('invalid payloadState');
  if(input.payloadState==='available'&&!T.isId(input.payloadRef))fail('available payload requires ref');
  if(input.payloadState!=='available'&&!(input.payloadRef===null||T.isId(input.payloadRef)))fail('invalid payloadRef');
  if(!T.isId(input.transformId))fail('transformId required');
  if(!(input.contentDigest===null||(typeof input.contentDigest==='string'&&/^[0-9a-f]{64}$/i.test(input.contentDigest))))fail('invalid contentDigest');
  return T.immutablePlainCopy(input);
}
module.exports={SCHEMA,validateFrameEnvelope};

};
M["contracts/identity.js"]=function(module,exports,require){
'use strict';
const material=require('./identity_material');const sha=require('./sha256_pure');
function frameIdentityTuple(fields){return material.validateIdentityFields(fields);}function lengthPrefixedUtf8(parts){return material.lengthPrefixedUtf8(parts);}function frameUID(fields){frameIdentityTuple(fields);return material.uidFromDigestBytes(sha.digest(material.frameIdentityBytes(fields)));}function samePhysicalSample(a,b){return !!a&&!!b&&a.runId===b.runId&&a.sourceId===b.sourceId&&a.streamGeneration===b.streamGeneration&&a.frameSeq===b.frameSeq;}module.exports={lengthPrefixedUtf8,frameIdentityTuple,frameUID,samePhysicalSample};

};
M["contracts/identity_browser.js"]=function(module,exports,require){
(function(root,factory){
  const dep=typeof module!=='undefined'&&module.exports?require('./identity_material'):root.ShadowIdentityMaterial;
  const api=factory(dep);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ShadowIdentityBrowser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(material){
  'use strict';
  async function frameUID(fields,cryptoLike=globalThis.crypto){
    if(!material)throw new Error('ShadowIdentityMaterial unavailable');
    material.validateIdentityFields(fields);
    if(!cryptoLike?.subtle?.digest)throw new Error('WebCrypto SHA-256 unavailable');
    const digest=await cryptoLike.subtle.digest('SHA-256',material.frameIdentityBytes(fields));
    return material.uidFromDigestBytes(new Uint8Array(digest));
  }
  return{frameUID};
});

};
M["contracts/identity_material.js"]=function(module,exports,require){
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ShadowIdentityMaterial=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const U64_MAX=(1n<<64n)-1n;
  function wellFormed(v){
    if(typeof v!=='string')return false;
    if(typeof v.isWellFormed==='function')return v.isWellFormed();
    for(let i=0;i<v.length;i++){
      const c=v.charCodeAt(i);
      if(c>=0xD800&&c<=0xDBFF){if(i+1>=v.length)return false;const d=v.charCodeAt(++i);if(d<0xDC00||d>0xDFFF)return false;}
      else if(c>=0xDC00&&c<=0xDFFF)return false;
    }
    return true;
  }
  function isId(v){return typeof v==='string'&&v.length>0&&v.length<=512&&wellFormed(v);}
  function isU64(v){if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v))return false;try{const n=BigInt(v);return n>=0n&&n<=U64_MAX;}catch{return false;}}
  function validateIdentityFields(fields){
    if(!fields||typeof fields!=='object'||!isId(fields.runId)||!isId(fields.sourceId)||!isId(fields.streamGeneration)||!isU64(fields.frameSeq))throw new TypeError('Invalid frame identity tuple');
    return [fields.runId,fields.sourceId,fields.streamGeneration,fields.frameSeq];
  }
  function utf8(s){if(!wellFormed(s))throw new TypeError('Identity string must be well-formed UTF-16');return new TextEncoder().encode(s);}
  function lengthPrefixedUtf8(parts){
    const encoded=parts.map(utf8);let total=0;for(const b of encoded)total+=4+b.length;
    const out=new Uint8Array(total);const view=new DataView(out.buffer);let off=0;
    for(const b of encoded){view.setUint32(off,b.length,false);off+=4;out.set(b,off);off+=b.length;}
    return out;
  }
  function tuple(fields){return validateIdentityFields(fields);}
  function frameIdentityBytes(fields){return lengthPrefixedUtf8(tuple(fields));}
  function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
  function uidFromDigestBytes(bytes){return `f1/${hex(bytes)}`;}
  return{lengthPrefixedUtf8,tuple,frameIdentityBytes,uidFromDigestBytes,validateIdentityFields,isId};
});

};
M["contracts/record_validators.js"]=function(module,exports,require){
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
    if(s.status==='real'){real++;if(!T.isFrameUID(s.actualFrameUID)||seen.has(s.actualFrameUID))fail('projection duplicate/invalid FrameUID');seen.add(s.actualFrameUID);for(const k of ['derivationId','candidateId','sourceId','streamGeneration','frameEnvelopeRef'])if(!T.isId(s[k]))fail(`real slot ${k}`);if(!T.isU64String(s.frameSeq)||!T.isSha256(s.contentDigest))fail('real slot identity metadata');time(s.actualMasterTime,'actualMasterTime',{nullable:false});time(s.signedDelta,'signedDelta',{nullable:false});time(s.mappingUncertaintyUs,'mappingUncertaintyUs',{nullable:false,nonnegative:true});time(s.toleranceUs,'toleranceUs',{nullable:false,nonnegative:true});if(!Number.isSafeInteger(s.targetMasterTime)||s.signedDelta!==s.actualMasterTime-s.targetMasterTime)fail('real slot signedDelta mismatch');if(s.missingReason!==null)fail('real slot missingReason must be null');ids(s.actualPhaseEvidenceRefs,'actualPhaseEvidenceRefs');if(s.phase!=='release_window'){if(!s.phaseProof||s.phaseProof.phase!==s.phase||s.phaseProof.intervalCheck!=='inside'||!Array.isArray(s.phaseProof.timelineRefs)||!s.phaseProof.timelineRefs.every(T.isId))fail('real slot phaseProof');if(s.phase==='anchor'&&typeof s.phaseProof.settledAnchorBoundary!=='boolean')fail('anchor settled proof required');}else if(!(s.phaseProof===null||typeof s.phaseProof==='object'))fail('release phaseProof');
    }else{if(s.status==='missing')missing++;else inactive++;for(const k of ['actualFrameUID','derivationId','candidateId','actualMasterTime','signedDelta','mappingUncertaintyUs','toleranceUs','sourceId','streamGeneration','frameSeq','contentDigest','frameEnvelopeRef'])if(Object.prototype.hasOwnProperty.call(s,k)&&s[k]!==null)fail('non-real slot must not reference frame');if(!T.isId(s.missingReason))fail('missing/inactive reason required');if(s.phaseProof!==null)fail('non-real phaseProof must be null');}
  });
  if(x.uniqueRealCount!==real||x.missingCount!==missing||x.inactiveCount!==inactive||real+missing+inactive!==25)fail('projection counts mismatch');return T.immutablePlainCopy(x);
}
module.exports={PLAN,EXPECTED_PHASES,validateObservation,validateEvidenceCandidate,validatePhaseClaim,validateShotEvent,validateProjection};

};
M["contracts/sha256_pure.js"]=function(module,exports,require){
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ShadowSha256=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function rotr(x,n){return (x>>>n)|(x<<(32-n));}
function bytes(input){if(input instanceof Uint8Array)return input;if(typeof input==='string')return new TextEncoder().encode(input);if(input instanceof ArrayBuffer)return new Uint8Array(input);throw new TypeError('sha256 input must be string/bytes');}
function digest(input){const m=bytes(input),l=m.length,bitLen=BigInt(l)*8n,pad=((56-(l+1)%64)+64)%64,total=l+1+pad+8,b=new Uint8Array(total);b.set(m);b[l]=0x80;for(let i=0;i<8;i++)b[total-1-i]=Number((bitLen>>BigInt(8*i))&255n);let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19,w=new Uint32Array(64);for(let off=0;off<total;off+=64){for(let i=0;i<16;i++){const j=off+i*4;w[i]=((b[j]<<24)|(b[j+1]<<16)|(b[j+2]<<8)|b[j+3])>>>0;}for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2],s0=rotr(x,7)^rotr(x,18)^(x>>>3),s1=rotr(y,17)^rotr(y,19)^(y>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}let a=h0,bb=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&bb)^(a&c)^(bb&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=bb;bb=a;a=(t1+t2)>>>0;}h0=(h0+a)>>>0;h1=(h1+bb)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;}const out=new Uint8Array(32),hs=[h0,h1,h2,h3,h4,h5,h6,h7];for(let i=0;i<8;i++){out[i*4]=hs[i]>>>24;out[i*4+1]=hs[i]>>>16;out[i*4+2]=hs[i]>>>8;out[i*4+3]=hs[i];}return out;}
function hex(input){return Array.from(digest(input),b=>b.toString(16).padStart(2,'0')).join('');}
return{digest,hex};
});

};
M["contracts/strict_types.js"]=function(module,exports,require){
'use strict';

const U64_MAX=(1n<<64n)-1n;
const I64_MIN=-(1n<<63n);
const I64_MAX=(1n<<63n)-1n;
const FORBIDDEN_KEYS=new Set(['__proto__','prototype','constructor']);

function isExplicitNull(v){ return v === null; }
function isUnknown(v){ return v === null || typeof v === 'undefined'; }
function isFiniteNumber(v){ return typeof v === 'number' && Number.isFinite(v); }
function finiteNumberOrNull(v){
  if(v === null || typeof v === 'undefined') return null;
  return isFiniteNumber(v) ? v : null;
}
function positiveFiniteOrNull(v){
  const n=finiteNumberOrNull(v); return n !== null && n > 0 ? n : null;
}
function parseBoundedIntegerString(v,{signed=false}={}){
  if(typeof v!=='string')return null;
  if(signed){
    if(!/^-?(0|[1-9][0-9]*)$/.test(v)||v==='-0')return null;
    let n;try{n=BigInt(v);}catch{return null;}
    return n>=I64_MIN&&n<=I64_MAX?n:null;
  }
  if(!/^(0|[1-9][0-9]*)$/.test(v))return null;
  let n;try{n=BigInt(v);}catch{return null;}
  return n>=0n&&n<=U64_MAX?n:null;
}
function isU64String(v){ return parseBoundedIntegerString(v,{signed:false})!==null; }
function isI64String(v){ return parseBoundedIntegerString(v,{signed:true})!==null; }
function isWellFormedString(v){
  if(typeof v!=='string')return false;
  if(typeof v.isWellFormed==='function')return v.isWellFormed();
  for(let i=0;i<v.length;i++){
    const c=v.charCodeAt(i);
    if(c>=0xD800&&c<=0xDBFF){if(i+1>=v.length)return false;const d=v.charCodeAt(++i);if(d<0xDC00||d>0xDFFF)return false;}
    else if(c>=0xDC00&&c<=0xDFFF)return false;
  }
  return true;
}
function isId(v){ return typeof v === 'string' && v.length > 0 && v.length <= 512 && isWellFormedString(v); }
function isFrameUID(v){ return typeof v==='string' && /^f1\/[0-9a-f]{64}$/i.test(v); }
function isSha256(v){ return typeof v==='string' && /^[0-9a-f]{64}$/i.test(v); }
function requireField(obj,key){
  if(!Object.prototype.hasOwnProperty.call(obj,key)) throw new TypeError(`Missing required field: ${key}`);
  return obj[key];
}
function assertKnownOrNull(obj,key){
  const v=requireField(obj,key);
  if(typeof v === 'undefined') throw new TypeError(`${key} must be explicit null when unknown`);
  return v;
}
function timeUsOrNull(v){
  if(v === null) return null;
  if(!Number.isSafeInteger(v)) throw new TypeError('TimeUs must be a safe integer or null');
  return v;
}
function durationUsOrNull(v){
  const n=timeUsOrNull(v); if(n !== null && n < 0) throw new TypeError('DurationUs must be nonnegative'); return n;
}
function clonePlain(value,path='$'){
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'){
    if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError(`Non-finite number at ${path}`);
    if(typeof value==='string'&&!isWellFormedString(value))throw new TypeError(`Ill-formed UTF-16 string at ${path}`);
    return value;
  }
  if(Array.isArray(value))return value.map((v,i)=>clonePlain(v,`${path}[${i}]`));
  if(value&&typeof value==='object'){
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)throw new TypeError('Contract values must be plain objects/arrays/scalars');
    const out=Object.create(null);
    for(const [k,v] of Object.entries(value)){
      if(FORBIDDEN_KEYS.has(k))throw new TypeError(`Forbidden contract key: ${k}`);
      if(!isWellFormedString(k))throw new TypeError(`Ill-formed contract key at ${path}`);
      Object.defineProperty(out,k,{value:clonePlain(v,`${path}.${k}`),writable:true,enumerable:true,configurable:true});
    }
    return out;
  }
  throw new TypeError(`Unsupported contract value type: ${typeof value}`);
}
function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const v of Object.values(value))deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
function immutablePlainCopy(value){return deepFreeze(clonePlain(value));}
function assertNoUnknownFields(obj,allowed,label='record'){
  const set=new Set(allowed);
  for(const k of Object.keys(obj||{}))if(!set.has(k))throw new TypeError(`${label} unknown field: ${k}`);
}

module.exports={
  U64_MAX,I64_MIN,I64_MAX,isExplicitNull,isUnknown,isFiniteNumber,finiteNumberOrNull,positiveFiniteOrNull,
  parseBoundedIntegerString,isU64String,isI64String,isWellFormedString,isId,isFrameUID,isSha256,requireField,assertKnownOrNull,timeUsOrNull,durationUsOrNull,
  clonePlain,deepFreeze,immutablePlainCopy,assertNoUnknownFields
};

};
M["contracts/time.js"]=function(module,exports,require){
'use strict';
const {isI64String,isU64String,timeUsOrNull}=require('./strict_types');
function rational(numerator,denominator){
  if(!isU64String(numerator)||!isU64String(denominator)||BigInt(numerator)<=0n||BigInt(denominator)<=0n) throw new TypeError('Invalid timebase');
  return {numerator,denominator};
}
function ticksToMicroseconds(ticks,timebase){
  if(ticks===null) return null;
  if(!isI64String(ticks)||!timebase) throw new TypeError('Invalid source ticks/timebase');
  const t=BigInt(ticks),n=BigInt(timebase.numerator),d=BigInt(timebase.denominator);
  const num=t*n*1000000n;
  const q=num/d, r=num%d, absR=r<0n?-r:r, absD=d<0n?-d:d;
  let rounded=q;
  const twice=absR*2n;
  if(twice>absD || (twice===absD && (q&1n)!==0n)) rounded += num>=0n?1n:-1n;
  const out=Number(rounded);if(!Number.isSafeInteger(out)) throw new RangeError('Mapped time exceeds JS safe integer');return out;
}
function mappedTimeOrNull(v){ return timeUsOrNull(v); }
module.exports={rational,ticksToMicroseconds,mappedTimeOrNull};

};
M["decision/shot_cycle_reducer.js"]=function(module,exports,require){
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

};
M["event_log/in_memory_event_log.js"]=function(module,exports,require){
'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const {validateShotEvent}=require('../contracts/record_validators');
function scopeKey(e){return JSON.stringify([e.eventNamespace,e.runId,e.cycleId]);}
function idemKey(e){return JSON.stringify([e.eventNamespace,e.runId,e.cycleId,e.idempotencyKey]);}
function recomputeDigest(event){const {eventDigest,...body}=event;return sha256Canonical(body);}
function derivedIdempotencyKey(e){return sha256Canonical({namespace:e.eventNamespace,runId:e.runId,cycleId:e.cycleId,seq:e.seq,eventType:e.eventType,policyVersion:e.policyVersion});}
class InMemoryShotEventLog{
  constructor({allowedNamespacePrefix='shadow/'}={}){if(typeof allowedNamespacePrefix!=='string'||!allowedNamespacePrefix)throw new TypeError('allowedNamespacePrefix required');this.allowedNamespacePrefix=allowedNamespacePrefix;this.byCycle=new Map();this.byIdempotency=new Map();}
  append(event,{expectedPreviousSeq=null}={}){
    const frozen=validateShotEvent(event);if(!frozen.eventNamespace.startsWith(this.allowedNamespacePrefix))throw new Error('EVENT_NAMESPACE_DENIED');
    const derived=derivedIdempotencyKey(frozen);if(frozen.idempotencyKey!==derived)throw new Error('EVENT_IDEMPOTENCY_KEY_MISMATCH');if(recomputeDigest(frozen)!==frozen.eventDigest)throw new Error('EVENT_DIGEST_MISMATCH');
    const sk=scopeKey(frozen),ik=idemKey(frozen),idem=this.byIdempotency.get(ik);if(idem){if(idem.eventDigest!==frozen.eventDigest||sha256Canonical(idem)!==sha256Canonical(frozen))throw new Error('IDEMPOTENCY_CONFLICT');return {status:'existing',event:idem};}
    const rows=this.byCycle.get(sk)||[],prev=rows.at(-1)||null;if(expectedPreviousSeq!==null&&String(prev?.seq||'0')!==String(expectedPreviousSeq))throw new Error('EVENT_SEQ_CONFLICT');if(BigInt(frozen.seq)!==BigInt(prev?.seq||'0')+1n)throw new Error('EVENT_SEQ_GAP');if((frozen.previousEventDigest??null)!==(prev?.eventDigest??null))throw new Error('EVENT_CHAIN_CONFLICT');if(prev&&['confirmed','rejected','uncertain'].includes(prev.eventType))throw new Error('TERMINAL_ALREADY_COMMITTED');rows.push(frozen);this.byCycle.set(sk,rows);this.byIdempotency.set(ik,frozen);return {status:'appended',event:frozen};
  }
  cycle(cycleId,{namespace,runId}={}){if(typeof namespace!=='string'||!namespace||typeof runId!=='string'||!runId)throw new TypeError('cycle query requires namespace and runId');return Object.freeze([...(this.byCycle.get(JSON.stringify([namespace,runId,cycleId]))||[])]);}
}
module.exports={InMemoryShotEventLog,recomputeDigest,derivedIdempotencyKey};

};
M["evidence_writer/in_memory_writer.js"]=function(module,exports,require){
'use strict';
const {sha256Canonical}=require('../contracts/canonical_json');
const {immutablePlainCopy}=require('../contracts/strict_types');
const {validateEvidenceCandidate,validateProjection,validatePhaseClaim}=require('../contracts/record_validators');
function keyTuple(parts){return JSON.stringify(parts);}
function commandFingerprint(c){return sha256Canonical({namespace:c.namespace,runId:c.runId,cycleId:c.cycleId,role:c.role,operation:c.operation,expectedRecordVersion:c.expectedRecordVersion,payloadDigest:c.payloadDigest});}
function validateCandidate(item,c){return validateEvidenceCandidate(item,{runId:c.runId,cycleId:c.cycleId,role:c.role});}
class InMemoryEvidenceWriter{
  constructor({allowedNamespacePrefix='shadow/',maxCommandMemos=10000}={}){this.allowedNamespacePrefix=allowedNamespacePrefix;this.maxCommandMemos=maxCommandMemos;this.records=new Map();this.commands=new Map();this.commandScopes=new Map();this.quarantine=[];}
  _key(c){return keyTuple([c.namespace,c.runId,c.cycleId,c.role]);}
  execute(c){
    for(const k of ['commandId','namespace','runId','cycleId','role','operation','payloadDigest'])if(typeof c?.[k]!=='string'||!c[k])throw new TypeError(`command ${k} required`);if(!c.namespace.startsWith(this.allowedNamespacePrefix))throw new Error('WRITER_NAMESPACE_DENIED');if(!['side','overhead','rear'].includes(c.role))throw new TypeError('invalid command role');if(!['addCandidates','addPhaseEvidence','saveProjection','finalizeCycle'].includes(c.operation))throw new TypeError('invalid operation');
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

};
M["projector/logical25.js"]=function(module,exports,require){
'use strict';
const {immutablePlainCopy,isId}=require('../contracts/strict_types');
const {validateEvidenceCandidate}=require('../contracts/record_validators');
const {sha256Canonical}=require('../contracts/canonical_json');
const PLAN='logical25-v1-shadow';
const SLOT_PLAN=[...[['draw',1/3],['draw',2/3]],...[['anchor',1/4],['anchor',1/2],['anchor',3/4]],...[['hold',1/4],['hold',1/2],['hold',3/4]],...[['expansion',1/3],['expansion',2/3]],...Array.from({length:9},(_,i)=>['release_window',i-4]),...Array.from({length:5},(_,i)=>['follow_through',(i+1)/6]),['recovery',1]];
function phaseInterval(timeline,name){const p=timeline?.[name];return p&&p.status==='verified'&&Number.isSafeInteger(p.start)&&Number.isSafeInteger(p.end)&&p.end>=p.start&&Array.isArray(p.refs)&&p.refs.every(isId)?p:null;}
function slotTargets({timeline={},releaseTime=null}){return SLOT_PLAN.map(([phase,pos],i)=>{let target=null,refs=[];if(phase==='release_window'){if(Number.isSafeInteger(releaseTime))target=releaseTime+pos*33333;const p=timeline?.release_window;if(p?.status==='verified'&&Array.isArray(p.refs))refs=[...p.refs];}else{const iv=phaseInterval(timeline,phase);if(iv){target=phase==='recovery'?iv.end:Math.round(iv.start+(iv.end-iv.start)*pos);refs=[...iv.refs];}}return {slotId:`S${String(i+1).padStart(2,'0')}`,phase,targetMasterTime:target,targetPhaseEvidenceRefs:refs};});}
function bindingKey(c){return `${c.sourceId}\u0000${c.streamGeneration}`;}
function normalizeBindings(roleBindings){if(!Array.isArray(roleBindings)||roleBindings.length===0)throw new TypeError('roleBindings required');const out=new Map();for(const b of roleBindings){if(!b||!isId(b.sourceId)||!isId(b.streamGeneration)||!Number.isSafeInteger(b.startMasterTime)||!(b.endMasterTime===null||Number.isSafeInteger(b.endMasterTime))||b.endMasterTime!==null&&b.endMasterTime<b.startMasterTime||!Number.isSafeInteger(b.capturePeriodUs)||b.capturePeriodUs<=0||!Number.isSafeInteger(b.jitterUs)||b.jitterUs<0)throw new TypeError('invalid role binding');const k=`${b.sourceId}\u0000${b.streamGeneration}`;if(out.has(k))throw new TypeError('duplicate role binding');out.set(k,immutablePlainCopy(b));}return out;}
function identitySignature(c){return sha256Canonical({frameUID:c.frameUID,runId:c.runId,sourceId:c.sourceId,streamGeneration:c.streamGeneration,frameSeq:c.frameSeq,sourcePTS:c.sourcePTS,contentDigest:c.contentDigest,frameEnvelopeRef:c.frameEnvelopeRef});}
function classifyCandidate(c,ctx){
  let v;try{v=validateEvidenceCandidate(c,{runId:ctx.runId,cycleId:ctx.cycleId,role:ctx.role});}catch(e){return {ok:false,reason:/payload|decode/.test(e.message)?'payload_missing':/mapping/.test(e.message)?'clock_uncertain':'candidate_invalid'};}
  if(v.masterClockId!==ctx.masterClockId)return {ok:false,reason:'clock_mismatch'};const binding=ctx.bindings.get(bindingKey(v));if(!binding)return {ok:false,reason:'generation_mismatch'};if(v.actualMasterTime<binding.startMasterTime||binding.endMasterTime!==null&&v.actualMasterTime>binding.endMasterTime)return {ok:false,reason:'generation_mismatch'};return {ok:true,value:v,binding};
}
function preflightRawUidConflicts(candidates){const seen=new Map();for(const c of candidates){if(!c||typeof c.frameUID!=='string'||!c.frameUID)continue;const sig=sha256Canonical({runId:c.runId??null,sourceId:c.sourceId??null,streamGeneration:c.streamGeneration??null,frameSeq:c.frameSeq??null,sourcePTS:c.sourcePTS??null,contentDigest:c.contentDigest??null,frameEnvelopeRef:c.frameEnvelopeRef??null});const prior=seen.get(c.frameUID);if(prior&&prior!==sig)throw new Error('FRAME_UID_CONFLICT');if(!prior)seen.set(c.frameUID,sig);}}
function bestDerivations(validRows){const by=new Map();for(const row of validRows){const c=row.value,k=c.frameUID,prior=by.get(k),sig=identitySignature(c);if(prior&&prior.identitySignature!==sig)throw new Error('FRAME_UID_CONFLICT');if(!prior){by.set(k,{...row,identitySignature:sig});continue;}const ar=c.width*c.height,br=prior.value.width*prior.value.height;if(ar>br||(ar===br&&String(c.derivationId).localeCompare(String(prior.value.derivationId))<0))by.set(k,{...row,identitySignature:sig});}return [...by.values()].sort((a,b)=>String(a.value.frameUID).localeCompare(String(b.value.frameUID))||String(a.value.derivationId).localeCompare(String(b.value.derivationId)));}
function tolerance(row){return Math.min(50000,Math.ceil(row.binding.capturePeriodUs/2+row.binding.jitterUs+row.value.mappingUncertainty));}
function eligible(slot,row,timeline){const c=row.value,tol=tolerance(row);if(!Number.isSafeInteger(slot.targetMasterTime))return {ok:false,tolerance:tol};if(Math.abs(c.actualMasterTime-slot.targetMasterTime)>tol)return {ok:false,tolerance:tol};if(slot.phase==='release_window')return {ok:true,tolerance:tol};const iv=phaseInterval(timeline,slot.phase);return {ok:!!iv&&c.actualMasterTime-c.mappingUncertainty>=iv.start&&c.actualMasterTime+c.mappingUncertainty<=iv.end,tolerance:tol};}
function minCostLexMatch(slots,rows,timeline){
  const S=0,slot0=1,frame0=slot0+slots.length,T=frame0+rows.length,N=T+1,adj=Array.from({length:N},()=>[]);function edge(u,v,cap,cost){const a={v,cap,cost,rev:adj[v].length},b={v:u,cap:0,cost:-cost,rev:adj[u].length};adj[u].push(a);adj[v].push(b);}slots.forEach((_,i)=>edge(S,slot0+i,1,0n));rows.forEach((_,j)=>edge(frame0+j,T,1,0n));
  const B=BigInt(rows.length+2),sentinel=BigInt(rows.length+1);const powers=Array(slots.length);let p=1n;for(let i=slots.length-1;i>=0;i--){powers[i]=p;p*=B;}const maxLex=sentinel*p,PRIMARY=maxLex+1n;
  slots.forEach((s,i)=>rows.forEach((r,j)=>{const e=eligible(s,r,timeline);if(e.ok){const delta=BigInt(Math.abs(r.value.actualMasterTime-s.targetMasterTime));const digit=BigInt(j+1);const lex=(digit-sentinel)*powers[i];edge(slot0+i,frame0+j,1,delta*PRIMARY+lex);}}));
  while(true){const dist=Array(N).fill(null),pv=Array(N).fill(-1),pe=Array(N).fill(-1),inq=Array(N).fill(false),q=[S];dist[S]=0n;inq[S]=true;while(q.length){const u=q.shift();inq[u]=false;for(let ei=0;ei<adj[u].length;ei++){const e=adj[u][ei];if(e.cap<=0||dist[u]===null)continue;const nd=dist[u]+e.cost;if(dist[e.v]===null||nd<dist[e.v]){dist[e.v]=nd;pv[e.v]=u;pe[e.v]=ei;if(!inq[e.v]){q.push(e.v);inq[e.v]=true;}}}}if(dist[T]===null)break;for(let v=T;v!==S;v=pv[v]){const e=adj[pv[v]][pe[v]];e.cap--;adj[v][e.rev].cap++;}}
  const out=new Map();for(let i=0;i<slots.length;i++)for(const e of adj[slot0+i])if(e.v>=frame0&&e.v<T&&e.cap===0)out.set(i,e.v-frame0);return out;
}
function project25({runId,cycleId,masterClockId,role,active=true,timeline={},releaseTime=null,candidates=[],projectionId='projection-1',projectionVersion=1,planVersion=PLAN,roleBindings,configDigest='shadow-default'}={}){
  if(!isId(runId)||!isId(cycleId)||!isId(masterClockId)||!['side','overhead','rear'].includes(role)||!isId(projectionId)||!isId(configDigest))throw new TypeError('projection identity required');const hasVerifiedTimeline=Object.entries(timeline||{}).some(([k,v])=>k!=='masterClockId'&&v&&v.status==='verified');if(hasVerifiedTimeline&&timeline.masterClockId!==masterClockId)throw new Error('TIMELINE_CLOCK_MISMATCH');const slots=slotTargets({timeline,releaseTime});const baseSlot=s=>({...s,runId,cycleId,masterClockId,role,projectionId,projectionVersion,planVersion});
  if(!active){const rows=slots.map(s=>({...baseSlot(s),status:'inactive',actualFrameUID:null,derivationId:null,candidateId:null,actualMasterTime:null,signedDelta:null,missingReason:'role_not_active',mappingUncertaintyUs:null,toleranceUs:null,actualPhaseEvidenceRefs:[],selectionReason:'inactive',sourceId:null,streamGeneration:null,frameSeq:null,contentDigest:null,frameEnvelopeRef:null,contributingReasons:[],phaseProof:null}));return immutablePlainCopy({projectionId,projectionVersion,planVersion,runId,cycleId,masterClockId,role,inputCandidateCount:candidates.length,eligibleCandidateCount:0,inputCandidateDigest:sha256Canonical(candidates),timelineDigest:sha256Canonical(timeline),configDigest,slots:rows,uniqueRealCount:0,missingCount:0,inactiveCount:25});}
  const bindings=normalizeBindings(roleBindings);preflightRawUidConflicts(candidates);const ctx={runId,cycleId,masterClockId,role,bindings},classified=candidates.map(c=>classifyCandidate(c,ctx)),ineligibleReasons=classified.filter(x=>!x.ok).map(x=>x.reason),validRows=classified.filter(x=>x.ok),frames=bestDerivations(validRows),assignment=minCostLexMatch(slots,frames,timeline);
  const used=new Set();const rows=slots.map((s,i)=>{const j=assignment.get(i);if(j===undefined){let reason='no_frame_in_tolerance';if(!Number.isSafeInteger(s.targetMasterTime))reason=s.phase==='release_window'?'release_time_unknown':'phase_unverified';else if(candidates.length===0)reason='no_candidates';else if(validRows.length===0)reason=ineligibleReasons.includes('generation_mismatch')?'generation_mismatch':ineligibleReasons.includes('payload_missing')?'payload_missing':ineligibleReasons.includes('clock_uncertain')?'clock_uncertain':'no_eligible_candidates';else if(frames.length===used.size)reason='unique_frame_exhausted';return {...baseSlot(s),status:'missing',actualFrameUID:null,derivationId:null,candidateId:null,actualMasterTime:null,signedDelta:null,missingReason:reason,mappingUncertaintyUs:null,toleranceUs:null,actualPhaseEvidenceRefs:[],selectionReason:'missing',sourceId:null,streamGeneration:null,frameSeq:null,contentDigest:null,frameEnvelopeRef:null,contributingReasons:[...new Set(ineligibleReasons)],phaseProof:null};}
    const r=frames[j],f=r.value,tol=tolerance(r);used.add(f.frameUID);const timelineRefs=[...(s.targetPhaseEvidenceRefs||[])];const phaseRefs=s.phase==='release_window'?[...timelineRefs,...(f.phaseEvidenceRefs||[])]:timelineRefs;const phaseProof=s.phase==='release_window'?null:{phase:s.phase,timelineRefs,intervalCheck:'inside',settledAnchorBoundary:s.phase==='anchor'};return {...baseSlot(s),status:'real',actualFrameUID:f.frameUID,derivationId:f.derivationId,candidateId:f.candidateId,actualMasterTime:f.actualMasterTime,signedDelta:f.actualMasterTime-s.targetMasterTime,missingReason:null,mappingUncertaintyUs:f.mappingUncertainty,toleranceUs:tol,actualPhaseEvidenceRefs:[...new Set(phaseRefs)],selectionReason:'max_cardinality_min_delta_lexicographic',sourceId:f.sourceId,streamGeneration:f.streamGeneration,frameSeq:f.frameSeq,contentDigest:f.contentDigest,frameEnvelopeRef:f.frameEnvelopeRef,contributingReasons:[],phaseProof};});
  const uniqueRealCount=rows.filter(x=>x.status==='real').length,missingCount=rows.filter(x=>x.status==='missing').length;return immutablePlainCopy({projectionId,projectionVersion,planVersion,runId,cycleId,masterClockId,role,inputCandidateCount:candidates.length,eligibleCandidateCount:validRows.length,inputCandidateDigest:sha256Canonical(candidates),timelineDigest:sha256Canonical(timeline),configDigest,slots:rows,uniqueRealCount,missingCount,inactiveCount:0});
}
module.exports={PLAN,SLOT_PLAN,slotTargets,project25,minCostLexMatch};

};
M["replay/virtual_clock.js"]=function(module,exports,require){
'use strict';
class VirtualClock{
  constructor(startUs=0){if(!Number.isSafeInteger(startUs))throw new TypeError('startUs');this.nowUs=startUs;}
  now(){return this.nowUs;}
  set(us){if(!Number.isSafeInteger(us)||us<this.nowUs)throw new RangeError('virtual clock cannot move backward');this.nowUs=us;return us;}
  advance(deltaUs){if(!Number.isSafeInteger(deltaUs)||deltaUs<0)throw new RangeError('deltaUs');this.nowUs+=deltaUs;return this.nowUs;}
}
function deterministicReplay(events,reducer,initialState,clock=new VirtualClock()){
  let state=initialState;
  const out=[];
  for(const e of events){if(Number.isSafeInteger(e.atUs))clock.set(e.atUs);state=reducer(state,e,clock);out.push({atUs:clock.now(),state});}
  return {state,steps:out};
}
module.exports={VirtualClock,deterministicReplay};

};
M["review/view_model.js"]=function(module,exports,require){
'use strict';
const {immutablePlainCopy}=require('../contracts/strict_types');
const {validateProjection}=require('../contracts/record_validators');
function buildReviewView(projection){const p=validateProjection(projection);const slots=p.slots.map(s=>Object.freeze({slotId:s.slotId,phase:s.phase,status:s.status,label:s.status==='real'?s.slotId:s.status==='inactive'?'Inactive':'Missing',frameUID:s.actualFrameUID??null,actualMasterTime:s.actualMasterTime??null,signedDelta:s.signedDelta??null,missingReason:s.missingReason??null,actualPhaseEvidenceRefs:Object.freeze([...(s.actualPhaseEvidenceRefs||[])]),sourceId:s.sourceId??null,streamGeneration:s.streamGeneration??null,frameSeq:s.frameSeq??null,phaseProof:s.phaseProof??null}));return immutablePlainCopy({projectionId:p.projectionId,runId:p.runId,cycleId:p.cycleId,masterClockId:p.masterClockId,planVersion:p.planVersion,role:p.role,slots,realCount:slots.filter(s=>s.status==='real').length,missingCount:slots.filter(s=>s.status==='missing').length,inactiveCount:slots.filter(s=>s.status==='inactive').length});}
function anchorTarget(view){const anchors=view.slots.filter((s,i)=>i>=2&&i<=4&&s.phase==='anchor');const pick=anchors.find(s=>s.status==='real'&&s.phaseProof?.phase==='anchor'&&s.phaseProof.intervalCheck==='inside'&&s.phaseProof.settledAnchorBoundary===true&&Array.isArray(s.phaseProof.timelineRefs)&&s.phaseProof.timelineRefs.length>0);return pick?Object.freeze({status:'real',slotId:pick.slotId,frameUID:pick.frameUID}):Object.freeze({status:'missing',slotId:null,frameUID:null,reason:'verified_anchor_slot_missing'});}
function playbackOrder(projection){const p=validateProjection(projection),real=p.slots.filter(s=>s.status==='real');return Object.freeze(real.slice().sort((a,b)=>(a.actualMasterTime-b.actualMasterTime)||String(a.sourceId).localeCompare(String(b.sourceId))||String(a.streamGeneration).localeCompare(String(b.streamGeneration))||(BigInt(a.frameSeq)<BigInt(b.frameSeq)?-1:BigInt(a.frameSeq)>BigInt(b.frameSeq)?1:0)||String(a.actualFrameUID).localeCompare(String(b.actualFrameUID))).map(s=>s.actualFrameUID));}
module.exports={buildReviewView,anchorTarget,playbackOrder,validateProjection};

};
M["ring/role_ring.js"]=function(module,exports,require){
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

};
M["scheduler/priority_scheduler.js"]=function(module,exports,require){
'use strict';
function isPlainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function validateDescriptor(d){if(!isPlainObject(d)||typeof d.workerId!=='string'||!d.workerId||typeof d.messageType!=='string'||!d.messageType||!(d.payloadRef===null||typeof d.payloadRef==='string'))throw new TypeError('scheduler requires serializable worker descriptor');for(const v of Object.values(d))if(typeof v==='function')throw new TypeError('scheduler descriptor must not contain functions');return Object.freeze({...d});}
class LatestLane{
  constructor(name,{onDrop,onOutcome,execute,timeoutMs,isCancelled}){this.name=name;this.onDrop=onDrop;this.onOutcome=onOutcome;this.execute=execute;this.timeoutMs=timeoutMs;this.isCancelled=isCancelled;this.active=false;this.pending=null;this.generation=null;this.token=0;}
  submit(job){if(!job||!job.descriptor)throw new TypeError('descriptor required');if(!this.active){this._start(job);return {accepted:true,replaced:false};}const replaced=!!this.pending;if(replaced)this.onDrop(this.pending,'replaced_by_latest');this.pending=job;return {accepted:true,replaced};}
  cancelGeneration(generation){if(this.pending&&this.pending.meta?.generation===generation){this.onDrop(this.pending,'generation_cancelled');this.pending=null;}}
  _start(job){
    this.active=true;this.generation=job.meta?.generation??null;const myToken=++this.token;let timer=null;
    const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>{const e=new Error('SCHEDULER_JOB_TIMEOUT');e.code='SCHEDULER_JOB_TIMEOUT';rej(e);},this.timeoutMs);});
    Promise.race([Promise.resolve().then(()=>this.execute(job.descriptor,job.meta)),timeout]).then(v=>{
      if(this.isCancelled(job.meta?.generation))this.onOutcome(job,'stale_discarded',v);else this.onOutcome(job,'completed',v);
    },e=>{if(e&&e.code==='SCHEDULER_JOB_TIMEOUT')this.onOutcome(job,'timed_out',e);else if(this.isCancelled(job.meta?.generation))this.onOutcome(job,'stale_discarded',e);else this.onOutcome(job,'failed',e);}).finally(()=>{
      if(timer)clearTimeout(timer);if(myToken!==this.token)return;this.active=false;this.generation=null;const next=this.pending;this.pending=null;if(next)this._start(next);
    });
  }
}
class AnalysisScheduler{
  constructor({onDrop=null,onOutcome=null,executor=null,jobTimeoutMs=1000}={}){
    if(typeof executor!=='function')executor=async()=>{throw new Error('SCHEDULER_EXECUTOR_UNAVAILABLE');};
    if(!Number.isInteger(jobTimeoutMs)||jobTimeoutMs<1)throw new TypeError('jobTimeoutMs required');
    this.cancelledGenerations=new Set();this.metrics={sideSubmitted:0,auxSubmitted:0,droppedPending:0,failed:0,completed:0,timedOut:0,staleDiscarded:0,observerErrors:0};
    this._safeDrop=(job,reason)=>{this.metrics.droppedPending++;try{onDrop?.(job,reason);}catch{this.metrics.observerErrors++;}};
    this._safeOutcome=(job,status,value)=>{if(status==='failed')this.metrics.failed++;else if(status==='timed_out')this.metrics.timedOut++;else if(status==='stale_discarded')this.metrics.staleDiscarded++;else this.metrics.completed++;try{onOutcome?.(job,status,value);}catch{this.metrics.observerErrors++;}};
    const isCancelled=g=>g!=null&&this.cancelledGenerations.has(g);this.executor=executor;this.jobTimeoutMs=jobTimeoutMs;
    this.side=new LatestLane('side',{onDrop:this._safeDrop,onOutcome:this._safeOutcome,execute:executor,timeoutMs:jobTimeoutMs,isCancelled});this.auxActive=false;this.auxToken=0;this.auxPending={overhead:null,rear:null};this.auxTurn='overhead';this.isCancelled=isCancelled;
  }
  submit(role,descriptor,meta={}){
    if(typeof descriptor==='function')throw new TypeError('scheduler does not accept functions');const desc=validateDescriptor(descriptor);if(meta.dispatchKind!==undefined&&meta.dispatchKind!=='worker-dispatch')throw new TypeError('invalid dispatchKind');const job={role,descriptor:desc,meta:{...meta,dispatchKind:'worker-dispatch'}};
    if(role==='side'){this.metrics.sideSubmitted++;return this.side.submit(job);}if(!['overhead','rear'].includes(role))throw new TypeError('invalid role');this.metrics.auxSubmitted++;if(!this.auxActive){this._startAux(job);return {accepted:true,replaced:false};}const replaced=!!this.auxPending[role];if(replaced)this._safeDrop(this.auxPending[role],'replaced_by_latest');this.auxPending[role]=job;return {accepted:true,replaced};
  }
  cancelGeneration(generation){if(generation==null)return;this.cancelledGenerations.add(generation);this.side.cancelGeneration(generation);for(const role of ['overhead','rear'])if(this.auxPending[role]?.meta?.generation===generation){this._safeDrop(this.auxPending[role],'generation_cancelled');this.auxPending[role]=null;}}
  _startAux(job){
    this.auxActive=true;this.auxTurn=job.role==='overhead'?'rear':'overhead';const token=++this.auxToken;let timer=null;const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>{const e=new Error('SCHEDULER_JOB_TIMEOUT');e.code='SCHEDULER_JOB_TIMEOUT';rej(e);},this.jobTimeoutMs);});
    Promise.race([Promise.resolve().then(()=>this.executor(job.descriptor,job.meta)),timeout]).then(v=>{this._safeOutcome(job,this.isCancelled(job.meta?.generation)?'stale_discarded':'completed',v);},e=>{this._safeOutcome(job,e?.code==='SCHEDULER_JOB_TIMEOUT'?'timed_out':this.isCancelled(job.meta?.generation)?'stale_discarded':'failed',e);}).finally(()=>{if(timer)clearTimeout(timer);if(token!==this.auxToken)return;this.auxActive=false;const first=this.auxPending[this.auxTurn]?this.auxTurn:(this.auxPending.overhead?'overhead':this.auxPending.rear?'rear':null);if(first){const n=this.auxPending[first];this.auxPending[first]=null;this._startAux(n);}});
  }
  snapshot(){return Object.freeze({metrics:Object.freeze({...this.metrics}),sideActive:this.side.active,sidePending:!!this.side.pending,auxActive:this.auxActive,auxPending:Object.freeze({overhead:!!this.auxPending.overhead,rear:!!this.auxPending.rear}),cancelledGenerations:Object.freeze([...this.cancelledGenerations])});}
}
module.exports={AnalysisScheduler,validateDescriptor};

};
M["telemetry/event_tape.js"]=function(module,exports,require){
'use strict';
const {utf8ByteLength}=require('../contracts/binary_pure');
const {immutablePlainCopy}=require('../contracts/strict_types');
class EventTape{
  constructor({maxEvents=20000,maxApproxBytes=8*1024*1024}={}){this.maxEvents=maxEvents;this.maxApproxBytes=maxApproxBytes;this.events=[];this.bytes=0;this.dropped=0;this.seq=0;}
  append(event){
    const row=immutablePlainCopy({...event,sequence:++this.seq});
    const n=utf8ByteLength(JSON.stringify(row));
    this.events.push(row);this.bytes+=n;
    while(this.events.length>this.maxEvents||this.bytes>this.maxApproxBytes){const x=this.events.shift();this.bytes-=utf8ByteLength(JSON.stringify(x));this.dropped++;}
    return row;
  }
  snapshot(){return immutablePlainCopy({events:this.events,dropped:this.dropped,sequence:this.seq,approxBytes:this.bytes});}
}
module.exports={EventTape};

};

function norm(path){const out=[];for(const p of path.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!out.length)throw new Error('module path escapes root');out.pop();}else out.push(p);}return out.join('/');}
function resolve(req,parent){if(req[0]!=='.')throw new Error('external module forbidden in browser bundle: '+req);const base=parent.split('/');base.pop();let id=norm(base.join('/')+'/'+req);if(!id.endsWith('.js'))id+='.js';if(!M[id])throw new Error('module not found: '+id+' from '+parent);return id;}
function load(id){id=norm(id);if(C[id])return C[id].exports;if(!M[id])throw new Error('module not found: '+id);const module={exports:{}};C[id]=module;M[id](module,module.exports,(req)=>load(resolve(req,id)));return module.exports;}
const api=Object.create(null);
api["contracts"]=load("contracts/contract_v1.js");
api["records"]=load("contracts/record_validators.js");
api["identity"]=load("contracts/identity.js");
api["clock"]=load("contracts/clock_mapper.js");
api["replay"]=load("adapters/replay/replay_adapter.js");
api["ring"]=load("ring/role_ring.js");
api["scheduler"]=load("scheduler/priority_scheduler.js");
api["events"]=load("event_log/in_memory_event_log.js");
api["writer"]=load("evidence_writer/in_memory_writer.js");
api["projector"]=load("projector/logical25.js");
api["review"]=load("review/view_model.js");
api["archive"]=load("archive/shadow_archive.js");
api["telemetry"]=load("telemetry/event_tape.js");
Object.freeze(api);root.ThreePMShadow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
