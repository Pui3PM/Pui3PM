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
