'use strict';
const assert=require('assert');
global.window=global;require('../static/core_runtime.js');const Core=global.CoreEngine;
let seed=(Number(process.env.SEED)||0x3A2F24)>>>0;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}function rand(a,b){return a+rnd()*(b-a);}
function anchor(){return {wrist:{x:0,y:0},faceHand:{x:0,y:0},elbow:{x:1,y:0},head:{x:0,y:1},rearVec:{x:1,y:0},worldFaceHand:null,worldElbow:null,worldBowWrist:null,faceDist:.25,bowArmDeg:150,drawElbowDeg:160};}
function stats(){return {n:8,sumHandX:0,sumHandY:0,sumFace:2,sumHeadX:0,sumHeadY:8,handSS:.00001,faceSS:.5,headSS:8};}
function primeHold(tr,t0=1000,holdMs=0){const s=tr.s;s.phase='Aim / Hold';s.phaseSince=t0-holdMs;s.holdStart=t0-holdMs;s.holdAt=t0-holdMs;s.releaseEverArmed=true;s.releaseArmed=true;s.releaseArmedAt=t0-holdMs;s.drawQualified=true;s.anchorQualified=true;s.recoveredSequence=false;s.anchor=anchor();s.anchorStats=stats();s.holdMotionSamples=[...Array(10)].map(()=>({rearStep:rand(-.0007,.0012),frameSpeed:rand(.008,.028),elbowRearStep:rand(-.0005,.0008),bowDownStep:rand(-.0005,.0008),epochMs:0}));s.holdPrevHand={x:0,y:0};s.holdPrevFaceHand={x:0,y:0};s.holdPrevElbow={x:1,y:0};s.holdPrevBow={x:-1,y:0};s.holdPrevEpochMs=t0;s.lastReleaseAt=0;}
function inp(t,o={}){return {now:t,epochMs:t,phaseQuality:.9,releaseQuality:.9,criticalTrackingOK:true,faceDist:.25,phaseFaceDist:.25,bowExtended:true,phaseBowExtended:true,setReady:true,shootingPosture:true,phaseShootingPosture:true,wristsLow:false,drawWristVisibility:.9,drawElbowVisibility:.9,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9,measurementTrustScore:.95,drawSpeed:.13,faceVelocity:0,faceHandSpeed:.16,worldFaceHandSpeed:0,elbowSpeed:.05,bowSpeed:0,trackingDrop:0,visibilityDrop:0,anchorHandRel:{x:0,y:0},faceHandRel:{x:0,y:0},drawElbowRel:{x:1,y:0},headRel:{x:0,y:1},bowWristRel:{x:-1,y:0},bowArmDeg:150,drawElbowDeg:160,...o};}

let falseShots=0,letdownCases=400;
for(let n=0;n<letdownCases;n++){
  const e=Core.createAthleteShotEngine(),tr=e.trackers.side,t0=1000;primeHold(tr,t0,Math.round(rand(0,20000)));
  let x=0,y=0,by=0,everRelease=false,ended=false;
  for(let i=1;i<=10;i++){
    const t=t0+i*33;x+=rand(-.002,.0035);y+=rand(.006,.014);by+=rand(.008,.016);
    const late=i>=3;
    const r=tr.update(inp(t,{anchorHandRel:{x,y},faceHandRel:{x,y},drawElbowRel:{x:1+rand(-.002,.003),y:y*.35},bowWristRel:{x:-1,y:by},setReady:!late,phaseShootingPosture:!late,phaseBowExtended:!late,wristsLow:i>=5,phaseFaceDist:late?rand(.86,1.18):.25,faceDist:late?rand(.86,1.18):.25,trackingDrop:i>=3?rand(.05,.28):rand(0,.05),visibilityDrop:i>=3?rand(.05,.25):rand(0,.05),bowSpeed:late?rand(.05,.14):rand(0,.03),faceHandSpeed:rand(.05,.18),drawSpeed:rand(.05,.16)}));
    if(r.didRelease||r.postReleaseEvidence||r.phase==='Follow Through')everRelease=true;
    if(r.phase==='Setup'){ended=true;break;}
  }
  if(everRelease)falseShots++;
  assert(ended,'let-down must return to Setup');
}
assert.equal(falseShots,0,`let-down false releases: ${falseShots}`);

let realMisses=0,realCases=300;
for(let n=0;n<realCases;n++){
  const e=Core.createAthleteShotEngine(),tr=e.trackers.side,t0=1000;primeHold(tr,t0,Math.round(rand(0,20000)));
  const k=rand(.92,1.18),noise=()=>rand(-.001,.001);
  const seq=[[33,.008,1.001,0],[66,.020,1.004,0],[99,.040,1.010,0],[132,.070,1.020,.08],[165,.100,1.035,.08],[205,.120,1.050,.08],[245,.132,1.062,.08]];
  let confirmed=false,follow=false;
  for(const [dt,bx,bex,bs] of seq){
    const r=tr.update(inp(t0+dt,{anchorHandRel:{x:bx*k+noise(),y:noise()},faceHandRel:{x:bx*k+noise(),y:noise()},drawElbowRel:{x:1+(bex-1)*k+noise(),y:noise()},bowWristRel:{x:-1,y:noise()},bowSpeed:bs?bs*rand(.9,1.25):0,faceHandSpeed:rand(.14,.22),drawSpeed:rand(.12,.20),elbowSpeed:rand(.04,.08)}));
    confirmed ||= !!r.didRelease||!!r.releaseConfirmed; follow ||= !!r.postReleaseEvidence||r.phase==='Follow Through';
  }
  if(!(confirmed&&follow))realMisses++;
}
assert.equal(realMisses,0,`synthetic genuine-release misses: ${realMisses}`);

// Tracking loss by itself must expire, not validate.
for(let n=0;n<300;n++){
  const e=Core.createAthleteShotEngine(),tr=e.trackers.side,s=tr.s;s.phase='Release';s.releaseEverArmed=true;s.releaseArmed=true;s.releaseConfirmed=true;s.releaseEpochMs=1000;s.releaseConfidence=.8;s.releaseEventId=1;s.drawQualified=true;s.anchorQualified=true;s.lastHoldTime=1;s.anchor=anchor();s.anchorStats=stats();s.releaseValidation={confirmedAt:1000,candidateStartedEpochMs:950,escapeEpochMs:1000,confirmSep:.08,maxSep:.08,candidateGrowth:.04,growthSteps:2,directionalSteps:2,rearAccum:.012,elbowRearAccum:.003,trackingDropSeen:false,bowReaction:false,outwardSteps:1,elbowAtConfirm:0,worldElbowAtConfirm:0,preTrajectory:false,visualMotionSeen:false};
  let r=tr.update(inp(1120,{criticalTrackingOK:false,measurementTrustScore:.2,trackingDrop:rand(.15,.4),visibilityDrop:rand(.16,.4),anchorHandRel:{x:rand(.075,.11),y:rand(-.01,.01)},faceHandRel:{x:rand(.075,.11),y:rand(-.01,.01)},drawElbowRel:{x:1+rand(-.003,.004),y:rand(-.003,.003)},faceHandSpeed:rand(.08,.18),drawSpeed:rand(.08,.18)}));
  assert.equal(r.phase,'Release');assert.equal(r.postReleaseEvidence,false);
  r=tr.update(inp(1305,{criticalTrackingOK:false,measurementTrustScore:.2,trackingDrop:rand(.15,.4),visibilityDrop:rand(.16,.4),anchorHandRel:{x:rand(.075,.11),y:rand(-.01,.01)},faceHandRel:{x:rand(.075,.11),y:rand(-.01,.01)},drawElbowRel:{x:1+rand(-.003,.004),y:rand(-.003,.003)}}));
  assert.equal(r.releaseInvalidated,true);assert.notEqual(r.phase,'Follow Through');
}

console.log(`X2.4 randomized stress: PASS · seed ${process.env.SEED||'0x3A2F24'} · ${letdownCases} let-downs · ${realCases} genuine releases · 300 tracking-drop cases`);
