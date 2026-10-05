// 3PM R8 P1-08 Frame Identity + Clock-Domain Chronology Core
// Pure shared rules (no DOM, no shot authority). Used by temporal_evidence_core, evidence_budget_core and
// camera_timeline_core so identity and chronology cannot drift between modules.
//
// H-01  mediaTime / frameSeq are LOCAL to one clock domain (one source pipeline + stream generation).
//       Browser video media time and native AVFoundation presentation time are different domains and are
//       never compared with each other. The only clock comparable across domains is epochMs (capture wall
//       clock on the same machine). Physical order = each domain in its own camera order, domains merged by
//       epochMs. Unknown clocks are never invented (null/undefined/''/boolean are UNKNOWN, never 0).
// H-02  Identity layers (Post-P108 R2): durable FrameUID > stream generation fence > camera identity (mediaTime or
//       frameSeq) inside one EXPLICIT clock domain = known source AND known generation (and the same device when
//       either names one) > the same payload object (one Blob instance) corroborated by an agreeing camera label.
//       Persisted copies must carry FrameUID (stamped before the R7 writer and on readback of historical rows by
//       evidence_identity_persistence_layer.js). Timestamp, payload size and epoch proximity never prove identity.
//       Different FrameUIDs, generations, devices or native-vs-browser frames are never merged.
// R2 history: v3 additionally required a device/stream id for any camera identity or camera order. No capture
//       pipeline in this tree emits one (frozen app.js, worker, native bridge), so v3 turned every re-delivery of
//       one frame into a new row and ordered native frames by jittered callback epoch. v4 keeps the v3 negatives
//       (equal time/size, unknown source or generation never merge) and restores the P1-08 domain definition.
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.FrameIdentityCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='R8-Post-P1-08-frame-identity-v4';
const objectKeys=new WeakMap();let nextObjectKey=0;
function objectKey(f){if(!objectKeys.has(f))objectKeys.set(f,'object:'+ ++nextObjectKey);return objectKeys.get(f);}
// Payload identity: a shallow copy ({...f}) keeps the same Blob instance, a structuredClone/IndexedDB copy does not.
const payloadKeys=new WeakMap();let nextPayloadKey=0;
function payloadOf(f){const b=f?.blob;return b&&typeof b==='object'?b:null;}
function payloadKey(b){if(!payloadKeys.has(b))payloadKeys.set(b,'payload:'+ ++nextPayloadKey);return payloadKeys.get(b);}
function deviceOf(f){return text(f?.deviceID)||text(f?.deviceId)||text(f?.streamID);}
// Explicit clock domain = known source pipeline AND known stream generation (P1-08 contract D-108-04).
function explicitDomain(f){return !!sourceOf(f)&&generationOf(f)!==null;}
function domainMatches(a,b,A){
  if(!explicitDomain(a)||!explicitDomain(b))return false;
  const da=deviceOf(a),db=deviceOf(b);
  if((da||db)&&da!==db)return false;                                          // one-sided or different device: not comparable
  return sourceOf(a)===sourceOf(b)&&generationOf(a)===generationOf(b)&&A.domain(a)===A.domain(b);
}
const PIPELINE_FOLD_MS=8;                                                   // API compatibility only: epoch proximity is not identity (v4)
const SAME_MEDIA_S=0.0008;
const known=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v))?Number(v):null;
const text=v=>typeof v==='string'&&v.trim()!==''?v.trim():null;
function sourceOf(f){return text(f?.source)||'';}
function generationOf(f){const g=f?.generation;if(typeof g==='number'&&Number.isFinite(g))return String(g);return text(g);}
function frameUIDOf(f){return text(f?.frameUID);}
function blobSize(f){return known(f?.blob?.size);}
// Native bridge sources are 'native-<backend>-...'. 'native30' is the BROWSER dense buffer of frozen app.js.
function deviceFamily(f){const s=sourceOf(f).toLowerCase();if(!s)return 'unknown';if(/^native-/.test(s))return 'native-bridge';return 'browser-track';}
function clockDomain(f){return text(f?.clockDomain)||`${sourceOf(f)||'unknown-source'}|g${generationOf(f)??'?'}`;}
const defaults={epoch:f=>known(f?.epochMs),media:f=>known(f?.mediaTime),seq:f=>known(f?.frameSeq)};
function accessors(o={}){return {epoch:o.epoch||defaults.epoch,media:o.media||defaults.media,seq:o.seq||defaults.seq,domain:o.domain||clockDomain};}
function mediaComparable(a,b,o){const A=accessors(o);return domainMatches(a,b,A)&&A.media(a)!==null&&A.media(b)!==null;}

function sameFrame(a,b,o){
  if(!a||!b)return false;if(a===b)return true;
  const ua=frameUIDOf(a),ub=frameUIDOf(b);if(ua&&ub)return ua===ub;            // durable identity decides
  const ga=generationOf(a),gb=generationOf(b);if(ga!==null&&gb!==null&&ga!==gb)return false;
  // Camera identity inside one explicit clock domain decides first, both ways: equal frameSeq/mediaTime is one frame
  // (R7 contract: the same real media frame never counts twice); a contradictory one is two frames even when the
  // rows share a payload object (a labelling conflict is kept visible, never resolved by deleting a row).
  const A=accessors(o);
  if(domainMatches(a,b,A)){
    const ma=A.media(a),mb=A.media(b),qa=A.seq(a),qb=A.seq(b);
    const mediaKnown=ma!==null&&mb!==null,seqKnown=qa!==null&&qb!==null;
    if(seqKnown){if(qa!==qb)return false;return !mediaKnown||Math.abs(ma-mb)<SAME_MEDIA_S;}
    if(mediaKnown)return Math.abs(ma-mb)<SAME_MEDIA_S;
  }
  // The same Blob instance arriving through two evidence paths is one encoded capture (R7/BLE43882 contract) when a
  // camera label from one pipeline corroborates it (equal frameSeq, or equal mediaTime). A shared Blob without any
  // agreeing label is not merged (placeholder/fixture payloads; production rows already carry a provenance FrameUID).
  // Native and browser rows never fold. Labels alone, outside an explicit domain, are never identity proof.
  const pa=payloadOf(a);
  if(pa&&pa===payloadOf(b)){
    const fa=deviceFamily(a),fb=deviceFamily(b);if(fa!=='unknown'&&fb!=='unknown'&&fa!==fb)return false;
    const sa=sourceOf(a),sb=sourceOf(b);if(sa&&sb&&sa!==sb)return false;
    const ma=A.media(a),mb=A.media(b),qa=A.seq(a),qb=A.seq(b);
    if(qa!==null&&qb!==null)return qa===qb&&(ma===null||mb===null||Math.abs(ma-mb)<SAME_MEDIA_S);
    return ma!==null&&mb!==null&&Math.abs(ma-mb)<SAME_MEDIA_S;
  }
  // Equal epochs, equal payload sizes, near epochs, source labels alone: NOT identity proof. Keep both rows
  // (a retained duplicate is visible and recoverable; a false merge silently deletes a real frame).
  return false;
}

// Selection key of an already-unique row: stable across shallow copies ({...f} keeps the Blob instance and labels),
// never shared by two rows that sameFrame keeps apart (labels and epoch disambiguate a shared placeholder payload),
// and never an epoch-only or media-only key across domains.
function idKey(f,o){
  const u=frameUIDOf(f);if(u)return 'uid:'+u;
  const A=accessors(o),p=payloadOf(f);
  return `${p?payloadKey(p):objectKey(f)}|${A.domain(f)}|q${A.seq(f)??'?'}|m${A.media(f)??'?'}|e${A.epoch(f)??'?'}`;
}

// Deterministic physical order. A clock domain is split into continuous segments wherever its local clock and
// the capture epoch disagree by more than DISCONTINUITY_MS (a media clock reset / stream restart without a new
// generation label, e.g. video.currentTime restarting). Within a segment: camera order (mediaTime if every frame
// has it, else frameSeq if every frame has it, else epoch). Segments are merged on epochMs only.
const DISCONTINUITY_MS=1000;
function segments(rows,A){
  const allMedia=rows.every(r=>A.media(r.f)!==null),allSeq=!allMedia&&rows.every(r=>A.seq(r.f)!==null);
  if(!allMedia&&!allSeq)return [{rows,primary:r=>A.epoch(r.f)}];
  const byEpoch=[...rows].sort((x,y)=>(A.epoch(x.f)-A.epoch(y.f))||(x.i-y.i)),out=[[byEpoch[0]]];
  for(let k=1;k<byEpoch.length;k++){
    const p=byEpoch[k-1].f,c=byEpoch[k].f,de=A.epoch(c)-A.epoch(p);
    const brk=allMedia?Math.abs((A.media(c)-A.media(p))*1000-de)>DISCONTINUITY_MS:(A.seq(c)-A.seq(p))<-5;
    if(brk)out.push([byEpoch[k]]);else out[out.length-1].push(byEpoch[k]);
  }
  const primary=allMedia?r=>A.media(r.f):r=>A.seq(r.f);
  return out.map(rs=>({rows:rs,primary}));
}
function physicalOrder(frames=[],o){
  const A=accessors(o),groups=new Map();
  (frames||[]).forEach((f,i)=>{if(!f||A.epoch(f)===null)return;const d=A.domain(f)+'|dev:'+(deviceOf(f)||'');if(!groups.has(d))groups.set(d,[]);groups.get(d).push({f,i});});
  const lanes=[];
  for(const [d,rows] of [...groups.entries()].sort((x,y)=>x[0]<y[0]?-1:x[0]>y[0]?1:0)){
    segments(rows,A).forEach((seg,k)=>{
      seg.rows.sort((x,y)=>(seg.primary(x)-seg.primary(y))||(A.epoch(x.f)-A.epoch(y.f))||(idKey(x.f,o)<idKey(y.f,o)?-1:idKey(x.f,o)>idKey(y.f,o)?1:0)||(x.i-y.i));
      lanes.push({d:d+'#'+k,rows:seg.rows,p:0});
    });
  }
  const out=[];
  for(;;){
    let pick=null;
    for(const l of lanes){if(l.p>=l.rows.length)continue;if(!pick||A.epoch(l.rows[l.p].f)<A.epoch(pick.rows[pick.p].f))pick=l;}
    if(!pick)break;out.push(pick.rows[pick.p++].f);
  }
  return out;
}
// Unique logical real frames. rank(f) chooses the kept representation when two rows are one frame.
function uniqueFrames(frames=[],{rank=()=>0,merge=null,...o}={}){
  const kept=[];
  for(const f of physicalOrder(frames,o)){
    const incomingUID=frameUIDOf(f);
    const slot=kept.find(k=>{
      const knownUIDs=[...new Set(k.aliases.map(frameUIDOf).filter(Boolean))];
      // An unknown alias can never bridge two durable identities.
      if(incomingUID&&knownUIDs.length&&knownUIDs.some(u=>u!==incomingUID))return false;
      return k.aliases.some(x=>sameFrame(x,f,o));
    });
    if(!slot){kept.push({rep:f,aliases:[f]});continue;}
    slot.aliases.push(f);
    const better=rank(f)>rank(slot.rep)||(rank(f)===rank(slot.rep)&&!frameUIDOf(slot.rep)&&frameUIDOf(f));
    slot.rep=merge?merge(slot.rep,f,better):(better?f:slot.rep);
  }
  return physicalOrder(kept.map(k=>k.rep),o);
}
function isPhysicalOrder(frames=[],o){const p=physicalOrder(frames,o);return p.length===(frames||[]).length&&p.every((f,i)=>f===frames[i]);}
function nativeFrameUID({role,generation,frameSeq,epochMs}){const g=known(generation),q=known(frameSeq),e=known(epochMs);return g===null||q===null||e===null?null:`n1/${String(role||'side')}/${g}/${q}/${e}`;}
function workerFrameUID({role,generation,frameSeq,epochMs,source}){const g=known(generation),q=known(frameSeq),e=known(epochMs);return g===null||q===null||e===null?null:`w1/${String(role||'side')}/${String(source||'worker')}/${g}/${q}/${e}`;}
return Object.freeze({VERSION,PIPELINE_FOLD_MS,DISCONTINUITY_MS,known,sourceOf,generationOf,frameUIDOf,deviceOf,deviceFamily,clockDomain,explicitDomain,mediaComparable,sameFrame,idKey,physicalOrder,uniqueFrames,isPhysicalOrder,nativeFrameUID,workerFrameUID});
});
