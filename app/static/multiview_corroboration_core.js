// 3PM BLE4.3.8.9.5.1 Multi-View Corroboration Core
// Pure evidence fusion. Side remains authoritative. Auxiliary evidence is positive-only,
// timestamp matched, quality gated, and can never create Capture/Release or block Side-only use.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MultiViewCorroborationCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.5.1-multiview-corroboration-v2';
const PHASES=['Set','Setup','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through','Recovery'];
const RANK=Object.fromEntries(PHASES.map((p,i)=>[p,i]));
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
const clamp=v=>Math.max(0,Math.min(1,v));
const rank=p=>RANK[String(p||'')]??-1;
function phaseOf(m){return String(m?.primaryPhase||m?.phase||'');}
function quality(m){
  if(!m?.detected)return 0;
  const q=clamp(num(m.phaseQuality,num(m.quality,0))),id=clamp(num(m.identityConfidence,.5)),obs=clamp(num(m.shotObservability,.5));
  const wrist=clamp(num(m.phaseDrawWristVisibility??m.drawWristVisibility,.5)),elbow=clamp(num(m.phaseDrawElbowVisibility??m.drawElbowVisibility,.5));
  return clamp(q*.38+id*.16+obs*.16+Math.max(wrist,elbow)*.30);
}
function fresh(){return{version:VERSION,overheadSeenAt:0,overheadPhase:null,overheadQuality:0,lastMatchedAt:0,lastSyncDeltaMs:null,lastDecision:null,streak:{phase:null,since:0,samples:0}};}
function reset(s){Object.assign(s,fresh());return s;}
function updateAux(state,role,m,nowArg){const s=state||fresh();if(role!=='overhead')return s;const now=finite(nowArg)?Number(nowArg):finite(m?.epochMs)?Number(m.epochMs):Date.now();s.overheadSeenAt=now;s.overheadPhase=phaseOf(m)||null;s.overheadQuality=quality(m);return s;}
function corroborate(state,side,overhead,deltaMs,nowArg){
  const s=state||fresh(),now=finite(nowArg)?Number(nowArg):finite(side?.epochMs)?Number(side.epochMs):Date.now();
  const present=!!overhead?.detected,delta=Math.abs(num(deltaMs,9999)),q=quality(overhead),phaseQ=clamp(num(overhead?.phaseQuality,num(overhead?.quality,0))),freshEnough=present&&delta<=140,qGood=q>=.48&&phaseQ>=.35;
  const sp=phaseOf(side),op=phaseOf(overhead),sr=rank(sp),or=rank(op);
  const adjacent=sr>=0&&or>=0&&Math.abs(sr-or)<=1;
  const sideReleaseIntent=side?.releaseCandidate===true||side?.releaseConfirmed===true||sr>=rank('Release');
  // Auxiliary phase evidence must stay local to Side authority. Overhead may be one micro-step
  // ahead/behind, but cannot leap multiple phases. Release is the only exception and only after
  // Side has independently formed release intent.
  const releaseCompatible=sideReleaseIntent&&or>=rank('Release')&&or<=rank('Follow Through');
  const compatible=sr>=0&&or>=0&&(adjacent||releaseCompatible);
  const drawVisible=(num(overhead?.phaseDrawWristVisibility??overhead?.drawWristVisibility,0)>=.28||num(overhead?.phaseDrawElbowVisibility??overhead?.drawElbowVisibility,0)>=.30);
  const support=freshEnough&&qGood&&compatible&&drawVisible;
  const phaseKey=support?op:null;
  if(phaseKey&&s.streak.phase===phaseKey){s.streak.samples++;}else{s.streak={phase:phaseKey,since:phaseKey?now:0,samples:phaseKey?1:0};}
  const sustained=support&&s.streak.samples>=2&&(now-s.streak.since>=45||s.streak.samples>=3);
  // Expansion is deliberately optional. It may strengthen evidence but absence never counts against Side.
  const expansionSupport=sustained&&or>=rank('Expansion')&&or<=rank('Follow Through');
  // Release support is strictly corroborative: an auxiliary camera cannot originate a release.
  const releaseSupport=sustained&&sideReleaseIntent&&(overhead?.releaseCandidate===true||overhead?.releaseConfirmed===true||or>=rank('Release'));
  const d={version:VERSION,available:present,fresh:freshEnough,quality:q,phaseQuality:phaseQ,syncDeltaMs:present?delta:null,sidePhase:sp||null,overheadPhase:op||null,compatible,sustained,supportLevel:!support?'none':sustained?'strong':'weak',drawSupport:sustained&&sr>=rank('Draw')&&or>=rank('Draw'),anchorSupport:sustained&&sr>=rank('Anchor')&&or>=rank('Anchor'),holdSupport:sustained&&sr>=rank('Aim / Hold')&&or>=rank('Aim / Hold'),expansionSupport,releaseSupport,negativeEvidence:false,reason:!present?'overhead-unavailable':!freshEnough?'overhead-stale-or-unsynced':!qGood?'overhead-low-quality':!compatible?'phase-not-compatible':!drawVisible?'draw-side-not-observable':sustained?'corroborated':'building-corroboration'};
  s.lastMatchedAt=now;s.lastSyncDeltaMs=d.syncDeltaMs;s.lastDecision=d;return d;
}
return{VERSION,PHASES,fresh,reset,updateAux,corroborate,quality,phaseOf};
});
