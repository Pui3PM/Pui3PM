'use strict';
// Auditor-only harness: executes unmodified production source through the shipped native writer harness.
// Only test fixtures and output assertions are changed below; no package source is written.
const fs=require('fs'),path=require('path'),vm=require('vm'),{createRequire}=require('module');
const root=path.resolve(process.argv[2]||'audit_input/3PM_Analyzer_R8_FIELD_TEST');
const harness=path.join(root,'app/tests/test_evidence_identity_writer_r8c.js');
const raw=fs.readFileSync(harness,'utf8').split('\n(async()=>{')[0];
async function nativeRun(kind){
 let code=raw;
 if(kind==='mixed-clock'){
  code=code.replace('media_time_ms:i<2?null:5000+i*33','media_time_ms:5000000+i*33');
  code=code.replace("mediaTime:null,blob:{size:1,i:'live'}","mediaTime:9.1,blob:{size:1,i:'live'}");
  code=code.replace("mediaTime:null,blob:{size:1,i:'rec'}","mediaTime:12,blob:{size:1,i:'rec'}");
 }
 if(kind==='generation-switch') code=code.replace('recoveryInjected=true;','recoveryInjected=true;ctx.window.NativeCaptureLayer.states.side.generation=2;ctx.window.NativeCaptureLayer.states.side.token++;');
 const fn=new Function('require','__dirname','process',code+'\nreturn nativeWriterScenario();');
 const record=await fn(createRequire(harness),path.dirname(harness),{argv:['node','harness']});
 return {kind,generationChanged:kind==='generation-switch',epochs:record.frames.map(f=>f.epochMs),sources:record.frames.map(f=>f.source),generations:record.frames.map(f=>f.generation??null),recoveryPreserved:record.followThroughEndEpochMs===102000&&record.frames.some(f=>f.evidenceZone==='recovery-end'),nativeFrameCount:record.frames.filter(f=>String(f.source).startsWith('native-')).length,epochOrderValid:record.frames.every((f,i,a)=>i===0||f.epochMs>=a[i-1].epochMs)};
}
async function workerRun(){
 const T=require(path.join(root,'app/static/temporal_evidence_core.js')),B=require(path.join(root,'app/static/evidence_budget_core.js'));let merged=null;
 const record={sessionId:1,shotId:1,role:'side',releaseEpochMs:100000,frames:[]};
 const ctx={console,Promise,Map,Set,Date,Math,Number,Array,Object,JSON,queueMicrotask,setInterval:()=>0,setTimeout,clearTimeout,
 document:{readyState:'loading',addEventListener(){}},navigator:{},CustomEvent:function(){},
 window:{TemporalEvidenceCore:T,EvidenceBudgetCore:B,FormAnalyzer:{getCurrentSessionId:()=>1},dispatchEvent(){}},
 evidenceDbMerge:async r=>{merged=r;return r;},
 indexedDB:{open(){const req={};setTimeout(()=>{req.result={transaction(){return{objectStore(){return{index(){return{getAll(){const q={};setTimeout(()=>{q.result=[record];q.onsuccess();},0);return q;}};}};}};}};req.onsuccess();},0);return req;}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'app/static/temporal_evidence_layer.js'),'utf8'),ctx);
 await ctx.window.TemporalEvidenceLayer.augmentBundle({role:'side',release_epoch_ms:100000,mode:'worker-track-processor',raw_fps:30,reported_fps:30,frames:Array.from({length:25},(_,i)=>({epochMs:100000+i*34,mediaTime:null,frameSeq:null,blob:{i}}))});
 return {kind:'actual-worker-augmentBundle',inputFrames:25,mergedFrames:merged.frames.length,identities:merged.frames.map(f=>({mediaTime:f.mediaTime,frameSeq:f.frameSeq}))};
}
(async()=>{const out=[];for(const k of ['control','mixed-clock','generation-switch'])out.push(await nativeRun(k));out.push(await workerRun());console.log(JSON.stringify(out,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
