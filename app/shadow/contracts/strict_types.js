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
// S-02: FrameUID is canonical lower-case hex only; an upper-case spelling is a different string, never an alias.
function isFrameUID(v){ return typeof v==='string' && /^f1\/[0-9a-f]{64}$/.test(v); }
// S-04/S-05 (INV-009/INV-030): the shadow write capability is an invariant, not a parameter.
// One predicate shared by event log, evidence writer, reducer, archive records and importer.
const SHADOW_NS_PREFIX='shadow/';
function isShadowNamespace(ns){
  return isId(ns)&&ns.startsWith(SHADOW_NS_PREFIX)&&ns.length>SHADOW_NS_PREFIX.length&&!/production|legacy/i.test(ns);
}
function shadowNamespacePolicy(prefix,label){
  // Optional constructor prefix may only narrow the invariant (e.g. 'shadow/replay/'), never widen it.
  if(prefix===undefined||prefix===null)return SHADOW_NS_PREFIX;
  if(typeof prefix!=='string'||!prefix.startsWith(SHADOW_NS_PREFIX)||/production|legacy/i.test(prefix))throw new TypeError(`${label}: namespace policy is fixed to shadow/ (got ${JSON.stringify(prefix)})`);
  return prefix;
}
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
  parseBoundedIntegerString,isU64String,isI64String,isWellFormedString,isId,isFrameUID,isSha256,SHADOW_NS_PREFIX,isShadowNamespace,shadowNamespacePolicy,requireField,assertKnownOrNull,timeUsOrNull,durationUsOrNull,
  clonePlain,deepFreeze,immutablePlainCopy,assertNoUnknownFields
};
