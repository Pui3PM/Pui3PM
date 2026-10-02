'use strict';
const assert=require('assert');
const L=require('../static/side_lifecycle_core.js');
const A=require('../static/adaptive_release_core.js');
const Plan=require('../static/coach_keyframe_plan_core.js');
function inp(t,o={}){return {epochMs:t,phaseQuality:.98,measurementTrustScore:.98,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,setReady:true,nativeSetReady:true,physicalSetReady:true,setAdmissionReady:true,shotIntentReady:true,debugShotIntentVerified:true,phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,drawSideVisible:true,bowArmDeg:169,bowSpeed:.15,drawSpeed:.18,faceHandSpeed:.20,phaseFaceDist:.55,...o};}
function nat(p,o={}){return {phase:p,primaryPhase:p,armed:true,phaseTimeline:o.phaseTimeline||[],...o};}
// 1) 5,000 adversarial raw Anchor/Hold/Expansion flickers while the athlete is still physically drawing.
for(let k=0;k<5000;k++){
  let s=L.fresh(),t=0;
  for(const q of [0,100]){let r=L.update(s,inp(q,{phaseShootingPosture:false,phaseBowExtended:false,neutralEvidence:true,wristsLow:true,bowArmDeg:110}),nat('Setup'),q);s=r.state;}
  for(const q of [200,280]){let r=L.update(s,inp(q,{drawSpeed:1.2,faceHandSpeed:1.1,bowSpeed:1.0}),nat('Draw'),q);s=r.state;}
  const raw=['Anchor','Aim / Hold','Expansion'][k%3],now=330;
  let r=L.update(s,inp(now,{drawSpeed:.85+(k%7)*.03,faceHandSpeed:.90+(k%5)*.04}),nat(raw),now);s=r.state;
  r=L.reconcileResult(s,nat(raw,{phaseTimeline:[{phase:'Draw',epochMs:200},{phase:raw,epochMs:now}]}),now);s=r.state;
  assert.equal(s.authorityPhase,'Draw',`moving draw promoted to ${raw} at case ${k}`);
}
// 2) Shot-5 style Expansion -> violent let-down: release-like impulse followed by >7.5deg bow-arm collapse must never latch Release.
for(let k=0;k<2000;k++){
  let s=A.fresh(),t=1000;
  A.update(s,nat('Anchor',{armed:true}),inp(t,{phaseFaceDist:.50}),t);
  A.update(s,nat('Aim / Hold',{armed:true}),inp(t+40,{phaseFaceDist:.50}),t+40);
  A.update(s,nat('Expansion',{armed:true}),inp(t+80,{phaseFaceDist:.50,bowArmDeg:170}),t+80);
  const onset=nat('Expansion',{armed:true,releaseCandidate:true,releaseRearStep:.030+(k%9)*.002,releaseFaceRearStep:.025,releaseElbowRearStep:.010,releaseRearThreshold:.02,releaseSpeedThreshold:.5,releaseFrameSpeed:1.10,letDownDirectional:false});
  let r=A.update(s,onset,inp(t+120,{phaseFaceDist:.51,bowArmDeg:164,bowSpeed:1.0,drawSpeed:.9,faceHandSpeed:1.1,visualMotionCorroborated:true}),t+120);s=r.state;
  const collapse=nat('Expansion',{armed:true,releaseCandidate:false,releaseRearStep:-.05,releaseFaceRearStep:-.04,releaseElbowRearStep:-.01,releaseRearThreshold:.02,releaseSpeedThreshold:.5,releaseFrameSpeed:1.4,letDownDirectional:true});
  r=A.update(s,collapse,inp(t+175,{phaseFaceDist:.60,bowArmDeg:151-(k%4),bowSpeed:2.0,drawSpeed:1.5,faceHandSpeed:1.6,visualMotionCorroborated:true}),t+175);s=r.state;
  assert.equal(s.latched,false,`violent let-down latched Release at case ${k}`);
  assert.notEqual(r?.patch?.releaseConfirmed,true,`violent let-down emitted Release at case ${k}`);
}
// 3) Let-down confirmation re-arms lifecycle immediately once neutral is confirmed.
for(let k=0;k<1000;k++){
  let s=L.fresh();s.shotActive=true;s.verifiedSetup=true;s.verifiedDraw=true;s.authorityPhase='Expansion';s.authorityRank=5;s.lastEpoch=1000;s.lastArmDeg=168;
  let r=L.update(s,inp(1050,{bowArmDeg:150}),nat('Expansion',{letDown:true}),1050);s=r.state;
  r=L.update(s,inp(1100,{phaseShootingPosture:false,phaseBowExtended:false,neutralEvidence:true,wristsLow:true,bowArmDeg:112}),nat('Setup',{letDown:true}),1100);s=r.state;
  r=L.update(s,inp(1210,{phaseShootingPosture:false,phaseBowExtended:false,neutralEvidence:true,wristsLow:true,bowArmDeg:110}),nat('Setup',{letDown:true}),1210);s=r.state;
  assert.equal(s.shotActive,false);assert.equal(s.authorityPhase,'Set');assert.equal(s.terminal,false);assert.equal(s.releaseEpoch,null);
}
// 4) KF25 is deterministic: exactly 25 requests, Release T0 fixed at #13, monotonic request offsets.
const p=Plan.build25([{phase:'Draw',epochMs:1000},{phase:'Anchor',epochMs:1800},{phase:'Aim / Hold',epochMs:2200},{phase:'Expansion',epochMs:2800}],3000);
assert.equal(p.requests.length,25);assert.equal(p.releaseIndex,12);assert.equal(p.requests[12].offset,0);
for(let i=1;i<p.requests.length;i++)assert(p.requests[i].offset>p.requests[i-1].offset,`KF25 non-monotonic at ${i}`);
console.log('BLE438955 TORTURE GATE PASS · 5k moving-phase attacks · 2k violent let-downs · 1k immediate re-arms · KF25 deterministic');
