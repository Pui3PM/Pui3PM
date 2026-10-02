const fs=require('fs'),vm=require('vm'),assert=require('assert');
const core=require('../static/camera_timeline_core.js');
const code=fs.readFileSync(__dirname+'/../static/multicamera_timeline_layer.js','utf8');
function CE(type,init){this.type=type;this.detail=init?.detail;}
const sandbox={window:{CameraTimelineCore:core,TemporalEvidenceLayer:{diagnostics(){return{side:{active:true,backend:'native-avfoundation',rawFps:30,bufferFrames:120,bufferDurationMs:6500,lastFrameSeq:321,clockDomain:'3pm-master-monotonic-v1'},overhead:{active:true,backend:'browser-fallback',rawFps:30},rear:{active:false,backend:'none'}}}},dispatchEvent(){}},CustomEvent:CE,console};sandbox.window.window=sandbox.window;
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const api=sandbox.window.MultiCameraTimeline;assert(api);const snap=api.snapshot();
assert.deepStrictEqual([...snap.capabilities.activeRoles],['side','overhead']);
assert.strictEqual(snap.capabilities.multiviewCorroboration,true);
assert.strictEqual(snap.roles.side.lastFrameSeq,321);
assert.strictEqual(snap.secondaryBlocking,false);
console.log('HV3 multi-camera foundation layer PASS');
