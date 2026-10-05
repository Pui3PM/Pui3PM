'use strict';
// Deterministic backend-effect MODEL plus Swift source fences. NOT execution of AVFoundation/Swift.
const assert=require('assert'),fs=require('fs'),path=require('path');
const swift=fs.readFileSync(path.join(__dirname,'../native_capture_bridge/3PMNativeCaptureBridge.swift'),'utf8');
assert(swift.indexOf('let token = try c.reserveStart')<swift.indexOf('guard ensureCameraPermissionSync()',swift.indexOf('func open(')));
for(const s of ['startWorkLock.lock()','try requireCurrent(startVersion)','guard lifecycleVersion == startVersion','stop(expectedGeneration:requested)','self.output === output','self.lifecycleVersion == frameLifecycle','parameters.requiredLocalEndpoint','r.headers["origin"]'])assert(swift.includes(s),s);
class Model{
 constructor(){this.version=0;this.desired=null;this.closed=-1;this.active=null;}
 reserve(g){if(g<=this.closed||this.desired!==null&&g<this.desired)return null;this.desired=g;this.active=null;return{version:++this.version,g};}
 current(t){return t&&t.version===this.version&&this.desired!==null;}
 complete(t){if(this.current(t)){this.active=t.g;return true;}return false;}
 close(g){if(this.desired!==null&&this.desired!==g)return false;this.closed=Math.max(this.closed,g);this.desired=null;this.active=null;this.version++;return true;}
}
let checks=0;
for(const phase of ['permission','configuration','startRunning']){const m=new Model(),a=m.reserve(1);m.close(1);assert.equal(m.complete(a),false);assert.equal(m.active,null);assert.equal(m.reserve(1),null);checks++;}
for(const outcome of ['success','error']){const m=new Model(),a=m.reserve(1),b=m.reserve(2);assert(m.complete(b));if(outcome==='success')assert.equal(m.complete(a),false);assert.equal(m.close(1),false);assert.equal(m.active,2);checks++;}
const m=new Model();for(let g=1;g<=100;g++){const a=m.reserve(g);assert(m.complete(a));m.close(g);assert.equal(m.complete(a),false);}checks++;
console.log('Post-P108 lifecycle MODEL/source fences PASS '+checks+' groups; Swift compile/runtime NOT RUN');
