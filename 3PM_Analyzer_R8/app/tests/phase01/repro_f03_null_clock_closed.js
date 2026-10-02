'use strict';
// P-05 closure regression (converted from repro_f03_null_clock.js after the R8C repair, P-02).
// History (HV3 baseline, documentation only, NOT asserted): frameTimeMs({masterTimeMs:null,...}) returned 0
// because Number(null)===0, so a null master clock became time 0. The defect is closed; this file guards it.
const assert=require('assert');
const core=require('../../static/camera_timeline_core');
const f={masterTimeMs:null,captureEpochMs:123456,epochMs:123456,mediaTimeMs:null,mediaTime:null,frameSeq:1};
assert.equal(core.frameTimeMs(f),123456,'F03: null masterTimeMs falls through to the next known clock');
for(const unknown of [null,undefined,false,true,'','  '])
  assert.equal(core.frameTimeMs({masterTimeMs:unknown,captureEpochMs:unknown,epochMs:unknown,mediaTimeMs:unknown,mediaTime:unknown}),null,`F03: unknown clock ${JSON.stringify(unknown)} is null, never 0`);
assert.equal(core.frameTimeMs({masterTimeMs:0}),0,'a real 0 is still 0');
const frames=Array.from({length:5},(_,i)=>({epochMs:1000+i*33,frameSeq:null,mediaTime:null}));
assert.equal(core.canonicalFrames(frames).length,5,'F03: null frameSeq does not drop frames');
console.log(JSON.stringify({finding:'F03',status:'CLOSED',nullMasterFallsThrough:true},null,2));
