'use strict';
// Known legacy/R8 integration gaps confirmed by Astra. This is characterization, not a green correctness test.
const assert=require('assert');
const T=require('../../static/temporal_evidence_core');
const B=require('../../static/evidence_budget_core');
const C=require('../../static/camera_timeline_core');
function frame(i,high=false,extra={}){return {epochMs:1000+i*(high?1000/240:34),mediaTime:high?i/240:null,frameSeq:high?i+1:null,source:'native-avfoundation',streamGeneration:'g1',blob:{size:1},...extra};}
const rowsNull=Array.from({length:25},(_,i)=>frame(i,false));
const rows240=Array.from({length:25},(_,i)=>frame(i,true));
// R8C (2026-10-02): the three gaps below were CLOSED by the R8C production evidence patch.
// Their stronger red->green regression lives in app/tests/test_evidence_identity_writer_r8c.js
// (red on the unpatched R8 P1-06 tree, green after). Kept here as closure checks, not as "gap exists".
const temporalNull=B.canonicalUnique(T.mergeEvidence([],rowsNull,1000)).length;
const temporal240=B.canonicalUnique(T.mergeEvidence([],rows240,1000)).length;
assert.equal(temporalNull,25,'regression: upstream null dedup gap reopened (was 25->1 before R8C)');
assert.equal(temporal240,25,'regression: upstream high-FPS dedup gap reopened (was 25->13 before R8C)');
assert.equal(C.frameTimeMs({masterTimeMs:null,epochMs:1000}),1000,'regression: null master clock collapses to 0 again');
const crossSource=B.canonicalUnique([frame(0,true,{mediaTime:1,frameSeq:1,source:'native-avfoundation'}),frame(1,true,{mediaTime:1,frameSeq:7,source:'worker'})]).length;
assert.equal(crossSource,1,'characterization changed: cross-source media identity gap may have been fixed');
console.log(JSON.stringify({status:'R8C_CLOSED_3_STILL_OPEN_1',closed:{temporalNull,temporal240,timelineNullMaster:1000},stillOpen:{crossSourceSameMediaTime:crossSource,note:'needs clock-domain decision: are native and browser mediaTime the same clock?'}},null,2));
