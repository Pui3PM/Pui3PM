const assert=require('assert'),fs=require('fs'),path=require('path');
const U=require('../static/ui_stability_core.js');

assert.deepEqual(U.coachPhaseSummary(['Set','Setup','Set','Draw','Anchor','Draw','Anchor','Aim / Hold','Expansion','Expansion','Release','Follow Through']).map(x=>x.phase),
  ['Setup','Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through']);
assert.equal(U.phaseName('hold'),'Aim / Hold');
assert.equal(U.phaseName('follow-through'),'Follow Through');
assert.deepEqual(U.stableMetricSnapshot({a:6,b:null,c:''}),{a:'6',b:'—',c:'—'});

const layer=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8');
assert(!layer.includes("ensureRun('manual-export')"),'Export must never create a new empty run');
assert(layer.includes('camera_registry_last_active'),'Trace must preserve last active camera profile after Stop Live');
assert(layer.includes('t<=end+2500'),'Evidence export must be bounded by run end');

const ui=fs.readFileSync(path.join(__dirname,'../static/ui_stability_layer.js'),'utf8');
assert(ui.includes('data-shot-value')||ui.includes('dataset.shotValue'),'Selected-shot visible values must be snapshot-owned');
assert(ui.includes('Live Pose continues independently'),'Selected-shot UI must declare live/saved ownership separation');
assert(ui.includes('Detailed measurement evidence'),'Biomechanics frame-by-frame detail must remain available on demand');

const css=fs.readFileSync(path.join(__dirname,'../static/style.css'),'utf8');
assert(css.includes('max-height:66px'),'Desktop pose diagnostics must have a stable layout footprint');
assert(css.includes('text-overflow:ellipsis'),'Dynamic diagnostic text must not reflow the camera layout');
console.log('BLE4.3.7.1 UI stability QA PASS');
