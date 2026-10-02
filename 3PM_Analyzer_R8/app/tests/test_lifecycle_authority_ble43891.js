'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');

const ci=read('static/capture_integrity_layer.js');
const fg=read('static/foundation_guard_layer.js');
const ev=read('static/evidence_timeline_baseline_layer.js');

assert(ci.includes("const BUILD_VERSION='BLE4.3.8.9.5.4';"),'BLE43891 build truth missing');
assert(ci.includes('const previousSideResult=sideResult;'),'rearm must preserve previous terminal result for lifecycle observer');
const resetAt=ci.indexOf('if(forceEngineReset){forceEngineReset=false;sideResult=null;inner.reset?.();A?.reset?.(adaptive);SideLife?.reset?.(sideLife);AnchorBridge?.reset?.(anchorBridge);pendingLifecycleEvent=null;}');
const prepareAt=ci.indexOf('const prepared=prepareSideInput(input||{},previousSideResult);');
assert(resetAt>=0&&prepareAt>resetAt,'frozen engine/lifecycle reset must happen before evaluating the first post-rearm camera frame');
assert(ci.includes('rec.displayPhase=SideLife?.displayPhase?.(rec.phase)'),'athlete-facing trace phase missing');
assert(ci.includes('rec.lifecycleAuthorityPhase=SideLife?.authorityPhase?.'),'terminal-safe trace authority missing');
assert(ci.includes('display_timeline:displayTimeline(timeline,c.releaseEpochMs)'),'display timeline missing from exported cycles');
assert(fg.includes("const LAYER_VERSION='BLE4.3.8.9.4.1-shot-state-arbiter-v2';"),'foundation monotonic lifecycle authority version missing');
assert(fg.includes("authority==='Follow Through'?'Follow Through · terminal lock'"),'terminal presentation lock missing');
assert(fg.includes("Set:'Setup'"),'athlete-facing Set -> Setup terminology missing');
assert(ev.includes('const notObserved=Object.entries(stages).filter'),'optional-stage truth must be recomputed after normalized Recovery append');

// Review 2026-09-29 intentionally fixes missing-number coercion in the evidence
// helper; pin that reviewed change. Frozen Dev4 runtime hashes remain unchanged.
const unchanged={
  'static/shot_intent_core.js':'2102bf307d98df415aec727672a358f25a185310251a60a3beb14047c37f4e5f',
  'static/capture_integrity_core.js':'68e9aacfedfdfa9d52110685374435d15f5a9f7a041fb78df6a13ee4396c15f3',
};
for(const [f,want] of Object.entries(unchanged))assert.equal(sha(f),want,`${f} changed outside reviewed scope`);
assert(read('static/adaptive_release_core.js').includes("const VERSION='BLE4.3.8.9.5.7-adaptive-release-v16';"),'BLE43894 adaptive Release pending missing');
assert(read('static/coach_keyframe_plan_core.js').includes("BLE4.3.8.9.4.1-keyframe25-t0-v5"),'BLE43894 T0-protected review plan missing');

// Regression: if a recovery-end real frame is already present, normalized evidence must not
// simultaneously report optional Recovery as "notObserved", even if the base record was persisted
// before followThroughEndEpochMs was appended.
const C=require('../static/capture_integrity_core.js');
const release=1800000000000;
const frames=[
 {offsetMs:-1800,evidenceZone:'draw-pin'},
 {offsetMs:-1200,evidenceZone:'anchor-pin'},
 {offsetMs:-900,evidenceZone:'hold-pin'},
 {offsetMs:-350,evidenceZone:'expansion-pin'},
 {offsetMs:-8,evidenceZone:'release-focus'},
 {offsetMs:180,evidenceZone:'follow-summary'},
 {offsetMs:1300,evidenceZone:'recovery-end'}
];
const record={frames,releaseEpochMs:release,anchorEpochMs:release-1200,anchorSettledEpochMs:release-900,anchorFocusEpochMs:release-900};
const advanced={phase_timeline:[
 {phase:'Draw',epochMs:release-1800},{phase:'Anchor',epochMs:release-1200},{phase:'Aim / Hold',epochMs:release-900},{phase:'Expansion',epochMs:release-350},{phase:'Release',epochMs:release},{phase:'Follow Through',epochMs:release+160}
],release_epoch_ms:release};
const base=C.evidenceContract(record,advanced);
assert(base.notObserved.includes('recovery'),'fixture must reproduce stale base Recovery metadata');
const context={window:{CaptureIntegrityCore:C},console};context.globalThis=context;
vm.createContext(context);vm.runInContext(ev,context,{filename:'evidence_timeline_baseline_layer.js'});
const E=context.window.EvidenceTimelineBaselineLayer;
assert(E?.normalizeContract,'evidence contract normalizer unavailable');
const fixed=E.normalizeContract(record,advanced,base);
assert.equal(fixed.stages.recovery.ok,true,'real recovery-end frame must be recognized');
assert(!fixed.notObserved.includes('recovery'),'Recovery cannot be both observed and notObserved');

console.log('BLE4.3.8.9.4.1 Lifecycle Authority QA PASS · rearm first frame kept · terminal trace authority · Recovery metadata coherent · Release readiness scoped to adaptive overlay');
