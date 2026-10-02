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
    // S-03: exact namespace segment; 'shadow/replayPRODUCTION' is not under shadow/replay.
    if(input.calibrationMethod==='fixture'&&!(input.mappingNamespace==='shadow/replay'||input.mappingNamespace.startsWith('shadow/replay/')))fail('fixture mapping cannot be validated outside shadow/replay');
    if(input.calibrationMethod==='sample-affine'&&(input.residualBoundUs===null||input.transportBoundUs===null))fail('sample-affine validated mapping requires residual and transport bounds');
    if(input.calibrationMethod==='trusted-api'&&(!isId(input.trustedApiId)||input.transportBoundUs===null))fail('trusted-api validated mapping requires trustedApiId and transport bound');
    // S-03: the total bound covers every declared component, including when another component is unknown (null).
    if(input.uncertaintyBoundUs<(input.residualBoundUs??0)+(input.transportBoundUs??0))fail('uncertainty bound smaller than component bounds');
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
