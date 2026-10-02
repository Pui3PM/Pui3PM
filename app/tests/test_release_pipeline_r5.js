'use strict';
const assert=require('assert');
global.window=global;require('../static/core_runtime.js');const Core=global.CoreEngine;
let seed=(Number(process.env.SEED)||0x3A2F24)>>>0;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}function rand(a,b){return a+rnd()*(b-a);}
function anchor(){return {wrist:{x:0,y:0},faceHand:{x:0,y:0},elbow:{x:1,y:0},head:{x:0,y:1},rearVec:{x:1,y:0},worldFaceHand:null,worldElbow:null,worldBowWrist:null,faceDist:.25,bowArmDeg:150,drawElbowDeg:160};}
function stats(){return {n:8,sumHandX:0,sumHandY:0,sumFace:2,sumHeadX:0,sumHeadY:8,handSS:.00001,faceSS:.5,headSS:8};}
function primeHold(tr,t0=1000,holdMs=0){const s=tr.s;s.phase='Aim / Hold';s.phaseSince=t0-holdMs;s.holdStart=t0-holdMs;s.holdAt=t0-holdMs;s.releaseEverArmed=true;s.releaseArmed=true;s.releaseArmedAt=t0-holdMs;s.drawQualified=true;s.anchorQualified=true;s.recoveredSequence=false;s.anchor=anchor();s.anchorStats=stats();s.holdMotionSamples=[...Array(10)].map(()=>({rearStep:rand(-.0007,.0012),frameSpeed:rand(.008,.028),elbowRearStep:rand(-.0005,.0008),bowDownStep:rand(-.0005,.0008),epochMs:0}));s.holdPrevHand={x:0,y:0};s.holdPrevFaceHand={x:0,y:0};s.holdPrevElbow={x:1,y:0};s.holdPrevBow={x:-1,y:0};s.holdPrevEpochMs=t0;s.lastReleaseAt=0;}
function inp(t,o={}){return {now:t,epochMs:t,phaseQuality:.9,releaseQuality:.9,criticalTrackingOK:true,faceDist:.25,phaseFaceDist:.25,bowExtended:true,phaseBowExtended:true,setReady:true,shootingPosture:true,phaseShootingPosture:true,wristsLow:false,drawWristVisibility:.9,drawElbowVisibility:.9,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9,measurementTrustScore:.95,drawSpeed:.13,faceVelocity:0,faceHandSpeed:.16,worldFaceHandSpeed:0,elbowSpeed:.05,bowSpeed:0,trackingDrop:0,visibilityDrop:0,anchorHandRel:{x:0,y:0},faceHandRel:{x:0,y:0},drawElbowRel:{x:1,y:0},headRel:{x:0,y:1},bowWristRel:{x:-1,y:0},bowArmDeg:150,drawElbowDeg:160,...o};}


const A=require(process.env.RELEASE_CORE||'../static/adaptive_release_core.js');
function pipeline(eng,s,input){
  input={...input,shotIntentVerified:true};
  const raw=eng.update('side',input),r=A.update(s,raw,input,input.epochMs,eng.latestResults.side);
  if(process.env.DEBUG_PIPELINE)console.log(JSON.stringify({t:input.epochMs,rawPhase:raw.phase,complete:raw.shotComplete,post:raw.postReleaseEvidence,rear:raw.releaseRearAccum,elbow:raw.releaseElbowRearAccum,independent:raw.releasePostIndependent,blur:raw.releasePostBlurSupported,decision:s.lastDecision}));
  return r.override?{...raw,...r.patch}:raw;
}
const cases=120;
for(let n=0;n<cases;n++){
  const eng=Core.createAthleteShotEngine(),s=A.fresh();primeHold(eng.trackers.side,1000,Math.round(rand(0,20000)));
  s.reachedHold=true;s.reachedAnchor=true;
  const k=rand(.92,1.18),noise=()=>rand(-.001,.001);
  const seq=[[33,.008,1.001,0],[66,.020,1.004,0],[99,.040,1.010,0],[132,.070,1.020,.08],[165,.10,1.035,.08],[205,.12,1.05,.08],[245,.132,1.062,.08],[300,.135,1.065,.06]];
  const captures=[];
  for(const [dt,x,ex,bow] of seq){
    const r=pipeline(eng,s,inp(1000+dt,{anchorHandRel:{x:x*k+noise(),y:noise()},faceHandRel:{x:x*k+noise(),y:noise()},drawElbowRel:{x:1+(ex-1)*k+noise(),y:noise()},bowWristRel:{x:-1,y:noise()},bowSpeed:bow,faceHandSpeed:.18,drawSpeed:.15,elbowSpeed:.06}));
    if(r.shotComplete)captures.push(r);
  }
  assert.equal(captures.length,1,`real Core -> Adaptive release ${n}: exactly one completion`);
  assert(captures[0].releaseConfirmed&&captures[0].postReleaseEvidence,'completion requires validated release');
  assert(captures[0].releaseEpochMs>=1000&&captures[0].releaseEpochMs<=1300,'physical T0 remains inside observation window');
}
for(let n=0;n<cases;n++){
  const eng=Core.createAthleteShotEngine(),s=A.fresh();primeHold(eng.trackers.side,1000,Math.round(rand(0,20000)));
  s.reachedHold=true;s.reachedAnchor=true;
  let x=0,y=0,by=0,count=0;
  for(let i=1;i<=10;i++){
    x+=rand(-.002,.0035);y+=rand(.006,.014);by+=rand(.008,.016);const late=i>=3;
    const r=pipeline(eng,s,inp(1000+i*33,{anchorHandRel:{x,y},faceHandRel:{x,y},drawElbowRel:{x:1+rand(-.002,.003),y:y*.35},bowWristRel:{x:-1,y:by},setReady:!late,phaseShootingPosture:!late,phaseBowExtended:!late,wristsLow:i>=5,phaseFaceDist:late?rand(.86,1.18):.25,faceDist:late?rand(.86,1.18):.25,trackingDrop:late?rand(.05,.28):rand(0,.05),visibilityDrop:late?rand(.05,.25):rand(0,.05),bowSpeed:late?rand(.05,.14):rand(0,.03)}));
    if(r.shotComplete)count++;
  }
  assert.equal(count,0,`Core -> Adaptive let-down ${n} must not capture`);
}
console.log(`R5 actual frozen Core -> Adaptive release-segment integration: ${cases} genuine 1/each, ${cases} let-down 0/each (synthetic geometry; starts at verified Hold)`);
