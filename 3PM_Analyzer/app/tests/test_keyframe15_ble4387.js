'use strict';
const assert=require('assert');
const P=require('../static/coach_keyframe_plan_core.js');
const release=100000;
const tl=[
 {phase:'Setup',epochMs:92500},{phase:'Set',epochMs:93000},{phase:'Draw',epochMs:94500},{phase:'Anchor',epochMs:97000},
 {phase:'Aim / Hold',epochMs:98000},{phase:'Expansion',epochMs:99450},{phase:'Release',epochMs:release}
];
const p=P.build15(tl,release);
assert.equal(p.requests.length,15,'must target 15 balanced coach keyframes');
for(const phase of ['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'])assert(p.requests.some(x=>x.phase===phase),`missing ${phase} coverage`);
assert(p.requests.some(x=>x.offset===0),'release onset missing');
assert(p.requests.filter(x=>Math.abs(x.offset)<=300).length>=6,'release micro-sequence is not dense enough');
assert(p.requests.some(x=>x.offset>=600),'follow-through context missing');
assert.equal(p.releaseIndex,8,'Release T0 must have a fixed coach-review position');
assert.equal(p.requests[8].offset,0,'fixed Release slot must be physical T0');
assert(p.requests.filter(x=>x.kind==='release').length>=6,'Release band must stay dense');
assert(Math.max(...p.requests.map(x=>x.offset))<=850,'late unrelated post-shot motion must not enter Coach Keyframes');
assert(p.requests.filter(x=>x.offset< -350).length>=6,'long Hold must compress into representative pre-release context');
console.log('BLE4.3.8.9.0 Release-focused 15-keyframe plan QA: PASS · 7 Release · 2 Follow');
