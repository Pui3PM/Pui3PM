'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const B=require(path.join(root,'static/evidence_budget_core.js'));
const html=read('static/index.html');
const adaptive=read('static/adaptive_release_core.js');
const temporal=read('static/temporal_evidence_layer.js');
assert(adaptive.includes("adaptive-release-v16"),'R7 adaptive release v16 must survive lineage merge');
assert(temporal.includes('pendingFollowEvidence'),'R7 temporal persistence path must survive lineage merge');
for(const marker of ['native_vision_shadow_core.js?v=hv1','camera_timeline_core.js?v=hv3','evidence_integrity_repair_layer.js?v=hv2','native_capture_layer.js?v=hv3','multicamera_timeline_layer.js?v=hv3','native_vision_shadow_layer.js?v=hv1']) assert(html.includes(marker),`HV3 module missing ${marker}`);
const blob=()=>({size:1,type:'image/jpeg'});
const nullRows=Array.from({length:25},(_,i)=>({epochMs:1000+i*34,mediaTime:null,frameSeq:null,blob:blob(),source:'test'}));
assert.equal(B.canonicalUnique(nullRows).length,25,'null identity must not collapse distinct real frames');
const high=Array.from({length:25},(_,i)=>({epochMs:2000+i*(1000/240),mediaTime:i/240,frameSeq:i+1,blob:blob(),source:'native-avfoundation'}));
assert.equal(B.canonicalUnique(high).length,25,'240fps unique frames must not be time-deduped');
const inv=[
 {epochMs:1000,mediaTime:1.000,frameSeq:1,blob:blob(),source:'native-avfoundation'},
 {epochMs:1100,mediaTime:1.033,frameSeq:2,blob:blob(),source:'native-avfoundation'},
 {epochMs:1060,mediaTime:1.066,frameSeq:3,blob:blob(),source:'native-avfoundation'},
 {epochMs:1140,mediaTime:1.099,frameSeq:4,blob:blob(),source:'native-avfoundation'}
];
assert.deepEqual(B.canonicalUnique(inv).map(x=>x.frameSeq),[1,2,3,4],'camera chronology must beat corrected epoch order');
const many=Array.from({length:80},(_,i)=>({epochMs:5000+i*50,blob:blob(),source:'test',evidenceZone:'release-focus'}));
const reserved=[many[3].epochMs,many[17].epochMs,many[79].epochMs];
const sel=B.selectFixedBudget(many,7000,25,reserved);
assert.equal(sel.length,25); for(const t of reserved) assert(sel.some(f=>f.epochMs===t),'R7 contract witness must survive HV3 chronology merge');
console.log('R8 lineage merge gate PASS: R7 transaction lineage + HV3 camera lineage + F02 fixed');
