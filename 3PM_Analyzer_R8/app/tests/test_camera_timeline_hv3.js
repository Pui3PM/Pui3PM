const assert=require('assert');
const C=require('../static/camera_timeline_core.js');
assert.deepStrictEqual([...C.ROLES],['side','overhead','rear']);
assert.strictEqual(C.capabilities(['side']).automaticShotLifecycle,true);
assert.strictEqual(C.capabilities(['overhead','rear']).automaticShotLifecycle,false);
assert.strictEqual(C.capabilities(['side','overhead','rear']).fullThreeView,true);
assert.ok(Math.abs(C.adaptiveToleranceMs(30)-16.6666667)<.1);
assert.ok(Math.abs(C.adaptiveToleranceMs(60)-8.3333333)<.1);
assert.ok(Math.abs(C.adaptiveToleranceMs(120)-4.1666667)<.1);
const shuffled=[
 {frameSeq:3,masterTimeMs:1066,mediaTimeMs:66,captureEpochMs:200066},
 {frameSeq:1,masterTimeMs:1000,mediaTimeMs:0,captureEpochMs:200000},
 {frameSeq:2,masterTimeMs:1033,mediaTimeMs:33,captureEpochMs:200033}
];
const sorted=C.canonicalFrames(shuffled);assert.deepStrictEqual(sorted.map(x=>x.frameSeq),[1,2,3]);
const n=C.nearestFrame(sorted,1034,{fps:30});assert(n&&n.frame.frameSeq===2&&n.deltaMs===1);
const frames={side:sorted,overhead:[{frameSeq:10,masterTimeMs:1025,mediaTimeMs:0,captureEpochMs:200025},{frameSeq:11,masterTimeMs:1058,mediaTimeMs:33,captureEpochMs:200058}],rear:[]};
const aligned=C.alignAt(1034,frames,{side:{rawFps:30},overhead:{rawFps:30},rear:{rawFps:30}});
assert.strictEqual(aligned.side.frame.frameSeq,2);assert.strictEqual(aligned.overhead.frame.frameSeq,10);assert.strictEqual(aligned.rear,null);
const slots=C.logicalSlotAlignment([{name:'Release',masterTimeMs:1034}],frames,{side:{rawFps:30},overhead:{rawFps:30}});
assert.strictEqual(slots.length,1);assert.strictEqual(slots[0].views.side.frame.frameSeq,2);
console.log('HV3 camera timeline core PASS');
