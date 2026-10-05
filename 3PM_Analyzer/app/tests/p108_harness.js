'use strict';
// R8 P1-08 production-path harness (not a test file itself).
// Executes the SHIPPED frozen app.js evidence write queue (evidenceDbMerge), temporal_evidence_layer.js and
// native_capture_layer.js in a VM against an IndexedDB double whose readback uses structuredClone, exactly like
// a real IndexedDB round trip (Blob object identity is NOT preserved; Blob bytes are).
// Usage: const H=require('./p108_harness'); const env=H.env(staticDir); ...
const fs=require('fs'),path=require('path'),vm=require('vm');
const BASE='http://127.0.0.1:48735';
const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));
function load(staticDir){
  const read=n=>fs.readFileSync(path.join(staticDir,n),'utf8');
  const req=n=>{const p=path.join(staticDir,n);delete require.cache[require.resolve(p)];return require(p);};
  const T=req('temporal_evidence_core.js'),B=req('evidence_budget_core.js'),C=req('camera_timeline_core.js');
  return {read,T,B,C};
}
const blob=(tag,size=3)=>new Blob([String(tag).padEnd(size,'.')]);

// One evidence store + frozen queue + both capture layers. Bridge behaviour is supplied by `bridge(path,body)`.
// Post-P108 R2: index.html loads evidence_identity_persistence_layer.js between app.js and the capture layers, and that
// layer stamps every read of the evidence store (IDBObjectStore/IDBIndex get+getAll hooks). The doubles below apply the
// same read hook, exactly as the put double already applies the evidence_budget_layer put normalization.
// identityLayer:false reproduces the pre-adapter stack (characterization only).
function env(staticDir,{bridge=null,sessionId=1,identityLayer=true}={}){
  const {read,T,B,C}=load(staticDir);
  const records=new Map(),key=(s,id,r)=>`${s}:${id}:${r}`;
  const clone=x=>structuredClone(x);
  const log=[];let currentSession=sessionId;
  const fakeIDB={open(){const req={};setTimeout(()=>{req.result={transaction(){const tx={objectStore(){return{
      index(){return{getAll(s){const r={};setTimeout(()=>{r.result=readHook([...records.values()].filter(x=>Number(x.sessionId)===Number(s)).map(clone));r.onsuccess&&r.onsuccess();},0);return r;}};},
      put(v){records.set(v.key,clone(v));setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0);}};}};return tx;}};req.onsuccess&&req.onsuccess();},0);return req;}};
  const json=(data,status=200)=>({ok:status<300,status,json:async()=>data});
  const fetchMock=async(url,opt={})=>{
    const p=String(url).replace(BASE,'');let body=null;try{body=opt.body?JSON.parse(opt.body):null;}catch{}
    log.push({p,body});
    if(p.startsWith('/static/'))return json({});
    const r=bridge?await bridge(p,body):null;
    if(r&&r.__blob)return {ok:true,status:200,blob:async()=>r.__blob};
    if(r)return json(r.data,r.status||200);
    throw new Error('unexpected '+p);
  };
  const events=[];
  const readHook=rows=>{const L=ctx.window.EvidenceIdentityPersistenceLayer;return L&&typeof L.stampStoredResult==='function'?L.stampStoredResult(rows):rows;};
  const ctx={console,Promise,Map,Set,Date,Math,Number,Array,Object,JSON,String,Error,Blob,queueMicrotask,AbortController,structuredClone,crypto:globalThis.crypto,
    document:{readyState:'loading',addEventListener(){}},navigator:{userAgent:'p108'},
    window:{EvidenceBudgetCore:B,TemporalEvidenceCore:T,CameraTimelineCore:C,FrameIdentityCore:safeFI(staticDir),dispatchEvent(e){events.push(e);},FormAnalyzer:{getCurrentSessionId:()=>currentSession}},
    CustomEvent:function(t,o){this.type=t;this.detail=o?.detail;},setTimeout,clearTimeout,setInterval:()=>0,fetch:fetchMock,indexedDB:fakeIDB,
    evidenceRecordKey:key,evidenceDbGet:async(id,role,s)=>clone(records.get(key(s,id,role))||null),
    evidenceDbPut:async r=>{records.set(r.key,clone(B.normalizeRecord(r)));return true;},
    calibrationEvidenceVerifiedShots:new Set(),calibrationEvidenceComplete:()=>false,renderBaselineCalibration(){},
    pendingFollowEvidence:new Map(),earlyRecoveryEvents:new Map(),compactTrajectoryMetric:x=>x,
    registerPendingFollowEvidence(){},finalizeFollowEvidenceFromMetrics(){},extendFullShotEvidenceToRecovery:async()=>true};
  ctx.window.window=ctx.window;vm.createContext(ctx);
  const app=read('app.js'),start=app.indexOf('const evidenceWriteChains=new Map();'),end=app.indexOf('async function evidenceDbDeleteShot(',start);
  if(!(start>0&&end>start))throw new Error('frozen evidence queue not found in app.js');
  vm.runInContext(app.slice(start,end),ctx);                         // shipped frozen queue
  const idLayer=path.join(staticDir,'evidence_identity_persistence_layer.js');
  if(identityLayer&&fs.existsSync(idLayer))vm.runInContext(read('evidence_identity_persistence_layer.js'),ctx); // shipped writer adapter (index.html order)
  vm.runInContext(read('temporal_evidence_layer.js'),ctx);           // shipped R7 temporal layer
  const browserLayer=ctx.window.TemporalEvidenceLayer;
  ctx.window.TemporalEvidenceLayer={...browserLayer,openRole(){return true;},closeRole(){},diagnostics(){return{};},browserInfo(){return{};}};
  vm.runInContext(read('native_capture_layer.js'),ctx);              // shipped native facade
  const api={T,B,C,ctx,records,log,events,key,browserLayer,N:ctx.window.NativeCaptureLayer,
    setSession(s){currentSession=s;},
    seed(rec){records.set(rec.key,clone(rec));},
    get(s,id,role='side'){return records.get(key(s,id,role));},
    reload(s,id,role='side'){return B.normalizeRecord(clone(records.get(key(s,id,role))));},
    merge(rec){return ctx.evidenceDbMerge(rec);},
    async until(fn,ms=3000){const t=Date.now();while(Date.now()-t<ms){if(fn())return true;await tick(5);}return false;}};
  return api;
}
function safeFI(staticDir){try{return require(path.join(staticDir,'frame_identity_core.js'));}catch{return undefined;}}
// A native bridge double: a configurable bundle; /frame/<i> answers with a real Blob; optional hooks.
function nativeBridge({rel,frames,generation=1,role='side',onFrame=null,bundleExtra={},diagGeneration=null}){
  let firstFrame=true;
  return async(p,body)=>{
    if(p==='/health')return {data:{ok:true,version:'t',backend_id:'native-avfoundation',platform:'macOS'}};
    if(p==='/open')return {data:{ok:true,diagnostics:{backend:'native-avfoundation'}}};
    if(p==='/diag')return {data:{roles:{[role]:{active:true,generation:diagGeneration??generation,raw_fps:30,capture_fps:30}}}};
    if(p==='/close')return {data:{ok:true}};
    if(p==='/release')return {data:{ok:true,tokens:{[role]:'tok1'}}};
    if(p.startsWith('/bundle'))return {data:{ok:true,role,generation,release_epoch_ms:rel,raw_fps:30,reported_fps:30,pre_ms:1250,post_ms:900,backend_id:'native-avfoundation',clock_domain:'3pm-master-monotonic-v1',frames,...bundleExtra}};
    if(p.startsWith('/frame/')){if(firstFrame&&onFrame){firstFrame=false;await onFrame();}const i=Number(p.split('/').pop());return {__blob:blob('native-'+i,2)};}
    throw new Error('bridge: '+p);
  };
}
async function openNative(e,generation=1,role='side'){
  e.N.openRole(role,{label:'FaceTime HD Camera',getSettings:()=>({width:1280,height:720,frameRate:30})},generation);
  const ok=await e.until(()=>e.N.states[role].active&&e.N.states[role].generation===generation);
  if(!ok)throw new Error('native '+role+' gen '+generation+' did not open');
}
async function releaseAndWait(e,rel,count=1){
  const before=e.events.filter(x=>x?.type==='3pm-temporal-evidence-updated').length;
  e.N.release({releaseEpochMs:rel},'cycle');
  await e.until(()=>e.events.filter(x=>x?.type==='3pm-temporal-evidence-updated').length>=before+count,4000);
  await tick(20);
}
const zones=fs=>fs.map(f=>f.evidenceZone||(f.evidenceTags||[])[0]||'');
module.exports={BASE,tick,load,blob,env,nativeBridge,openNative,releaseAndWait,zones};
