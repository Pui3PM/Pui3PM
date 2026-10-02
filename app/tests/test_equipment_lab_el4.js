const assert=require('assert');const c=require('../static/equipment_lab_core.js');
assert(Math.abs(c.estimatedDrawLengthIn(186)-29.2913)<0.02);
assert.strictEqual(c.shaftWeightGr(29.5,6.06).toFixed(2),'178.77');
const bp=c.estimatedBalancePointIn({lengthIn:29.5,gpi:6.06,point:100,nock:3,vane:3.6,tape:1.75,pin:9,vanePositionMm:30});assert(bp>14.75&&bp<20);
const sp=c.genericSpineRange(37.5,29.5,100);assert(sp&&sp.center&&sp.stiff&&sp.weak);
const st=c.stabilizerReference(29.3);assert.deepStrictEqual(st.long,[27,29]);assert.deepStrictEqual(st.extender,[3,5]);
console.log('Equipment Lab EL4 core PASS');
