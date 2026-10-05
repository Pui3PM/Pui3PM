'use strict';
// R8 P1-08 M-01: frame-rate scope. Integration path (temporal + budget + fixed25) keeps distinct frames at
// 30/60/120/240 FPS. The FROZEN app.js initial sampler evidenceUniqueByEpoch still collapses frames <=8 ms apart
// (240 FPS -> 13/25) and treats two null mediaTime as equal; it cannot be changed without thawing frozen
// app.js, so it is characterized here (OPEN, field scope limited to 30 FPS) and must not silently change.
// Usage: node app/tests/test_p108_m01_fps_scope.js [path-to-app/static]
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const T=require(path.join(root,'temporal_evidence_core.js')),B=require(path.join(root,'evidence_budget_core.js'));
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),ctx={console};vm.createContext(ctx);
const a=app.indexOf('function evidenceUniqueByEpoch('),b=app.indexOf('function sampleEvidenceByGap(',a);assert(a>0&&b>a,'frozen sampler not found');
vm.runInContext(app.slice(a,b),ctx);
const out={};
for(const fps of [30,60,120,240]){
  const rows=Array.from({length:25},(_,i)=>({epochMs:100000+i*1000/fps,mediaTime:i/fps,frameSeq:i+1,blob:new Blob(['f'+i]),source:'worker-track-processor-'+(fps>=50?'60':'30')}));
  const core=B.normalizeRecord({releaseEpochMs:100000,frames:T.mergeEvidence([],rows,100000)}).frames.length;
  const sparse=rows.map(({frameSeq,...r})=>({...r,source:'sparse-jpeg'}));
  out[fps]={integrationPath:core,frozenInitialSampler:ctx.evidenceUniqueByEpoch(sparse).length};
  assert.strictEqual(core,25,`${fps} FPS integration path keeps 25 distinct frames`);
}
assert.strictEqual(out[30].frozenInitialSampler,25,'30 FPS (field scope) passes the frozen initial sampler intact');
// Characterization of the OPEN frozen limitation (M-01). A change here means app.js changed: re-review scope.
assert.strictEqual(out[240].frozenInitialSampler,13,'frozen sampler 240 FPS characterization (OPEN M-01)');
const nullMedia=Array.from({length:5},(_,i)=>({epochMs:1000+i*33,mediaTime:null,blob:{i},source:'sparse-jpeg'}));
assert.strictEqual(ctx.evidenceUniqueByEpoch(nullMedia).length,1,'frozen sampler null-mediaTime collapse characterization (OPEN M-01; browser frames carry finite video.currentTime)');
console.log('P1-08 M-01 FPS scope PASS (integration 25/25 at 30/60/120/240; frozen sampler characterized OPEN):',JSON.stringify(out));
