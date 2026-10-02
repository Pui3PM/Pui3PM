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
