'use strict';
const assert = require('assert');
const C = require('../static/capture_integrity_core.js');
for (const value of [null, undefined, '', ' ', false, true, [], {}, NaN, Infinity]) {
  assert.strictEqual(C.num(value), null);
}
assert.strictEqual(C.num(0), 0);
assert.strictEqual(C.num('0'), 0);
assert.strictEqual(C.num('29.4'), 29.4);
const q = C.cameraQuality({active:true, actualFps:null, reportedFps:30});
assert.strictEqual(q.captureRate, 30);
assert.strictEqual(q.mode, 'STANDARD EVIDENCE');
assert.strictEqual(q.analysisRate, null);
assert.deepStrictEqual(C.nearestFrameIndex([{offsetMs:null}, {offsetMs:100}],0), {index:1,delta:100});
assert.deepStrictEqual(C.nearestFrameIndex([{offsetMs:null}],0), {index:null,delta:null});
assert.strictEqual(C.median([null, '', false, 10, 20]), 15);
console.log('Missing-evidence regression PASS: unknown FPS fallback, missing timestamps, genuine zero, numeric imports.');
