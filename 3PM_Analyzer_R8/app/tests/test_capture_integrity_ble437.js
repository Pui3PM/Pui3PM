const assert=require('assert');
const C=require('../static/capture_integrity_core.js');

// Jitter is deviation from the median frame interval, not the frame interval itself.
let js=C.jitterStats([33.2,33.4,33.3,33.5,66.7]);
assert(js.median_ms>33&&js.median_ms<34);
assert(js.p95_deviation_ms>30,'a doubled frame gap must be visible as real timing jitter');

// Camera profiler: 60 fps remains high-speed evidence and analysis rate is independent.
let q=C.cameraQuality({width:1920,height:1080,reportedFps:60,actualFps:59.7,jitterMs:1.8,poseHz:29.4,active:true});
assert.equal(q.level,'good');
assert.equal(q.mode,'HIGH-SPEED EVIDENCE');
assert(Math.abs(q.captureRate-59.7)<.01);
assert(Math.abs(q.analysisRate-29.4)<.01);

// 30 fps standard and low-rate warning.
q=C.cameraQuality({width:1920,height:1080,actualFps:29.4,jitterMs:3,active:true});
assert.equal(q.mode,'STANDARD EVIDENCE');
q=C.cameraQuality({width:1280,height:720,actualFps:14.5,jitterMs:4,active:true});
assert.equal(q.level,'bad');

// Side-only timeline normalization drops stale Rear events.
const release=1_790_255_325_450;
const tl=C.normalizeTimeline([
  {phase:'Set',epochMs:release-7000,role:'rear'},
  {phase:'Draw',epochMs:release-6500,role:'side'},
  {phase:'Anchor',epochMs:release-4300,role:'side'},
  {phase:'Aim / Hold',epochMs:release-3500,role:'side'},
  {phase:'Expansion',epochMs:release-900,role:'side'},
  {phase:'Release',epochMs:release,role:'side'},
],release);
assert(!tl.some(x=>x.role!=='side'));
assert(!tl.some(x=>x.phase==='Set'));
assert(tl.some(x=>x.phase==='Anchor'));
assert(tl.some(x=>x.phase==='Release'));

// Absurd zero-epoch anchor is reported unavailable, never a trillion-ms offset.
assert.equal(C.safeOffset(0,release),null);
assert.equal(C.safeOffset(release-1806,release),-1806);

// Long hold does not remove beginning/end contract when evidence is present.
const frames=[
  {offsetMs:-12000,evidenceZone:'draw'},
  {offsetMs:-10000,evidenceZone:'anchor-focus'},
  {offsetMs:-8000,evidenceZone:'aim-hold'},
  {offsetMs:-5000,evidenceZone:'aim-hold'},
  {offsetMs:-900,evidenceZone:'expansion-pin'},
  {offsetMs:-50,evidenceZone:'release-focus'},
  {offsetMs:0,evidenceZone:'release-focus'},
  {offsetMs:50,evidenceZone:'release-focus'},
  {offsetMs:900,evidenceZone:'follow-summary'},
  {offsetMs:2500,evidenceZone:'recovery-end'},
];
const adv={release_epoch_ms:release,phase_timeline:[
  {phase:'Draw',epochMs:release-12000,role:'side'},
  {phase:'Anchor',epochMs:release-10000,role:'side'},
  {phase:'Aim / Hold',epochMs:release-9500,role:'side'},
  {phase:'Expansion',epochMs:release-900,role:'side'},
  {phase:'Release',epochMs:release,role:'side'},
  {phase:'Follow Through',epochMs:release+100,role:'side'},
]};
const rec={releaseEpochMs:release,anchorEpochMs:release-10000,anchorSettledEpochMs:release-9500,anchorFocusEpochMs:release-9500,followThroughEndEpochMs:release+2500,frames};
const contract=C.evidenceContract(rec,adv);
assert.equal(contract.complete,true,JSON.stringify(contract));
assert.equal(contract.releaseDeltaMs,0);
assert(contract.stages.anchor.ok&&contract.stages.recovery.ok);

// BLE4.3.8.8.2: a phase timestamp is not evidence. If Expansion was observed but
// no real frame was tagged for it, the contract must stay incomplete.
const noExpansionFrame=C.evidenceContract({...rec,frames:frames.map(f=>f.evidenceZone==='expansion-pin'?{...f,evidenceZone:'aim-hold'}:f)},adv);
assert.equal(noExpansionFrame.complete,false);
assert(noExpansionFrame.missing.includes('expansion'));
// If the detector did not observe Expansion for that physical shot, Expansion is
// optional rather than fabricated; the remaining real stages may still be complete.
const advNoExpansion={...adv,phase_timeline:adv.phase_timeline.filter(e=>e.phase!=='Expansion')};
const optionalExpansion=C.evidenceContract({...rec,frames:frames.map(f=>f.evidenceZone==='expansion-pin'?{...f,evidenceZone:'aim-hold'}:f)},advNoExpansion);
assert.equal(optionalExpansion.complete,true,JSON.stringify(optionalExpansion));
assert(optionalExpansion.notObserved.includes('expansion'));

// BLE43890: Recovery is optional closing evidence. A coach may intentionally hold Follow-through
// while checking Capture, so required evidence must be complete without forcing the athlete to lower.
const noRecovery=C.evidenceContract({...rec,followThroughEndEpochMs:null,frames:frames.filter(x=>x.evidenceZone!=='recovery-end')},adv);
assert.equal(noRecovery.complete,true,JSON.stringify(noRecovery));
assert.equal(noRecovery.stages.recovery.required,false);
assert(noRecovery.notObserved.includes('recovery'));
assert(!noRecovery.missing.includes('recovery'));

console.log('BLE4.3.7 capture integrity core QA PASS');
