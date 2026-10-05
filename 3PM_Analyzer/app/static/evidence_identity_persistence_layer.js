// Post-P108: stamp identity before the existing serialized writer. No decision authority.
(function(){
'use strict';
const FI=window.FrameIdentityCore;
if(!FI||typeof evidenceDbMerge!=='function')throw new Error('Evidence identity writer dependencies missing');
const original=evidenceDbMerge,objects=new WeakMap(),payloads=new WeakMap();
function stamp(f){
  if(!f||!f.blob||FI.frameUIDOf(f))return f;
  let uid=objects.get(f);
  const device=f.deviceID??f.deviceId??f.streamID??null;
  const seq=FI.known(f.frameSeq),media=FI.known(f.mediaTime);
  if(FI.sourceOf(f)&&FI.generationOf(f)!==null&&device&&(seq!==null||media!==null)) {
    uid='c1/'+encodeURIComponent(JSON.stringify([FI.sourceOf(f),FI.generationOf(f),device,FI.clockDomain(f),seq,media]));
  }
  const source=FI.sourceOf(f),generation=FI.generationOf(f);
  // Object identity proves retries of a payload only inside the identical capture envelope.
  const domain=JSON.stringify([source,generation,f.deviceID??f.deviceId??null,f.epochMs,f.mediaTime??null,f.frameSeq??null]);
  let map=payloads.get(f.blob);
  if(!uid&&source&&map)uid=map.get(domain);
  if(!uid){uid='p1/'+crypto.randomUUID();objects.set(f,uid);if(source){if(!map){map=new Map();payloads.set(f.blob,map);}map.set(domain,uid);}}
  return {...f,frameUID:uid};
}
evidenceDbMerge=function(record){
  const frames=(record?.frames||[]).map(stamp);
  // Join original R7 queue immediately. No await/read/put outside that queue.
  return original({...record,frames,evidenceInputCounts:{receivedBatch:frames.length,uniqueBatch:FI.uniqueFrames(frames).length}});
};
window.EvidenceIdentityPersistenceLayer=Object.freeze({version:'R8-Post-P108-persist-identity-v1',stamp});
})();
