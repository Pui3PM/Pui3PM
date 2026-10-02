const assert=require('assert');
const T=require('../static/temporal_evidence_core.js');
const blob={size:1},rel=1790590800000;
// Simulate two capture clocks: epoch order says A,C,B,D while camera media time says A,B,C,D.
const mixed=[
 {epochMs:rel-100,mediaTime:10.000,frameSeq:100,blob,source:'native-avfoundation-30'},
 {epochMs:rel-20, mediaTime:10.066,frameSeq:102,blob,source:'native-avfoundation-30'},
 {epochMs:rel-50, mediaTime:10.033,frameSeq:101,blob,source:'native-avfoundation-30'},
 {epochMs:rel+20, mediaTime:10.099,frameSeq:103,blob,source:'native-avfoundation-30'}
];
const c=T.canonicalFrames(mixed);
assert.deepEqual(c.map(x=>x.frameSeq),[100,101,102,103]);
assert.deepEqual(c.map(x=>x.replaySeq),[0,1,2,3]);
for(let i=1;i<c.length;i++)assert(c[i].mediaTime>c[i-1].mediaTime,'camera chronology must be monotonic');
// A sparse duplicate inside native dense window must not survive the merge.
const sparse=[{epochMs:rel-30,mediaTime:10.033,blob,source:'sparse-jpeg',evidenceZone:'release-focus'},
 {epochMs:rel+2500,mediaTime:12.5,blob,source:'sparse-jpeg',evidenceZone:'recovery-end'}];
const merged=T.mergeEvidence(sparse,mixed,rel,{preMs:1250,postMs:900,replaceDense:true});
assert(!merged.some(x=>x.source==='sparse-jpeg'&&x.evidenceZone==='release-focus'));
assert(merged.some(x=>x.evidenceZone==='recovery-end'));
console.log('BLE4.3.8.9.5.2 frame chronology QA PASS');
