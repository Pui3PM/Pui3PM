// 3PM BLE4.3.8.9.2 Real-Bow Anchor Bridge
// Field-trace correction for Side shots whose real anchor geometry is stable but whose visual
// face-distance scale sits outside the frozen X2.8.2 absolute Anchor band.  This helper NEVER
// decides Release/Capture.  It only supplies a temporary engine-only phaseFaceDist proxy until
// the frozen core reaches/arms Aim-Hold.  Adaptive Release always receives the untouched input.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RealBowAnchorBridgeCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.2-anchor-bridge-v1';
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function median(a){if(!a.length)return null;const x=[...a].sort((p,q)=>p-q),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;}
function mad(a,m){if(!a.length||!finite(m))return null;return median(a.map(v=>Math.abs(v-m)));}
function fresh(){return{
  drawSince:0,maxFaceDist:null,history:[],candidateSince:0,assistLatched:false,assistSince:0,
  mappedFrames:0,lastReason:'idle',lastSnapshot:null
};}
function reset(s){Object.assign(s,fresh());return s;}
function trusted(input,diag,fd){
  const q=num(input?.phaseQuality),w=num(input?.phaseDrawWristVisibility??input?.drawWristVisibility),e=num(input?.phaseDrawElbowVisibility??input?.drawElbowVisibility);
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const extended=input?.phaseBowExtended===true||input?.bowExtended===true||num(input?.bowArmDeg)>=136;
  const plane=diag?.bowPlaneReady!==false;
  const lowering=input?.wristsLow===true||input?.phaseShootingPosture===false||input?.phaseBowExtended===false;
  return finite(fd)&&fd<=1.38&&q>=.55&&w>=.50&&e>=.55&&posture&&extended&&plane&&!lowering;
}
function update(state,input={},previousResult={},diag={},nowArg){
  const s=state||fresh(),now=finite(nowArg)?Number(nowArg):finite(input?.epochMs)?Number(input.epochMs):Date.now();
  const phase=String(previousResult?.phase||previousResult?.primaryPhase||'Setup');
  const armed=previousResult?.armed===true;
  const terminal=previousResult?.releaseConfirmed===true||previousResult?.shotComplete===true||phase==='Release'||phase==='Follow Through'||previousResult?.letDown===true;
  const fd=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
  let engineInput=input,active=false,stats=null;

  if(terminal||['Setup','Set'].includes(phase)){
    if(terminal||phase==='Setup'){s.drawSince=0;s.maxFaceDist=null;s.history=[];s.candidateSince=0;s.assistLatched=false;s.assistSince=0;s.mappedFrames=0;}
    s.lastReason=terminal?'terminal-reset':'waiting-draw';
  }else if(['Draw','Anchor','Aim / Hold','Expansion'].includes(phase)){
    if(!s.drawSince)s.drawSince=now;
    if(fd!==null)s.maxFaceDist=s.maxFaceDist===null?fd:Math.max(s.maxFaceDist,fd);
    const ok=trusted(input,diag,fd);
    if(ok){
      s.history.push({t:now,fd});
      s.history=s.history.filter(x=>now-x.t<=320).slice(-10);
    }else if(input?.phaseShootingPosture===false||input?.phaseBowExtended===false||input?.wristsLow===true){
      s.history=[];s.candidateSince=0;
    }
    if(!s.assistLatched&&phase==='Draw'&&s.history.length>=3){
      const span=s.history.at(-1).t-s.history[0].t,vals=s.history.map(x=>x.fd),med=median(vals),range=Math.max(...vals)-Math.min(...vals),md=mad(vals,med),elapsed=now-s.drawSince,approach=s.maxFaceDist===null?0:Math.max(0,s.maxFaceDist-med);
      const stable=span>=130&&range<=.20&&md<=.055;
      const nearEnough=med<=1.34;
      const progress=approach>=.055||med<=1.02||elapsed>=650;
      stats={spanMs:span,medianFaceDist:med,rangeFaceDist:range,madFaceDist:md,approach,elapsedMs:elapsed};
      if(stable&&nearEnough&&progress&&elapsed>=170){
        if(!s.candidateSince)s.candidateSince=now;
        if(now-s.candidateSince>=50){s.assistLatched=true;s.assistSince=now;s.lastReason='stable-real-bow-anchor';}
      }else{s.candidateSince=0;s.lastReason=stable?'anchor-progress-wait':'anchor-plateau-wait';}
    }
    // Keep the proxy only until the frozen core has armed Release.  Once armed, return immediately
    // to the untouched real face-distance so Release/let-down arbitration sees true post-anchor motion.
    const bridgePhase=['Draw','Anchor','Aim / Hold','Expansion'].includes(phase);
    active=s.assistLatched&&bridgePhase&&!armed&&trusted(input,diag,fd);
    if(active){
      const mapped=Math.min(fd,0.70);
      engineInput={...input,phaseFaceDist:mapped,debugAnchorBridgeRawFaceDist:fd,debugAnchorBridgeMappedFaceDist:mapped,debugAnchorBridgeActive:true};
      s.mappedFrames++;s.lastReason='engine-anchor-proxy';
    }else if(s.assistLatched&&armed)s.lastReason='armed-raw-restored';
  }
  const snapshot={version:VERSION,active,latched:!!s.assistLatched,assistSince:s.assistSince||null,drawSince:s.drawSince||null,rawFaceDist:fd,engineFaceDist:finite(engineInput?.phaseFaceDist)?Number(engineInput.phaseFaceDist):null,mappedFrames:s.mappedFrames,reason:s.lastReason,stats};
  s.lastSnapshot=snapshot;
  return{state:s,engineInput,snapshot};
}
return{VERSION,fresh,reset,update};
});
