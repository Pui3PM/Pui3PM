const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/../static/native_capture_layer.js','utf8');
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
async function runNative(){
  let fallbackOpen=0; let diagN=0;
  const browser={openRole(){fallbackOpen++;return true},closeRole(){},beginCycle(){},phase(){},release(){},endCycle(){},diagnostics(){return{backend:'browser-fallback',rawFps:14}},browserInfo(){return{user_agent:'test'}}};
  const core={releaseZone:()=> 'release-focus',bundleHealthy:()=>true,mergeEvidence:(a,b)=>[...a,...b]};
  const responses=async (url,opt={})=>{
    const path=url.replace('http://127.0.0.1:48735','');
    if(path==='/health')return new Response(JSON.stringify({ok:true,version:'native-test'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/open')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/diag'){diagN++;return new Response(JSON.stringify({roles:{side:{active:true,generation:2,raw_fps:29.8,capture_fps:30.0,median_interval_ms:33.5,p95_interval_ms:34,jitter_p95_ms:.7,evidence_frames:150,av_dropped_frames:0,encoder_dropped_frames:0,buffer_frames:120,target_width:640,requested_fps:30}}}),{status:200,headers:{'Content-Type':'application/json'}});}
    if(path==='/close')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error('unexpected '+path);
  };
  const sandbox={window:{TemporalEvidenceCore:core,TemporalEvidenceLayer:browser},navigator:{userAgent:'ua'},fetch:responses,AbortController,Response,CustomEvent:function(){},indexedDB:{},setTimeout,clearTimeout,setInterval:()=>1,console,Blob,URL}; sandbox.window.window=sandbox.window;
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  const track={label:'FaceTime HD Camera (1C1C:B782)',getSettings:()=>({width:1280,height:720,frameRate:30})};
  sandbox.window.TemporalEvidenceLayer.openRole('side',track,2);await delay(25);
  await sandbox.window.TemporalEvidenceLayer._health();await delay(5);
  const d=sandbox.window.TemporalEvidenceLayer.diagnostics('side');
  assert.strictEqual(d.backend,'native-avfoundation');assert.ok(Math.abs(d.rawFps-29.8)<0.01);assert.ok(Math.abs(d.captureFps-30)<0.01);assert.strictEqual(fallbackOpen,0);assert.ok(diagN>=1);
}
async function runFallback(){
  let fallbackOpen=0;
  const browser={openRole(){fallbackOpen++;return true},closeRole(){},beginCycle(){},phase(){},release(){},endCycle(){},diagnostics(){return{backend:'worker-track-processor',rawFps:28.7}},browserInfo(){return{user_agent:'test'}}};
  const core={releaseZone:()=> 'release-focus',bundleHealthy:()=>true,mergeEvidence:(a,b)=>[...a,...b]};
  const badFetch=async()=>{throw new Error('ECONNREFUSED')};
  const sandbox={window:{TemporalEvidenceCore:core,TemporalEvidenceLayer:browser},navigator:{userAgent:'ua'},fetch:badFetch,AbortController,CustomEvent:function(){},indexedDB:{},setTimeout,clearTimeout,setInterval:()=>1,console,Blob,URL}; sandbox.window.window=sandbox.window;
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  const track={label:'FaceTime HD Camera',getSettings:()=>({width:1280,height:720,frameRate:30})};
  sandbox.window.TemporalEvidenceLayer.openRole('side',track,1);await delay(25);
  const d=sandbox.window.TemporalEvidenceLayer.diagnostics('side');assert.strictEqual(fallbackOpen,1);assert.strictEqual(d.backend,'worker-track-processor');assert.ok(d.nativeError);
}
(async()=>{await runNative();await runFallback();console.log('BLE4.3.8 native capture facade PASS');})().catch(e=>{console.error(e);process.exit(1)});
