'use strict';
// Characterization of the still-open legacy upstream gap. GREEN means the OPEN defect was reproduced,
// not that the production path is fixed. Do not invert this without an authorized production repair.
const assert=require('assert');
const T=require('../../static/temporal_evidence_core');
const B=require('../../static/evidence_budget_core');
function frame(i,high=false){return {epochMs:1000+i*(high?1000/240:34),mediaTime:high?i/240:null,frameSeq:high?i+1:null,source:'native-avfoundation',streamGeneration:'g1',blob:{size:1}};}
const n=Array.from({length:25},(_,i)=>frame(i,false));
const h=Array.from({length:25},(_,i)=>frame(i,true));
const nr=B.canonicalUnique(T.mergeEvidence([],n,1000)).length;
const hr=B.canonicalUnique(T.mergeEvidence([],h,1000)).length;
assert.equal(nr,1,'Known legacy F02 null-identity upstream gap changed; investigate rather than masking');
assert.equal(hr,13,'Known legacy F02 high-FPS upstream gap changed; investigate rather than masking');
console.log(JSON.stringify({finding:'F02-upstream-temporal',status:'OPEN_CONFIRMED',nullRetained:nr,highFpsRetained:hr,productionRepairAuthorized:false},null,2));
