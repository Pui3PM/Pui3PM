'use strict';
const assert=require('assert');const fs=require('fs');const vm=require('vm');const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(ROOT,'shadow/browser/shadow_runtime_bundle.js'),'utf8');
const sandbox={TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,queueMicrotask};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{timeout:3000});
assert.equal(typeof sandbox.require,'undefined');assert.equal(typeof sandbox.Buffer,'undefined');assert.equal(typeof sandbox.process,'undefined');
const A=sandbox.ThreePMShadow;assert(A&&A.identity&&A.contracts&&A.projector&&A.archive);
const tuple={runId:'run-vm',sourceId:'cam-vm',streamGeneration:'gen-vm',frameSeq:'1'};
const uid=A.identity.frameUID(tuple);assert(/^f1\/[0-9a-f]{64}$/.test(uid));
assert.throws(()=>A.identity.frameUID({...tuple,runId:'x\uD800'}));
// Negative browser-bound validator parity: overflow U64 must fail in the bundled contract path.
const F=require('./_shadow_fixture');const bad=F.frame(1,{runId:'run-vm',sourceId:'cam-vm',streamGeneration:'gen-vm'});bad.frameSeq='18446744073709551616';bad.frameUID='f1/'+'0'.repeat(64);
assert.throws(()=>A.contracts.validateFrameEnvelope(bad));
// Pure binary/archive code must be available with no Node crypto/Buffer globals.
assert.equal(typeof A.archive.safePath,'function');assert.equal(A.archive.safePath('evidence/frame.jpg'),true);assert.equal(A.archive.safePath('../escape'),false);
vm.runInContext("const __tape=new ThreePMShadow.telemetry.EventTape({maxEvents:2,maxApproxBytes:1000});__tape.append({x:'สวัสดี'});globalThis.__tapeCount=__tape.snapshot().events.length;",sandbox,{timeout:1000});assert.equal(sandbox.__tapeCount,1);
console.log('Browser-portable shadow bundle VM (no require/Buffer/process): PASS');
