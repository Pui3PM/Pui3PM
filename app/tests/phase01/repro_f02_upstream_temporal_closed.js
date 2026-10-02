'use strict';
// P-05 closure regression (converted from repro_f02_upstream_temporal_open.js after the R8C repair, P-01).
// History (HV3 baseline, kept here as documentation, NOT asserted): with null mediaTime/frameSeq the upstream
// temporal merge collapsed 25 distinct samples to 1, and 240 FPS samples (4.2 ms apart) to 13
// (OPEN_CONFIRMED nullRetained:1 highFpsRetained:13). The defect is closed; this file now guards it.
const assert=require('assert');
const T=require('../../static/temporal_evidence_core');
const B=require('../../static/evidence_budget_core');
function frame(i,high=false){return {epochMs:1000+i*(high?1000/240:34),mediaTime:high?i/240:null,frameSeq:high?i+1:null,source:'native-avfoundation',streamGeneration:'g1',blob:{size:1}};}
const n=Array.from({length:25},(_,i)=>frame(i,false));
const h=Array.from({length:25},(_,i)=>frame(i,true));
const nr=B.canonicalUnique(T.mergeEvidence([],n,1000)).length;
const hr=B.canonicalUnique(T.mergeEvidence([],h,1000)).length;
assert.equal(nr,25,'F02: 25 distinct null-identity samples must survive the upstream merge');
assert.equal(hr,25,'F02: 25 distinct 240 FPS samples must survive the upstream merge');
console.log(JSON.stringify({finding:'F02-upstream-temporal',status:'CLOSED',nullRetained:nr,highFpsRetained:hr},null,2));
