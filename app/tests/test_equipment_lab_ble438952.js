const assert=require('assert');const c=require('../static/equipment_lab_core.js');
assert(Math.abs(c.focPct(29.5,17.0)-7.6271186)<1e-6,'AMO FOC formula');
assert.strictEqual(c.shaftWeightGr(29.5,6.7),197.65,'GPI shaft mass');
assert(Math.abs(c.finishedWeightGr(29.5,6.7,[100,12,7,9])-325.65)<1e-9,'finished mass');
assert.strictEqual(c.targetFocReference(10).band,'within');assert.strictEqual(c.targetFocReference(6.9).band,'below');assert.strictEqual(c.targetFocReference(15.1).band,'above');
assert(Math.abs(c.pointMomentGcm(30,50,85.048569375,4)-9503.794451225)<1e-6,'front moment');
console.log('PASS equipment lab core');
