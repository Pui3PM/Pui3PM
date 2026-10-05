'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=require('../static/adaptive_release_core.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble4387_field_capture_regression.json'),'utf8'));

function replayCycle(c){
  let s=A.fresh(),captures=0,releaseEpoch=null,adaptive=false;
  for(const x of c.samples){
    const tl=c.timeline.filter(e=>e.epochMs<=x.t);
    const m={...x,phaseTimeline:tl};
    const input={...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady,shotIntentVerified:c.timeline.some(e=>e.phase==='Draw')&&c.timeline.some(e=>e.phase==='Anchor')};
    const r=A.update(s,m,input,x.t);s=r.state;
    const out=r.override?{...m,...r.patch}:m;
    if(out.shotComplete===true){captures++;releaseEpoch=out.releaseEpochMs||releaseEpoch;adaptive=adaptive||!!out.adaptiveReleaseProof;}
  }
  return {captures,releaseEpoch,adaptive};
}

const got=fixture.cycles.map(c=>({id:c.id,timeline:c.timeline.map(x=>x.phase),armed:c.samples.some(x=>x.armed),nativeRelease:c.timeline.some(x=>x.phase==='Release'),...replayCycle(c)}));
const early=got.filter(x=>!x.timeline.includes('Anchor'));
for(const x of got)assert(x.captures<=1,`${x.id} must never double-Capture`);
for(const x of early)assert.equal(x.captures,0,`${x.id} Set/Draw-only motion must not Capture`);
for(const x of got.filter(x=>!x.armed&&!x.nativeRelease))assert.equal(x.captures,0,`${x.id} unarmed Hold/return motion must remain 0 Capture`);

function base(t,o={}){return Object.assign({t,epochMs:t,phase:'Aim / Hold',primaryPhase:'Aim / Hold',detected:true,phaseQuality:.98,measurementTrust:.95,measurementTrustScore:.95,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,setReady:true,setAdmissionReady:true,phaseFaceDist:.62,bowSpeed:.12,trackingDrop:0,visibilityDrop:0,visualMotionCorroborated:false,releaseCandidate:false,releaseConfirmed:false,releaseRearStep:0,releaseRearThreshold:.04,releaseFrameSpeed:.2,releaseSpeedThreshold:1.0,releaseElbowRearStep:0,letDownDirectional:false,shotIntentVerified:true,phaseTimeline:[{phase:'Set',epochMs:t-800},{phase:'Draw',epochMs:t-600},{phase:'Anchor',epochMs:t-300},{phase:'Aim / Hold',epochMs:t-150}]},o);}
function seq(rows){let s=A.fresh(),n=0;for(const x of rows){const r=A.update(s,x,x,x.t);s=r.state;if(r.override&&r.patch?.shotComplete)n++;}return n;}
// Normal expansion pulses without post-release departure must never create a shot.
assert.equal(seq([
  base(1000,{phase:'Expansion',primaryPhase:'Aim / Hold',releaseCandidate:true,releaseRearStep:.052,releaseRearThreshold:.04,releaseFrameSpeed:1.25,releaseSpeedThreshold:1.0,releaseElbowRearStep:.07,bowSpeed:.25}),
  base(1055,{phase:'Expansion',phaseFaceDist:.625,releaseRearStep:-.01,releaseElbowRearStep:-.01,bowSpeed:.18}),
  base(1110,{phase:'Expansion',phaseFaceDist:.621,bowSpeed:.15}),
  base(1180,{phase:'Expansion',phaseFaceDist:.620,bowSpeed:.14})
]),0,'ordinary expansion pulse must not false-Capture');
// Deliberate lowering / let-down remains a hard negative.
assert.equal(seq([
  base(2000,{phase:'Expansion',releaseCandidate:true,releaseRearStep:.08,releaseRearThreshold:.04,releaseFrameSpeed:1.8,releaseSpeedThreshold:1.0,releaseElbowRearStep:.08,letDownDirectional:true}),
  base(2055,{phase:'Aim / Hold',phaseShootingPosture:false,phaseBowExtended:false,setReady:false,letDownDirectional:true,phaseFaceDist:1.1,bowSpeed:1.0}),
  base(2110,{phase:'Aim / Hold',phaseShootingPosture:false,phaseBowExtended:false,setReady:false,letDown:true,phaseFaceDist:1.2,bowSpeed:.8})
]),0,'deliberate let-down must remain 0 Capture');
// Fast Hold-only release is retained as a candidate, but only commits when the shot reaches
// a terminal edge. This prevents normal Hold/Expansion pulses from capturing early.
assert.equal(seq([
  base(3000,{armed:true,releaseCandidate:true,releaseRearStep:.12,releaseRearThreshold:.04,releaseFrameSpeed:2.3,releaseSpeedThreshold:1.0,releaseElbowRearStep:.08,bowSpeed:.6,visualMotionCorroborated:true}),
  base(3060,{armed:true,phaseFaceDist:.68,releaseRearStep:.02,releaseElbowRearStep:.03,bowSpeed:.7,visualMotionCorroborated:true}),
  base(3160,{phase:'Setup',primaryPhase:'Setup',armed:true,letDown:false,phaseShootingPosture:true,phaseBowExtended:true,setReady:true,phaseFaceDist:.90,bowSpeed:.9})
]),1,'strong Hold-only release must Capture exactly once at terminal edge');
// Even when armed, deliberate lowering with no valid rearward+elbow release candidate stays 0.
assert.equal(seq([
  base(4000,{phase:'Expansion',armed:true,releaseCandidate:false,releaseRearStep:-.03,releaseRearThreshold:.04,releaseFrameSpeed:.8,releaseSpeedThreshold:1.0,releaseElbowRearStep:-.04,letDownDirectional:true}),
  base(4070,{phase:'Aim / Hold',armed:true,phaseShootingPosture:false,phaseBowExtended:false,setReady:false,letDownDirectional:true,phaseFaceDist:1.05,bowSpeed:.8}),
  base(4140,{phase:'Setup',primaryPhase:'Setup',armed:false,phaseShootingPosture:false,phaseBowExtended:false,setReady:false,letDown:true,phaseFaceDist:1.2})
]),0,'armed deliberate lowering must remain 0 Capture');
console.log('BLE4.3.8.8.5 adaptive release safety QA PASS · no double capture · early/unarmed motion 0 · let-down 0 · strong fresh Hold-only release 1');
