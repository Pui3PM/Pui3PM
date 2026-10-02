'use strict';
const assert=require('assert');
const core=require('../../static/camera_timeline_core');
const f={masterTimeMs:null,captureEpochMs:123456,epochMs:123456,mediaTimeMs:null,mediaTime:null,frameSeq:1};
const got=core.frameTimeMs(f);
assert.equal(got,0,'HV3 baseline should reproduce Number(null)->0 clock collapse');
console.log(JSON.stringify({finding:'F03',input:f,baselineFrameTimeMs:got,expectedNewPath:'mappedMasterTime=null; epoch remains display-only'},null,2));
