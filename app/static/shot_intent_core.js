// 3PM BLE4.3.8.9.0 Shot Intent Core · flexible Set-up/Draw overlap
// Event-sequence shot truth: neutral token -> real bow-side shot plane -> Draw.
// The neutral token does not expire while the athlete waits. Draw and shot-plane may arrive
// on adjacent pose frames, but Anchor/face-touch alone can never open a capture cycle.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ShotIntentCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.0-shot-intent-v4';
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=null)=>finite(v)?Number(v):d;
const SHOT_PAIR_WINDOW_MS=1500;
const LATE_START_WINDOW_MS=2200;
function fresh(){return{
  neutralToken:false,lastNeutralAt:0,
  bowPlaneSince:0,lastPlaneSeenAt:0,lastPlaneAt:0,lastPlaneDiag:null,
  lastNativeReadyAt:0,
  recentDrawAt:0,recentDrawSource:null,recentDrawDiag:null,
  consumed:false,lastAdmission:null
};}
function reset(s,{neutralAt=0}={}){
  Object.assign(s,fresh());
  if(neutralAt){s.neutralToken=true;s.lastNeutralAt=neutralAt;}
  return s;
}
function bowPlaneEvidence(input={}){
  const p=input?.bowWristRel;
  const x=num(p?.x),y=num(p?.y);
  const geometry=x!==null&&y!==null;
  // Side-camera authority. A face-touch can have a straight elbow, but it does not put the
  // bow wrist into the lateral shoulder/aiming corridor of a real shot.
  const lateral=geometry&&Math.abs(x)>=.46;
  // Shot-plane admission must not assume one technique. Some archers raise first, some start
  // loading from Set, and some pre-load slightly before the bow arm reaches full extension.
  const height=geometry&&y<=1.45&&y>=-1.55;
  const extended=input?.phaseBowExtended===true||input?.bowExtended===true;
  const drawMotion=Math.abs(num(input?.drawSpeed,0))>=.58||Math.abs(num(input?.faceHandSpeed,0))>=.68;
  const building=extended||drawMotion;
  return{ready:!!(geometry&&lateral&&height&&building),geometry,lateral,height,extended,drawMotion,building,x,y};
}
function neutralEvidence(input={},plane=null){
  const p=plane||bowPlaneEvidence(input),x=p.x,y=p.y;
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const nativeRaw=input?.setReady===true;
  const geometryNeutral=p.geometry&&(y>1.08||Math.abs(x)<.30);
  const armNeutral=input?.wristsLow===true||(finite(input?.bowArmDeg)&&Number(input.bowArmDeg)<122);
  const postureNeutral=!posture&&!nativeRaw;
  // Geometry is intentionally authoritative here: the legacy setReady flag can become true
  // while the bow arm is still low. A low bow wrist is still a real neutral edge.
  return !!(input?.letDown===true||geometryNeutral||armNeutral||postureNeutral);
}
function clearProvisional(s){
  s.bowPlaneSince=0;s.lastPlaneSeenAt=0;s.lastPlaneAt=0;s.lastPlaneDiag=null;
  s.recentDrawAt=0;s.recentDrawSource=null;s.recentDrawDiag=null;s.consumed=false;
}
function admission(state,input={},nowArg){
  const s=state||fresh(),now=num(nowArg,num(input?.epochMs,Date.now()));
  const q=num(input?.phaseQuality,0),wrist=num(input?.phaseDrawWristVisibility??input?.drawWristVisibility,0),elbow=num(input?.phaseDrawElbowVisibility??input?.drawElbowVisibility,0);
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const plane=bowPlaneEvidence(input),drawSideVisible=wrist>=.30&&elbow>=.28;
  const neutral=neutralEvidence(input,plane);
  if(neutral){
    // A neutral token is an event, not a stopwatch. The athlete may stand ready for any duration.
    s.neutralToken=true;s.lastNeutralAt=now;clearProvisional(s);
  }
  if(plane.ready&&posture&&drawSideVisible&&q>=.24){
    if(!s.bowPlaneSince)s.bowPlaneSince=now;
    s.lastPlaneSeenAt=now;
  }else if(s.lastPlaneSeenAt&&now-s.lastPlaneSeenAt>220){
    s.bowPlaneSince=0;
  }
  const planeStable=plane.ready&&posture&&drawSideVisible&&s.bowPlaneSince>0&&now-s.bowPlaneSince>=70;
  if(planeStable){
    s.lastPlaneAt=now;
    s.lastPlaneDiag={phaseQuality:q,drawSideVisible,shootingPosture:posture,bowPlaneReady:true,bowPlaneStable:true,bowWristRelX:plane.x,bowWristRelY:plane.y};
  }
  const recentPlane=s.lastPlaneAt>0&&now-s.lastPlaneAt<=320;
  const nativeRaw=input?.setReady===true;
  const nativeReady=nativeRaw&&q>=.25&&drawSideVisible&&(planeStable||recentPlane);
  if(nativeReady)s.lastNativeReadyAt=now;
  const visualFallback=!nativeRaw&&q>=.31&&drawSideVisible&&posture&&(planeStable||recentPlane)&&s.neutralToken;
  const ready=nativeReady||visualFallback;
  const source=nativeReady?'native+shot-plane':visualFallback?'visual-shot-plane-edge':nativeRaw?'native-veto-shot-plane':'none';
  const out={ready,source,nativeRaw,nativeReady,visualFallback,drawSideVisible,shootingPosture:posture,bowPlaneReady:plane.ready,bowPlaneStable:planeStable,bowWristRelX:plane.x,bowWristRelY:plane.y,neutralEvidence:neutral,neutralToken:s.neutralToken,phaseQuality:q,lastPlaneAt:s.lastPlaneAt};
  s.lastAdmission=out;return out;
}
function observePhase(state,phase,nowArg,diag={}){
  const s=state||fresh(),now=num(nowArg,Date.now()),p=String(phase||'');
  const shooting=diag.shootingPosture===true||diag.phaseShootingPosture===true;
  if(p==='Draw'&&s.neutralToken&&shooting&&diag.drawSideVisible===true&&num(diag.phaseQuality,0)>=.24){
    s.recentDrawAt=now;s.recentDrawSource=diag.source||'draw-observed';s.recentDrawDiag={...diag};
  }
  // If an unconsumed provisional Draw returns all the way to neutral Setup, throw it away.
  if(p==='Setup'&&diag.neutralEvidence===true&&s.recentDrawAt)clearProvisional(s);
  return s;
}
function startProof(state,phase,nowArg){
  const s=state||fresh(),now=num(nowArg,Date.now()),p=String(phase||'');
  if(!s.neutralToken||s.consumed||!s.recentDrawAt||!s.lastPlaneAt)return null;
  const pairGap=Math.abs(s.recentDrawAt-s.lastPlaneAt);
  if(pairGap>SHOT_PAIR_WINDOW_MS)return null;
  const drawAge=now-s.recentDrawAt;
  const direct=p==='Draw'&&drawAge<=500;
  const late=['Anchor','Aim / Hold','Expansion','Release','Follow Through'].includes(p)&&drawAge>=0&&drawAge<=LATE_START_WINDOW_MS;
  if(!(direct||late))return null;
  const d=s.recentDrawDiag||{},pd=s.lastPlaneDiag||{};
  if(!((d.shootingPosture===true||d.phaseShootingPosture===true)&&d.drawSideVisible===true&&pd.bowPlaneReady===true))return null;
  // The neutral token must precede both pieces of the shot-intent pair. It does not expire merely
  // because the athlete waits before raising the bow.
  const first=Math.min(s.recentDrawAt,s.lastPlaneAt);
  if(!s.lastNeutralAt||first<s.lastNeutralAt)return null;
  return{verified:true,drawEpoch:s.recentDrawAt,planeEpoch:s.lastPlaneAt,neutralEpoch:s.lastNeutralAt,temporalPairMs:pairGap,source:s.recentDrawSource||'temporal-draw+shot-plane',bowPlaneReady:true,nativeSetSeen:(s.lastNativeReadyAt>0&&s.lastNativeReadyAt>=s.lastNeutralAt),lateStart:late&&p!=='Draw'};
}
function consumeDraw(state){
  if(state){state.consumed=true;state.neutralToken=false;state.recentDrawAt=0;state.recentDrawSource=null;state.recentDrawDiag=null;}
  return state;
}
function snapshot(state){const s=state||fresh();return{neutralToken:!!s.neutralToken,lastNeutralAt:s.lastNeutralAt||0,lastPlaneAt:s.lastPlaneAt||0,recentDrawAt:s.recentDrawAt||0,consumed:!!s.consumed,lastAdmission:s.lastAdmission?{...s.lastAdmission}:null};}
return{VERSION,SHOT_PAIR_WINDOW_MS,LATE_START_WINDOW_MS,fresh,reset,bowPlaneEvidence,neutralEvidence,admission,observePhase,startProof,consumeDraw,snapshot};
});
