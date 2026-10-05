// Post-P108: stamp identity before the existing serialized writer. No decision authority.
// R2 (2026-10-05, Claude Code): a FrameUID is derived from capture PROVENANCE only, never from timestamps or sizes.
//   - same Blob instance              -> same UID (one encode = one capture: retries, re-plans, shallow copies)
//   - same live dense-buffer entry    -> same UID for every JPEG re-encode of it (frozen app.js re-encodes native30
//                                        bitmaps on each persist; v1 gave each re-encode a new random UID -> duplicates)
//   - explicit clock domain + seq/media -> deterministic UID, consistent with FrameIdentityCore.sameFrame
//   - historical rows stored WITHOUT a UID get a deterministic UID on every read (record key + release + stored
//     position), so a stale snapshot and the queue's own readback of one stored version agree. Rows are never
//     merged or dropped by this; a stored clone pair stays two rows (no proof to collapse it).
// v1 stamped 'p1/<random>' per frame OBJECT: every readback, retry or re-encode of one frame became a new frame.
(function(){
'use strict';
const FI=window.FrameIdentityCore;
if(!FI||typeof evidenceDbMerge!=='function')throw new Error('Evidence identity writer dependencies missing');
const VERSION='R8-Post-P108-persist-identity-v2';
const STORE='shotEvidence';
const byPayload=new WeakMap();   // Blob instance -> FrameUID
const byCapture=new WeakMap();   // live dense-buffer entry (frozen app.js liveDenseFrameBuffers row) -> FrameUID
const stats={stamped:0,payload:0,capture:0,domain:0,fresh:0,historical:0};
let serial=0;
function freshId(){
  try{if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();}catch{}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}-${(++serial).toString(36)}`;
}
const payloadOf=f=>f&&f.blob&&typeof f.blob==='object'?f.blob:null;
// Deterministic for every row FrameIdentityCore.sameFrame treats as one camera frame inside one explicit domain.
function domainUID(f){
  if(!FI.explicitDomain(f))return null;
  const seq=FI.known(f.frameSeq),media=FI.known(f.mediaTime);if(seq===null&&media===null)return null;
  return 'c2/'+encodeURIComponent(JSON.stringify([FI.sourceOf(f),FI.generationOf(f),FI.deviceOf(f),FI.clockDomain(f),seq!==null?['q',seq]:['m',media]]));
}
function stamp(f){
  if(!f||typeof f!=='object'||!f.blob||FI.frameUIDOf(f))return f;
  const p=payloadOf(f);let uid=p?byPayload.get(p):null;
  if(uid)stats.payload++;
  else if((uid=domainUID(f)))stats.domain++;
  else{uid='p2/'+freshId();stats.fresh++;}
  if(p&&!byPayload.has(p))byPayload.set(p,uid);
  stats.stamped++;
  return {...f,frameUID:uid};
}
// Historical rows: deterministic per stored record version; mutates the given (freshly read) record in place.
function stampStoredRecord(rec){
  if(!rec||typeof rec!=='object'||!Array.isArray(rec.frames))return rec;
  if(rec.frames.every(f=>!f||typeof f!=='object'||FI.frameUIDOf(f)))return rec;
  const key=String(rec.key||`${rec.sessionId}:${rec.shotId}:${rec.role||'side'}`),release=FI.known(rec.releaseEpochMs);
  rec.frames.forEach((f,i)=>{
    if(!f||typeof f!=='object'||FI.frameUIDOf(f))return;
    f.frameUID=domainUID(f)||`h2/${encodeURIComponent(key)}/${release===null?'?':release}/${i}`;stats.historical++;
    const p=payloadOf(f);if(p&&!byPayload.has(p))byPayload.set(p,f.frameUID);
  });
  return rec;
}
function stampStoredResult(result){if(Array.isArray(result))result.forEach(stampStoredRecord);else stampStoredRecord(result);return result;}

// Re-encodes of one buffered native30 bitmap share the buffer entry's UID (frozen app.js passes {...entry,denseRef:entry}).
if(typeof evidenceFrameToBlob==='function'){
  const encode=evidenceFrameToBlob;
  evidenceFrameToBlob=async function(frame,...rest){
    const blob=await encode(frame,...rest);
    try{
      const capture=frame&&typeof frame==='object'?(frame.denseRef&&typeof frame.denseRef==='object'?frame.denseRef:frame):null;
      if(blob&&typeof blob==='object'&&capture&&!frame.blob&&!byPayload.has(blob)){
        let uid=byCapture.get(capture);if(!uid){uid='b2/'+freshId();byCapture.set(capture,uid);}else stats.capture++;
        byPayload.set(blob,uid);
      }
    }catch(err){console.warn('3PM evidence identity: capture provenance not recorded',err);}
    return blob;
  };
}
// Every read of the evidence store returns UID-bearing rows (frozen app.js get + layers' raw getAll snapshots).
if(typeof evidenceDbGet==='function'){
  const read=evidenceDbGet;
  evidenceDbGet=async function(...args){return stampStoredRecord(await read(...args));};
}
function hookReads(proto,isEvidence){
  if(!proto)return;
  for(const name of ['get','getAll']){
    const original=proto[name];if(typeof original!=='function'||original.__threePmIdentity)continue;
    const wrapped=function(...args){
      const req=original.apply(this,args);
      try{if(isEvidence(this)&&req&&typeof req.addEventListener==='function')req.addEventListener('success',()=>{try{stampStoredResult(req.result);}catch(err){console.warn('3PM evidence identity: read stamp failed',err);}});}catch{}
      return req;
    };
    wrapped.__threePmIdentity=true;proto[name]=wrapped;
  }
}
if(typeof IDBObjectStore!=='undefined')hookReads(IDBObjectStore.prototype,st=>st?.name===STORE);
if(typeof IDBIndex!=='undefined')hookReads(IDBIndex.prototype,ix=>ix?.objectStore?.name===STORE);

const original=evidenceDbMerge;
evidenceDbMerge=function(record){
  const frames=(record?.frames||[]).map(stamp);
  // Join original R7 queue immediately. No await/read/put outside that queue.
  return original({...record,frames,evidenceInputCounts:{receivedBatch:frames.length,uniqueBatch:FI.uniqueFrames(frames).length}});
};
window.EvidenceIdentityPersistenceLayer=Object.freeze({version:VERSION,stamp,stampStoredRecord,stampStoredResult,stats:()=>({...stats})});
})();
