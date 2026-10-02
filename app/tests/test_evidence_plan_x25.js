'use strict';
const assert=require('assert');
global.window=global;require('../static/core_runtime.js');const Core=global.CoreEngine;
const release=1790007840398;
const tl=[
 {phase:'Draw',epochMs:1790007836985},
 {phase:'Anchor',epochMs:1790007837227},
 {phase:'Aim / Hold',epochMs:1790007838741},
 {phase:'Expansion',epochMs:1790007839360},
 {phase:'Release',epochMs:1790007840445},
];
const plan=Core.buildCoachEvidencePlan(tl,release);
assert.equal(plan.requests.length,12,'normal completed shot should produce 12 coach requests before availability filtering');
assert(plan.requests.some(x=>x.offset===0),'release request missing');
assert(plan.requests.some(x=>x.offset===67),'early follow-through request missing');
assert(plan.requests.some(x=>x.offset===500),'late release-window request missing');
console.log('X2.5 coach evidence-plan QA: PASS · 12 requested keyframes');
