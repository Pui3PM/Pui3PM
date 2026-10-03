// 3PM R8 P1-08 Frame Identity + Clock-Domain Chronology Core
// Pure shared rules (no DOM, no shot authority). Used by temporal_evidence_core, evidence_budget_core and
// camera_timeline_core so identity and chronology cannot drift between modules.
//
// H-01  mediaTime / frameSeq are LOCAL to one clock domain (one source pipeline + stream generation).
//       Browser video media time and native AVFoundation presentation time are different domains and are
//       never compared with each other. The only clock comparable across domains is epochMs (capture wall
//       clock on the same machine). Physical order = each domain in its own camera order, domains merged by
//       epochMs. Unknown clocks are never invented (null/undefined/''/boolean are UNKNOWN, never 0).
// H-02  Identity layers: durable FrameUID > stream generation > same-domain camera identity (mediaTime or
//       frameSeq) > exact persisted copy (same source, same capture epoch, same payload size: survives
//       structuredClone / IndexedDB readback, unlike Blob object identity) > browser pipeline duplicate
//       (two browser pipelines of the same track, at least one without durable identity, <= 8 ms apart).
//       Anything else stays distinct: different FrameUIDs, generations, devices or native-vs-browser frames
//       are never merged because of equal mediaTime, equal frameSeq or near epochs.
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.FrameIdentityCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='R8-P1-08-frame-identity-v1';
const PIPELINE_FOLD_MS=8;
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
function mediaComparable(a,b,o){const A=accessors(o);return A.domain(a)===A.domain(b)&&A.media(a)!==null&&A.media(b)!==null;}

function sameFrame(a,b,o){
  if(!a||!b)return false;if(a===b)return true;
  const ua=frameUIDOf(a),ub=frameUIDOf(b);if(ua&&ub)return ua===ub;            // durable identity decides
  const ga=generationOf(a),gb=generationOf(b);if(ga!==null&&gb!==null&&ga!==gb)return false;
  const A=accessors(o),ea=A.epoch(a),eb=A.epoch(b),sa=sourceOf(a),sb=sourceOf(b),sameDomain=sa===sb&&A.domain(a)===A.domain(b);
  const ma=A.media(a),mb=A.media(b),qa=A.seq(a),qb=A.seq(b);
  const mediaKnown=sameDomain&&ma!==null&&mb!==null,seqKnown=sameDomain&&qa!==null&&qb!==null;
  // Camera identity inside one clock domain (R7 contract: the same real media frame never counts twice).
  if(mediaKnown)return Math.abs(ma-mb)<SAME_MEDIA_S;
  if(seqKnown)return qa===qb;
  const near=ea!==null&&eb!==null&&Math.abs(ea-eb)<=PIPELINE_FOLD_MS;
  // The same in-memory payload is the same frame (phase-bucket copies) unless capture time contradicts it.
  if(a.blob&&a.blob===b.blob)return near;
  if(sa===sb){
    // Exact persisted copy: same capture epoch AND same payload size from the same source (survives
    // structuredClone / IndexedDB readback, where Blob object identity is lost).
    const za=blobSize(a);return ea!==null&&ea===eb&&za!==null&&za===blobSize(b);
  }
  // Different pipeline labels: fold only a browser-pipeline representation of the same capture moment.
  if(deviceFamily(a)==='browser-track'&&deviceFamily(b)==='browser-track'&&(!ua||!ub)&&near)return true;
  return false;
}

function idKey(f,o){const A=accessors(o),u=frameUIDOf(f);if(u)return 'uid:'+u;return ['k',sourceOf(f),generationOf(f)??'?',A.seq(f)??'',A.media(f)??'',A.epoch(f)??'',blobSize(f)??''].join('|');}

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
  (frames||[]).forEach((f,i)=>{if(!f||A.epoch(f)===null)return;const d=A.domain(f);if(!groups.has(d))groups.set(d,[]);groups.get(d).push({f,i});});
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
    const slot=kept.find(k=>k.aliases.some(x=>sameFrame(x,f,o)));
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
return Object.freeze({VERSION,PIPELINE_FOLD_MS,DISCONTINUITY_MS,known,sourceOf,generationOf,frameUIDOf,deviceFamily,clockDomain,mediaComparable,sameFrame,idKey,physicalOrder,uniqueFrames,isPhysicalOrder,nativeFrameUID,workerFrameUID});
});
