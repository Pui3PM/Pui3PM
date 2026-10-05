'use strict';
// N13: base64Decode validation regex overflows the V8 regex stack on large payloads -> archive with a large blob cannot validate.
const path=require('path'),crypto=require('crypto');const APP=path.resolve(process.argv[2]||'.');
const Bin=require(path.join(APP,'shadow/contracts/binary_pure'));const AR=require(path.join(APP,'shadow/archive/shadow_archive'));
const ok=n=>{try{Bin.base64Decode(Bin.base64Encode(new Uint8Array(n)));return true;}catch(e){return e instanceof RangeError?false:(()=>{throw e;})();}};
let lo=1024,hi=8*1024*1024;if(ok(hi)){console.log(JSON.stringify({defectReproduced:false,maxTested:hi}));process.exit(0);}
while(hi-lo>4096){const m=Math.floor((lo+hi)/2);if(ok(m))lo=m;else hi=m;}
const base=crypto.createHash('sha256').update('b').digest('hex');let archiveErr=null;
try{AR.buildArchive({archiveId:'big',baselineDigest:base,records:{frames:[],candidates:[],events:[],projections:[]},files:{'clip.bin':new Uint8Array(hi+65536)}});}catch(e){archiveErr=e.constructor.name+': '+e.message;}
console.log(JSON.stringify({defectReproduced:true,largestDecodableBytes:lo,firstFailingBytesApprox:hi,archiveBuildWithBlobAboveLimit:archiveErr,contractMaxTotalBytes:512*1024*1024}));
