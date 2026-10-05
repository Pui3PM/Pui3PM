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
