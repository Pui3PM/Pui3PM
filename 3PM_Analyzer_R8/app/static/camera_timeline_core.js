// 3PM HV3 Cross-Platform Camera Timeline Core
// Pure shared logic: no OS APIs, no shot authority, no DOM.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CameraTimelineCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='HV3-camera-timeline-v1';
const ROLES=Object.freeze(['side','overhead','rear']);
const ROLE_SET=new Set(ROLES);
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=null)=>finite(v)?Number(v):d;
// R8C/F03: clock/sequence fields use a strict reader: null/undefined/boolean/'' are UNKNOWN, never 0.
// (num() above is left unchanged for fps/jitter policy inputs; see R8C patch note open item.)
const known=(v,d=null)=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v))?Number(v):d;
const role=r=>ROLE_SET.has(String(r||'').toLowerCase())?String(r).toLowerCase():null;
function frameTimeMs(f){
  for(const k of ['masterTimeMs','captureEpochMs','epochMs']){const v=known(f?.[k]);if(v!==null)return v;}
  const media=known(f?.mediaTimeMs);if(media!==null)return media;
  const legacyMedia=known(f?.mediaTime);if(legacyMedia!==null)return legacyMedia*1000;
  return null;
}
function chronologyKey(f,index=0){return{timeMs:frameTimeMs(f),mediaTimeMs:known(f?.mediaTimeMs,known(f?.mediaTime)!==null?known(f.mediaTime)*1000:null),frameSeq:known(f?.frameSeq),index};}
function canonicalFrames(frames=[]){
  const rows=(frames||[]).map((f,i)=>({f:{...f},k:chronologyKey(f,i)})).filter(x=>x.k.timeMs!==null||x.k.frameSeq!==null);
  rows.sort((a,b)=>{
    if(a.k.mediaTimeMs!==null&&b.k.mediaTimeMs!==null&&Math.abs(a.k.mediaTimeMs-b.k.mediaTimeMs)>.05)return a.k.mediaTimeMs-b.k.mediaTimeMs;
    if(a.k.frameSeq!==null&&b.k.frameSeq!==null&&a.k.frameSeq!==b.k.frameSeq)return a.k.frameSeq-b.k.frameSeq;
    if(a.k.timeMs!==null&&b.k.timeMs!==null&&a.k.timeMs!==b.k.timeMs)return a.k.timeMs-b.k.timeMs;
    return a.k.index-b.k.index;
  });
  const out=[];let lastSeq=null,lastMedia=null;
  for(const x of rows){
    const seq=x.k.frameSeq,mt=x.k.mediaTimeMs;
    if(seq!==null&&lastSeq!==null&&seq<=lastSeq)continue;
    if(mt!==null&&lastMedia!==null&&mt<lastMedia-.05)continue;
    out.push(x.f);if(seq!==null)lastSeq=seq;if(mt!==null)lastMedia=mt;
  }
  return out;
}
function adaptiveToleranceMs(fps,jitterMs=0){
  const f=Math.max(1,num(fps,30)),j=Math.max(0,num(jitterMs,0));
  return Math.max(2,Math.min(50,(500/f)+(j*1.5)));
}
function nearestFrame(frames,targetMs,{fps=30,jitterMs=0,maxMultiplier=1.25}={}){
  const t=num(targetMs);if(t===null)return null;const rows=canonicalFrames(frames);let best=null,delta=Infinity;
  for(const f of rows){const ft=frameTimeMs(f);if(ft===null)continue;const d=Math.abs(ft-t);if(d<delta){delta=d;best=f;}}
  const tolerance=adaptiveToleranceMs(fps,jitterMs)*Math.max(1,num(maxMultiplier,1.25));
  return best&&delta<=tolerance?{frame:best,deltaMs:delta,toleranceMs:tolerance}:null;
}
function alignAt(targetMs,framesByRole={},diagByRole={}){
  const aligned={};
  for(const r of ROLES){
    const d=diagByRole?.[r]||{},fps=num(d.rawFps,num(d.captureFps,num(d.reportedFps,30))),j=num(d.jitterMs,0);
    aligned[r]=nearestFrame(framesByRole?.[r]||[],targetMs,{fps,jitterMs:j});
  }
  return aligned;
}
function capabilities(activeRoles=[]){
  const a=new Set((activeRoles||[]).map(role).filter(Boolean));
  const side=a.has('side'),overhead=a.has('overhead'),rear=a.has('rear');
  return Object.freeze({
    activeRoles:ROLES.filter(r=>a.has(r)),
    sideAuthorityAvailable:side,
    automaticShotLifecycle:side,
    phaseReleaseLetdown:side,
    overheadAlignment:overhead,
    rearLateralAlignment:rear,
    multiviewCorroboration:side&&(overhead||rear),
    fullThreeView:side&&overhead&&rear,
    degradedWithoutSide:!side&&(overhead||rear),
    note:side?'Side authority available':'Side unavailable: auxiliary views remain evidence-only; do not pretend full shot-lifecycle parity.'
  });
}
function logicalSlotAlignment(slots=[],framesByRole={},diagByRole={}){
  return (slots||[]).map((slot,index)=>{const target=num(slot?.masterTimeMs,num(slot?.epochMs));return{index,slot:{...slot},targetMs:target,views:target===null?Object.fromEntries(ROLES.map(r=>[r,null])):alignAt(target,framesByRole,diagByRole)};});
}
return{VERSION,ROLES,role,frameTimeMs,chronologyKey,canonicalFrames,adaptiveToleranceMs,nearestFrame,alignAt,capabilities,logicalSlotAlignment};
});
