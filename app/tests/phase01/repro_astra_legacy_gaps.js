'use strict';
// Known legacy/R8 integration gaps confirmed by Astra. This is characterization, not a green correctness test.
const assert=require('assert');
const T=require('../../static/temporal_evidence_core');
const B=require('../../static/evidence_budget_core');
const C=require('../../static/camera_timeline_core');
function frame(i,high=false,extra={}){return {epochMs:1000+i*(high?1000/240:34),mediaTime:high?i/240:null,frameSeq:high?i+1:null,source:'native-avfoundation',streamGeneration:'g1',blob:{size:1},...extra};}
const rowsNull=Array.from({length:25},(_,i)=>frame(i,false));
const rows240=Array.from({length:25},(_,i)=>frame(i,true));
const temporalNull=B.canonicalUnique(T.mergeEvidence([],rowsNull,1000)).length;
const temporal240=B.canonicalUnique(T.mergeEvidence([],rows240,1000)).length;
assert.equal(temporalNull,1,'characterization changed: upstream null dedup gap may have been fixed');
assert.equal(temporal240,13,'characterization changed: upstream high-FPS dedup gap may have been fixed');
assert.equal(C.frameTimeMs({masterTimeMs:null,epochMs:1000}),0,'characterization changed: null master clock gap may have been fixed');
const crossSource=B.canonicalUnique([frame(0,true,{mediaTime:1,frameSeq:1,source:'native-avfoundation'}),frame(1,true,{mediaTime:1,frameSeq:7,source:'worker'})]).length;
assert.equal(crossSource,1,'characterization changed: cross-source media identity gap may have been fixed');
console.log(JSON.stringify({status:'KNOWN_LEGACY_GAPS_CONFIRMED',temporalNull,temporal240,timelineNullMaster:0,crossSource},null,2));
