'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=require('../static/adaptive_release_core.js');
const L=require('../static/side_lifecycle_core.js');
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43893_real_bow_release_readiness.json'),'utf8'));
assert.equal(A.VERSION,'BLE4.3.8.9.5.7-adaptive-release-v16');
assert.equal(L.VERSION,'BLE4.3.8.9.5.5-side-lifecycle-v7');

function inputFrom(x){return {...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady===true,physicalSetReady:x.nativeSetReady===true,shotIntentVerified:true};}
function replay(rows){
  let s=A.fresh(),caps=[];
  for(const x of rows){
    const r=A.update(s,x,inputFrom(x),x.t);s=r.state;
    const out=r.override&&r.patch?{...x,...r.patch}:x;
    if(out.shotComplete===true)caps.push({t:x.t,releaseEpochMs:out.releaseEpochMs,source:out.adaptiveReleaseSource||null});
  }
  return {caps,state:s};
}

// 2026-09-27 real-bow field truth: these six genuine releases all reached verified Anchor/Hold but
// BLE43892 classified them as let-down.  BLE43893 must recover each exactly once without requiring
// an Expansion milestone or native armed=true at the release witness.
for(const c of fx.real_bow_missed_releases){
  assert(!c.samples.some(x=>x.phase==='Expansion'),'fixture must exercise micro/no-visible Expansion path');
  const r=replay(c.samples);
  assert.equal(r.caps.length,1,`${c.id} genuine real-bow release must Capture exactly once`);
  assert.equal(r.caps[0].source,'hold-watch-terminal',`${c.id} must be proven by deferred Anchor/Hold release watcher`);
}

// Explicit field-ground-truth hard negative: deep deliberate let-down that reached Expansion.
{
  const r=replay(fx.confirmed_deep_let_down.samples);
  assert.equal(r.caps.length,0,'confirmed deep deliberate let-down must remain 0 Capture');
}

// A Hold/Expansion pulse is only a witness.  Without a terminal edge it must remain 0 Capture.
{
  const base={phase:'Aim / Hold',primaryPhase:'Aim / Hold',detected:true,phaseQuality:.98,measurementTrust:.96,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,setAdmissionReady:true,nativeSetReady:true,phaseFaceDist:.70,bowSpeed:1.3,releaseRearThreshold:.04,releaseSpeedThreshold:1.0,visualMotionCorroborated:false,letDownDirectional:false};
  const rows=[
    {...base,t:1000,releaseRearStep:.06,releaseFaceRearStep:.05,releaseElbowRearStep:.09,releaseFrameSpeed:1.3,letDown:false},
    {...base,t:1080,phaseFaceDist:.73,releaseRearStep:-.01,releaseFaceRearStep:-.01,releaseElbowRearStep:-.02,releaseFrameSpeed:.3,letDown:false},
    {...base,t:1200,phaseFaceDist:.71,releaseRearStep:0,releaseFaceRearStep:0,releaseElbowRearStep:0,releaseFrameSpeed:.2,letDown:false}
  ];
  assert.equal(replay(rows).caps.length,0,'candidate alone must never Capture');
}

function lifeInput(t,o={}){return {epochMs:t,phaseQuality:.95,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.96,phaseShootingPosture:false,phaseBowExtended:false,setReady:true,wristsLow:true,neutralEvidence:true,bowPlaneReady:false,bowPlaneStable:false,setAdmissionReady:false,shotIntentReady:false,drawSideVisible:true,bowArmDeg:105,bowSpeed:0,drawSpeed:0,faceHandSpeed:0,phaseFaceDist:2.2,...o};}
function shotInput(t,o={}){return lifeInput(t,{wristsLow:false,neutralEvidence:false,phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,setAdmissionReady:true,shotIntentReady:true,bowArmDeg:145,bowSpeed:1.0,drawSpeed:1.1,faceHandSpeed:1.0,phaseFaceDist:1.05,...o});}
function step(st,t,input,native={phase:'Setup',primaryPhase:'Setup'}){return L.update(st,input,native,t);}

// False motion without a credible shot plane must stay private/provisional and never leave athlete-facing Set.
{
  let s=L.fresh(),r,events=[];
  for(const t of [0,110,220]){r=step(s,t,lifeInput(t),{phase:'Setup'});s=r.state;if(r.event)events.push(r.event);}
  assert.equal(s.stableSet,true,'fixture must establish stable Set');
  for(const t of [300,370]){r=step(s,t,lifeInput(t,{wristsLow:false,neutralEvidence:false,bowArmDeg:150,drawSpeed:1.2,faceHandSpeed:1.1,bowSpeed:.9,phaseFaceDist:1.05}),{phase:'Draw'});s=r.state;if(r.event)events.push(r.event);}
  assert.equal(events.filter(e=>e.type==='shot-start').length,0,'scratch/head-touch style motion without plane must not start shot');
  assert.equal(s.shotActive,false);assert.equal(s.authorityPhase,'Set');
}

// A verified Setup may still be abandoned cleanly before Draw and must return to Set.
{
  let s=L.fresh(),r,aborted=null;
  for(const t of [0,110,220]){r=step(s,t,lifeInput(t),{phase:'Setup'});s=r.state;}
  for(const t of [300,370,440]){r=step(s,t,shotInput(t,{drawSpeed:.2,faceHandSpeed:.25}),{phase:'Setup'});s=r.state;}
  assert.equal(s.shotActive,true);assert.equal(s.verifiedSetup,true);assert.equal(s.verifiedDraw,false);
  for(const t of [560,700,820]){r=step(s,t,lifeInput(t),{phase:'Setup'});s=r.state;if(r.event?.type==='shot-abort')aborted=r.event;}
  assert(aborted,'neutral return before verified Draw must abort verified Setup');assert.equal(s.shotActive,false);assert.equal(s.authorityPhase,'Set');
}

// Once Draw is verified, the pre-Draw stale-context fuse is no longer allowed to abort.
{
  let s=L.fresh(),r;
  for(const t of [0,110,220]){r=step(s,t,lifeInput(t),{phase:'Setup'});s=r.state;}
  for(const t of [300,370,440]){r=step(s,t,shotInput(t),{phase:'Draw',primaryPhase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:300}]});s=r.state;}
  assert.equal(s.verifiedDraw,true,'credible native/shot-plane Draw must verify shot');
  for(const t of [500,750,1000,1400]){r=step(s,t,shotInput(t,{drawSpeed:.15,faceHandSpeed:.2,bowSpeed:.15}),{phase:'Draw',primaryPhase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:300}]});s=r.state;assert.notEqual(r.event?.type,'shot-abort','verified Draw must not be discarded');}
  assert.equal(s.shotActive,true);
}

const ci=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8');
assert(ci.includes("pendingLifecycleEvent?.type==='shot-abort'"),'integration must consume lifecycle shot-abort');
assert(ci.includes('cycle_early_context_discarded'),'discarded early context must be trace-visible');
assert(ci.includes('holdReleaseWatch'),'release watcher diagnostics must be trace-visible');

console.log('BLE4.3.8.9.4.1 Real-Bow Release Pending QA PASS · 6/6 prior real misses rescued · no visible Expansion required · deep let-down 0 · stale pre-shot context expires');
