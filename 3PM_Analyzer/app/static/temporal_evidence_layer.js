// 3PM BLE4.3.7.4 Browser-Compatible Temporal Evidence Layer
// Adaptive temporal capture backends, isolated from frozen Dev4 analysis/Pose/UI paths.
(function(){
'use strict';
const T=window.TemporalEvidenceCore;if(!T)return;
const ROLES=['side','rear','overhead'];
const mkState=role=>({role,generation:0,active:false,sourceTrack:null,mode:'idle',backend:'none',rawFps:null,medianMs:null,p95Ms:null,jitterMs:null,totalFrames:0,discardedFrames:0,bufferFrames:0,targetWidth:null,reportedFps:null,error:null,lastBundle:null,lastReleaseEpoch:null,attempts:[],reader:null,feederTrack:null,feederVideo:null,feederRvfc:null,feederCanvas:null,feederCtx:null,feedToken:0});
const states=Object.fromEntries(ROLES.map(role=>[role,mkState(role)]));
let worker=null,syncTimer=null,filmstripObserver=null,filmstripMutating=false;
const now=()=>Date.now();
function browserInfo(){return{user_agent:navigator.userAgent||null,vendor:navigator.vendor||null,platform:navigator.platform||null,worker:typeof Worker==='function',mstp_window:typeof window.MediaStreamTrackProcessor==='function',rvfc:typeof HTMLVideoElement!=='undefined'&&typeof HTMLVideoElement.prototype.requestVideoFrameCallback==='function',offscreen:typeof OffscreenCanvas==='function',video_frame:typeof VideoFrame==='function'};}
function annotateFilmstrip(){
  const el=document.getElementById('filmstripStatus');if(!el||filmstripMutating)return;
  let text=String(el.textContent||'');if(!/Native\s+[0-9—]/.test(text))return;
  for(const role of ROLES){const label=role==='side'?'Side':role==='rear'?'Rear':'Overhead',raw=Number(states[role].rawFps);if(!Number.isFinite(raw))continue;const rx=new RegExp(`(${label}[^·]*·\\s*)Native\\s+([0-9—.]+)\\s*fps`,'i');text=text.replace(rx,(_,a,legacy)=>`${a}RAW ${raw.toFixed(raw>=50?0:1)} fps · Display ${legacy} fps`);}
  if(text!==el.textContent){filmstripMutating=true;el.textContent=text;filmstripMutating=false;}
}
function installFilmstripObserver(){const el=document.getElementById('filmstripStatus');if(!el||filmstripObserver)return;filmstripObserver=new MutationObserver(()=>queueMicrotask(annotateFilmstrip));filmstripObserver.observe(el,{childList:true,characterData:true,subtree:true});}
function video(role){return document.getElementById(`${role}Video`);}
function ensureWorker(){
  if(worker)return worker;
  try{
    worker=new Worker('/static/temporal_evidence_worker.js?v=ble43890');
    worker.onmessage=onWorker;
    worker.onerror=e=>console.warn('Temporal Evidence worker runtime error',e);
  }catch(err){console.warn('Temporal Evidence worker creation unavailable',err);worker=null;}
  if(worker&&!syncTimer)syncTimer=setInterval(syncClocks,250);
  return worker;
}
function syncClocks(){if(!worker)return;for(const role of ROLES){const s=states[role],v=video(role);if(!s.active||!v?.srcObject)continue;const media=Number(v.currentTime);if(Number.isFinite(media))try{worker.postMessage({type:'sync',role,generation:s.generation,epochMs:now(),mediaTime:media});}catch{}}}
function chooseWidth(fps){return Number(fps)>=50?560:640;}
function noteAttempt(s,backend,ok,error=null){s.attempts.push({t:now(),backend,ok:!!ok,error:error?String(error):null});if(s.attempts.length>12)s.attempts.shift();}
function cleanupFeeder(s){
  s.feedToken++;
  try{s.reader?.cancel?.();}catch{} try{s.reader?.releaseLock?.();}catch{} s.reader=null;
  try{if(s.feederVideo&&s.feederRvfc!==null&&s.feederVideo.cancelVideoFrameCallback)s.feederVideo.cancelVideoFrameCallback(s.feederRvfc);}catch{} s.feederRvfc=null;
  try{s.feederTrack?.stop?.();}catch{} s.feederTrack=null;
  if(s.feederVideo){try{s.feederVideo.pause();}catch{} try{s.feederVideo.srcObject=null;}catch{} try{s.feederVideo.remove();}catch{} s.feederVideo=null;}
  s.feederCanvas=null;s.feederCtx=null;
}
function prepareFeedWorker(s,mode){const w=ensureWorker();if(!w)return false;try{w.postMessage({type:'start_feed',role:s.role,generation:s.generation,mode,reportedFps:s.reportedFps,targetWidth:s.targetWidth,retentionMs:1550});return true;}catch(err){s.error=String(err?.message||err);return false;}}
async function sendVideoFrame(s,frame,epochMs){
  if(!worker){try{frame?.close?.();}catch{}return false;}
  const ts=Number(frame?.timestamp),mediaTime=Number.isFinite(ts)?ts/1e6:null;
  try{worker.postMessage({type:'feed_frame',role:s.role,generation:s.generation,epochMs:Number(epochMs)||now(),mediaTime,frameTimestampUs:Number.isFinite(ts)?ts:null,frame},[frame]);return true;}
  catch(err){
    try{const bitmap=await createImageBitmap(frame);try{frame.close();}catch{}worker.postMessage({type:'feed_frame',role:s.role,generation:s.generation,epochMs:Number(epochMs)||now(),mediaTime,frameTimestampUs:Number.isFinite(ts)?ts:null,bitmap},[bitmap]);return true;}
    catch(err2){try{frame?.close?.();}catch{}s.error=String(err2?.message||err2||err);return false;}
  }
}
function startWorkerTrack(s){
  const w=ensureWorker();if(!w||!s.sourceTrack)return false;
  let clone=null;
  try{
    clone=s.sourceTrack.clone();
    w.postMessage({type:'start',role:s.role,generation:s.generation,track:clone,reportedFps:s.reportedFps,targetWidth:s.targetWidth,retentionMs:1550},[clone]);
    s.backend='worker-track-processor';s.mode='starting-worker-track';s.error=null;noteAttempt(s,s.backend,true);return true;
  }catch(err){try{clone?.stop?.();}catch{}noteAttempt(s,'worker-track-processor',false,err);s.error=String(err?.message||err);return false;}
}
function startMainTrackProcessor(s){
  const Ctor=window.MediaStreamTrackProcessor;if(typeof Ctor!=='function'||!s.sourceTrack)return false;
  cleanupFeeder(s);let clone=null,processor=null,reader=null;
  try{
    if(!prepareFeedWorker(s,'main-track-processor'))throw new Error('feed worker unavailable');
    clone=s.sourceTrack.clone();processor=new Ctor({track:clone,maxBufferSize:4});reader=processor.readable.getReader();
    s.feederTrack=clone;s.reader=reader;s.backend='main-track-processor';s.mode='starting-main-track';s.error=null;noteAttempt(s,s.backend,true);
  }catch(err){try{reader?.cancel?.();}catch{}try{clone?.stop?.();}catch{}noteAttempt(s,'main-track-processor',false,err);s.error=String(err?.message||err);return false;}
  const token=++s.feedToken;
  (async()=>{
    try{
      while(s.active&&s.feedToken===token){const {value:frame,done}=await reader.read();if(done||!frame)break;const ok=await sendVideoFrame(s,frame,now());if(!ok)throw new Error(s.error||'VideoFrame transfer failed');}
      if(s.active&&s.feedToken===token)throw new Error('main track processor ended');
    }catch(err){if(s.active&&s.feedToken===token){noteAttempt(s,'main-track-processor',false,err);s.error=String(err?.message||err);startVideoPump(s);}}
  })();
  return true;
}
function startVideoPump(s){
  if(!s.sourceTrack||typeof document==='undefined')return false;
  cleanupFeeder(s);let clone=null,v=null;
  try{
    if(!prepareFeedWorker(s,'independent-video-pump'))throw new Error('feed worker unavailable');
    clone=s.sourceTrack.clone();v=document.createElement('video');v.muted=true;v.playsInline=true;v.autoplay=true;v.setAttribute('aria-hidden','true');
    // Keep compositor active without affecting product layout.
    Object.assign(v.style,{position:'fixed',left:'-8px',top:'-8px',width:'2px',height:'2px',opacity:'0.001',pointerEvents:'none',zIndex:'-1'});
    v.srcObject=new MediaStream([clone]);document.body.appendChild(v);
    s.feederTrack=clone;s.feederVideo=v;s.backend='independent-video-pump';s.mode='starting-video-pump';s.error=null;noteAttempt(s,s.backend,true);
  }catch(err){try{clone?.stop?.();}catch{}try{v?.remove?.();}catch{}noteAttempt(s,'independent-video-pump',false,err);s.mode='unavailable';s.error=String(err?.message||err);return false;}
  const token=++s.feedToken;
  const begin=async()=>{
    try{await v.play();}catch(err){s.error=String(err?.message||err);}
    if(!v.requestVideoFrameCallback){s.mode='unavailable';s.error='requestVideoFrameCallback unavailable';noteAttempt(s,'independent-video-pump',false,s.error);return;}
    const pump=async(ts,meta)=>{
      if(!s.active||s.feedToken!==token||s.feederVideo!==v)return;
      s.feederRvfc=v.requestVideoFrameCallback(pump);
      const srcW=Number(v.videoWidth)||1280,srcH=Number(v.videoHeight)||720,w=Math.max(360,Math.min(srcW,s.targetWidth||640)),h=Math.max(1,Math.round(w*srcH/srcW));
      try{
        if(!s.feederCanvas||s.feederCanvas.width!==w||s.feederCanvas.height!==h){s.feederCanvas=new OffscreenCanvas(w,h);s.feederCtx=s.feederCanvas.getContext('2d',{alpha:false,desynchronized:true});}
        s.feederCtx.drawImage(v,0,0,w,h);const bitmap=s.feederCanvas.transferToImageBitmap();const mediaTime=Number(meta?.mediaTime);worker.postMessage({type:'feed_frame',role:s.role,generation:s.generation,epochMs:now(),mediaTime:Number.isFinite(mediaTime)?mediaTime:null,bitmap},[bitmap]);
      }catch(err){s.error=String(err?.message||err);}
    };
    s.feederRvfc=v.requestVideoFrameCallback(pump);
  };
  void begin();return true;
}
function startFallback(s,reason){
  if(!s.active)return false;s.error=reason?String(reason):s.error;
  try{worker?.postMessage({type:'stop',role:s.role,generation:s.generation});}catch{}
  if(startMainTrackProcessor(s))return true;
  if(startVideoPump(s))return true;
  s.mode='unavailable';return false;
}
function openRole(role,track,generation){
  const s=states[role];if(!s||!track)return false;if(s.active&&s.generation===generation&&s.sourceTrack===track)return true;closeRole(role);
  s.generation=Number(generation)||0;s.active=true;s.sourceTrack=track;s.reportedFps=Number(track.getSettings?.().frameRate)||null;s.targetWidth=chooseWidth(s.reportedFps);s.mode='starting';s.backend='none';s.error=null;s.attempts=[];
  if(startWorkerTrack(s))return true;
  return startFallback(s,s.error||'worker track transfer unavailable');
}
function closeRole(role){const s=states[role];if(!s)return;cleanupFeeder(s);if(worker&&s.generation)try{worker.postMessage({type:'stop',role,generation:s.generation});}catch{}s.active=false;s.sourceTrack=null;s.mode='idle';s.backend='none';s.lastReleaseEpoch=null;s.rawFps=null;s.medianMs=null;s.p95Ms=null;s.jitterMs=null;s.totalFrames=0;s.discardedFrames=0;s.bufferFrames=0;}
function beginCycle(cycleId){if(worker&&states.side.active)worker.postMessage({type:'cycle_start',role:'side',generation:states.side.generation,cycle_id:cycleId||null});}
function phase(role,phaseName,epochMs){if(worker&&states[role]?.active)worker.postMessage({type:'phase',role,generation:states[role].generation,phase:phaseName,epochMs:Number(epochMs)||now()});}
function release(metrics,cycleId){if(!worker||!states.side.active)return;const epoch=Number(metrics?.releaseEpochMs||metrics?.releaseAlignedEpochMs)||now(),s=states.side;if(Number.isFinite(s.lastReleaseEpoch)&&Math.abs(s.lastReleaseEpoch-epoch)<500)return;s.lastReleaseEpoch=epoch;worker.postMessage({type:'release',role:'side',generation:s.generation,cycle_id:cycleId||null,release_epoch_ms:epoch,pre_ms:1250,post_ms:900});}
function endCycle(reason='ended'){if(worker&&states.side.active)worker.postMessage({type:'cycle_end',role:'side',generation:states.side.generation,reason});}
function diagnostics(role=null){const one=r=>{const s=states[r];return{role:s.role,generation:s.generation,active:s.active,mode:s.mode,backend:s.backend,rawFps:s.rawFps,medianMs:s.medianMs,p95Ms:s.p95Ms,jitterMs:s.jitterMs,totalFrames:s.totalFrames,discardedFrames:s.discardedFrames,bufferFrames:s.bufferFrames,targetWidth:s.targetWidth,reportedFps:s.reportedFps,error:s.error,lastBundle:s.lastBundle,attempts:[...s.attempts]};};return role?one(role):Object.fromEntries(ROLES.map(r=>[r,one(r)]));}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('3pm-form-analyzer-shot-evidence-v1',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function recordsForSession(sessionId){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('shotEvidence','readonly'),idx=tx.objectStore('shotEvidence').index('sessionId'),req=idx.getAll(Number(sessionId));req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function putRecord(rec){
  if(typeof evidenceDbMerge!=='function')throw new Error('Serialized evidence writer unavailable');
  return evidenceDbMerge(rec);
}
function sessionId(){return Number(window.FormAnalyzer?.getCurrentSessionId?.())||null;}
async function findRecordForBundle(bundle,timeoutMs=10000){const sid=sessionId(),until=now()+timeoutMs;if(!sid)return null;while(now()<until){const rows=await recordsForSession(sid).catch(()=>[]),matches=rows.filter(r=>r.role===bundle.role&&Math.abs(Number(r.releaseEpochMs)-Number(bundle.release_epoch_ms))<=350).sort((a,b)=>Math.abs(Number(a.releaseEpochMs)-Number(bundle.release_epoch_ms))-Math.abs(Number(b.releaseEpochMs)-Number(bundle.release_epoch_ms)));if(matches[0])return matches[0];await new Promise(r=>setTimeout(r,220));}return null;}
async function augmentBundle(bundle){
  const rec=await findRecordForBundle(bundle);if(!rec){console.warn('Temporal Evidence could not match persisted shot',bundle.release_epoch_ms);return false;}
  // R8 P1-08 H-02 (narrow thaw, see DECISION_LOG): unknown worker identity stays null (Number(null)===0 used to
  // manufacture mediaTime/frameSeq 0/0 and collapse 25 real frames into 1). Frames carry the stream generation
  // that produced them and a durable FrameUID when their sequence is known.
  const known=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v))?Number(v):null,gen=known(bundle.generation),FI=window.FrameIdentityCore||null,source=`${bundle.mode||'temporal'}-${Number(bundle.raw_fps)>=50?'60':'30'}`;
  const workerFrames=(bundle.frames||[]).filter(f=>f?.blob&&Number.isFinite(Number(f.epochMs))).map(f=>{const off=Number(f.epochMs)-Number(bundle.release_epoch_ms),zone=T.releaseZone(off,f.pinLabel),pinTags=(Array.isArray(f.pinLabels)?f.pinLabels:[]).map(x=>T.releaseZone(off,x)).filter(Boolean),evidenceTags=[...new Set([zone,...pinTags].filter(Boolean))],frameSeq=known(f.frameSeq),uid=FI&&gen!==null&&frameSeq!==null?FI.workerFrameUID({role:bundle.role,generation:gen,frameSeq,epochMs:Number(f.epochMs),source}):null;return {epochMs:Number(f.epochMs),offsetMs:off,mediaTime:known(f.mediaTime),frameSeq,generation:gen,...(uid?{frameUID:uid}:{}),blob:f.blob,source,evidenceZone:zone,evidenceTags};});
  const healthy=T.bundleHealthy(bundle,bundle.reported_fps),frames=T.mergeEvidence(rec.frames||[],workerFrames,bundle.release_epoch_ms,{preMs:bundle.pre_ms||1250,postMs:bundle.post_ms||900,replaceDense:healthy});
  const merged={...rec,frames,startEpochMs:frames[0]?.epochMs||rec.startEpochMs,endEpochMs:frames.at(-1)?.epochMs||rec.endEpochMs,captureKind:`${rec.captureKind||'phase-weighted'}+adaptive-native-temporal`,temporalEvidence:{version:'BLE4.3.7.4',mode:bundle.mode||states[bundle.role]?.backend||'temporal',healthy,raw_fps:Number(bundle.raw_fps)||null,reported_fps:Number(bundle.reported_fps)||null,dense_frame_count:Number(bundle.dense_frame_count)||0,target_width:Number(bundle.target_width)||null,processor_discarded_frames:Number(bundle.processor_discarded_frames)||0,pre_ms:Number(bundle.pre_ms)||1250,post_ms:Number(bundle.post_ms)||900,updated_at:new Date().toISOString()}};
  await putRecord(merged);states[bundle.role].lastBundle=merged.temporalEvidence;window.dispatchEvent(new CustomEvent('3pm-temporal-evidence-updated',{detail:{shotId:Number(rec.shotId),role:bundle.role,releaseEpochMs:Number(bundle.release_epoch_ms),temporalEvidence:merged.temporalEvidence}}));return true;
}
function onWorker(e){const m=e.data||{},s=states[m.role];if(!s||Number(m.generation)!==s.generation)return;
  if(m.type==='mode'){s.mode=m.mode||s.mode;s.backend=m.mode||s.backend;s.error=null;return;}
  if(m.type==='error'){const err=m.error||'unknown';noteAttempt(s,s.backend||m.mode||'worker',false,err);s.error=err;console.warn('Temporal Evidence backend error',err);if(s.backend==='worker-track-processor'||s.mode==='starting-worker-track'||m.mode==='worker-track-processor'){startFallback(s,err);}else{s.mode='error';}return;}
  if(m.type==='diag'){s.mode=m.mode||s.mode;s.backend=m.mode||s.backend;s.rawFps=Number(m.raw_fps)||null;s.medianMs=Number(m.median_interval_ms)||null;s.p95Ms=Number(m.p95_interval_ms)||null;s.jitterMs=Number(m.jitter_p95_ms)||null;s.totalFrames=Number(m.total_frames)||0;s.discardedFrames=Number(m.processor_discarded_frames)||0;s.bufferFrames=Number(m.buffer_frames)||0;s.targetWidth=Number(m.target_width)||s.targetWidth;s.reportedFps=Number(m.reported_fps)||s.reportedFps;return;}
  if(m.type==='bundle'){void augmentBundle(m);return;}
}
// R7: every asynchronous writer uses the app's per-record queue. A temporal bundle may have
// read its record BEFORE Recovery; a direct put of that stale snapshot used to erase Recovery.
// Missing mediaTime must not be interpreted as mediaTime=0 and collapse unrelated frames.
if(typeof mergeEvidenceFrames==='function'&&window.EvidenceBudgetCore){
  mergeEvidenceFrames=function(a=[],b=[]){return window.EvidenceBudgetCore.canonicalUnique([...a,...b]);};
}
if(typeof evidenceDbPut==='function'){
  const put=evidenceDbPut;
  evidenceDbPut=async function(record){const result=await put(record);
    // Calibration must reflect the latest persisted contract, including a late missing Recovery.
    try{if(record.role==='side'&&Number(record.sessionId)===Number(window.FormAnalyzer?.getCurrentSessionId?.())&&typeof calibrationEvidenceVerifiedShots!=='undefined'){
      if(calibrationEvidenceComplete(record.shotId,record))calibrationEvidenceVerifiedShots.add(Number(record.shotId));else calibrationEvidenceVerifiedShots.delete(Number(record.shotId));
      if(typeof renderBaselineCalibration==='function')renderBaselineCalibration();
    }}catch(err){console.warn('Calibration refresh after evidence save failed',err);}
    window.dispatchEvent(new CustomEvent('3pm-evidence-persisted',{detail:{shotId:record.shotId,role:record.role,releaseEpochMs:record.releaseEpochMs}}));return result;};
}
// Event ids restart at 1 whenever the tracker rearms. Match Recovery to its exact release epoch,
// not a reused id or nearest shot; retain unfinished work until persistence actually succeeds.
const recoveryJobs=new Map();
function validEpoch(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;}
function recoveryKey(release){return `release:${Number(release)}`;}
async function completeRecovery(key,ctx,end){
  if(recoveryJobs.has(key))return;
  const job={attempt:0};recoveryJobs.set(key,job);
  const attempt=async()=>{
    job.attempt++;
    try{
      await extendFullShotEvidenceToRecovery(ctx,end);
      const records=await Promise.all(ctx.roles.map(role=>evidenceDbGet(ctx.shotId,role,ctx.sessionId)));
      if(!records.length||records.some(r=>!r||Number(r.releaseEpochMs)!==ctx.releaseEpochMs||Number(r.followThroughEndEpochMs)!==end))throw new Error('Recovery record not finalized');
      pendingFollowEvidence.delete(key);earlyRecoveryEvents.delete(key);recoveryJobs.delete(key);
    }catch(err){
      console.warn('[3PM Recovery persistence]',job.attempt,err);
      if(job.attempt<3)setTimeout(()=>void attempt(),250*job.attempt);
      else{recoveryJobs.delete(key);window.CaptureIntegrityLayer?.recordGateOutcome?.('recovery-storage',{reason:'recovery_save_failed',missing:['recovery']},{releaseEpochMs:ctx.releaseEpochMs});}
    }
  };
  await attempt();
}
if(typeof registerPendingFollowEvidence==='function'&&typeof finalizeFollowEvidenceFromMetrics==='function'){
  registerPendingFollowEvidence=function(shotId,sessionId,metrics,roles){
    if(!validEpoch(metrics?.releaseEpochMs))return;
    const releaseEpochMs=Number(metrics.releaseEpochMs),primaryRole=metrics.role||'side',key=recoveryKey(releaseEpochMs);
    const seed=window.PoseEngine?.getMetricsWindow?.(primaryRole,releaseEpochMs-400,Date.now())||[];
    const ctx={shotId:Number(shotId),sessionId:Number(sessionId),releaseEpochMs,releaseEventId:Number(metrics.releaseEventId)||0,roles:[...(roles||[])],metrics:{...metrics},primaryRole,
      trajectoryRows:seed.map(x=>({epochMs:Number(x.epochMs),metrics:compactTrajectoryMetric(x.metrics)})).filter(x=>x.metrics)};
    pendingFollowEvidence.set(key,ctx);
    const early=earlyRecoveryEvents.get(key);if(early)void completeRecovery(key,ctx,early.endEpochMs);
  };
  finalizeFollowEvidenceFromMetrics=function(metrics){
    if((metrics?.role||'side')!=='side'||metrics?.followThroughEnded!==true||!validEpoch(metrics.releaseEpochMs))return;
    const release=Number(metrics.releaseEpochMs),end=validEpoch(metrics.followThroughEndEpochMs)?Number(metrics.followThroughEndEpochMs):Number(metrics.epochMs);
    if(!Number.isFinite(end)||end<=release)return;
    const key=recoveryKey(release);earlyRecoveryEvents.set(key,{releaseEpochMs:release,endEpochMs:end});
    while(earlyRecoveryEvents.size>40)earlyRecoveryEvents.delete(earlyRecoveryEvents.keys().next().value);
    const ctx=pendingFollowEvidence.get(key);if(ctx)void completeRecovery(key,ctx,end);
  };
}

window.TemporalEvidenceLayer={augmentBundle,putRecord,version:'BLE4.3.8.9.5.2-frame-chronology-v1',states,openRole,closeRole,beginCycle,phase,release,endCycle,diagnostics,browserInfo};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFilmstripObserver,{once:true});else installFilmstripObserver();
})();
