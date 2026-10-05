'use strict';
const assert = require('assert');
global.window = global;
require('../static/core_runtime.js');
const Core = global.CoreEngine;

function baseResult(overrides={}){
  return {
    phase:'Release', primaryPhase:'Release', holdTimeS:1.2, didRelease:false, shotComplete:false,
    releaseJustConfirmed:false, releaseConfirmed:true, followThroughConfirmed:false, postReleaseEvidence:false,
    releaseConfidence:.82, releaseEpochMs:1000, releaseEventId:1, sequenceQualified:true,
    blocker:'release_validation', ...overrides
  };
}
function baseInput(now=1000, overrides={}){
  return {
    now, epochMs:now, phaseQuality:.9, releaseQuality:.9, criticalTrackingOK:true,
    faceDist:.25, phaseFaceDist:.25, bowExtended:true, phaseBowExtended:true,
    setReady:true, shootingPosture:true, phaseShootingPosture:true, wristsLow:false,
    drawWristVisibility:.9, drawElbowVisibility:.9, phaseDrawWristVisibility:.9, phaseDrawElbowVisibility:.9,
    measurementTrustScore:.95, drawSpeed:0, faceVelocity:0, faceHandSpeed:0, worldFaceHandSpeed:0,
    elbowSpeed:0, bowSpeed:0, trackingDrop:0, visibilityDrop:0,
    anchorHandRel:{x:.08,y:0}, faceHandRel:{x:.08,y:0}, drawElbowRel:{x:1,y:0}, headRel:{x:0,y:1}, bowWristRel:{x:-1,y:0},
    bowArmDeg:150, drawElbowDeg:160, worldFaceHandRel:null, worldDrawElbowRel:null, worldBowWristRel:null,
    ...overrides
  };
}
function primeReleaseTracker(tracker,{preTrajectory=false,trackingDropSeen=false}={}){
  const s=tracker.s;
  s.phase='Release'; s.phaseSince=1000; s.releaseEverArmed=true; s.releaseArmed=true;
  s.releaseConfirmed=true; s.releaseEpochMs=1000; s.releaseConfidence=.82; s.releaseEventId=1;
  s.drawQualified=true; s.anchorQualified=true; s.holdStart=0; s.lastHoldTime=1.2; s.followEvidence=false;
  s.anchor={wrist:{x:0,y:0},faceHand:{x:0,y:0},elbow:{x:1,y:0},head:{x:0,y:1},rearVec:{x:1,y:0},worldFaceHand:null,worldElbow:null,worldBowWrist:null,faceDist:.25,bowArmDeg:150,drawElbowDeg:160,headPitchDeg:0,handSpreadPct:null};
  s.anchorStats={n:4,sumHandX:0,sumHandY:0,sumFace:1,sumHeadX:0,sumHeadY:4,handSS:0,faceSS:.25,headSS:4};
  s.releaseValidation={confirmedAt:1000,candidateStartedEpochMs:950,escapeEpochMs:1000,confirmSep:.08,maxSep:.08,candidateGrowth:.04,growthSteps:2,directionalSteps:2,rearAccum:.012,elbowRearAccum:.003,trackingDropSeen,bowReaction:false,outwardSteps:1,elbowAtConfirm:0,worldElbowAtConfirm:0,preTrajectory,visualMotionSeen:false};
}

// Runtime contract and evidence-plan regression.
assert.equal(Core.BUILD_ID,'x2.4-release-proof');
assert.deepStrictEqual(Core.assertRuntimeContract(),{ok:true,errors:[]});
const plan=Core.buildCoachEvidencePlan([{phase:'Draw',epochMs:1000},{phase:'Anchor',epochMs:1800},{phase:'Aim / Hold',epochMs:2000},{phase:'Release',epochMs:4000}],4000);
assert(plan.requests.some(r=>r.label.includes('Hold')),'Hold evidence must survive coach filmstrip compaction');
assert(!plan.requests.some(r=>r.label==='Expansion'&&r.offset===-4000),'Missing Expansion phase must not create epoch-zero phantom frame');

// Persistence invariant: no post-release evidence = no shot.
let v=Core.validateCompletedShotEvidence({role:'side',detected:true,shotComplete:true,releaseConfirmed:true,releaseEpochMs:1000,sequenceQualified:true,shotObservability:.9,identityConfidence:.9,postReleaseEvidence:false});
assert.equal(v.accepted,false);
v=Core.validateCompletedShotEvidence({role:'side',detected:true,shotComplete:true,releaseConfirmed:true,releaseEpochMs:1000,sequenceQualified:true,shotObservability:.9,identityConfidence:.9,postReleaseEvidence:true});
assert.equal(v.accepted,true);

// Multi-view corroboration cannot manufacture a completed shot.
{
  const eng=Core.createAthleteShotEngine();
  eng.authorityRole=()=> 'side';
  let sideN=0,rearN=0;
  eng.trackers.side.update=()=>baseResult({releaseJustConfirmed:sideN++===0});
  eng.trackers.rear.update=()=>baseResult({releaseJustConfirmed:rearN++===0});
  eng.trackers.overhead.update=()=>baseResult({releaseConfirmed:false,releaseEpochMs:null});
  let r=eng.update('side',{now:1000,epochMs:1000,phaseQuality:.9,releaseQuality:.9,criticalTrackingOK:true});
  assert.equal(r.shotComplete,false);
  r=eng.update('rear',{now:1110,epochMs:1110,phaseQuality:.9,releaseQuality:.9,criticalTrackingOK:true});
  assert.equal(r.evidenceRoles.length,2);
  assert.equal(r.shotComplete,false,'two provisional camera releases must not commit without post-release evidence');
  eng.trackers.side.update=()=>baseResult({releaseJustConfirmed:false,postReleaseEvidence:true,followThroughConfirmed:true,phase:'Follow Through',primaryPhase:'Follow Through'});
  r=eng.update('side',{now:1210,epochMs:1210,phaseQuality:.9,releaseQuality:.9,criticalTrackingOK:true});
  assert.equal(r.shotComplete,true,'shot should commit after one view completes post-release validation');
}

// Tracking drop alone must never validate a provisional Release.
{
  const eng=Core.createAthleteShotEngine(), tr=eng.trackers.side;
  primeReleaseTracker(tr,{preTrajectory:false});
  let r=tr.update(baseInput(1120,{criticalTrackingOK:false,trackingDrop:.25,visibilityDrop:.25}));
  assert.equal(r.phase,'Release');
  assert.equal(r.postReleaseEvidence,false);
  assert.equal(r.releasePostIndependent,false);
  r=tr.update(baseInput(1305,{criticalTrackingOK:false,trackingDrop:.25,visibilityDrop:.25}));
  assert.equal(r.releaseInvalidated,true);
  assert.equal(r.phase,'Aim / Hold');
}

// Lowering after a provisional release candidate is a hard veto before post-release proof.
{
  const eng=Core.createAthleteShotEngine(), tr=eng.trackers.side;
  primeReleaseTracker(tr,{preTrajectory:false});
  const r=tr.update(baseInput(1100,{setReady:false,wristsLow:true,phaseShootingPosture:false,phaseBowExtended:false,phaseFaceDist:1.1,faceDist:1.1,bowSpeed:.12,anchorHandRel:{x:.08,y:.08},faceHandRel:{x:.08,y:.08}}));
  assert.equal(r.releaseInvalidated,true);
  assert.equal(r.blocker,'release_contradicted_let_down');
  assert.equal(r.phase,'Setup');
  assert.equal(r.postReleaseEvidence,false);
}

// Genuine release with independent bow reaction validates and enters Follow Through.
{
  const eng=Core.createAthleteShotEngine(), tr=eng.trackers.side;
  primeReleaseTracker(tr,{preTrajectory:true});
  const r=tr.update(baseInput(1100,{bowSpeed:.08,anchorHandRel:{x:.10,y:0},faceHandRel:{x:.10,y:0},drawElbowRel:{x:1.03,y:0}}));
  assert.equal(r.phase,'Follow Through');
  assert.equal(r.postReleaseEvidence,true);
  assert.equal(r.releasePostIndependent,true);
}


// End-to-end actual tracker -> athlete engine: genuine release emits shotComplete only after post-release proof.
{
  const eng=Core.createAthleteShotEngine(), tr=eng.trackers.side;
  const s=tr.s;
  s.phase='Aim / Hold';s.phaseSince=1000;s.holdStart=1000;s.holdAt=1000;s.releaseEverArmed=true;s.releaseArmed=true;s.releaseArmedAt=1000;s.drawQualified=true;s.anchorQualified=true;s.recoveredSequence=false;
  s.anchor={wrist:{x:0,y:0},faceHand:{x:0,y:0},elbow:{x:1,y:0},head:{x:0,y:1},rearVec:{x:1,y:0},worldFaceHand:null,worldElbow:null,worldBowWrist:null,faceDist:.25,bowArmDeg:150,drawElbowDeg:160};
  s.anchorStats={n:8,sumHandX:0,sumHandY:0,sumFace:2,sumHeadX:0,sumHeadY:8,handSS:.00001,faceSS:.5,headSS:8};
  s.holdMotionSamples=[...Array(8)].map(()=>({rearStep:.001,frameSpeed:.02,elbowRearStep:0,bowDownStep:0,epochMs:0}));s.holdPrevHand={x:0,y:0};s.holdPrevFaceHand={x:0,y:0};s.holdPrevElbow={x:1,y:0};s.holdPrevBow={x:-1,y:0};s.holdPrevEpochMs=1000;
  const seq=[[1033,.008,1.001,0],[1066,.020,1.004,0],[1099,.040,1.010,0],[1132,.070,1.020,.08],[1165,.10,1.035,.08],[1200,.12,1.05,.08],[1240,.13,1.06,.08],[1300,.135,1.065,.06]];
  let completed=false, completion=null;
  for(const [t,x,ex,b] of seq){const r=eng.update('side',baseInput(t,{anchorHandRel:{x,y:0},faceHandRel:{x,y:0},drawElbowRel:{x:ex,y:0},bowSpeed:b,faceHandSpeed:.18,drawSpeed:.15,elbowSpeed:.06}));if(r.shotComplete){completed=true;completion=r;}}
  assert.equal(completed,true);
  assert.equal(completion.postReleaseEvidence,true);
}

// Follow-through has no timeout and ends only on recovery evidence.
{
  const eng=Core.createAthleteShotEngine(), tr=eng.trackers.side;
  const s=tr.s; s.phase='Follow Through'; s.releaseEverArmed=true; s.releaseArmed=true; s.releaseConfirmed=true; s.releaseEpochMs=1000; s.releaseEventId=1; s.followEvidence=true; s.lastHoldTime=1.0;
  let r=tr.update(baseInput(15000));
  assert.equal(r.phase,'Follow Through','long follow-through must not timeout');
  assert.equal(!!r.followThroughEnded,false);
  r=tr.update(baseInput(15100,{setReady:false,wristsLow:true,phaseShootingPosture:false,phaseBowExtended:false,phaseFaceDist:1.2,faceDist:1.2}));
  assert.equal(r.phase,'Follow Through');
  r=tr.update(baseInput(15250,{setReady:false,wristsLow:true,phaseShootingPosture:false,phaseBowExtended:false,phaseFaceDist:1.2,faceDist:1.2}));
  assert.equal(r.followThroughEnded,true);
  assert.equal(r.phase,'Setup');
}

console.log('X2.4 release-proof directed QA: PASS');
