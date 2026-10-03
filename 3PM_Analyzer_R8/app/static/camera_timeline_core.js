// 3PM HV3 Cross-Platform Camera Timeline Core
// Pure shared logic: no OS APIs, no shot authority, no DOM.
(function(root,factory){const FI=(typeof module==='object'&&module.exports&&typeof require==='function')?require('./frame_identity_core.js'):root&&root.FrameIdentityCore;if(!FI)throw new Error('CameraTimelineCore requires FrameIdentityCore (load frame_identity_core.js first)');const api=factory(FI);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CameraTimelineCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(FI){
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
// R8 P1-08 H-01/H-02: mediaTime/frameSeq order and identify frames only inside one clock domain (source pipeline +
// generation); domains are merged on the shared capture time. A frame of another source is never dropped because
// its local sequence/media clock is lower. Frames without any time or sequence cannot be placed and are skipped.
const FI_ACCESS={epoch:f=>frameTimeMs(f),media:f=>{const m=chronologyKey(f).mediaTimeMs;return m===null?null:m/1000;},seq:f=>known(f?.frameSeq)};
function canonicalFrames(frames=[]){
  const rows=(frames||[]).map(f=>({...f}));
  const timed=rows.filter(f=>frameTimeMs(f)!==null),untimed=rows.filter(f=>frameTimeMs(f)===null&&known(f?.frameSeq)!==null);
  const ordered=FI.uniqueFrames(timed,FI_ACCESS);
  // Sequence-only frames (no clock at all) keep their own per-domain sequence order after timed frames.
  const bySeq=FI.uniqueFrames(untimed.map(f=>({...f,__seqEpoch:known(f.frameSeq)})),{epoch:f=>f.__seqEpoch,media:()=>null,seq:f=>known(f?.frameSeq)}).map(({__seqEpoch,...f})=>f);
  return [...ordered,...bySeq];
}
function adaptiveToleranceMs(fps,jitterMs=0){
  const f=Math.max(1,num(fps,30)),j=Math.max(0,num(jitterMs,0));
  return Math.max(2,Math.min(50,(500/f)+(j*1.5)));
}
function nearestFrame(frames,targetMs,{fps=30,jitterMs=0,maxMultiplier=1.25}={}){
  const t=known(targetMs);if(t===null)return null;const rows=canonicalFrames(frames);/* M-02: unknown target never matches */let best=null,delta=Infinity;
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
  return (slots||[]).map((slot,index)=>{const target=known(slot?.masterTimeMs,known(slot?.epochMs));/* M-02: null master falls back to epoch, never 0 */return{index,slot:{...slot},targetMs:target,views:target===null?Object.fromEntries(ROLES.map(r=>[r,null])):alignAt(target,framesByRole,diagByRole)};});
}
return{VERSION,ROLES,role,frameTimeMs,chronologyKey,canonicalFrames,adaptiveToleranceMs,nearestFrame,alignAt,capabilities,logicalSlotAlignment};
});
