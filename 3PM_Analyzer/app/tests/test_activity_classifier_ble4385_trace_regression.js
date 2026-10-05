const assert=require('assert');
const C=require('../static/activity_classifier_core.js');

function stepMany(metrics,visual,count=20,dt=120){
  let s=C.fresh(),out=null;
  for(let i=0;i<count;i++) out=C.update(s,{now:i*dt,metrics,visual,sensor:{connected:false}});
  return out;
}

// Regression copied from physical BLE4.3.8.4 trace pattern:
// seated / hands close, classifier saw a strong vertical contrast and incorrectly called Real Bow.
const falseVisual={usable:true,quality:.87,bowStructure:.82,elasticLine:.10,handSeparationRatio:.63,reason:'ok'};
const falseMetrics={
  phase:'Set',primaryPhase:'Set',debugSetReady:true,debugPhaseShootingPosture:true,
  debugPhaseBowExtended:false,debugPhaseDrawWristVisibility:.95,debugPhaseDrawElbowVisibility:.95
};
const seated=stepMany(falseMetrics,falseVisual,30);
assert.notEqual(seated.label,'real_bow','strong image contrast must not classify Real Bow when bow arm is not extended');
assert.equal(seated.captureClassified,false,'invalid shooting geometry must never unlock capture classification');
assert.equal(seated.postureEligible,false,'trace-like seated pose must be posture-ineligible');

// Even if a previous real-bow label was valid, stale camera evidence must expire.
let s=C.fresh(),out=null;
const validMetrics={phase:'Anchor',primaryPhase:'Anchor',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseDrawWristVisibility:.95,debugPhaseDrawElbowVisibility:.95};
const bowVisual={usable:true,quality:.9,bowStructure:.90,elasticLine:.06,handSeparationRatio:1.15,reason:'ok'};
for(let i=0;i<12;i++) out=C.update(s,{now:i*150,metrics:validMetrics,visual:bowVisual,sensor:{connected:false}});
assert.equal(out.label,'real_bow','valid eligible multi-frame bow evidence should classify Real Bow');
assert(out.captureClassified,'fresh verified bow evidence should allow activity classification');
for(let i=12;i<24;i++) out=C.update(s,{now:i*150,metrics:falseMetrics,visual:{usable:false,quality:.8,bowStructure:0,elasticLine:0,reason:'arm landmarks unavailable'},sensor:{connected:false}});
assert.equal(out.label,'unknown','stale camera Real Bow label must fall back to Unknown');
assert.equal(out.captureClassified,false,'stale equipment evidence must not keep capture unlocked');
assert.equal(out.freshEvidence,false,'stale evidence must be reported as not fresh');

// A real sensor remains authoritative regardless of camera pose.
let ss=C.fresh();
out=C.update(ss,{now:100,metrics:falseMetrics,visual:falseVisual,sensor:{connected:true,deviceId:'3PM-BOW-REAL',dataMode:'REAL_IMU',lastPacketAgeMs:20}});
assert.equal(out.label,'real_bow');
assert(out.captureClassified&&out.source==='bow_sensor');

console.log('BLE4.3.8.5 trace regression QA PASS');
