const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/../static/native_capture_layer.js','utf8');
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  let nativeRelease=0,browserRelease=0;
  const browser={openRole(){return true},closeRole(){},beginCycle(){},phase(){},release(){browserRelease++},endCycle(){},diagnostics(role){return{role,backend:'browser-fallback',active:role==='side'}},browserInfo(){return{}}};
  const core={releaseZone:()=> 'release-focus',bundleHealthy:()=>true,mergeEvidence:(a,b)=>[...a,...b]};
  const fetcher=async (url,opt={})=>{
    const path=url.replace('http://127.0.0.1:48735','');
    if(path==='/health')return new Response(JSON.stringify({ok:true,version:'hv3-test',backend_id:'native-avfoundation',platform:'macOS',protocol:'3pm-capture-v1'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/open')return new Response(JSON.stringify({ok:true,diagnostics:{backend:'native-avfoundation'}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/close')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/diag')return new Response(JSON.stringify({roles:{overhead:{active:true,generation:1,backend:'native-avfoundation',evidence_frames:10,buffer_frames:10,requested_fps:30}}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/release'){nativeRelease++;return new Response(JSON.stringify({ok:true,tokens:{}}),{status:200,headers:{'Content-Type':'application/json'}});}
    throw new Error('unexpected '+path);
  };
  const sandbox={window:{TemporalEvidenceCore:core,TemporalEvidenceLayer:browser},navigator:{userAgent:'ua'},fetch:fetcher,AbortController,Response,CustomEvent:function(){},indexedDB:{},setTimeout,clearTimeout,setInterval:()=>1,console,Blob,URL};sandbox.window.window=sandbox.window;
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  // Side intentionally forced to browser fallback by directly setting the facade state.
  sandbox.window.NativeCaptureLayer.states.side.backend='browser-fallback';sandbox.window.NativeCaptureLayer.states.side.active=true;
  const track={label:'USB overhead',getSettings:()=>({width:1280,height:720,frameRate:30})};
  sandbox.window.NativeCaptureLayer.openRole('overhead',track,1);await delay(25);
  sandbox.window.NativeCaptureLayer.release({releaseEpochMs:10000},'cycle-1');await delay(25);
  assert.strictEqual(nativeRelease,1,'native auxiliary roles must receive shot event even when Side is browser fallback');
  assert.strictEqual(browserRelease,1,'browser Side must still receive its release event');
  console.log('HV3 mixed browser/native release PASS');
})().catch(e=>{console.error(e);process.exit(1)});
