const assert=require('assert');
const A=require('../static/adaptive_release_core.js');

function baseState(){const s=A.fresh();s.reachedAnchor=true;s.reachedHold=true;return s;}
function tl(){return [
  {phase:'Draw',epochMs:1000},{phase:'Anchor',epochMs:1200},{phase:'Aim / Hold',epochMs:1500}
];}
function input(t,o={}){return {epochMs:t,phaseQuality:1,measurementTrustScore:1,phaseDrawWristVisibility:1,phaseDrawElbowVisibility:1,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,physicalSetReady:true,shotIntentVerified:true,debugShotIntentVerified:true,visualMotionCorroborated:true,bowSpeed:2,bowArmDeg:165,phaseFaceDist:.7,...o};}

// User field trace false CAP #1: native transaction completed while the actual hand-down only had
// a weak rearward release signature. This must remain provisional and must not Capture.
{
  const s=baseState();
  const m={phase:'Follow Through',primaryPhase:'Release',armed:true,releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,followThroughConfirmed:true,
    releaseRearStep:.0182,releaseFaceRearStep:.0270,releaseElbowRearStep:.0107,releaseDirectionalSteps:2,
    releaseRearAccum:.0396,releaseElbowRearAccum:.0130,releaseFrameSpeed:.908,releasePostIndependent:false,releasePostBlurSupported:false,
    phaseTimeline:tl()};
  const r=A.update(s,m,input(1700,{bowSpeed:2.10,bowArmDeg:163.45,phaseFaceDist:1.03}),1700);
  assert.equal(r.override,true,'weak native terminal must be intercepted');
  assert.equal(r.patch.shotComplete,false,'weak native hand-down must not Capture');
  assert.equal(r.patch.releaseConfirmed,false,'weak native hand-down must not become Release');
  assert.equal(s.lastDecision,'native-release-veto-weak-terminal');
}

// Real native release control from the same field run: strong current + accumulated rearward motion
// must still pass through unchanged.
{
  const s=baseState();
  const m={phase:'Follow Through',primaryPhase:'Release',armed:true,releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,followThroughConfirmed:true,
    releaseRearStep:.289,releaseFaceRearStep:.279,releaseElbowRearStep:.0042,releaseDirectionalSteps:2,
    releaseRearAccum:.385,releaseElbowRearAccum:.081,releaseFrameSpeed:5.51,releasePostIndependent:false,releasePostBlurSupported:false,
    phaseTimeline:tl()};
  const r=A.update(s,m,input(1700,{bowSpeed:1.97,bowArmDeg:164.36,phaseFaceDist:1.05}),1700);
  assert.notEqual(r.override,true,'strong real native release must not be masked');
  assert.equal(s.lastDecision,'native-release');
}

// User field trace false CAP #2: Hold-watch rescue must lose if the bow arm collapses materially
// before the terminal edge, even when posture flags are still superficially intact.
{
  const s=baseState();
  s.holdWatchCandidate={epochMs:2000,seenAt:2000,onsetFace:.525,onsetBowArm:163.85,rear:.046,faceRear:.05,elbow:.113,speed:1.0,bow:.2,score:2.5,channels:5,rearPositive:true,facePositive:true,speedSupport:true,elbowSupport:true,maxPostFaceDelta:.16,minPostFaceDelta:0,lastPostFaceDelta:.15,maxBow:1.4,maxSpeed:2.2,maxElbowAbs:.12,directionalFrames:1,positiveFrames:2,negativeFrames:0,source:'anchor-hold-release-watch'};
  const m={phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:true,letDown:true,releaseConfirmed:false,releaseCandidate:false,phaseTimeline:tl()};
  const r=A.update(s,m,input(2381,{bowArmDeg:148.56,bowSpeed:.67,phaseFaceDist:.684}),2381);
  assert.equal(s.latched,false,'bow-arm collapse must veto hold-watch terminal rescue');
  assert.ok(!r.patch?.shotComplete,'collapsed hand-down must not Capture');
}

console.log('R4 user hand-down false-CAP regression PASS');
