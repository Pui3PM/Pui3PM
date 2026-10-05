'use strict';
// R8C production evidence regression (Claude review 2026-10-02).
// F02/M01: temporal_evidence_core must not turn null mediaTime/frameSeq into 0, and epoch nearness
//          must not collapse distinct camera samples (null-time or 240 FPS).
// F03:     camera_timeline_core must not turn null clocks/sequence into 0.
// F04/M03: native_capture_layer must write through the frozen app.js per-record queue (evidenceDbMerge),
//          so a late native bundle cannot erase Recovery written while its blobs were downloading.
// Usage: node app/tests/test_evidence_identity_writer_r8c.js [path-to-app/static]
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2]||path.join(__dirname,'../static');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const T=require(path.join(root,'temporal_evidence_core.js'));
const B=require(path.join(root,'evidence_budget_core.js'));
const C=require(path.join(root,'camera_timeline_core.js'));
const failures=[];
function check(name,fn){try{fn();}catch(e){failures.push(`${name}: ${e.message}`);}}
const blob=i=>({size:1,i});

// ---------- F02 / M01 : temporal identity ----------
check('F02 null mediaTime/frameSeq keeps 25 distinct samples',()=>{
  const rows=Array.from({length:25},(_,i)=>({epochMs:1000+i*34,mediaTime:null,frameSeq:null,blob:blob(i),source:'test'}));
  assert.equal(T.mergeEvidence([],rows,1000).length,25);
  assert.equal(B.canonicalUnique(T.mergeEvidence([],rows,1000)).length,25);
});
check('F02 240 FPS distinct mediaTime keeps 25 samples',()=>{
  const rows=Array.from({length:25},(_,i)=>({epochMs:2000+i*(1000/240),mediaTime:i/240,frameSeq:i+1,blob:blob(i),source:'native-avfoundation-high'}));
  assert.equal(T.mergeEvidence([],rows,2000).length,25);
});
check('F02 240 FPS frameSeq-only identity keeps 25 samples',()=>{
  const rows=Array.from({length:25},(_,i)=>({epochMs:2000+i*(1000/240),mediaTime:null,frameSeq:i+1,blob:blob(i),source:'native-avfoundation-high'}));
  assert.equal(T.canonicalFrames(rows).length,25);
});
check('F02 same-source captures without identity are not merged by epoch',()=>{
  const rows=Array.from({length:10},(_,i)=>({epochMs:5000+i*4,blob:blob(i),source:'worker-track-processor-60'}));
  assert.equal(T.canonicalFrames(rows).length,10);
});
check('F02 false/empty-string are unknown, not 0',()=>{
  const rows=[{epochMs:1,mediaTime:false,frameSeq:'',blob:blob(1),source:'a'},{epochMs:200,mediaTime:'',frameSeq:false,blob:blob(2),source:'a'}];
  const out=T.canonicalFrames(rows);assert.equal(out.length,2);
  assert.equal(T.num(null),null);assert.equal(T.num(false),null);assert.equal(T.num(''),null);assert.equal(T.num(0),0);
});
// Behaviour that must be preserved.
check('preserve: cross-pipeline duplicate (sparse w/o identity vs worker) still merges, worker kept, tags union',()=>{
  const out=T.canonicalFrames([{epochMs:1000,blob:blob(1),source:'sparse-jpeg',evidenceZone:'anchor-pin'},{epochMs:1005,mediaTime:3.2,frameSeq:7,blob:blob(2),source:'worker-track-processor-60',evidenceZone:'release-focus'}]);
  assert.equal(out.length,1);assert(/worker/.test(out[0].source));assert(out[0].evidenceTags.includes('anchor-pin')&&out[0].evidenceTags.includes('release-focus'));
});
check('preserve: same decoded frame (same mediaTime) from two paths merges',()=>{
  const b=blob(9);const d=T.dedupeFrames([{epochMs:1000,mediaTime:1.25,blob:b,evidenceZone:'anchor-pin'},{epochMs:1032,mediaTime:1.25,blob:b,evidenceZone:'hold-pin'}]);
  assert.equal(d.length,1);
});

// ---------- F03 : camera timeline null clocks ----------
check('F03 null masterTimeMs falls through to the next known clock, never 0',()=>{
  assert.equal(C.frameTimeMs({masterTimeMs:null,captureEpochMs:123456,epochMs:123456,mediaTimeMs:null,mediaTime:null,frameSeq:1}),123456);
  assert.equal(C.frameTimeMs({masterTimeMs:null,captureEpochMs:null,epochMs:null,mediaTimeMs:null,mediaTime:null}),null);
});
check('F03 null frameSeq does not drop frames in canonicalFrames',()=>{
  const rows=Array.from({length:5},(_,i)=>({masterTimeMs:1000+i*33,frameSeq:null,mediaTimeMs:null}));
  assert.equal(C.canonicalFrames(rows).length,5);
});

// ---------- F04 / M03 + native null coercion : native writer path ----------
async function nativeWriterScenario(){
  const records=new Map(),key=(s,id,r)=>`${s}:${id}:${r}`,rel=100000,sid=1,shotId=2;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const BASE='http://127.0.0.1:48735';
  let recoveryInjected=false,nativeEvents=0;
  // Minimal IndexedDB double backed by the same records map that the frozen queue uses.
  // Post-P108 R2: the shipped evidence_identity_persistence_layer.js hooks every evidence-store read (IDB get/getAll);
  // this double applies the same hook, like the put double below applies the evidence_budget_layer normalization.
  const readHook=rows=>{const L=ctx&&ctx.window.EvidenceIdentityPersistenceLayer;return L&&typeof L.stampStoredResult==='function'?L.stampStoredResult(rows):rows;};
  const fakeIDB={open(){const req={};setTimeout(()=>{req.result={transaction(){const tx={objectStore(){return{
      index(){return{getAll(s){const r={};setTimeout(()=>{r.result=readHook([...records.values()].filter(x=>Number(x.sessionId)===Number(s)).map(clone));r.onsuccess&&r.onsuccess();},0);return r;}};},
      put(v){records.set(v.key,clone(v));setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0);}
    };}};return tx;}};req.onsuccess&&req.onsuccess();},0);return req;}};
  const frameRows=[0,1,2,3].map(i=>({index:i,frame_seq:i<2?null:i+10,epoch_ms:rel-60+i*33,capture_epoch_ms:rel-60+i*33,master_time_ms:null,media_time_ms:i<2?null:5000+i*33,url:`${BASE}/frame/${i}`}));
  let ctx;
  const json=(data,status=200)=>({ok:status<300,status,json:async()=>data});
  const fetchMock=async(url,opt={})=>{
    const p=String(url).replace(BASE,'');
    if(p==='/health')return json({ok:true,version:'t',backend_id:'native-avfoundation',platform:'macOS'});
    if(p==='/open')return json({ok:true,diagnostics:{backend:'native-avfoundation'}});
    if(p==='/diag')return json({roles:{side:{active:true,generation:1,raw_fps:30,capture_fps:30}}});
    if(p==='/close')return json({ok:true});
    if(p==='/release')return json({ok:true,tokens:{side:'tok1'}});
    if(p.startsWith('/bundle'))return json({ok:true,release_epoch_ms:rel,raw_fps:30,reported_fps:30,pre_ms:1250,post_ms:900,backend_id:'native-avfoundation',frames:frameRows});
    if(p.startsWith('/frame/')){
      if(!recoveryInjected){recoveryInjected=true;
        // Recovery lands through the frozen queue while native blobs are still downloading.
        await ctx.evidenceDbMerge({...records.get(key(sid,shotId,'side')),followThroughEndEpochMs:rel+2000,frames:[{epochMs:rel+2000,offsetMs:2000,mediaTime:null,blob:{size:1,i:'rec'},evidenceZone:'recovery-end',source:'sparse-jpeg'}]});
      }
      return {ok:true,status:200,blob:async()=>({size:2,url:p})};
    }
    if(p.startsWith('/static/'))return json({});
    throw new Error('unexpected '+p);
  };
  ctx={console,Promise,Map,Set,Date,Math,Number,Array,Object,JSON,String,Error,queueMicrotask,AbortController,
    document:{readyState:'loading',addEventListener(){}},navigator:{userAgent:'t'},
    window:{EvidenceBudgetCore:B,TemporalEvidenceCore:T,dispatchEvent(e){if(e?.type==='3pm-temporal-evidence-updated')nativeEvents++;},FormAnalyzer:{getCurrentSessionId:()=>sid}},
    CustomEvent:function(t,o){this.type=t;this.detail=o?.detail;},setTimeout,clearTimeout,setInterval:()=>0,fetch:fetchMock,indexedDB:fakeIDB,
    evidenceRecordKey:key,evidenceDbGet:async(id,role,s)=>clone(records.get(key(s,id,role))||null),
    evidenceDbPut:async r=>{records.set(r.key,clone(B.normalizeRecord(r)));return true;},
    calibrationEvidenceVerifiedShots:new Set(),calibrationEvidenceComplete:()=>false,renderBaselineCalibration(){},
    pendingFollowEvidence:new Map(),earlyRecoveryEvents:new Map(),compactTrajectoryMetric:x=>x,
    registerPendingFollowEvidence(){},finalizeFollowEvidenceFromMetrics(){},extendFullShotEvidenceToRecovery:async()=>true};
  ctx.window.window=ctx.window;vm.createContext(ctx);
  const app=read('app.js'),start=app.indexOf('const evidenceWriteChains=new Map();'),end=app.indexOf('async function evidenceDbDeleteShot(',start);
  assert(start>0&&end>start,'frozen evidence queue not found in app.js');
  vm.runInContext(app.slice(start,end),ctx); // shipped frozen queue, not a reimplementation
  if(fs.existsSync(path.join(root,'evidence_identity_persistence_layer.js'))){                     // shipped writer adapter (index.html order)
    ctx.window.FrameIdentityCore=require(path.join(root,'frame_identity_core.js'));                // loaded by index.html before every evidence module
    vm.runInContext(read('evidence_identity_persistence_layer.js'),ctx);
  }
  vm.runInContext(read('temporal_evidence_layer.js'),ctx);
  ctx.window.TemporalEvidenceLayer={...ctx.window.TemporalEvidenceLayer,openRole(){return true;},closeRole(){},diagnostics(){return{};},browserInfo(){return{};}};
  vm.runInContext(read('native_capture_layer.js'),ctx);
  const base={key:key(sid,shotId,'side'),sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[{epochMs:rel-900,offsetMs:-900,mediaTime:null,blob:{size:1,i:'live'},source:'sparse-jpeg',evidenceZone:'anchor-focus'}]};
  records.set(base.key,clone(base));
  const N=ctx.window.NativeCaptureLayer;assert(N,'NativeCaptureLayer not installed');
  N.openRole('side',{label:'FaceTime HD Camera',getSettings:()=>({width:1280,height:720,frameRate:30})},1);
  for(let i=0;i<50&&!N.states.side.active;i++)await new Promise(r=>setTimeout(r,10));
  assert(N.states.side.active,'native side did not open');
  N.release({releaseEpochMs:rel},'cycle-1');
  for(let i=0;i<300&&nativeEvents===0;i++)await new Promise(r=>setTimeout(r,10));
  assert(recoveryInjected,'scenario did not interleave Recovery');assert.equal(nativeEvents,1,'native bundle did not complete');
  await new Promise(r=>setTimeout(r,30));
  return records.get(base.key);
}

(async()=>{
  let rec=null;
  try{rec=await nativeWriterScenario();}catch(e){failures.push(`F04 harness: ${e.message}`);}
  if(rec){
    check('F04 late native bundle must not erase Recovery end time',()=>assert.equal(rec.followThroughEndEpochMs,100000+2000));
    check('F04 late native bundle must not erase the Recovery frame',()=>assert(rec.frames.some(f=>f.evidenceZone==='recovery-end'||(f.evidenceTags||[]).includes('recovery-end'))));
    check('native null master_time_ms stays null (never 0)',()=>{const nat=rec.frames.filter(f=>/native-avfoundation/.test(String(f.source||'')));assert(nat.length>0,'no native frames persisted');for(const f of nat)assert.strictEqual(f.masterTimeMs,null);});
    check('native null frame_seq/media_time stay null and do not collapse samples',()=>{const nat=rec.frames.filter(f=>/native-avfoundation/.test(String(f.source||'')));assert.equal(nat.length,4,`native frames persisted=${nat.length}`);assert(nat.some(f=>f.frameSeq===null&&f.mediaTime===null));});
  }
  if(failures.length){console.error('R8C evidence identity/writer regression FAIL\n - '+failures.join('\n - '));process.exit(1);}
  console.log('R8C evidence identity/writer regression PASS: null/240fps temporal identity, camera timeline null clocks, native writer via frozen queue (Recovery preserved), native null fields');
})();
