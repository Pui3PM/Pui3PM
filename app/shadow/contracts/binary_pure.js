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
// S-01: linear, table-driven base64. No regex (V8 regex recursion overflowed above ~3.2 MB).
const DEC=(function(){const t=new Int16Array(256).fill(-1);for(let i=0;i<64;i++)t[ABC.charCodeAt(i)]=i;return t;})();
function base64Encode(value){const b=bytes(value),parts=[];const CHUNK=3*8192;for(let start=0;start<b.length;start+=CHUNK){const end=Math.min(b.length,start+CHUNK);let out='';for(let i=start;i<end;i+=3){const a=b[i],c=i+1<end?b[i+1]:0,d=i+2<end?b[i+2]:0,n=(a<<16)|(c<<8)|d;out+=ABC[(n>>>18)&63]+ABC[(n>>>12)&63]+(i+1<end?ABC[(n>>>6)&63]:'=')+(i+2<end?ABC[n&63]:'=');}parts.push(out);}return parts.join('');}
function base64Decode(s){
  if(typeof s!=='string'||s.length%4!==0)throw new Error('INVALID_BASE64');
  const L=s.length;let pad=0;if(L>0&&s.charCodeAt(L-1)===61){pad=1;if(s.charCodeAt(L-2)===61)pad=2;}
  const out=new Uint8Array((L/4)*3-pad),dataLen=L-pad;let oi=0;
  for(let i=0;i<L;i+=4){
    const q=[0,0,0,0];
    for(let k=0;k<4;k++){const idx=i+k,code=s.charCodeAt(idx);if(idx>=dataLen){if(code!==61)throw new Error('INVALID_BASE64');continue;}const v=code<256?DEC[code]:-1;if(v<0)throw new Error('INVALID_BASE64');q[k]=v;}
    const n=(q[0]<<18)|(q[1]<<12)|(q[2]<<6)|q[3];
    out[oi++]=(n>>>16)&255;if(oi<out.length)out[oi++]=(n>>>8)&255;if(oi<out.length)out[oi++]=n&255;
  }
  // Canonical padding: the unused low bits of the last sextet must be zero (QQ== valid, QR== invalid).
  if(pad===2&&(DEC[s.charCodeAt(L-3)]&15)!==0)throw new Error('INVALID_BASE64');
  if(pad===1&&(DEC[s.charCodeAt(L-2)]&3)!==0)throw new Error('INVALID_BASE64');
  return out;
}
function utf8ByteLength(s){if(typeof s!=='string')throw new TypeError('string required');return new TextEncoder().encode(s).length;}
return{bytes,base64Encode,base64Decode,utf8ByteLength};
});
