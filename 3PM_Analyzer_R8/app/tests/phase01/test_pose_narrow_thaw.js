'use strict';
const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const posePath=path.resolve(__dirname,'../../static/pose.js');
const source=fs.readFileSync(posePath,'utf8');
const BASELINE_SHA256='22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d';
function sha(s){return crypto.createHash('sha256').update(s).digest('hex');}
// P-06 (OWNER DECISION D-B option 1): a field_test_not_production artifact ships the frozen HV3 pose.js.
// The seam is absent there, so the reconstruction guard is replaced by the stronger exact frozen-hash check.
const ARTIFACT_CLASS=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../PACKAGE_CONTRACT.json'),'utf8')).artifact_class;
if(ARTIFACT_CLASS==='field_test_not_production'){
  assert.equal(sha(source),BASELINE_SHA256,'field test build must ship the frozen HV3 pose.js byte-for-byte');
  assert(!source.includes('Phase 0 narrow-thaw instrumentation seam')&&!source.includes('PHASE01_POSE_TRACE_CONFIG'),'field test build must not contain the trace seam');
  console.log('Phase 0 pose narrow-thaw seam: PASS (field_test_not_production: frozen HV3 pose.js, no seam)');
  process.exit(0);
}
assert.equal(ARTIFACT_CLASS,'development_not_release',`unknown artifact_class ${ARTIFACT_CLASS}`);

// Removing only the approved trace seam/calls must reconstruct frozen HV3 pose.js byte-for-byte.
const marker=source.indexOf('// Phase 0 narrow-thaw instrumentation seam.');
const blockStart=source.lastIndexOf('\n',marker-1);
const blockEnd=source.indexOf('const CONNECTIONS = [',marker);
assert(blockStart>0&&blockEnd>blockStart,'trace block boundaries missing');
let reconstructed=source.slice(0,blockStart)+source.slice(blockEnd);
const replacements=[
  [
    'const landmarker=await ensureLandmarker(role);const ts=Math.max(performance.now(),(state.lastVideoTime[role]||0)+.01);state.lastVideoTime[role]=ts;const input=inferenceSource(role,video,activeCount,authorityRole);const phase01Trace=PHASE01_POSE_TRACE_CONFIG?phase01PoseTracePrepare({role,input,video,ts,activeCount,authorityRole,started}):null;const result=landmarker.detectForVideo(input,ts);if(PHASE01_POSE_TRACE_CONFIG)phase01PoseTraceComplete(phase01Trace,{result});',
    'const landmarker=await ensureLandmarker(role);const ts=Math.max(performance.now(),(state.lastVideoTime[role]||0)+.01);state.lastVideoTime[role]=ts;const input=inferenceSource(role,video,activeCount,authorityRole);const result=landmarker.detectForVideo(input,ts);'
  ],
  [
    'const bestLost=bestCaptureMetrics();if(bestLost){updateDiagnostic(bestLost.role,bestLost.m);updateSideMetrics(bestLost.m);}else updateDiagnostic(role,state.latest[role]);phase01PoseTraceFlush(phase01Trace);return;',
    'const bestLost=bestCaptureMetrics();if(bestLost){updateDiagnostic(bestLost.role,bestLost.m);updateSideMetrics(bestLost.m);}else updateDiagnostic(role,state.latest[role]);return;'
  ],
  [
    'const bestAmbiguous=bestCaptureMetrics();if(bestAmbiguous){updateDiagnostic(bestAmbiguous.role,bestAmbiguous.m);updateSideMetrics(bestAmbiguous.m);}else updateDiagnostic(role,state.latest[role]);phase01PoseTraceFlush(phase01Trace);',
    'const bestAmbiguous=bestCaptureMetrics();if(bestAmbiguous){updateDiagnostic(bestAmbiguous.role,bestAmbiguous.m);updateSideMetrics(bestAmbiguous.m);}else updateDiagnostic(role,state.latest[role]);'
  ],
  [
    'const lm=smoothLandmarks(role,picked.landmarks,now);const world=result.worldLandmarks?.[picked.index]||null;const metrics=computeMetrics(role,lm,world,now);if(PHASE01_POSE_TRACE_CONFIG)phase01PoseTraceMetrics(phase01Trace,role,metrics);perf.cost=Number.isFinite(perf.cost)?perf.cost*.82+(performance.now()-started)*.18:(performance.now()-started);',
    'const lm=smoothLandmarks(role,picked.landmarks,now);const world=result.worldLandmarks?.[picked.index]||null;const metrics=computeMetrics(role,lm,world,now);perf.cost=Number.isFinite(perf.cost)?perf.cost*.82+(performance.now()-started)*.18:(performance.now()-started);'
  ],
  [
    'maybeLog(role,lm,metrics,now);phase01PoseTraceFlush(phase01Trace);',
    'maybeLog(role,lm,metrics,now);'
  ]
];
for(const [patched,legacy] of replacements){assert(reconstructed.includes(patched),`patched seam fragment missing: ${patched.slice(0,60)}`);reconstructed=reconstructed.replace(patched,legacy);}
assert.equal(sha(reconstructed),BASELINE_SHA256,'narrow-thaw changes exceed approved instrumentation seam');

// The pre-detect preparation function must not invoke the external emit hook.
const traceBlock=source.slice(blockStart,blockEnd);
const prepareStart=traceBlock.indexOf('function phase01PoseTracePrepare');
const completeStart=traceBlock.indexOf('function phase01PoseTraceComplete');
assert(prepareStart>=0&&completeStart>prepareStart,'trace functions missing');
assert(!traceBlock.slice(prepareStart,completeStart).includes('.emit('),'pre-detect trace preparation must not invoke external callback');
assert(!traceBlock.includes('exposeInputRef')&&!traceBlock.includes('exposeResultRef')&&!traceBlock.includes('exposeMetricsRef'),'trace must not expose mutable production objects');

const evalBlock=traceBlock.slice(traceBlock.indexOf('const PHASE01_POSE_TRACE_CONFIG'));
function buildHelpers(config){
  const window={__3PM_PHASE01_POSE_TRACE_CONFIG__:config};
  const state={inferenceSize:{side:{width:960,height:540,direct:false,locked:true}}};
  let perfNow=100;
  const performance={now:()=>++perfNow};
  const factory=new Function('window','state','performance',`${evalBlock}\nreturn {cfg:PHASE01_POSE_TRACE_CONFIG,prepare:phase01PoseTracePrepare,complete:phase01PoseTraceComplete,metrics:phase01PoseTraceMetrics,flush:phase01PoseTraceFlush};`);
  return factory(window,state,performance);
}

(async()=>{
  const events=[];
  const helpers=buildHelpers({enabled:true,emit:(type,payload)=>{events.push({type,payload});try{payload.role='MUTATED';}catch(_){}}});
  const directVideo={videoWidth:1280,videoHeight:720,currentTime:12.5,readyState:4};
  const t1=helpers.prepare({role:'side',input:directVideo,video:directVideo,ts:55.25,activeCount:1,authorityRole:'side',started:90});
  assert.equal(t1.inputKind,'video-direct');assert.equal(t1.rasterStableForSynchronousRead,false);assert.equal(t1.exactRasterClaim,'blocked-live-direct-video');
  helpers.complete(t1,{result:{landmarks:[[{}]],worldLandmarks:[[{}]]}});
  assert.equal(events.length,0,'external emit must be deferred until explicit flush/microtask');
  helpers.metrics(t1,'side',{phase:'Expansion',detected:true,armed:true,releaseCandidate:false,shotComplete:false,epochMs:1234});
  helpers.flush(t1);
  assert.equal(events.length,0,'flush must enqueue, not synchronously call external observer');
  await Promise.resolve();
  assert.equal(events.length,2);assert.equal(events[0].type,'pose.inference');assert.equal(events[1].type,'pose.metrics');
  assert.equal(events[0].payload.role,'side','emitted payload must be immutable');
  assert(Object.isFrozen(events[0].payload));
  assert.equal(events[1].payload.legacyMetricEpochMs,1234);
  assert.equal('resultRef' in events[0].payload,false);assert.equal('metricsRef' in events[1].payload,false);

  const throwing=buildHelpers({enabled:true,emit:()=>{throw new Error('observer failure');}});
  const tx=throwing.prepare({role:'side',input:{tagName:'CANVAS',width:960,height:540},video:directVideo,ts:57,activeCount:1,authorityRole:'side',started:92});
  assert.doesNotThrow(()=>throwing.complete(tx,{result:{landmarks:[]}}));assert.doesNotThrow(()=>throwing.metrics(tx,'side',{phase:'Hold'}));assert.doesNotThrow(()=>throwing.flush(tx));await Promise.resolve();
  const disabled=buildHelpers(null);assert.equal(disabled.cfg,null);
  console.log('Phase 0 pose narrow-thaw seam: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
