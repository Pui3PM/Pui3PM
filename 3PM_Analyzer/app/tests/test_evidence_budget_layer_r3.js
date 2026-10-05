const assert=require('assert');
const B=require('../static/evidence_budget_core.js');
global.window={EvidenceBudgetCore:B};
global.document={readyState:'loading',addEventListener:()=>{},getElementById:()=>null,querySelector:()=>null};
global.indexedDB={databases:async()=>[]};
global.setInterval=()=>0;
class Store{
  constructor(name){this.name=name;this.saved=null;}
  put(v){this.saved=v;return {ok:true};}
  add(v){this.saved=v;return {ok:true};}
}
global.IDBObjectStore=Store;
require('../static/evidence_budget_layer.js');
const release=50000,frames=[];
for(let i=0;i<60;i++)frames.push({epochMs:release-3000+i*100,blob:{i},source:'native30',evidenceZone:i<8?'draw':i<16?'anchor-focus':i<24?'aim-hold':i<28?'expansion-pin':i<50?'release-focus':i<59?'follow-summary':'recovery-end'});
const value={frames,releaseEpochMs:release,captureKind:'phase-weighted'};
const s=new Store('shotEvidence');s.put(value);
assert.equal(value.frames.length,25,'IDB put hook must normalize the same record object to 25');
assert.equal(s.saved.frames.length,25);assert.equal(value.evidenceBudget.targetSlots,25);assert(B.isStrictChronology(value.frames));
const other={frames:[...frames]};const x=new Store('other');x.put(other);assert.equal(other.frames.length,60,'non-evidence stores must be untouched');
console.log('PASS test_evidence_budget_layer_r3 · every shotEvidence IDB put is normalized before persistence');
