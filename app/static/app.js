let STATE = {athletes:[], equipment:[], sessions:[], shots:[], shot_frames:[]};
const APP_VERSION = "5.0.0-dev4-x2.8.2-unified-review-consistency";
const APP_BUILD_LABEL = "X2.8.2 Unified Review · Consistency · Anchor Settle · Replay Pan · Release Proof";

const EXPECTED_CORE_BUILD = "x2.4-release-proof";
const EXPECTED_POSE_BUILD = "x2.3-release-guard";
let registeredPoseBuild = null;
let phaseTraceBuffer = [];
let phaseTraceEvents = [];
const phaseTraceEventKeys = new Set();
const PHASE_TRACE_WINDOW_MS = 45000;

function updateBuildVerifyBadge(){
  const badge=document.getElementById("buildVerifyBadge");
  const core=window.CoreEngine?.BUILD_ID||null;
  const pose=registeredPoseBuild||window.PoseEngine?.BUILD_ID||null;
  const coreOK=core===EXPECTED_CORE_BUILD, poseOK=pose===EXPECTED_POSE_BUILD;
  if(badge){
    if(coreOK&&poseOK){badge.textContent=`Core ${core} · Pose ${pose} ✓`;badge.className="status-pill good compact-status";}
    else if(!pose&&coreOK){badge.textContent=`Core ${core} ✓ · Pose loading`;badge.className="status-pill neutral compact-status";}
    else {badge.textContent=`BUILD MISMATCH · Core ${core||"missing"} · Pose ${pose||"missing"}`;badge.className="status-pill bad compact-status";}
  }
  return {ok:coreOK&&(poseOK||!pose),core,pose,coreOK,poseOK};
}
function enforceBuildHandshake(){
  const v=updateBuildVerifyBadge();
  if(!v.coreOK || (v.pose && !v.poseOK)){
    console.error("3PM build handshake failed",v);
    const auto=document.getElementById("autoMarkToggle"); if(auto)auto.checked=false;
    const save=document.getElementById("shotSaveStatus"); if(save){save.textContent="Shot Save: BUILD MISMATCH";save.className="status-pill bad compact-status";}
    return false;
  }
  return true;
}
function traceNumber(v){return Number.isFinite(Number(v))?Number(v):null;}
function appendPhaseTrace(role,m){
  if(!m)return;
  const now=Date.now();
  phaseTraceBuffer.push({
    t:now,role,phase:m.phase||null,primaryPhase:m.primaryPhase||null,activity:m.shotActivity||null,blocker:m.shotBlocker||null,detected:!!m.detected,
    armed:!!m.armed,letDown:!!m.letDown,shotEvent:m.shotEvent||null,expansionActive:!!m.expansionActive,expansionEpisodeCount:traceNumber(m.expansionEpisodeCount),releaseCandidate:!!m.releaseCandidate,releaseConfirmed:!!m.releaseConfirmed,shotComplete:!!m.shotComplete,
    holdTimeS:traceNumber(m.holdTimeS),phaseQuality:traceNumber(m.phaseQuality),releaseQuality:traceNumber(m.releaseQuality),
    phaseFaceDist:traceNumber(m.debugPhaseFaceDist),measurementFaceDist:traceNumber(m.debugMeasurementFaceDist),
    setReady:!!m.debugSetReady,phaseShootingPosture:!!m.debugPhaseShootingPosture,phaseBowExtended:!!m.debugPhaseBowExtended,wristsLow:!!m.debugWristsLow,
    drawSpeed:traceNumber(m.drawSpeed),faceHandSpeed:traceNumber(m.faceHandSpeed),elbowSpeed:traceNumber(m.elbowSpeed),bowSpeed:traceNumber(m.bowSpeed),
    trackingDrop:traceNumber(m.trackingDrop),visibilityDrop:traceNumber(m.visibilityDrop),measurementTrust:traceNumber(m.debugMeasurementTrust),
    visualMotionRatio:traceNumber(m.visualMotionRatio),visualMotionLocalGlobal:traceNumber(m.visualMotionLocalGlobal),visualMotionCorroborated:!!m.visualMotionCorroborated,
    releaseCandidateGrowth:traceNumber(m.releaseCandidateGrowth),releaseCandidateGrowthSteps:traceNumber(m.releaseCandidateGrowthSteps),
    releaseCandidateStartedEpochMs:traceNumber(m.releaseCandidateStartedEpochMs),releaseAlignedEpochMs:traceNumber(m.releaseAlignedEpochMs||m.releaseEpochMs),
    releaseRearStep:traceNumber(m.releaseRearStep),releaseFaceRearStep:traceNumber(m.releaseFaceRearStep),releaseElbowRearStep:traceNumber(m.releaseElbowRearStep),releaseRearThreshold:traceNumber(m.releaseRearThreshold),releaseSpeedThreshold:traceNumber(m.releaseSpeedThreshold),releaseFrameSpeed:traceNumber(m.releaseFrameSpeed),letDownDirectional:!!m.letDownDirectional,releaseDirectionalSteps:traceNumber(m.releaseDirectionalSteps),releaseRearAccum:traceNumber(m.releaseRearAccum),releaseElbowRearAccum:traceNumber(m.releaseElbowRearAccum),
    releasePostIndependent:!!m.releasePostIndependent,releasePostBlurSupported:!!m.releasePostBlurSupported,releasePostLetDown:!!m.releasePostLetDown,releaseInvalidated:!!m.releaseInvalidated,invalidatedReleaseEventId:traceNumber(m.invalidatedReleaseEventId),
    followThroughEnded:!!m.followThroughEnded,followThroughEndEpochMs:traceNumber(m.followThroughEndEpochMs),releaseEventId:traceNumber(m.releaseEventId),shotCompleteEventId:traceNumber(m.shotCompleteEventId),handedness:m.handedness||window.FormAnalyzer?.getCurrentAthlete?.()?.handedness||null,
    anchorSamples:traceNumber(m.anchorSampleCount),phaseTimeline:Array.isArray(m.phaseTimeline)?m.phaseTimeline.slice(-10):[]
  });
  const latest=phaseTraceBuffer.at(-1);
  const eventType=latest?.shotComplete?'shot_complete':latest?.followThroughEnded?'recovery':latest?.letDown?'let_down':latest?.releaseInvalidated?(latest?.blocker||'release_invalidated'):latest?.releaseConfirmed?'release_confirmed':(latest?.blocker==='release_candidate_expired'||latest?.blocker==='release_unvalidated'||latest?.blocker==='let_down_veto'||latest?.blocker==='release_direction_stalled')?latest.blocker:null;
  if(eventType){
    const identity=latest.releaseEventId||latest.shotCompleteEventId||latest.followThroughEndEpochMs||latest.releaseAlignedEpochMs||Math.floor(now/750);
    const eventKey=`${eventType}:${role}:${identity}`;
    if(!phaseTraceEventKeys.has(eventKey)){
      phaseTraceEventKeys.add(eventKey);
      const clip=phaseTraceBuffer.slice(-120).map(x=>({...x}));phaseTraceEvents.push({event:eventType,t:now,role,event_key:eventKey,samples:clip});
      while(phaseTraceEvents.length>32)phaseTraceEvents.shift();
      if(phaseTraceEventKeys.size>160){phaseTraceEventKeys.clear();for(const e of phaseTraceEvents)if(e.event_key)phaseTraceEventKeys.add(e.event_key);}
    }
  }
  const cutoff=now-PHASE_TRACE_WINDOW_MS;while(phaseTraceBuffer.length&&phaseTraceBuffer[0].t<cutoff)phaseTraceBuffer.shift();
}
async function evidenceManifestForTrace(sessionId){
  if(!sessionId)return [];
  const records=await evidenceDbRecordsForSession(sessionId).catch(()=>[]);
  return (records||[]).map(r=>{
    const frames=Array.isArray(r?.frames)?r.frames:[],offsets=frames.map(f=>Math.round(Number(f?.offsetMs))).filter(Number.isFinite);
    const zones={};for(const f of frames){const z=String(f?.evidenceZone||f?.zone||"legacy");zones[z]=(zones[z]||0)+1;}
    const nearest=offsets.length?offsets.reduce((best,x)=>Math.abs(x)<Math.abs(best)?x:best,offsets[0]):null;
    const anchorAcq=Number(r?.anchorEpochMs),anchorSettled=Number(r?.anchorSettledEpochMs),anchorFocus=Number(r?.anchorFocusEpochMs),releaseEpoch=Number(r?.releaseEpochMs);
    const off=v=>Number.isFinite(v)&&Number.isFinite(releaseEpoch)?Math.round(v-releaseEpoch):null;
    return {shot_id:Number(r?.shotId)||null,role:r?.role||null,frame_count:frames.length,start_offset_ms:offsets.length?Math.min(...offsets):null,end_offset_ms:offsets.length?Math.max(...offsets):null,nearest_release_offset_ms:nearest,anchor_offset_ms:off(Number.isFinite(anchorFocus)?anchorFocus:(Number.isFinite(anchorSettled)?anchorSettled:anchorAcq)),anchor_acquisition_offset_ms:off(anchorAcq),anchor_settled_offset_ms:off(anchorSettled),anchor_focus_offset_ms:off(anchorFocus),follow_through_end_epoch_ms:Number(r?.followThroughEndEpochMs)||null,capture_kind:r?.captureKind||null,zones,offsets_ms:offsets};
  }).sort((a,b)=>(a.shot_id||0)-(b.shot_id||0)||String(a.role).localeCompare(String(b.role)));
}
async function exportPhaseTrace(){
  const evidence_records=await evidenceManifestForTrace(currentSessionId);
  const payload={
    format:"3PM Archery Form Analyzer Phase Trace",version:APP_VERSION,generated_at:new Date().toISOString(),
    expected_core:EXPECTED_CORE_BUILD,expected_pose:EXPECTED_POSE_BUILD,actual_core:window.CoreEngine?.BUILD_ID||null,actual_pose:registeredPoseBuild||window.PoseEngine?.BUILD_ID||null,
    session_id:currentSessionId||null,user_agent:navigator.userAgent,athlete:window.FormAnalyzer?.getCurrentAthlete?.()||null,evidence_buffer:evidenceBufferDiagnostics(),evidence_persistence:{...evidenceEncodeStats},evidence_records,event_archive:phaseTraceEvents,trace:phaseTraceBuffer
  };
  downloadText(`3PM_phase_trace_${new Date().toISOString().replace(/[:.]/g,"-")}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
  toast(`Phase trace exported · ${phaseTraceBuffer.length} rolling samples + ${phaseTraceEvents.length} pinned event clips + ${evidence_records.length} evidence manifest${evidence_records.length===1?"":"s"}.`,"good",3200);
}
const COACH_PROFILE_KEY = "3pm-coach-profile-v1";
const EQUIPMENT_SUPPLEMENT_KEY = "3pm-equipment-supplement-v1";
const EQUIPMENT_SUPPLEMENT_FIELDS = ["setup_distance_unit","brace_height","upper_tiller","lower_tiller"];
const STABILIZER_END_WEIGHT_FIELDS = ["long_rod_end_weight","left_side_rod_end_weight","right_side_rod_end_weight"];
const UNIT_AWARE_WEIGHT_LABELS = {
  long_rod_self_weight:"Long Rod Self Weight", left_side_rod_self_weight:"Left Side Rod Self Weight", right_side_rod_self_weight:"Right Side Rod Self Weight",
  extender_weight:"Extender Weight", vbar_weight:"V-Bar Weight", damper_weight:"Damper Weight", sight_weight:"Sight Weight",
  riser_top_weight:"Top Riser Weight", riser_bottom_weight:"Bottom Riser Weight", riser_front_weight:"Front Riser Weight", riser_other_weight:"Other Riser Weight",
  other_bow_weight:"Other Bow-Attached Weight"
};
let currentSessionId = null;
let activeAthleteId = Number(localStorage.getItem("3pm-active-athlete")||0) || null;
const expandedShotEnds = new Set();
let selectedShotId = null;
let compareShotAId = null;
let compareShotBId = null;
let lastAutoReleaseAt = 0;
let autoReleaseBusy = false;
let lastAutoReleaseEpochMs = 0;
let shotEvidenceQueue = [];
let shotEvidenceTimer = null;
const shotCoordinator = window.CoreEngine?.ShotCoordinator ? new window.CoreEngine.ShotCoordinator(520,720) : null;
const liveRoleMetrics = {side:null,rear:null,overhead:null};
let livePhase = "—";
let editingAthleteId = null;
let editingEquipmentId = null;
let editingSessionId = null;
let workspaceMode = localStorage.getItem("3pm-workspace-mode") || "capture";
let analysisMediaMode = "frame";
let analysisMediaRole = localStorage.getItem("3pm-analysis-media-role") || "auto";
let layoutPreference = localStorage.getItem("3pm-layout-mode") || "auto";
let resolvedLayoutMode = "standard";
let impactZoom = 1;
let impactSelectedArrow = 0;
let impactCurrentEnd = 1;
let impactUndoStack = [];
let cameraPermissionState = "unknown";
let cameraScanBusy = false;
let auxViewsExpanded = localStorage.getItem("3pm-aux-views") !== "false";
let focusCameraRole = CAMERA_FOCUS_SAFE(localStorage.getItem("3pm-focus-role")) || "side";
let layoutResizeTimer = null;
let cameraQualityMode = localStorage.getItem("3pm-camera-quality-mode") || "auto";
let cameraAutoTuneTimer = null;
let cameraTuneLastActionAt = 0;
const cameraTuneStableGood = {side:0,rear:0,overhead:0};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const CAMERA_ROLES = ["side", "rear", "overhead"];
function CAMERA_FOCUS_SAFE(role){ return ["side","rear","overhead"].includes(role) ? role : null; }
const liveStreams = {side:null, rear:null, overhead:null};
const recorders = {side:null, rear:null, overhead:null};
const recordingChunks = {side:[], rear:[], overhead:[]};
let detectedCameras = [];
let isRecording = false;
let recordStartedAt = null;
let recordTimerHandle = null;
let cameraPermissionGranted = false;

// V1.1 review / capture state
let shotDialogMode = "edit";
let pendingShotContext = null;
let timelineMode = "live";
const liveMetricHistory = [];
const liveFrameBuffers = {side:[], rear:[], overhead:[]}; // sparse JPEG history (long shot lifecycle)
const liveBufferBusy = {side:false, rear:false, overhead:false};
// X2.1: native-frame dense evidence is intentionally separate from Pose inference and JPEG encoding.
// It retains only a short rolling release window in memory, then compresses frames after a shot is confirmed.
const liveDenseFrameBuffers = {side:[], rear:[], overhead:[]};
const denseCaptureSurfaces = {side:null,rear:null,overhead:null};
const densePumpState = Object.fromEntries(["side","rear","overhead"].map(role=>[role,{generation:0,callbackId:null,timer:null,seen:0,captured:0,dropped:0,lastSeenEpochMs:0,lastCapturedEpochMs:0,lastMediaTime:null,duplicateFrames:0,intervals:[]}]));
const DENSE_EVIDENCE_RETENTION_MS = 2600;
const DENSE_EVIDENCE_MAX_FRAMES = 92; // >3 s at 30 fps safety ceiling; retention normally limits first.
const EPOCH_PERF_OFFSET_MS = Date.now() - performance.now();
const evidenceEncodeStats={attempted:0,offscreenOk:0,canvasOk:0,dataUrlFallbackOk:0,failed:0};

function closeDenseFrame(frame){try{frame?.bitmap?.close?.();}catch{}}
function clearDenseFrameBuffer(role){const buf=liveDenseFrameBuffers[role]||[];buf.forEach(closeDenseFrame);buf.length=0;denseCaptureSurfaces[role]=null;}
function denseTargetWidth(role){
  const active=Math.max(1,CAMERA_ROLES.filter(r=>!!liveStreams[r]).length),v=$(`#${role}Video`),source=Number(v?.videoWidth)||1280;
  // One 30 fps camera: enough hand detail without keeping full-resolution raw frames in RAM.
  const budget=active===1?640:active===2?560:480;
  return Math.max(360,Math.min(source,budget));
}
function captureDenseBitmap(role,video){
  if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return null;
  const width=denseTargetWidth(role),height=Math.max(1,Math.round(width*(video.videoHeight/video.videoWidth)));
  try{
    if(typeof OffscreenCanvas!=="undefined"){
      let surface=denseCaptureSurfaces[role];
      if(!surface||surface.canvas.width!==width||surface.canvas.height!==height){
        const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext("2d",{alpha:false});surface=denseCaptureSurfaces[role]={canvas,ctx};
      }
      surface.ctx.drawImage(video,0,0,width,height);
      if(typeof surface.canvas.transferToImageBitmap==="function")return surface.canvas.transferToImageBitmap();
    }
  }catch(err){console.warn("Dense evidence bitmap capture failed",err);}
  return null;
}
function pruneDenseFrameBuffer(role,nowEpochMs=Date.now()){
  const buf=liveDenseFrameBuffers[role]||[],cutoff=nowEpochMs-DENSE_EVIDENCE_RETENTION_MS,kept=[];
  for(const f of buf){if((f.pins||0)>0||f.epochMs>=cutoff)kept.push(f);else closeDenseFrame(f);}
  while(kept.length>DENSE_EVIDENCE_MAX_FRAMES){const i=kept.findIndex(f=>(f.pins||0)<=0);if(i<0)break;closeDenseFrame(kept[i]);kept.splice(i,1);}
  liveDenseFrameBuffers[role].splice(0,liveDenseFrameBuffers[role].length,...kept);
}
function frameEpochFromVideoCallback(now,metadata){
  const display=Number(metadata?.expectedDisplayTime);
  const perfEpoch=Number.isFinite(display)?display:Number(now);
  return Math.round(EPOCH_PERF_OFFSET_MS+perfEpoch);
}
function recordDenseFrame(role,epochMs,mediaTime=null){
  const v=$(`#${role}Video`),st=densePumpState[role];if(!st||!v?.srcObject)return false;
  st.seen++;st.lastSeenEpochMs=epochMs;
  const mt=Number(mediaTime);
  if(Number.isFinite(mt)&&Number.isFinite(st.lastMediaTime)&&Math.abs(mt-st.lastMediaTime)<0.0008){st.duplicateFrames++;return false;}
  if(Number.isFinite(mt))st.lastMediaTime=mt;
  const bitmap=captureDenseBitmap(role,v);
  if(!bitmap){st.dropped++;return false;}
  if(st.lastCapturedEpochMs){const dt=epochMs-st.lastCapturedEpochMs;if(dt>0&&dt<500){st.intervals.push(dt);if(st.intervals.length>120)st.intervals.shift();}}
  st.lastCapturedEpochMs=epochMs;st.captured++;
  liveDenseFrameBuffers[role].push({epochMs,mediaTime:Number.isFinite(Number(mediaTime))?Number(mediaTime):null,bitmap,width:bitmap.width,height:bitmap.height,source:"native-video-frame"});
  pruneDenseFrameBuffer(role,epochMs);
  return true;
}
function stopNativeEvidencePump(role){
  const v=$(`#${role}Video`),st=densePumpState[role];if(!st)return;st.generation++;
  try{if(st.callbackId!==null&&v?.cancelVideoFrameCallback)v.cancelVideoFrameCallback(st.callbackId);}catch{}st.callbackId=null;
  if(st.timer){clearInterval(st.timer);st.timer=null;}
}
function startNativeEvidencePump(role){
  stopNativeEvidencePump(role);clearDenseFrameBuffer(role);
  const v=$(`#${role}Video`),st=densePumpState[role];if(!v?.srcObject||!st)return false;
  const generation=++st.generation;st.seen=0;st.captured=0;st.dropped=0;st.lastSeenEpochMs=0;st.lastCapturedEpochMs=0;st.lastMediaTime=null;st.duplicateFrames=0;st.intervals=[];
  if(typeof v.requestVideoFrameCallback==="function"){
    const loop=(now,metadata)=>{
      if(st.generation!==generation||!liveStreams[role]||v.srcObject!==liveStreams[role])return;
      // Queue the next decoded frame before copying this one. The copy is synchronous (ImageBitmap),
      // so JPEG encoding can never throttle the source-frame cadence.
      st.callbackId=v.requestVideoFrameCallback(loop);
      recordDenseFrame(role,frameEpochFromVideoCallback(now,metadata),metadata?.mediaTime);
    };
    st.callbackId=v.requestVideoFrameCallback(loop);return true;
  }
  // Compatibility fallback. It cannot guarantee every decoded frame, but still stays independent of Pose/JPEG.
  st.timer=setInterval(()=>{if(st.generation!==generation||!liveStreams[role])return;recordDenseFrame(role,Date.now(),v.currentTime);},33);return false;
}
function denseEvidenceFps(role){
  const a=(densePumpState[role]?.intervals||[]).filter(x=>x>0&&x<200);if(!a.length)return null;
  const sorted=[...a].sort((x,y)=>x-y),med=sorted[Math.floor(sorted.length/2)];return med>0?1000/med:null;
}
function evidenceBufferDiagnostics(){
  const out={},now=Date.now();for(const role of CAMERA_ROLES){const st=densePumpState[role],dense=liveDenseFrameBuffers[role]||[],sparse=liveFrameBuffers[role]||[],track=liveStreams[role]?.getVideoTracks?.()[0],settings=track?.getSettings?.()||{},last=dense.at(-1);out[role]={live:!!liveStreams[role],camera_fps:Number(settings.frameRate)||null,native_callback:typeof $(`#${role}Video`)?.requestVideoFrameCallback==="function",dense_seen:st?.seen||0,dense_captured:st?.captured||0,dense_dropped:st?.dropped||0,dense_duplicate_frames:st?.duplicateFrames||0,dense_buffer_frames:dense.length,dense_effective_fps:denseEvidenceFps(role),dense_last_epoch_ms:Number(last?.epochMs)||null,dense_last_age_ms:Number.isFinite(Number(last?.epochMs))?now-Number(last.epochMs):null,sparse_buffer_frames:sparse.length,dense_retention_ms:DENSE_EVIDENCE_RETENTION_MS};}return out;
}
function nearestDenseFrame(epochMs,role="side",maxDeltaMs=70){
  const buf=liveDenseFrameBuffers[role]||[];let best=null,delta=Infinity;for(const f of buf){const d=Math.abs(f.epochMs-epochMs);if(d<delta){delta=d;best=f;}}return best&&delta<=maxDeltaMs?{...best,denseRef:best,deltaMs:delta,evidenceSource:"native30"}:null;
}
// V5 Dev4 Full Shot Evidence Replay.
// These are REAL camera frames already captured by the rolling evidence buffer. They are
// persisted in IndexedDB only after a validated shot, so normal Live view does not fill disk.
const SHOT_EVIDENCE_DB = "3pm-form-analyzer-shot-evidence-v1";
const SHOT_EVIDENCE_STORE = "shotEvidence";
let shotEvidenceDbPromise = null;
const shotReplayState = {shotId:null,role:null,record:null,index:0,playing:false,speed:.5,zoom:1,panX:0,panY:0,timer:null,objectUrl:null,loadToken:0};
function openShotEvidenceDb(){
  if(shotEvidenceDbPromise)return shotEvidenceDbPromise;
  shotEvidenceDbPromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return;}
    const req=indexedDB.open(SHOT_EVIDENCE_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SHOT_EVIDENCE_STORE)){const st=db.createObjectStore(SHOT_EVIDENCE_STORE,{keyPath:"key"});st.createIndex("sessionId","sessionId",{unique:false});st.createIndex("shotId","shotId",{unique:false});}};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("Evidence database open failed"));
  });
  return shotEvidenceDbPromise;
}
async function evidenceDbPut(record){const db=await openShotEvidenceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(SHOT_EVIDENCE_STORE,"readwrite");tx.objectStore(SHOT_EVIDENCE_STORE).put(record);tx.oncomplete=()=>resolve(record);tx.onerror=()=>reject(tx.error||new Error("Evidence save failed"));});}
function evidenceRecordKey(sessionId,shotId,role){return `${Number(sessionId)}:${Number(shotId)}:${role}`;}
function legacyEvidenceRecordKey(shotId,role){return `${Number(shotId)}:${role}`;}
async function evidenceDbGet(shotId,role,sessionId=null){
  const db=await openShotEvidenceDb();
  const getKey=key=>new Promise((resolve,reject)=>{const req=db.transaction(SHOT_EVIDENCE_STORE,"readonly").objectStore(SHOT_EVIDENCE_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error("Evidence read failed"));});
  if(Number.isFinite(Number(sessionId))){
    const scoped=await getKey(evidenceRecordKey(sessionId,shotId,role));if(scoped)return scoped;
    const legacy=await getKey(legacyEvidenceRecordKey(shotId,role));
    return legacy&&Number(legacy.sessionId)===Number(sessionId)?legacy:null;
  }
  return getKey(legacyEvidenceRecordKey(shotId,role));
}
const evidenceWriteChains=new Map();
function mergeEvidenceFrames(a=[],b=[]){
  const rows=[...a,...b].filter(f=>f&&Number.isFinite(Number(f.epochMs))&&f.blob).sort((x,y)=>Number(x.epochMs)-Number(y.epochMs));
  const out=[];
  for(const f of rows){
    const t=Number(f.epochMs),mt=Number(f.mediaTime),prev=out.at(-1);
    const sameMedia=prev&&Number.isFinite(mt)&&Number.isFinite(Number(prev.mediaTime))&&Math.abs(mt-Number(prev.mediaTime))<0.0008;
    const nearSameEpoch=prev&&Math.abs(t-Number(prev.epochMs))<=25;
    if(sameMedia||nearSameEpoch){
      const tags=[...new Set([String(prev?.evidenceZone||''),...(Array.isArray(prev?.evidenceTags)?prev.evidenceTags:[]),String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags:[])].filter(Boolean))];
      if(String(f.source||'').includes('native30')&&!String(prev.source||'').includes('native30'))out[out.length-1]={...f,evidenceTags:tags};
      else out[out.length-1]={...prev,evidenceTags:tags};
      continue;
    }
    out.push(f);
  }
  return out;
}
async function evidenceDbMerge(record){
  const sessionId=Number(record?.sessionId),releaseEpochMs=Number(record?.releaseEpochMs);
  const key=evidenceRecordKey(sessionId,record?.shotId,record?.role||"side");
  const prev=evidenceWriteChains.get(key)||Promise.resolve();
  const run=prev.catch(()=>{}).then(async()=>{
    const found=await evidenceDbGet(record.shotId,record.role,sessionId).catch(()=>null);
    // X2.7 replay hygiene: never merge a record from an older shot that merely reused
    // the same backend shot id. Same-session recovery writes stay close to one release epoch.
    const sameCycle=found&&Number(found.sessionId)===sessionId&&(!Number.isFinite(releaseEpochMs)||!Number.isFinite(Number(found.releaseEpochMs))||Math.abs(Number(found.releaseEpochMs)-releaseEpochMs)<=2500)?found:null;
    let frames=mergeEvidenceFrames(sameCycle?.frames||[],record?.frames||[]);
    if(Number.isFinite(releaseEpochMs))frames=frames.filter(f=>Number(f.epochMs)>=releaseEpochMs-31000&&Number(f.epochMs)<=releaseEpochMs+45000);
    const merged={...(sameCycle||{}),...(record||{}),key,sessionId,frames};
    if(frames.length){merged.startEpochMs=frames[0].epochMs;merged.endEpochMs=frames.at(-1).epochMs;}
    if(sameCycle?.followThroughEndEpochMs||record?.followThroughEndEpochMs)merged.followThroughEndEpochMs=Math.max(Number(sameCycle?.followThroughEndEpochMs)||0,Number(record?.followThroughEndEpochMs)||0);
    if(sameCycle?.releaseEpochMs&&!record?.releaseEpochMs)merged.releaseEpochMs=sameCycle.releaseEpochMs;
    await evidenceDbPut(merged);
    return merged;
  });
  evidenceWriteChains.set(key,run);
  try{return await run;}finally{if(evidenceWriteChains.get(key)===run)evidenceWriteChains.delete(key);}
}
async function evidenceDbDeleteShot(shotId,sessionId=null){
  const db=await openShotEvidenceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(SHOT_EVIDENCE_STORE,"readwrite"),st=tx.objectStore(SHOT_EVIDENCE_STORE);CAMERA_ROLES.forEach(role=>{st.delete(legacyEvidenceRecordKey(shotId,role));if(Number.isFinite(Number(sessionId)))st.delete(evidenceRecordKey(sessionId,shotId,role));});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error("Evidence delete failed"));});
}
async function evidenceDbDeleteSession(sessionId,shotIds=[]){for(const id of shotIds)await evidenceDbDeleteShot(id,sessionId);return true;}
async function evidenceDbRecordsForSession(sessionId){try{const db=await openShotEvidenceDb();const rows=await new Promise((resolve,reject)=>{const idx=db.transaction(SHOT_EVIDENCE_STORE,"readonly").objectStore(SHOT_EVIDENCE_STORE).index("sessionId"),req=idx.getAll(Number(sessionId));req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error("Evidence list failed"));});const byShotRole=new Map();for(const r of rows){const k=`${Number(r.shotId)}:${r.role}`;const prev=byShotRole.get(k);if(!prev||String(r.key||"").split(":").length>String(prev.key||"").split(":").length)byShotRole.set(k,r);}return [...byShotRole.values()];}catch(err){console.warn("Full Shot Evidence database unavailable",err);return [];}}
let evidenceStoragePersistRequested=false;
async function prepareEvidenceStorage(){
  try{
    if(!evidenceStoragePersistRequested&&navigator.storage?.persist){evidenceStoragePersistRequested=true;navigator.storage.persist().catch(()=>false);}
    if(navigator.storage?.estimate){const est=await navigator.storage.estimate(),quota=Number(est.quota),usage=Number(est.usage);if(Number.isFinite(quota)&&Number.isFinite(usage)){const remaining=quota-usage;if(remaining<250*1024*1024)return {ok:false,remaining};}}
  }catch{}
  return {ok:true,remaining:null};
}
function shotEvidenceCycle(metrics,releaseEpochMs){
  const release=Number(releaseEpochMs)||Date.now(),events=(Array.isArray(metrics?.phaseTimeline)?metrics.phaseTimeline:[])
    .filter(e=>Number.isFinite(Number(e?.epochMs))&&Number(e.epochMs)<=release)
    .map(e=>({...e,epochMs:Number(e.epochMs)})).sort((a,b)=>a.epochMs-b.epochMs);
  const lastBefore=(phase,before=release)=>{for(let i=events.length-1;i>=0;i--){const e=events[i];if(e.epochMs<=before&&String(e.phase)===phase)return e.epochMs;}return null;};
  // X2.8: Anchor entry is acquisition, not the settled Anchor target used for coaching. The core
  // already enters Aim / Hold only after the visual anchor plateau is confirmed, so use
  // that transition as Anchor Focus while keeping the classifier itself completely frozen.
  const holdAt=lastBefore("Aim / Hold",release),expansionAt=lastBefore("Expansion",release);
  const anchorAt=lastBefore("Anchor",holdAt??expansionAt??release),drawAt=lastBefore("Draw",anchorAt??holdAt??expansionAt??release),setAt=lastBefore("Set",drawAt??anchorAt??holdAt??release);
  const anchorFocusAt=holdAt??anchorAt;
  const cycleStart=setAt??drawAt??anchorAt??holdAt??(release-6000);
  return {releaseEpochMs:release,setAt,drawAt,anchorAt,holdAt,expansionAt,anchorFocusAt,startEpochMs:Math.max(release-28500,cycleStart-180)};
}
function shotEvidenceStartEpoch(metrics,releaseEpochMs){return shotEvidenceCycle(metrics,releaseEpochMs).startEpochMs;}
async function evidenceFrameToBlob(frame,quality=.78){
  if(frame?.blob)return frame.blob;if(!frame?.bitmap)return null;
  evidenceEncodeStats.attempted++;
  const w=Number(frame.bitmap.width)||0,h=Number(frame.bitmap.height)||0;if(!w||!h){evidenceEncodeStats.failed++;return null;}
  // Do not discard a good native frame just because JPEG encoding is busy. X2.4 used a
  // 300 ms hard timeout here; on a loaded Mac that could turn a healthy 30 fps ring into
  // only the few sparse JPEG frames that were already encoded. The rolling buffer itself
  // is untouched — this is only the post-shot persistence encoder.
  try{
    if(typeof OffscreenCanvas!=="undefined"){
      const c=new OffscreenCanvas(w,h),ctx=c.getContext("2d",{alpha:false});ctx.drawImage(frame.bitmap,0,0,w,h);
      if(typeof c.convertToBlob==="function"){
        const b=await c.convertToBlob({type:"image/jpeg",quality});if(b){evidenceEncodeStats.offscreenOk++;return b;}
      }
    }
  }catch(err){console.warn("Native evidence OffscreenCanvas encode fallback",err);}
  try{
    const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:false});ctx.drawImage(frame.bitmap,0,0,w,h);
    return await new Promise(resolve=>{
      let done=false;
      const finish=b=>{
        if(done)return;
        if(b){done=true;evidenceEncodeStats.canvasOk++;resolve(b);return;}
        try{const fallback=dataUrlToBlob(c.toDataURL("image/jpeg",quality));done=true;if(fallback)evidenceEncodeStats.dataUrlFallbackOk++;else evidenceEncodeStats.failed++;resolve(fallback||null);}catch{done=true;evidenceEncodeStats.failed++;resolve(null);}
      };
      try{
        if(typeof c.toBlob==="function"){
          c.toBlob(finish,"image/jpeg",quality);
          // Persistence happens after Shot commit, so reliability beats a 300 ms deadline.
          setTimeout(()=>finish(null),2200);
        }else finish(null);
      }catch{finish(null);}
    });
  }catch{evidenceEncodeStats.failed++;return null;}
}
async function evidenceFrameToDataUrl(frame,quality=.84){
  if(frame?.dataUrl)return frame.dataUrl;if(frame?.blob)return blobToDataUrl(frame.blob);if(!frame?.bitmap)return null;
  try{const c=document.createElement("canvas");c.width=frame.bitmap.width;c.height=frame.bitmap.height;c.getContext("2d",{alpha:false}).drawImage(frame.bitmap,0,0);return c.toDataURL("image/jpeg",quality);}catch{return null;}
}
function nearestEvidenceFrame(epochMs,role="side",maxDeltaMs=125){
  const dense=nearestDenseFrame(epochMs,role,Math.min(maxDeltaMs,80)),sparse=nearestBufferedFrame(epochMs,role,maxDeltaMs);if(dense&&(!sparse||dense.deltaMs<=sparse.deltaMs))return dense;return sparse?{...sparse,evidenceSource:"sparse-jpeg"}:null;
}
const REPLAY_RELEASE_FOCUS_PRE_MS=650;
const REPLAY_RELEASE_FOCUS_POST_MS=650;
const REPLAY_ANCHOR_FOCUS_PRE_MS=750;
const REPLAY_ANCHOR_FOCUS_POST_MS=450;
function evidenceUniqueByEpoch(frames=[]){
  const out=[];const tags=f=>[String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
  for(const f of [...frames].sort((a,b)=>Number(a.epochMs)-Number(b.epochMs))){
    const t=Number(f?.epochMs),mt=Number(f?.mediaTime);if(!Number.isFinite(t))continue;const prev=out.at(-1),pmt=Number(prev?.mediaTime);
    const sameMedia=prev&&Number.isFinite(mt)&&Number.isFinite(pmt)&&Math.abs(mt-pmt)<0.0008,sameEpoch=prev&&Math.abs(t-Number(prev.epochMs))<=8;
    if(prev&&(sameMedia||sameEpoch)){prev.evidenceTags=[...new Set([...tags(prev),...tags(f)])];if(!prev.evidenceZone&&f.evidenceZone)prev.evidenceZone=f.evidenceZone;continue;}
    out.push({...f,evidenceTags:[...new Set(tags(f))]});
  }return out;
}
function sampleEvidenceByGap(frames=[],gapMs=150){
  const a=[...frames].sort((x,y)=>Number(x.epochMs)-Number(y.epochMs));if(a.length<=2)return a;
  const out=[a[0]];let last=Number(a[0].epochMs);
  for(let i=1;i<a.length-1;i++){const t=Number(a[i].epochMs);if(t-last>=gapMs){out.push(a[i]);last=t;}}
  if(Number(a.at(-1).epochMs)!==Number(out.at(-1).epochMs))out.push(a.at(-1));
  return out;
}
function nearestEvidenceFromList(frames,targetEpochMs,maxDeltaMs=220){
  let best=null,delta=Infinity;for(const f of frames||[]){const d=Math.abs(Number(f?.epochMs)-Number(targetEpochMs));if(Number.isFinite(d)&&d<delta){best=f;delta=d;}}
  return best&&delta<=maxDeltaMs?best:null;
}
/** Phase-weighted Replay plan. It does NOT alter the Native30 rolling buffer.
 * Draw/Anchor remain readable at lower density; Release gets every available native
 * frame; Follow-through is summarized and Recovery contributes one explicit end frame.
 */
function replayEvidenceFramePlan(sparseFrames=[],denseFrames=[],startEpochMs,endEpochMs,releaseEpochMs,{finalIsRecovery=false,anchorEpochMs=null,phaseEpochs={}}={}){
  const start=Number(startEpochMs),end=Number(endEpochMs),release=Number(releaseEpochMs),anchor=Number(anchorEpochMs);
  if(![start,end,release].every(Number.isFinite)||end<start)return [];
  const sparse=(sparseFrames||[]).filter(f=>Number(f?.epochMs)>=start&&Number(f?.epochMs)<=end).sort((a,b)=>a.epochMs-b.epochMs);
  const dense=(denseFrames||[]).filter(f=>Number(f?.epochMs)>=start&&Number(f?.epochMs)<=end).sort((a,b)=>a.epochMs-b.epochMs);
  const focusStart=Math.max(start,release-REPLAY_RELEASE_FOCUS_PRE_MS),focusEnd=Math.min(end,release+REPLAY_RELEASE_FOCUS_POST_MS);
  const selected=[],all=evidenceUniqueByEpoch([...sparse,...dense]);
  const pin=(epoch,zone,maxDelta=240)=>{if(!Number.isFinite(Number(epoch)))return;const best=nearestEvidenceFromList(all,Number(epoch),maxDelta);if(best)selected.push({...best,evidenceZone:zone,evidenceTags:[zone]});};
  // Pin the real frame nearest each observed phase transition before density sampling. Short
  // Anchor/Hold phases are therefore not erased merely because Release is only 50–150 ms later.
  pin(phaseEpochs?.draw,'draw-pin',260);pin(phaseEpochs?.anchor,'anchor-pin',260);pin(phaseEpochs?.hold,'hold-pin',220);pin(phaseEpochs?.expansion,'expansion-pin',180);
  const anchorValid=Number.isFinite(anchor)&&anchor>=start&&anchor<focusStart;
  if(anchorValid){
    const anchorStart=Math.max(start,anchor-REPLAY_ANCHOR_FOCUS_PRE_MS),anchorEnd=Math.min(focusStart-1,anchor+REPLAY_ANCHOR_FOCUS_POST_MS);
    const before=sparse.filter(f=>Number(f.epochMs)<anchorStart),beforeSpan=Math.max(0,anchorStart-start),beforeGap=beforeSpan>6500?220:150;
    selected.push(...sampleEvidenceByGap(before,beforeGap).map(f=>({...f,evidenceZone:"draw"})));
    let anchorPool=evidenceUniqueByEpoch([...sparse,...dense].filter(f=>Number(f.epochMs)>=anchorStart&&Number(f.epochMs)<=anchorEnd));
    if(anchorPool.length>18)anchorPool=sampleEvidenceByGap(anchorPool,55);
    selected.push(...anchorPool.map(f=>({...f,evidenceZone:"anchor-focus"})));
    const bridge=sparse.filter(f=>Number(f.epochMs)>anchorEnd&&Number(f.epochMs)<focusStart);
    selected.push(...sampleEvidenceByGap(bridge,180).map(f=>({...f,evidenceZone:"aim-hold"})));
  }else{
    const pre=sparse.filter(f=>Number(f.epochMs)<focusStart),preSpan=Math.max(0,focusStart-start),preGap=preSpan>6500?220:150;
    selected.push(...sampleEvidenceByGap(pre,preGap).map(f=>({...f,evidenceZone:"draw-anchor"})));
  }
  let focus=dense.filter(f=>Number(f.epochMs)>=focusStart&&Number(f.epochMs)<=focusEnd);
  if(focus.length<3)focus=sparse.filter(f=>Number(f.epochMs)>=focusStart&&Number(f.epochMs)<=focusEnd);
  selected.push(...focus.map(f=>({...f,evidenceZone:"release-focus"})));
  // After the release-focus micro-sequence, keep only coach-useful follow-through checkpoints.
  // This prevents a long natural bow-arm lowering/recovery from dominating Replay.
  const postPool=evidenceUniqueByEpoch([...sparse,...dense].filter(f=>Number(f.epochMs)>focusEnd&&Number(f.epochMs)<=end));
  const endOffset=end-release,targets=[750,1000,1350,1800];
  if(endOffset>2450)targets.push(Math.round((1800+endOffset)/2));
  targets.push(endOffset);
  const used=new Set();
  for(const off of targets){
    const target=release+off;if(target<=focusEnd||target<start||target>end)continue;
    const maxDelta=off===endOffset?240:220,best=nearestEvidenceFromList(postPool,target,maxDelta);if(!best)continue;
    const k=Math.round(Number(best.epochMs));if(used.has(k))continue;used.add(k);
    selected.push({...best,evidenceZone:(off===endOffset&&finalIsRecovery)?"recovery-end":"follow-summary"});
  }
  return evidenceUniqueByEpoch(selected);
}
async function bufferedEvidenceFrames(role,startEpochMs,endEpochMs,releaseEpochMs,options={}){
  const sparse=(liveFrameBuffers[role]||[]).filter(f=>f?.blob&&f.epochMs>=startEpochMs&&f.epochMs<=endEpochMs)
    .map(f=>({epochMs:f.epochMs,offsetMs:f.epochMs-releaseEpochMs,mediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,blob:f.blob,source:"sparse-jpeg"}));
  const dense=(liveDenseFrameBuffers[role]||[]).filter(f=>f?.bitmap&&f.epochMs>=startEpochMs&&f.epochMs<=endEpochMs)
    .map(f=>({...f,denseRef:f,offsetMs:f.epochMs-releaseEpochMs,source:"native30"}));
  const planned=replayEvidenceFramePlan(sparse,dense,startEpochMs,endEpochMs,releaseEpochMs,options);
  const refs=[...new Set(planned.map(f=>f.denseRef).filter(Boolean))];refs.forEach(f=>f.pins=(f.pins||0)+1);
  const out=[];
  try{
    for(let i=0;i<planned.length;i+=4){
      const batch=await Promise.all(planned.slice(i,i+4).map(async f=>{
        if(f.blob)return {epochMs:f.epochMs,offsetMs:f.epochMs-releaseEpochMs,mediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,blob:f.blob,source:f.source||"sparse-jpeg",evidenceZone:f.evidenceZone||null,evidenceTags:Array.isArray(f.evidenceTags)?[...f.evidenceTags]:[]};
        const blob=await evidenceFrameToBlob(f,.76);
        return blob?{epochMs:f.epochMs,offsetMs:f.epochMs-releaseEpochMs,mediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,blob,source:"native30",evidenceZone:f.evidenceZone||null,evidenceTags:Array.isArray(f.evidenceTags)?[...f.evidenceTags]:[]}:null;
      }));
      out.push(...batch.filter(Boolean));
    }
  }finally{refs.forEach(f=>f.pins=Math.max(0,(f.pins||1)-1));pruneDenseFrameBuffer(role,Date.now());}
  return evidenceUniqueByEpoch(out);
}
async function persistFullShotEvidence(shotId,sessionId,eventEpochMs,roles,metrics,endEpochMs=null,options={}){
  const storage=await prepareEvidenceStorage();if(!storage.ok){toast("Shot saved, but Full Shot Evidence was skipped because local browser storage is nearly full. Archive older Sessions to an external drive.","warn",6200);return false;}
  const release=Number(eventEpochMs)||Date.now(),cycle=shotEvidenceCycle(metrics,release),start=cycle.startEpochMs,end=Number(endEpochMs)||release+820,planOptions={...options,anchorEpochMs:cycle.anchorFocusAt,phaseEpochs:{draw:cycle.drawAt,anchor:cycle.anchorAt,hold:cycle.holdAt,expansion:cycle.expansionAt}};
  let savedRoles=0,totalFrames=0;
  for(const role of roles||[]){
    const frames=await bufferedEvidenceFrames(role,start,end,release,planOptions);if(frames.length<3)continue;
    const record={key:evidenceRecordKey(sessionId,shotId,role),shotId:Number(shotId),sessionId:Number(sessionId),role,releaseEpochMs:release,anchorEpochMs:Number(cycle.anchorAt)||null,anchorSettledEpochMs:Number(cycle.holdAt)||null,anchorFocusEpochMs:Number(cycle.anchorFocusAt)||null,startEpochMs:frames[0].epochMs,endEpochMs:frames.at(-1).epochMs,createdAt:new Date().toISOString(),captureKind:"phase-weighted-anchor-settle-focus+release-focus+follow-summary",frames};
    try{const merged=await evidenceDbMerge(record);if(markCalibrationEvidenceIfComplete(shotId,merged))renderBaselineCalibration();savedRoles++;totalFrames+=merged?.frames?.length||frames.length;}catch(err){console.warn("Full shot evidence save failed",role,err);}
  }
  if(savedRoles){
    if(Number(selectedShotId)===Number(shotId))loadShotReplay(selectedShot(),reviewRole==='multi'?'side':reviewRole);
    // Backfill the coach strip from the persisted real-frame record. This is a safety net:
    // if live keyframe JPEG encoding was busy, we still derive the summary from evidence
    // that is already safely stored instead of leaving the coach with 3–5 thumbnails.
    setTimeout(()=>{for(const role of roles||[])backfillCoachKeyframesFromEvidence(shotId,role,metrics,release).catch(err=>console.warn("Coach evidence backfill failed",err));},120);
    toast(`Full Shot Evidence saved · ${totalFrames} real frame${totalFrames===1?'':'s'} · ${savedRoles} view${savedRoles===1?'':'s'}.`,"good",2100);return true;
  }
  return false;
}
const finalizedFollowEvidenceShots=new Set();
function scheduleFullShotEvidence(shotId,sessionId,eventEpochMs,roles,metrics){
  // X2.7 keeps the X2.6 release-focused snapshot around +0.82 s from the actual release
  // epoch instead of waiting a fixed 1.38 s after backend/network work finishes.
  // This protects the pre-release native frames while keeping the rolling buffer unchanged.
  const release=Number(eventEpochMs)||Date.now(),wait=Math.max(80,Math.min(900,(release+820)-Date.now()));
  setTimeout(async()=>{
    const id=Number(shotId);if(finalizedFollowEvidenceShots.has(id))return;
    const existing=await evidenceDbGet(id,(roles||[])[0]||'side',sessionId).catch(()=>null);
    if(existing?.followThroughEndEpochMs){finalizedFollowEvidenceShots.add(id);return;}
    await persistFullShotEvidence(id,sessionId,eventEpochMs,roles,metrics);
  },wait);
}
const pendingFollowEvidence=new Map(),earlyRecoveryEvents=new Map();
function compactTrajectoryMetric(m){
  if(!m)return null;return{epochMs:Number(m.epochMs)||Date.now(),phase:m.phase||null,phaseQuality:Number(m.phaseQuality??m.quality??0),releaseQuality:Number(m.releaseQuality??m.phaseQuality??0),anchorHandRelX:Number(m.anchorHandRelX),anchorHandRelY:Number(m.anchorHandRelY),drawElbowRelX:Number(m.drawElbowRelX),drawElbowRelY:Number(m.drawElbowRelY),bowWristRelX:Number(m.bowWristRelX),bowWristRelY:Number(m.bowWristRelY),headRelX:Number(m.headRelX),headRelY:Number(m.headRelY)};
}
function appendPendingTrajectory(role,metrics){
  const epoch=Number(metrics?.epochMs)||Date.now();
  for(const ctx of pendingFollowEvidence.values()){
    if(ctx.primaryRole!==role||epoch<ctx.releaseEpochMs-400)continue;
    const row=compactTrajectoryMetric(metrics);if(!row)continue;
    const arr=ctx.trajectoryRows||(ctx.trajectoryRows=[]),last=arr.at(-1);if(last&&Math.abs(last.epochMs-row.epochMs)<2)continue;
    arr.push({epochMs:row.epochMs,metrics:row});
    // Keep enough for unusually long follow-throughs without unbounded growth (~20 s at 30 Hz pose max).
    while(arr.length>650)arr.shift();
  }
}
async function extendFullShotEvidenceToRecovery(ctx,endEpochMs){
  if(!ctx||!Number.isFinite(Number(endEpochMs)))return false;
  let wrote=false;
  for(const role of ctx.roles||[]){
    let rec=await evidenceDbGet(ctx.shotId,role,ctx.sessionId);
    if(!rec){wrote=(await persistFullShotEvidence(ctx.shotId,ctx.sessionId,ctx.releaseEpochMs,[role],ctx.metrics,endEpochMs,{finalIsRecovery:true}))||wrote;rec=await evidenceDbGet(ctx.shotId,role,ctx.sessionId);}
    if(!rec)continue;
    const start=Math.max(Number(rec.endEpochMs||ctx.releaseEpochMs)+1,ctx.releaseEpochMs+650);
    if(endEpochMs>start){
      const extra=await bufferedEvidenceFrames(role,start,endEpochMs,ctx.releaseEpochMs,{finalIsRecovery:true});if(extra.length){
        const all=[...(rec.frames||[]),...extra].sort((x,y)=>x.epochMs-y.epochMs),unique=[];let last=-Infinity;for(const f of all){if(f.epochMs-last<25)continue;unique.push(f);last=f.epochMs;}
        rec={...rec,frames:unique,endEpochMs:unique.at(-1)?.epochMs||endEpochMs,followThroughEndEpochMs:endEpochMs,captureKind:"phase-weighted-anchor-settle-focus+release-focus+follow-summary+recovery-end"};rec=await evidenceDbMerge(rec);if(markCalibrationEvidenceIfComplete(ctx.shotId,rec))renderBaselineCalibration();wrote=true;
      }else if(!rec.followThroughEndEpochMs){rec={...rec,followThroughEndEpochMs:endEpochMs,captureKind:"phase-weighted-anchor-settle-focus+release-focus+follow-summary+recovery-end"};rec=await evidenceDbMerge(rec);if(markCalibrationEvidenceIfComplete(ctx.shotId,rec))renderBaselineCalibration();wrote=true;}
    }else if(!rec.followThroughEndEpochMs){rec={...rec,followThroughEndEpochMs:endEpochMs,captureKind:"phase-weighted-anchor-settle-focus+release-focus+follow-summary+recovery-end"};rec=await evidenceDbMerge(rec);if(markCalibrationEvidenceIfComplete(ctx.shotId,rec))renderBaselineCalibration();wrote=true;}
  }
  const analysis=buildHandReleaseAnalyzer(ctx.primaryRole||'side',ctx.releaseEpochMs,endEpochMs,ctx.trajectoryRows||null);if(analysis){const adv=loadAdvancedShotMetrics(ctx.shotId)||{};try{localStorage.setItem(advancedShotKey(ctx.shotId),JSON.stringify({...adv,hand_release_analyzer:analysis,follow_through_end_epoch_ms:endEpochMs}));}catch{}}
  // Recovery is now in the authoritative evidence record; use it to fill any missing slots in the 15-frame coach summary.
  for(const role of ctx.roles||[])await backfillCoachKeyframesFromEvidence(ctx.shotId,role,ctx.metrics,ctx.releaseEpochMs).catch(err=>console.warn('Recovery keyframe backfill failed',role,err));
  finalizedFollowEvidenceShots.add(Number(ctx.shotId));
  if(Number(selectedShotId)===Number(ctx.shotId)){loadShotReplay(selectedShot(),reviewRole==='multi'?'side':reviewRole);renderAnalyze();}
  return wrote||!!analysis;
}
function registerPendingFollowEvidence(shotId,sessionId,metrics,roles){
  const id=Number(metrics?.releaseEventId)||0,releaseEpochMs=Number(metrics?.releaseEpochMs)||Date.now(),primaryRole=metrics?.role||'side';
  const seed=window.PoseEngine?.getMetricsWindow?.(primaryRole,releaseEpochMs-400,Date.now())||[];
  const ctx={shotId:Number(shotId),sessionId:Number(sessionId),releaseEpochMs,releaseEventId:id,roles:[...(roles||[])],metrics:{...metrics},primaryRole,trajectoryRows:seed.map(x=>({epochMs:Number(x.epochMs),metrics:compactTrajectoryMetric(x.metrics)})).filter(x=>x.metrics)};
  const key=id||ctx.releaseEpochMs;pendingFollowEvidence.set(key,ctx);
  let earlyKey=null,early=null;if(id&&earlyRecoveryEvents.has(id)){earlyKey=id;early=earlyRecoveryEvents.get(id);}
  if(!early){for(const [k,v] of earlyRecoveryEvents){if(Math.abs(Number(v?.releaseEpochMs)-releaseEpochMs)<900){earlyKey=k;early=v;break;}}}
  if(early){earlyRecoveryEvents.delete(earlyKey);pendingFollowEvidence.delete(key);extendFullShotEvidenceToRecovery(ctx,Number(early.endEpochMs));}
}
function finalizeFollowEvidenceFromMetrics(metrics){
  if(!metrics?.followThroughEnded)return;const id=Number(metrics.releaseEventId)||0,releaseEpochMs=Number(metrics.releaseEpochMs)||0,end=Number(metrics.followThroughEndEpochMs)||Number(metrics.epochMs)||Date.now();let key=id,ctx=id?pendingFollowEvidence.get(id):null;
  if(!ctx){for(const [k,v] of pendingFollowEvidence){if(releaseEpochMs&&Math.abs(Number(v.releaseEpochMs)-releaseEpochMs)<900){key=k;ctx=v;break;}}}
  if(ctx){pendingFollowEvidence.delete(key);appendPendingTrajectory(ctx.primaryRole,metrics);extendFullShotEvidenceToRecovery(ctx,end);}else{const earlyKey=id||releaseEpochMs||end;earlyRecoveryEvents.set(earlyKey,{endEpochMs:end,releaseEpochMs});if(earlyRecoveryEvents.size>40){const first=earlyRecoveryEvents.keys().next().value;earlyRecoveryEvents.delete(first);}}
}
function stopShotReplay(){shotReplayState.playing=false;if(shotReplayState.timer){clearTimeout(shotReplayState.timer);shotReplayState.timer=null;}const b=$("#replayPlayBtn");if(b)b.textContent="▶ Play";}
function clearShotReplayObjectUrl(){if(shotReplayState.objectUrl){URL.revokeObjectURL(shotReplayState.objectUrl);shotReplayState.objectUrl=null;}}
function replayPhaseForOffset(shot,offsetMs){const adv=shot?loadAdvancedShotMetrics(shot.id):null,tl=adv?.phase_timeline||adv?.phaseTimeline||[];if(!Array.isArray(tl)||!tl.length)return null;const rel=Number(adv?.release_epoch_ms||adv?.releaseEpochMs)||null;if(!rel)return null;let best=null;for(const e of tl){const off=Number(e.epochMs)-rel;if(off<=offsetMs)best=e;else break;}return best?.phase||null;}
function expectedReleaseEpochForShot(shot){const adv=shot?loadAdvancedShotMetrics(shot.id):null;return Number(adv?.release_epoch_ms||adv?.releaseEpochMs)||null;}
function replayAnchorEpochForShot(shot,r=shotReplayState.record){
  // X2.8 Anchor button means SETTLED Anchor. Core transitions to Aim / Hold only after
  // the Anchor plateau is confirmed; Anchor phase entry itself is still draw-to-load/acquisition.
  const storedFocus=Number(r?.anchorFocusEpochMs),storedSettled=Number(r?.anchorSettledEpochMs);
  if(Number.isFinite(storedFocus)&&storedFocus>0)return storedFocus;
  if(Number.isFinite(storedSettled)&&storedSettled>0)return storedSettled;
  const adv=shot?loadAdvancedShotMetrics(shot.id):null,release=Number(adv?.release_epoch_ms||adv?.releaseEpochMs||r?.releaseEpochMs),tl=adv?.phase_timeline||adv?.phaseTimeline||[];if(!Number.isFinite(release)||!Array.isArray(tl))return null;
  const events=tl.filter(e=>Number.isFinite(Number(e?.epochMs))&&Number(e.epochMs)<=release).sort((a,b)=>Number(a.epochMs)-Number(b.epochMs));
  for(let i=events.length-1;i>=0;i--)if(String(events[i].phase)==="Aim / Hold")return Number(events[i].epochMs);
  const storedAcquisition=Number(r?.anchorEpochMs);
  if(Number.isFinite(storedAcquisition)&&storedAcquisition>0&&Number.isFinite(Number(adv?.anchor_settle_s)))return storedAcquisition+Math.max(0,Number(adv.anchor_settle_s))*1000;
  if(Number.isFinite(storedAcquisition)&&storedAcquisition>0)return storedAcquisition;
  for(let i=events.length-1;i>=0;i--)if(String(events[i].phase)==="Anchor")return Number(events[i].epochMs);return null;
}
function replayAnchorOffsetForShot(shot,r=shotReplayState.record){const a=replayAnchorEpochForShot(shot,r),rel=Number(r?.releaseEpochMs)||expectedReleaseEpochForShot(shot);return Number.isFinite(a)&&Number.isFinite(rel)?a-rel:null;}
function replayPanBounds(){
  const stage=$("#shotReplayStage"),z=Math.max(.75,Math.min(3,Number(shotReplayState.zoom)||1));
  if(!stage||z<=1.001)return{x:0,y:0};
  const sw=stage.clientWidth||0,sh=stage.clientHeight||0;if(!(sw>0&&sh>0))return{x:0,y:0};
  // The replay <img> itself fills the stage and uses object-fit:contain, so the safe
  // translated envelope is the scaled stage box. This intentionally allows vertical
  // repositioning even when the source frame is letterboxed inside the stage.
  return{x:Math.max(0,sw*(z-1)/2),y:Math.max(0,sh*(z-1)/2)};
}
function applyReplayZoom(){
  const img=$("#shotReplayImage"),label=$("#replayZoomResetBtn"),z=Math.max(.75,Math.min(3,Number(shotReplayState.zoom)||1));
  if(z<=1.001){shotReplayState.panX=0;shotReplayState.panY=0;}
  const bounds=replayPanBounds();shotReplayState.panX=Math.max(-bounds.x,Math.min(bounds.x,Number(shotReplayState.panX)||0));shotReplayState.panY=Math.max(-bounds.y,Math.min(bounds.y,Number(shotReplayState.panY)||0));
  if(img){img.style.transform=`translate3d(${Math.round(shotReplayState.panX)}px,${Math.round(shotReplayState.panY)}px,0) scale(${z})`;img.classList.toggle("zoomed",z>1.001);}
  if(label)label.textContent=`${Math.round(z*100)}%`;
  ["replayPanLeftBtn","replayPanUpBtn","replayPanDownBtn","replayPanRightBtn"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=!shotReplayState.record?.frames?.length||z<=1.001;});
}
function setReplayZoom(next){shotReplayState.zoom=Math.max(.75,Math.min(3,Math.round(Number(next)*100)/100));if(shotReplayState.zoom<=1.001){shotReplayState.panX=0;shotReplayState.panY=0;}applyReplayZoom();}
function panShotReplay(dx=0,dy=0){
  if(!shotReplayState.record?.frames?.length||Number(shotReplayState.zoom)<=1.001)return false;
  const stage=$("#shotReplayStage"),step=Math.max(36,Math.round(Math.min(stage?.clientWidth||520,stage?.clientHeight||320)*.16));
  shotReplayState.panX=(Number(shotReplayState.panX)||0)+Number(dx||0)*step;shotReplayState.panY=(Number(shotReplayState.panY)||0)+Number(dy||0)*step;applyReplayZoom();return true;
}
function renderShotReplayFrame(){
  const panel=$("#shotReplayPanel"),img=$("#shotReplayImage"),empty=$("#shotReplayEmpty"),slider=$("#shotReplaySlider"),meta=$("#shotReplayMeta"),shot=selectedShot(),r=shotReplayState.record;
  if(!panel||!img||!slider)return;
  if(!r?.frames?.length){panel.classList.add("replay-empty");img.removeAttribute("src");if(empty)empty.textContent=shot?`No Full Shot Evidence for ${roleTitle(shotReplayState.role||reviewRole)} in this shot.`:"Select a shot.";slider.disabled=true;if(meta)meta.textContent="—";applyReplayZoom();return;}
  panel.classList.remove("replay-empty");slider.disabled=false;slider.min="0";slider.max=String(Math.max(0,r.frames.length-1));slider.step="1";shotReplayState.index=Math.max(0,Math.min(r.frames.length-1,Number(shotReplayState.index)||0));slider.value=String(shotReplayState.index);
  const f=r.frames[shotReplayState.index];clearShotReplayObjectUrl();shotReplayState.objectUrl=URL.createObjectURL(f.blob);img.src=shotReplayState.objectUrl;applyReplayZoom();
  const phase=replayPhaseForOffset(shot,Number(f.offsetMs)||0),off=Number(f.offsetMs)||0,delta=shotReplayState.index?f.epochMs-r.frames[shotReplayState.index-1].epochMs:null;
  const zoneLabel=f.evidenceZone==="release-focus"?"Release Focus":f.evidenceZone==="anchor-focus"?"Anchor Focus":f.evidenceZone==="draw"?"Draw":f.evidenceZone==="aim-hold"?"Aim / Hold":f.evidenceZone==="draw-anchor"?"Draw / Anchor":f.evidenceZone==="follow-summary"?"Follow-through":f.evidenceZone==="recovery-end"?"End Shot":null;
  if(meta)meta.textContent=`Frame ${shotReplayState.index+1}/${r.frames.length} · ${off===0?'Release':`${off>0?'+':''}${(off/1000).toFixed(3)} s`} · real camera frame${zoneLabel?` · ${zoneLabel}`:''}${phase?` · ${phase}`:''}${Number.isFinite(delta)?` · Δ${Math.round(delta)} ms`:''}`;
  if(empty)empty.textContent="";updateReviewControls();
}
async function loadShotReplay(shot,role){
  stopShotReplay();const token=++shotReplayState.loadToken;clearShotReplayObjectUrl();shotReplayState.shotId=shot?.id||null;shotReplayState.role=CAMERA_ROLES.includes(role)?role:'side';shotReplayState.record=null;shotReplayState.index=0;shotReplayState.zoom=1;shotReplayState.panX=0;shotReplayState.panY=0;
  const panel=$("#shotReplayPanel");if(panel)panel.classList.remove("hidden");
  if(!shot){renderShotReplayFrame();return;}
  try{
    const sessionId=Number(shot?.session_id||currentSessionId)||null;let rec=await evidenceDbGet(shot.id,shotReplayState.role,sessionId);if(token!==shotReplayState.loadToken)return;
    const expectedRelease=expectedReleaseEpochForShot(shot);
    if(rec&&Number.isFinite(expectedRelease)&&Number.isFinite(Number(rec.releaseEpochMs))&&Math.abs(Number(rec.releaseEpochMs)-expectedRelease)>5000){console.warn("Ignoring stale replay evidence from another shot cycle",{shotId:shot.id,sessionId,storedRelease:rec.releaseEpochMs,expectedRelease});rec=null;}
    if(rec?.frames?.length&&Number.isFinite(Number(rec.releaseEpochMs))){const rel=Number(rec.releaseEpochMs);rec={...rec,frames:rec.frames.filter(f=>Number(f.epochMs)>=rel-31000&&Number(f.epochMs)<=rel+45000)};}
    shotReplayState.record=rec;
    if(rec?.frames?.length){
      let nearest=0,best=Infinity;rec.frames.forEach((f,i)=>{const d=Math.abs(Number(f.offsetMs)||0);if(d<best){best=d;nearest=i;}});
      shotReplayState.index=best<=180?nearest:0;
    }
    renderShotReplayFrame();
  }
  catch(err){console.warn(err);if(token===shotReplayState.loadToken)renderShotReplayFrame();}
}
function stepShotReplay(dir){const r=shotReplayState.record;if(!r?.frames?.length)return false;stopShotReplay();shotReplayState.index=Math.max(0,Math.min(r.frames.length-1,shotReplayState.index+dir));renderShotReplayFrame();return true;}
function jumpReplayRelease(){
  const r=shotReplayState.record;if(!r?.frames?.length)return false;
  let idx=0,best=Infinity;r.frames.forEach((f,i)=>{const d=Math.abs(Number(f.offsetMs)||0);if(d<best){best=d;idx=i;}});
  if(best>180){toast(`Full Shot Evidence is missing the Release window (nearest real frame is ${(best/1000).toFixed(2)} s away).`,"warn",4200);return false;}
  stopShotReplay();shotReplayState.index=idx;renderShotReplayFrame();return true;
}
function jumpReplayAnchor(){
  const r=shotReplayState.record,shot=selectedShot();if(!r?.frames?.length||!shot)return false;const target=replayAnchorOffsetForShot(shot,r);
  if(!Number.isFinite(target)){toast("Settled Anchor timing is not available for this shot.","warn",3000);return false;}
  let idx=0,best=Infinity;r.frames.forEach((f,i)=>{const d=Math.abs((Number(f.offsetMs)||0)-target);if(d<best){best=d;idx=i;}});
  if(best>320){toast(`Full Shot Evidence is missing the settled Anchor window (nearest real frame is ${Math.round(best)} ms away).`,"warn",3600);return false;}
  stopShotReplay();shotReplayState.index=idx;renderShotReplayFrame();return true;
}
function replayDelayForNext(){const r=shotReplayState.record,i=shotReplayState.index;if(!r?.frames?.length||i>=r.frames.length-1)return null;const real=Math.max(18,Math.min(450,r.frames[i+1].epochMs-r.frames[i].epochMs));return real/Math.max(.1,shotReplayState.speed||.5);}
function scheduleReplayTick(){if(!shotReplayState.playing)return;const delay=replayDelayForNext();if(delay===null){stopShotReplay();return;}shotReplayState.timer=setTimeout(()=>{if(!shotReplayState.playing)return;shotReplayState.index++;renderShotReplayFrame();scheduleReplayTick();},delay);}
function toggleShotReplay(){if(!shotReplayState.record?.frames?.length)return;if(shotReplayState.playing){stopShotReplay();return;}shotReplayState.playing=true;const b=$("#replayPlayBtn");if(b)b.textContent="❚❚ Pause";scheduleReplayTick();}
let reviewRole = localStorage.getItem("3pm-review-role") || "side";
let liveSessionStartedAt = Date.now();
let liveFrameTimer = null;
const frameGenerationInFlight = new Set();
const LEGACY_VIDEO_KEYFRAME_OFFSETS = [
  {offset:-1500,label:"-1.5s"},
  {offset:-900,label:"-0.9s"},
  {offset:-500,label:"-0.5s"},
  {offset:-200,label:"-0.2s"},
  {offset:0,label:"Release"},
  {offset:100,label:"+0.1s"},
  {offset:200,label:"+0.2s"},
  {offset:500,label:"+0.5s"},
  {offset:900,label:"+0.9s"},
  {offset:1400,label:"+1.4s"},
];

async function api(url, options={}) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function fmt(v, suffix="") { return (v===null || v===undefined || v==="") ? "—" : `${v}${suffix}`; }
function kv(items){ return items.map(([a,b])=>`<div>${a}</div><div>${b}</div>`).join(""); }
function secToClock(s){
  if (s===null || s===undefined) return "—";
  const m=Math.floor(s/60), x=(s%60).toFixed(1).padStart(4,"0");
  return `${m}:${x}`;
}
function roleTitle(role){ return role === "side" ? "Side" : role === "rear" ? "Rear" : "Overhead"; }
function getAssignment(role){ return localStorage.getItem(`3pm-camera-${role}`) || ""; }
function getAssignmentLabel(role){ return localStorage.getItem(`3pm-camera-label-${role}`) || ""; }
function setAssignment(role, id, label=""){
  localStorage.setItem(`3pm-camera-${role}`, id || "");
  if(label) localStorage.setItem(`3pm-camera-label-${role}`, label);
  else if(!id) localStorage.removeItem(`3pm-camera-label-${role}`);
}
function portableLocalData(){
  const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith("3pm-"))continue;if(k.startsWith("3pm-camera-")||k.startsWith("3pm-camera-label-"))continue;data[k]=localStorage.getItem(k);}
  return {format:"3PM Form Analyzer Portable Analysis Backup",version:APP_VERSION,exported_at:new Date().toISOString(),data};
}
function exportPortableLocalBackup(){
  const payload=portableLocalData(),blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`3PM_Form_Analyzer_Analysis_Backup_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Analysis backup exported · ${Object.keys(payload.data).length} local records.`,"good",2600);
}
async function importPortableLocalBackup(file){
  if(!file)return;let payload;try{payload=JSON.parse(await file.text());}catch{throw new Error("Backup is not valid JSON.");}
  if(payload?.format!=="3PM Form Analyzer Portable Analysis Backup"||!payload?.data||typeof payload.data!=="object")throw new Error("This is not a 3PM Form Analyzer portable backup.");
  let count=0;for(const [k,v] of Object.entries(payload.data)){if(!k.startsWith("3pm-")||k.startsWith("3pm-camera-")||k.startsWith("3pm-camera-label-"))continue;localStorage.setItem(k,String(v));count++;}
  return count;
}

function loadCoachProfile(){
  try{
    const p=JSON.parse(localStorage.getItem(COACH_PROFILE_KEY)||"{}");
    return {name:String(p.name||"Coach"),organization:String(p.organization||""),certification:String(p.certification||""),contact:String(p.contact||"")};
  }catch{return {name:"Coach",organization:"",certification:"",contact:""};}
}
function saveCoachProfile(profile){
  const clean={name:String(profile?.name||"Coach").trim()||"Coach",organization:String(profile?.organization||"").trim(),certification:String(profile?.certification||"").trim(),contact:String(profile?.contact||"").trim()};
  localStorage.setItem(COACH_PROFILE_KEY,JSON.stringify(clean));
  return clean;
}
function coachSessionSnapshot(){
  const p=loadCoachProfile();
  return {coach_name:p.name,coach_organization:p.organization,coach_certification:p.certification,coach_contact:p.contact};
}
function renderCoachProfile(){
  const p=loadCoachProfile();
  const header=$("#headerCoachName");if(header)header.textContent=p.name||"Coach";
  const form=$("#coachProfileForm");if(form){
    if(form.elements.coach_name)form.elements.coach_name.value=p.name||"";
    if(form.elements.coach_organization)form.elements.coach_organization.value=p.organization||"";
    if(form.elements.coach_certification)form.elements.coach_certification.value=p.certification||"";
    if(form.elements.coach_contact)form.elements.coach_contact.value=p.contact||"";
  }
}
function loadEquipmentSupplements(){try{return JSON.parse(localStorage.getItem(EQUIPMENT_SUPPLEMENT_KEY)||"{}");}catch{return {};}}
function saveEquipmentSupplement(id,data){if(!id)return;const all=loadEquipmentSupplements();all[String(id)]={...(all[String(id)]||{}),...(data||{})};localStorage.setItem(EQUIPMENT_SUPPLEMENT_KEY,JSON.stringify(all));}
function deleteEquipmentSupplement(id){if(!id)return;const all=loadEquipmentSupplements();delete all[String(id)];localStorage.setItem(EQUIPMENT_SUPPLEMENT_KEY,JSON.stringify(all));}
function mergeEquipmentSupplements(){
  const all=loadEquipmentSupplements();
  STATE.equipment=(STATE.equipment||[]).map(e=>({...e,...(all[String(e.id)]||{})}));
}
function equipmentSupplementFromForm(form){
  const out={};
  EQUIPMENT_SUPPLEMENT_FIELDS.forEach(k=>{const el=form?.elements?.[k];if(!el)return;out[k]=String(el.value??"").trim();});
  return out;
}
function tillerDifference(e){
  if(!valueKnown(e?.upper_tiller)||!valueKnown(e?.lower_tiller))return null;
  return Number(e.upper_tiller)-Number(e.lower_tiller);
}
function formatBowSetup(e){
  if(!e)return "—";
  const u=e.setup_distance_unit||"mm",digits=u==="in"?3:1;
  const bh=valueKnown(e.brace_height)?`${Number(e.brace_height).toFixed(digits)} ${u}`:"—",td=tillerDifference(e);
  return `BH ${bh} · Tiller ${td===null?'—':`${td>=0?'+':''}${td.toFixed(digits)} ${u}`}`;
}

const SESSION_CONTEXT_VERSION="v33";
const SESSION_CONTEXT_FIELDS=["weather_condition","light_condition","wind_pattern","wind_speed","wind_unit","gust_speed","shooting_direction","wind_direction_abs","wind_direction_relative","temperature_c","humidity_pct"];
function sessionContextKey(sessionId){return `3pm-session-context-${SESSION_CONTEXT_VERSION}-${sessionId}`;}
function loadSessionContext(sessionId=currentSessionId){
  if(!sessionId)return {};
  try{return JSON.parse(localStorage.getItem(sessionContextKey(sessionId))||"{}");}catch{return {};}
}
function saveSessionContext(sessionId,ctx){if(sessionId)localStorage.setItem(sessionContextKey(sessionId),JSON.stringify(ctx||{}));}
function deleteSessionContext(sessionId){if(sessionId)localStorage.removeItem(sessionContextKey(sessionId));}
function extractSessionContext(form){
  const ctx={};
  SESSION_CONTEXT_FIELDS.forEach(k=>{const el=form.elements[k];if(el&&String(el.value??"").trim()!=="")ctx[k]=el.value;});
  return ctx;
}
function applySessionContextToForm(form,ctx={}){SESSION_CONTEXT_FIELDS.forEach(k=>{if(form.elements[k])form.elements[k].value=ctx[k]??"";});}
function sessionConditionSummary(session=currentSession()){
  if(!session)return "—";
  const ctx=loadSessionContext(session.id),env=session.environment||"—";
  if(String(env).toLowerCase()==="indoor")return "Indoor";
  const parts=[env];
  if(ctx.weather_condition)parts.push(ctx.weather_condition);
  if(ctx.light_condition)parts.push(ctx.light_condition);
  const wind=[];
  if(ctx.wind_pattern)wind.push(ctx.wind_pattern);
  if(ctx.wind_speed)wind.push(`${ctx.wind_speed} ${ctx.wind_unit||"m/s"}`);
  if(ctx.gust_speed)wind.push(`gust ${ctx.gust_speed} ${ctx.wind_unit||"m/s"}`);
  if(ctx.wind_direction_relative)wind.push(ctx.wind_direction_relative);
  else if(ctx.wind_direction_abs)wind.push(`from ${ctx.wind_direction_abs}`);
  if(wind.length)parts.push(`Wind ${wind.join(" · ")}`);
  if(ctx.shooting_direction)parts.push(`Shoot ${ctx.shooting_direction}`);
  if(ctx.temperature_c)parts.push(`${ctx.temperature_c}°C`);
  if(ctx.humidity_pct)parts.push(`${ctx.humidity_pct}% RH`);
  return parts.join(" · ");
}
function updateSessionOutdoorFields(){
  const form=$("#sessionForm");if(!form)return;
  const env=form.elements.environment?.value||"Indoor";
  $("#sessionOutdoorFields")?.classList.toggle("hidden",env==="Indoor");
}

function latestSessionForAthlete(athleteId){
  return STATE.sessions.filter(s=>s.athlete_id===Number(athleteId)).sort((a,b)=>String(b.session_date||'').localeCompare(String(a.session_date||''))||Number(b.id)-Number(a.id))[0]||null;
}
function ensureActiveAthleteContext(){
  const active=STATE.athletes.filter(a=>!a.archived),cur=currentSession();
  // Active athlete is the owner of the workspace. A stale currentSessionId must
  // never switch the workspace back to another athlete and leak their live state.
  if(!active.some(a=>a.id===Number(activeAthleteId))){
    const sessionAthlete=cur&&active.some(a=>a.id===Number(cur.athlete_id))?cur.athlete_id:null;
    activeAthleteId=sessionAthlete||active[0]?.id||null;
  }
  if(activeAthleteId)localStorage.setItem('3pm-active-athlete',String(activeAthleteId));
  const sessionValid=STATE.sessions.some(s=>s.id===Number(currentSessionId)&&s.athlete_id===Number(activeAthleteId));
  if(!sessionValid)currentSessionId=latestSessionForAthlete(activeAthleteId)?.id||null;
}
async function reload() {
  STATE = await api("/api/state");
  mergeEquipmentSupplements();
  renderCoachProfile();
  if(!currentSessionId&&STATE.sessions.length){
    const storedAthlete=STATE.athletes.find(a=>a.id===Number(activeAthleteId)&&!a.archived);
    currentSessionId=(storedAthlete?latestSessionForAthlete(storedAthlete.id):STATE.sessions[0])?.id||null;
  }
  ensureActiveAthleteContext();
  populateSelectors();
  renderAll();
}

function populateSelectors(){
  const activeAthletes=STATE.athletes.filter(a=>!a.archived);
  const athleteOptions=activeAthletes.map(a=>`<option value="${a.id}" ${a.id===Number(activeAthleteId)?'selected':''}>${escapeHtml(a.name)} · ${escapeHtml(a.discipline)}</option>`).join("");
  if($("#activeAthleteSelect"))$("#activeAthleteSelect").innerHTML=athleteOptions||'<option value="">No active athletes</option>';
  const athleteSessions=STATE.sessions.filter(s=>!activeAthleteId||s.athlete_id===Number(activeAthleteId));
  const sessionOptions=athleteSessions.map(s=>`<option value="${s.id}" ${s.id==currentSessionId?"selected":""}>${escapeHtml(s.title)} · ${escapeHtml(s.session_date||"")}</option>`).join("");
  ["sessionSelect","analyzeSessionSelect","compareSessionSelect","reportSessionSelect"].forEach(id=>{
    const el=$("#"+id); if(el) el.innerHTML=sessionOptions||'<option value="">No session for this athlete</option>';
  });
  if($("#equipmentAthlete")) $("#equipmentAthlete").innerHTML=athleteOptions||'<option value="">Create an athlete first</option>';
  if($("#sessionAthlete")) $("#sessionAthlete").innerHTML=athleteOptions||'<option value="">Create an athlete first</option>';
  if($("#sessionAthlete")&&activeAthleteId&&!$("#sessionAthlete").value)$("#sessionAthlete").value=String(activeAthleteId);
  syncSessionEquipment();
  populateShotSelectors();
}

function defaultEquipmentForAthlete(athleteId){
  const aid=Number(athleteId);if(!aid)return null;
  const list=STATE.equipment.filter(e=>Number(e.athlete_id)===aid);
  return list.find(e=>!!e.is_default) || list[0] || null;
}
function displayEquipmentForSession(session){
  if(session?.equipment_id){const explicit=STATE.equipment.find(e=>e.id===Number(session.equipment_id));if(explicit)return explicit;}
  return defaultEquipmentForAthlete(session?.athlete_id || activeAthleteId);
}
function syncSessionEquipment({preferDefault=false}={}){
  const aid=Number($("#sessionAthlete")?.value || STATE.athletes.find(a=>!a.archived)?.id);
  const list=STATE.equipment.filter(e=>Number(e.athlete_id)===aid).sort((a,b)=>Number(b.is_default)-Number(a.is_default)||String(a.name).localeCompare(String(b.name)));
  const opts=list.map(e=>`<option value="${e.id}">${e.is_default?"★ ":""}${escapeHtml(e.name)}</option>`).join("");
  const select=$("#sessionEquipment");if(!select)return;
  const previous=select.value;select.innerHTML=`<option value="">None</option>${opts}`;
  if(previous&&list.some(e=>String(e.id)===String(previous)))select.value=previous;
  else if(preferDefault){const d=defaultEquipmentForAthlete(aid);select.value=d?String(d.id):"";}
}

function renderAll(){
  renderSession();
  renderHome();
  renderAthletes();
  renderAnalyze();
  renderCompare();
  renderImpact();
  renderReport();
}

function currentSession(){ return STATE.sessions.find(s=>s.id===Number(currentSessionId)); }
function athleteFor(s){ return STATE.athletes.find(a=>a.id===s?.athlete_id); }
function equipFor(s){ return displayEquipmentForSession(s); }

window.FormAnalyzer = {
  getCurrentSession: () => currentSession(),
  getCurrentSessionId: () => currentSessionId,
  getCurrentAthlete: () => athleteFor(currentSession()) || STATE.athletes.find(a=>a.id===Number(activeAthleteId)) || null,
  getCurrentEquipment: () => displayEquipmentForSession(currentSession() || {athlete_id:activeAthleteId}),
  isRecording: () => isRecording,
  getRecordingElapsed: () => (isRecording && recordStartedAt) ? (Date.now()-recordStartedAt)/1000 : null,
  getLiveRoles: () => CAMERA_ROLES.filter(r=>!!liveStreams[r]),
  isRoleLive: role => !!liveStreams[role],
  refreshShotUI: () => { renderShots(); renderShotDetail(); renderAnalyze(); renderReport(); },
  updateLivePhase: (phase, metrics) => updateLivePhase(phase, metrics),
  onAutoRelease: metrics => onAutoRelease(metrics),
  onShotEvidence: metrics => onShotEvidence(metrics),
  onPoseMetrics: (role,metrics) => onPoseMetrics(role,metrics),
  isAutoMarkEnabled: () => $("#autoMarkToggle")?.checked ?? true,
  isPhaseDetectionEnabled: () => $("#phaseDetectToggle")?.checked ?? true,
  getPhaseProfile: () => $("#phaseProfileSelect")?.value || "verified",
  registerPoseBuild: id => { registeredPoseBuild=id||null; enforceBuildHandshake(); },
};

function renderSession(){
  const s=currentSession();
  if(!s){
    const a=STATE.athletes.find(x=>x.id===Number(activeAthleteId));
    if($("#sessionInfo"))$("#sessionInfo").innerHTML='<span class="muted">No session for this athlete yet.</span>';
    if($("#athleteInfo"))$("#athleteInfo").innerHTML=a?kv([["Name",a.name],["Handedness",a.handedness||"—"],["Discipline",a.discipline||"—"],["Height",fmt(a.height_cm," cm")],["Arm Span",fmt(a.arm_span_cm," cm")],["Draw Length",fmt(a.draw_length_in,'"')]]):kv([["Athlete","—"]]);
    const e=defaultEquipmentForAthlete(a?.id);
    if($("#equipmentInfo"))$("#equipmentInfo").innerHTML=e?kv([
      ["Setup",`${escapeHtml(e.name)}${e.is_default?" · Default":""}`],["Bow",fmt(e.bow_length_in,'"')],["BH / Tiller",escapeHtml(formatBowSetup(e))],["OTF",fmt(e.actual_draw_weight_lb," lb")],
      ["Arrow",`${fmt(e.arrow_length_in,'"')} / ${fmt(e.arrow_spine)}`]
    ]):kv([["Setup","—"]]);
    if($("#sessionDetails"))$("#sessionDetails").innerHTML=kv([["Session","—"]]);
    renderSessionArchiveSummary();
    if($("#shotRows"))$("#shotRows").innerHTML="";
    selectedShotId=null;renderFilmstrip(null);drawTimeline();
    CAMERA_ROLES.forEach(role=>{if(!liveStreams[role])loadSavedVideo(role,null,0)});
    return;
  }
  const a=athleteFor(s), e=equipFor(s);
  $("#sessionInfo").innerHTML=`<b>${s.title}</b><br>${s.session_date||""}<br>${s.notes||""}`;
  $("#athleteInfo").innerHTML=kv([
    ["Name", a?.name||"—"], ["Handedness", a?.handedness||"—"], ["Discipline", a?.discipline||"—"],
    ["Height", fmt(a?.height_cm," cm")], ["Arm Span", fmt(a?.arm_span_cm," cm")], ["Draw Length", fmt(a?.draw_length_in,'"')]
  ]);
  $("#equipmentInfo").innerHTML= e ? kv([
    ["Setup",escapeHtml(e.name)],["Bow",fmt(e.bow_length_in,'"')],["BH / Tiller",escapeHtml(formatBowSetup(e))],["OTF",fmt(e.actual_draw_weight_lb," lb")],
    ["Arrow",`${fmt(e.arrow_length_in,'"')} / ${fmt(e.arrow_spine)}`],
    ["Long Rod",e.long_rod_length_in?`${fmt(e.long_rod_length_in,'"')} · end ${fmt(e.long_rod_end_weight," oz")}`:"—"],
    ["V-Bar",e.vbar_type?`${escapeHtml(e.vbar_type)} · ${fmt(e.vbar_angle_out_deg,"° out")} / ${fmt(e.vbar_angle_down_deg,"° down")}`:"—"],
    ["Known Component Wt",(()=>{const w=equipmentWeightSummary(e);return w.total===null?"Unknown":`${w.total.toFixed(0)} g${w.unknown?" · partial":""}`;})()]
  ]) : kv([["Setup","—"]]);
  const sessionCtx=loadSessionContext(s.id);
  $("#sessionDetails").innerHTML=kv([
    ["Distance",fmt(s.distance_m," m")],["Target",fmt(s.target_face)],["Environment",fmt(s.environment)],["Mode",fmt(s.mode)],
    ["Coach",escapeHtml(sessionCtx.coach_name||"—")],["Conditions",escapeHtml(sessionConditionSummary(s))]
  ]);
  renderSessionArchiveSummary();

  // Do not replace a live preview with the saved file.
  CAMERA_ROLES.forEach(role => {
    if (!liveStreams[role]) loadSavedVideo(role, s[`${role}_video`], s.id);
  });
  renderShots();
  drawTimeline();
  updateShotSaveStatus();
}

function setRoleMediaVisible(role,visible){
  const v=$(`#${role}Video`),wrap=v?.closest?.(".video-wrap");
  if(v)v.style.visibility=visible?"visible":"hidden";
  if(wrap)wrap.classList.toggle("has-media",!!visible);
}
function loadSavedVideo(role,file,sessionId){
  const v=$(`#${role}Video`), empty=$(`#${role}Empty`);
  if (v.srcObject) return;
  if(file){
    const url=`/api/media/${sessionId}/${role}?v=${encodeURIComponent(file)}`;
    if(v.dataset.src!==url){v.src=url;v.dataset.src=url;}
    v.controls = true;
    setRoleMediaVisible(role,true);empty.style.display="none";
    $(`#${role}Mode`).textContent="SAVED";
  } else {
    v.removeAttribute("src");
    try{v.load();}catch{}
    v.dataset.src="";
    setRoleMediaVisible(role,false);empty.style.display="flex";
    empty.textContent = detectedCameras.length ? `${roleTitle(role)} camera not live` : "No camera detected";
    $(`#${role}Mode`).textContent="EMPTY";
  }
}

function shotEndSize(){
  try{return Math.max(1,Number(roundStructure(getImpactConfig()).arrowsPerEnd)||6);}catch{return 6;}
}
function shotValidity(shot){
  if(shot.status==='bad')return{label:'Excluded',css:'problem'};
  if(shot.auto_detected){
    const adv=loadAdvancedShotMetrics(shot.id);
    if(adv?.confirmed_release===true)return{label:'Confirmed release',css:'auto'};
    return{label:'Unverified event',css:'review'};
  }
  return{label:'Manual',css:''};
}
function toggleShotEnd(endNo){
  if(expandedShotEnds.has(endNo))expandedShotEnds.delete(endNo);else expandedShotEnds.add(endNo);
  renderShots();
}
const calibrationEvidenceVerifiedShots=new Set();
let calibrationEvidenceSessionId=null,calibrationEvidenceLoading=false;
function calibrationEvidenceComplete(shotId,record){
  if(!record||String(record.role||'side')!=='side')return false;
  const core=window.CaptureIntegrityCore;if(!core?.evidenceContract)return false;
  const adv=loadAdvancedShotMetrics(shotId)||{};return core.evidenceContract(record,adv)?.complete===true;
}
function markCalibrationEvidenceIfComplete(shotId,record){
  const id=Number(shotId);if(!Number.isFinite(id)||!calibrationEvidenceComplete(id,record))return false;calibrationEvidenceVerifiedShots.add(id);return true;
}
async function hydrateCalibrationEvidence(sessionId=currentSessionId){
  const sid=Number(sessionId);if(!sid||calibrationEvidenceLoading)return;calibrationEvidenceLoading=true;
  try{const rows=await evidenceDbRecordsForSession(sid);if(Number(currentSessionId)!==sid)return;calibrationEvidenceVerifiedShots.clear();for(const r of rows)markCalibrationEvidenceIfComplete(r.shotId,r);renderBaselineCalibration();}
  finally{calibrationEvidenceLoading=false;}
}
function calibrationVerifiedShots(sessionId=currentSessionId){
  const sid=Number(sessionId)||null;if(sid&&calibrationEvidenceSessionId!==sid){calibrationEvidenceSessionId=sid;calibrationEvidenceVerifiedShots.clear();queueMicrotask(()=>hydrateCalibrationEvidence(sid));}
  return sessionShots(sessionId).filter(shot=>{if(!shot||shot.status==='bad'||!shot.auto_detected||!calibrationEvidenceVerifiedShots.has(Number(shot.id)))return false;const adv=loadAdvancedShotMetrics(shot.id);return adv?.confirmed_release===true;}).slice(0,6);
}
function renderBaselineCalibration(){
  const host=$('#baselineCalibration'),title=$('#baselineCalibrationTitle'),detail=$('#baselineCalibrationDetail'),dots=$('#baselineCalibrationDots');if(!host||!title||!detail||!dots)return;
  if(!currentSessionId){title.textContent='Baseline · no active session';detail.textContent='Start a session to begin Calibration / Warm-up.';dots.innerHTML='';host.dataset.state='idle';return;}
  const n=calibrationVerifiedShots().length;
  dots.innerHTML=[0,1,2,3,4,5].map(i=>`<span class="baseline-dot ${i<n?'done':''}">${i<n?'✓':i+1}</span>`).join('');
  if(n<3){title.textContent=`Building Baseline · ${n}/3`;detail.textContent=`Calibration / Warm-up · ${n}/6 verified shots captured. Let-downs and incomplete evidence do not count.`;host.dataset.state='building';}
  else if(n===3){title.textContent='Baseline Ready ✓ · 3/6';detail.textContent='Initial athlete baseline is usable. Calibration continues automatically while the athlete warms up.';host.dataset.state='ready';}
  else if(n<6){title.textContent=`Baseline refining · ${n}/6`;detail.textContent='Using verified shots to tighten the athlete/session range without turning averages into hard timing rules.';host.dataset.state='refining';}
  else{title.textContent='Baseline Refined ✓ · 6 verified shots';detail.textContent='Session Calibration Complete · analysis uses robust athlete/session ranges; Capture remains event-driven.';host.dataset.state='refined';}
}
function renderShots(){
  renderBaselineCalibration();
  const shots=sessionShots(),aps=shotEndSize();
  const rows=$("#shotRows");if(rows)rows.innerHTML="";
  const shotCards=$("#shotCards");
  if(!shotCards)return;
  if(!shots.length){shotCards.innerHTML='<div class="shot-card-empty">No shots yet.</div>';selectedShotId=null;return;}
  const groups=new Map();
  shots.forEach(x=>{const endNo=Math.floor((Number(x.shot_no)-1)/aps)+1;(groups.get(endNo)||groups.set(endNo,[]).get(endNo)).push(x);});
  const selected=STATE.shots.find(x=>x.id===selectedShotId),selectedEnd=selected?Math.floor((selected.shot_no-1)/aps)+1:null;
  const currentEnd=Math.max(...groups.keys());
  if(!expandedShotEnds.size)expandedShotEnds.add(selectedEnd||currentEnd);
  if(selectedEnd)expandedShotEnds.add(selectedEnd);
  shotCards.innerHTML=[...groups.entries()].sort((a,b)=>b[0]-a[0]).map(([endNo,endShots])=>{
    const endScore=endShots.filter(x=>x.score!=null).reduce((sum,x)=>sum+Number(x.score||0),0),scored=endShots.filter(x=>x.score!=null).length;
    const holds=endShots.map(x=>Number(x.hold_time_s)).filter(Number.isFinite),holdAvg=holds.length?holds.reduce((a,b)=>a+b,0)/holds.length:null;
    const open=expandedShotEnds.has(endNo),isCurrent=endNo===currentEnd;
    return `<div class="shot-end-group ${open?'open':''} ${isCurrent?'current':''}" data-end="${endNo}">
      <button type="button" class="shot-end-head" data-toggle-end="${endNo}"><div><b>End ${endNo}${isCurrent?' · Current':''}</b><span>${endShots.length}/${aps} arrows${holdAvg!=null?` · Hold avg ${holdAvg.toFixed(2)}s`:''}</span></div><span class="end-score">${scored?`${endScore}/${scored*10}`:'Unscored'}</span><span>${open?'▾':'▸'}</span></button>
      <div class="shot-end-body">${endShots.map(x=>{
        const analysis=interpretShot(x),scoreText=x.score==null?'—':(x.is_x?`${x.score}X`:x.score),hold=Number.isFinite(Number(x.hold_time_s))?`${Number(x.hold_time_s).toFixed(2)}s`:'—',valid=shotValidity(x);
        return `<div class="shot-row-v34 ${x.id===selectedShotId?'selected':''}" data-id="${x.id}">
          <button class="ref-star ${x.is_reference?'on':''}" data-ref-id="${x.id}" title="Coach reference">${x.is_reference?'★':'☆'}</button>
          <div class="shot-num">#${x.shot_no}</div>
          <div class="shot-meta"><b>${analysis.label}</b><span>${secToClock(x.timestamp_s)} · Hold ${hold} · <span class="shot-validity ${valid.css}">${valid.label}</span></span></div>
          <div class="shot-score ${x.is_x?'score-x':''}">${scoreText}</div>
          <button class="row-edit-btn" data-edit-id="${x.id}" title="Edit score, note or validity">Edit</button>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');

  $$("#shotCards [data-toggle-end]").forEach(btn=>btn.onclick=e=>{e.stopPropagation();toggleShotEnd(Number(btn.dataset.toggleEnd));});
  $$("#shotCards .shot-row-v34").forEach(card=>card.onclick=e=>{
    if(e.target.closest(".ref-star")||e.target.closest(".row-edit-btn"))return;
    selectedShotId=Number(card.dataset.id);renderShots();renderShotDetail();renderAnalyze();
  });
  $$("#shotCards .row-edit-btn").forEach(btn=>btn.onclick=e=>{e.stopPropagation();selectedShotId=Number(btn.dataset.editId);openEditShotDialog(selectedShotId);});
  $$("#shotCards .ref-star").forEach(btn=>btn.onclick=async e=>{
    e.stopPropagation();const id=Number(btn.dataset.refId),shot=STATE.shots.find(x=>x.id===id);if(!shot)return;
    const fd=new FormData();fd.append("is_reference",shot.is_reference?"false":"true");await api(`/api/shots/${id}/reference`,{method:"POST",body:fd});await reload();selectedShotId=id;renderShots();renderAnalyze();
  });
  const compare=$("#compareBtn");if(compare){compare.disabled=shots.length<2||!selectedShotId;compare.title=shots.length<2?"At least two shots are needed for comparison.":!selectedShotId?"Select a shot first.":"Compare selected shot with another shot.";}
}


const ADVANCED_SHOT_STORAGE_VERSION="v500d3";
function advancedShotKey(shotId){return `3pm-advanced-${ADVANCED_SHOT_STORAGE_VERSION}-shot-${shotId}`;}
function pickViewMetric(m){
  if(!m)return null;
  return {
    detected:!!m.detected,quality:Number.isFinite(m.quality)?m.quality:null,phase_quality:Number.isFinite(m.phaseQuality)?m.phaseQuality:null,
    draw_elbow_deg:Number.isFinite(m.drawElbowDeg)?m.drawElbowDeg:null,bow_arm_deg:Number.isFinite(m.bowArmDeg)?m.bowArmDeg:null,
    shoulder_line_deg:Number.isFinite(m.shoulderLineDeg)?m.shoulderLineDeg:null,torso_lean_deg:Number.isFinite(m.torsoLeanDeg)?m.torsoLeanDeg:null,
    head_movement_mm:Number.isFinite(m.headMovementMm)?m.headMovementMm:null,head_pitch_deg:Number.isFinite(m.headPitchDeg)?m.headPitchDeg:null,
    rejected_joints:Number.isFinite(m.rejectedJoints)?m.rejectedJoints:null,release_quality:Number.isFinite(m.releaseQuality)?m.releaseQuality:null,
    visual_quality:Number.isFinite(m.visualQuality)?m.visualQuality:null,visual_status:m.visualStatus||null,visual_issues:Array.isArray(m.visualIssues)?m.visualIssues.slice(0,4):[],
    inference_hz:Number.isFinite(m.effectiveInferenceHz)?m.effectiveInferenceHz:null,metric_confidence:m.metricConfidence||null,identity_confidence:Number.isFinite(m.identityConfidence)?m.identityConfidence:null,people_count:Number.isFinite(m.peopleCount)?m.peopleCount:null,shot_observability:Number.isFinite(m.shotObservability)?m.shotObservability:null,view_type:m.viewType||null,positioning_status:m.positioning?.status||null
  };
}
function collectMultiViewEvidence(eventEpochMs=Date.now()){
  const views={};
  CAMERA_ROLES.forEach(role=>{
    if(!liveStreams[role])return;
    const track=liveStreams[role]?.getVideoTracks?.()[0],settings=track?.getSettings?.()||{},nearFrame=nearestEvidenceFrame(eventEpochMs,role);
    const nearMetric=window.PoseEngine?.getMetricsNearEpoch?.(role,eventEpochMs,420)||null;
    const metric=nearMetric?.metrics||window.PoseEngine?.getLatestMetrics?.(role)||null;
    views[role]={...pickViewMetric(metric),camera_label:track?.label||roleTitle(role),width:settings.width||null,height:settings.height||null,fps:settings.frameRate||null,
      frame_sync_delta_ms:Number.isFinite(nearFrame?.deltaMs)?nearFrame.deltaMs:null,
      metric_sync_delta_ms:Number.isFinite(nearMetric?.deltaMs)?nearMetric.deltaMs:null,
      sync_delta_ms:Number.isFinite(nearMetric?.deltaMs)?nearMetric.deltaMs:(Number.isFinite(nearFrame?.deltaMs)?nearFrame.deltaMs:null)};
  });
  return views;
}
function buildHandReleaseAnalyzer(role,releaseEpochMs,endEpochMs=null,pinnedRows=null){
  const end=Number(endEpochMs)||Number(releaseEpochMs)+1200,win=Array.isArray(pinnedRows)&&pinnedRows.length?pinnedRows:(window.PoseEngine?.getMetricsWindow?.(role,Number(releaseEpochMs)-350,end)||[]);if(win.length<4)return null;
  const rows=win.map(x=>({t:Number(x.epochMs),m:x.metrics||{}})).filter(x=>Number.isFinite(x.t)&&x.t<=end);
  const pre=rows.filter(x=>x.t<releaseEpochMs&&x.t>=releaseEpochMs-300&&Number.isFinite(Number(x.m.anchorHandRelX))&&Number.isFinite(Number(x.m.anchorHandRelY))&&Number.isFinite(Number(x.m.drawElbowRelX))&&Number.isFinite(Number(x.m.drawElbowRelY)));if(!pre.length)return null;
  const med=v=>{const a=v.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const n=Math.floor(a.length/2);return a.length%2?a[n]:(a[n-1]+a[n])/2;};
  const hx=med(pre.map(x=>Number(x.m.anchorHandRelX))),hy=med(pre.map(x=>Number(x.m.anchorHandRelY))),ex=med(pre.map(x=>Number(x.m.drawElbowRelX))),ey=med(pre.map(x=>Number(x.m.drawElbowRelY)));const vx=ex-hx,vy=ey-hy,vm=Math.hypot(vx,vy);if(!(vm>.01))return null;const rx=vx/vm,ry=vy/vm;
  const pts=rows.filter(x=>x.t>=releaseEpochMs-120&&x.t<=end&&Number.isFinite(Number(x.m.anchorHandRelX))&&Number.isFinite(Number(x.m.anchorHandRelY))).map(x=>{const dx=Number(x.m.anchorHandRelX)-hx,dy=Number(x.m.anchorHandRelY)-hy;const edx=Number(x.m.drawElbowRelX)-ex,edy=Number(x.m.drawElbowRelY)-ey;return{offset_ms:x.t-releaseEpochMs,rear:dx*rx+dy*ry,off:dx*ry-dy*rx,elbow_rear:edx*rx+edy*ry,quality:Number(x.m.releaseQuality??x.m.phaseQuality??0),phase:x.m.phase||null};});if(pts.length<3)return null;
  const post=pts.filter(x=>x.offset_ms>=0&&x.offset_ms<=650),maxRear=Math.max(0,...post.map(x=>x.rear)),maxOff=Math.max(0,...post.map(x=>Math.abs(x.off))),maxElbow=Math.max(0,...post.map(x=>x.elbow_rear));let path=0,net=0;for(let i=1;i<post.length;i++)path+=Math.hypot(post[i].rear-post[i-1].rear,post[i].off-post[i-1].off);if(post.length>1)net=Math.hypot(post.at(-1).rear-post[0].rear,post.at(-1).off-post[0].off);const efficiency=path>1e-6?Math.min(1,net/path):null;
  const peakIndex=post.reduce((bi,p,i,a)=>p.rear>a[bi].rear?i:bi,0),peak=post[peakIndex]?.rear||0,after=post.slice(peakIndex+1),minAfter=after.length?Math.min(...after.map(x=>x.rear)):peak,returnAmount=Math.max(0,peak-minAfter);const collapseRatio=peak>.01?Math.min(1,returnAmount/peak):0;const q=med(post.map(x=>x.quality).filter(Number.isFinite))||0;
  return{role,release_epoch_ms:Number(releaseEpochMs),end_epoch_ms:end,samples:pts.length,pose_hz:pts.length>1?1000*(pts.length-1)/(pts.at(-1).offset_ms-pts[0].offset_ms):null,rear_travel_pct:maxRear*100,off_axis_travel_pct:maxOff*100,elbow_continuation_pct:maxElbow*100,path_efficiency_pct:Number.isFinite(efficiency)?efficiency*100:null,forward_return_pct:returnAmount*100,collapse_ratio_pct:collapseRatio*100,confidence:Math.max(0,Math.min(1,q*(pts.length>=8?1:.82))),trajectory:pts.map(x=>({offset_ms:Math.round(x.offset_ms),rear_pct:Number((x.rear*100).toFixed(2)),off_pct:Number((x.off*100).toFixed(2)),elbow_rear_pct:Number((x.elbow_rear*100).toFixed(2)),phase:x.phase,quality:Number(x.quality.toFixed?.(3)??x.quality)}))};
}

function saveAdvancedShotMetrics(shotId,m,views=null){
  if(!shotId||!m)return;
  const picked={
    head_pitch_deg:Number.isFinite(m.headPitchDeg)?m.headPitchDeg:null,anchor_face_pct:Number.isFinite(m.anchorFaceDistPct)?m.anchorFaceDistPct:null,
    head_toward_draw_pct:Number.isFinite(m.headTowardDrawPct)?m.headTowardDrawPct:null,anchor_hand_drift_pct:Number.isFinite(m.anchorHandDriftPct)?m.anchorHandDriftPct:null,
    anchor_hand_rms_pct:Number.isFinite(m.anchorHandRmsPct)?m.anchorHandRmsPct:null,anchor_face_rms_pct:Number.isFinite(m.anchorFaceRmsPct)?m.anchorFaceRmsPct:null,
    anchor_head_rms_pct:Number.isFinite(m.anchorHeadRmsPct)?m.anchorHeadRmsPct:null,anchor_settle_s:Number.isFinite(m.anchorSettleTimeS)?m.anchorSettleTimeS:null,
    anchor_ref_hand_x:Number.isFinite(m.anchorReferenceHandX)?m.anchorReferenceHandX:null,anchor_ref_hand_y:Number.isFinite(m.anchorReferenceHandY)?m.anchorReferenceHandY:null,
    anchor_ref_head_x:Number.isFinite(m.anchorReferenceHeadX)?m.anchorReferenceHeadX:null,anchor_ref_head_y:Number.isFinite(m.anchorReferenceHeadY)?m.anchorReferenceHeadY:null,
    anchor_ref_face_pct:Number.isFinite(m.anchorReferenceFacePct)?m.anchorReferenceFacePct:null,anchor_ref_head_pitch:Number.isFinite(m.anchorReferenceHeadPitch)?m.anchorReferenceHeadPitch:null,
    release_rear_pct:Number.isFinite(m.releaseRearPct)?m.releaseRearPct:null,release_offaxis_pct:Number.isFinite(m.releaseOffAxisPct)?m.releaseOffAxisPct:null,
    release_rear_travel_pct:Number.isFinite(m.releaseRearTravelPct)?m.releaseRearTravelPct:null,release_offaxis_travel_pct:Number.isFinite(m.releaseOffAxisTravelPct)?m.releaseOffAxisTravelPct:null,
    release_elbow_travel_pct:Number.isFinite(m.releaseElbowTravelPct)?m.releaseElbowTravelPct:null,release_face_relative_travel_pct:Number.isFinite(m.releaseFaceRelativeTravelPct)?m.releaseFaceRelativeTravelPct:null,
    hand_opening_delta_pct:Number.isFinite(m.handOpeningDeltaPct)?m.handOpeningDeltaPct:null,set_to_draw_s:Number.isFinite(m.setToDrawS)?m.setToDrawS:null,draw_to_anchor_s:Number.isFinite(m.drawToAnchorS)?m.drawToAnchorS:null,anchor_to_arm_s:Number.isFinite(m.anchorToArmS)?m.anchorToArmS:null,
    draw_speed_mean:Number.isFinite(m.drawSpeedMean)?m.drawSpeedMean:null,draw_speed_cv:Number.isFinite(m.drawSpeedCv)?m.drawSpeedCv:null,draw_acceleration_peak:Number.isFinite(m.drawAccelerationPeak)?m.drawAccelerationPeak:null,draw_jerk_peak:Number.isFinite(m.drawJerkPeak)?m.drawJerkPeak:null,
    source_role:m.role||null,evidence_roles:Array.isArray(m.evidenceRoles)?m.evidenceRoles.slice(0,3):[m.role||"side"],metric_sources:m.metricSources||null,shot_observability:Number.isFinite(m.shotObservability)?m.shotObservability:null,identity_confidence:Number.isFinite(m.identityConfidence)?m.identityConfidence:null,view_type:m.viewType||null,
    follow_bow_arm_delta_deg:Number.isFinite(m.followBowArmDeltaDeg)?m.followBowArmDeltaDeg:null,
    follow_head_move_pct:Number.isFinite(m.followHeadMovePct)?m.followHeadMovePct:null,release_path_confidence:Number.isFinite(m.releasePathConfidence)?m.releasePathConfidence:null,
    release_epoch_ms:Number.isFinite(m.releaseEpochMs)?m.releaseEpochMs:null,quality:Number.isFinite(m.quality)?m.quality:null,phase_quality:Number.isFinite(m.phaseQuality)?m.phaseQuality:null,
    confirmed_release:!!(m.releaseConfirmed||m.didRelease||m.shotComplete),follow_through_confirmed:!!m.followThroughConfirmed,post_release_evidence:!!m.postReleaseEvidence,release_quality:Number.isFinite(m.releaseQuality)?m.releaseQuality:null,visual_quality:Number.isFinite(m.visualQuality)?m.visualQuality:null,
    visual_status:m.visualStatus||null,visual_issues:Array.isArray(m.visualIssues)?m.visualIssues.slice(0,4):[],metric_confidence:m.metricConfidence||null,
    phase_timeline:Array.isArray(m.phaseTimeline)?m.phaseTimeline.map(x=>({phase:x.phase,epochMs:Number(x.epochMs),role:x.role||null,confidence:Number.isFinite(Number(x.confidence))?Number(x.confidence):null})):[],
    coach_evidence_plan:window.CoreEngine?.buildCoachEvidencePlan?.(m.phaseTimeline||[],Number(m.releaseEpochMs)||Date.now())||null,
    biomechanics_matrix:window.CoreEngine?.buildBiomechanicsMatrix?.(m)||[],
    hand_release_analyzer:buildHandReleaseAnalyzer(m.role||'side',Number(m.releaseEpochMs)||Date.now(),(Number(m.releaseEpochMs)||Date.now())+900),
    views:views||collectMultiViewEvidence(Number.isFinite(m.releaseEpochMs)?m.releaseEpochMs:Date.now()),evidence_buffer:evidenceBufferDiagnostics(),saved_at:new Date().toISOString()
  };
  try{localStorage.setItem(advancedShotKey(shotId),JSON.stringify(picked));}catch(err){console.warn('Advanced shot metric save failed',err);}
}
function loadAdvancedShotMetrics(shotId){
  try{
    const keys=[advancedShotKey(shotId),`3pm-advanced-v500d2-shot-${shotId}`,`3pm-advanced-v500d1-shot-${shotId}`,`3pm-advanced-v400a1-shot-${shotId}`,`3pm-advanced-v352rc5-shot-${shotId}`,`3pm-advanced-v351-shot-${shotId}`,`3pm-advanced-v341-shot-${shotId}`,`3pm-advanced-v34-shot-${shotId}`,`3pm-advanced-v33-shot-${shotId}`];
    for(const k of keys){const raw=localStorage.getItem(k);if(raw)return JSON.parse(raw);}return null;
  }catch{return null;}
}
function deleteAdvancedShotMetrics(shotId){for(const k of [advancedShotKey(shotId),`3pm-advanced-v500d2-shot-${shotId}`,`3pm-advanced-v500d1-shot-${shotId}`,`3pm-advanced-v400a1-shot-${shotId}`,`3pm-advanced-v352rc5-shot-${shotId}`,`3pm-advanced-v351-shot-${shotId}`,`3pm-advanced-v341-shot-${shotId}`,`3pm-advanced-v34-shot-${shotId}`,`3pm-advanced-v33-shot-${shotId}`]){try{localStorage.removeItem(k);}catch{}}}
function setAdvancedMetric(id,value,digits=1,suffix=''){
  const el=$(id);if(!el)return;el.textContent=Number.isFinite(Number(value))?`${Number(value).toFixed(digits)}${suffix}`:'—';
}

function renderShotDetail(){
  const x=STATE.shots.find(s=>s.id===selectedShotId);
  if(!x){
    $("#shotNotes").textContent="Select a shot.";
    renderFilmstrip(null);
    loadShotReplay(null,reviewRole==='multi'?'side':reviewRole);
    drawTimeline();
    updateReviewControls();
    return;
  }
  $("#mHold").textContent=fmtNum(x.hold_time_s,2);
  $("#mElbow").textContent=fmtNum(x.draw_elbow_deg,1);
  $("#mBowArm").textContent=fmtNum(x.bow_arm_deg,1);
  $("#mShoulder").textContent=fmtNum(x.shoulder_line_deg,1);
  $("#mTorso").textContent=fmtNum(x.torso_lean_deg,1);
  $("#mHeadMm").textContent=fmtNum(x.head_movement_mm,1);
  const adv=loadAdvancedShotMetrics(x.id);
  setAdvancedMetric("#mHeadPitch",adv?.head_pitch_deg,1,"°");
  setAdvancedMetric("#mAnchorFace",adv?.anchor_face_pct,1,"%");
  setAdvancedMetric("#mHeadTowardDraw",adv?.head_toward_draw_pct,1,"%");
  setAdvancedMetric("#mAnchorDrift",adv?.anchor_hand_drift_pct,1,"%");
  setAdvancedMetric("#mAnchorStability",adv?.anchor_hand_rms_pct,1,"%");
  const rp=$("#mReleasePath");if(rp)rp.textContent=Number.isFinite(Number(adv?.release_rear_pct))&&Number.isFinite(Number(adv?.release_offaxis_pct))?`${Number(adv.release_rear_pct).toFixed(0)} / ${Number(adv.release_offaxis_pct).toFixed(0)}%`:"—";
  $("#mPoseQuality").textContent=x.pose_confidence==null?"—":`${Math.round(x.pose_confidence*100)}%`;
  const analysis=interpretShot(x);
  const scoreText=x.score==null?"Not scored":(x.is_x?`${x.score}X`:x.score);
  $("#shotNotes").textContent=`${analysis.label}: ${analysis.summary}\nScore: ${scoreText}${x.note?"\n\nCoach note: "+x.note:""}`;
  const v=$("#sideVideo");
  if(!v.srcObject && Number.isFinite(x.timestamp_s) && v.readyState>=1){
    try{v.currentTime=Math.max(0,x.timestamp_s-0.35)}catch{}
  }
  renderFilmstrip(x);
  loadShotReplay(x,reviewRole==='multi'?'side':reviewRole);
  drawTimeline();
  updateReviewControls();
}

function ensureToastHost(){
  let host=document.querySelector(".toast-host");
  if(!host){host=document.createElement("div");host.className="toast-host";document.body.appendChild(host);}
  return host;
}
function toast(message,kind="good",timeout=3000){
  const host=ensureToastHost(),el=document.createElement("div");
  el.className=`toast ${kind}`;el.textContent=message;host.appendChild(el);
  setTimeout(()=>el.remove(),timeout);
}

function selectedShot(){return STATE.shots.find(x=>x.id===Number(selectedShotId))||null;}
function shotFrames(shotId,role=reviewRole==='multi'?'side':reviewRole){return roleFramesForShot(shotId,role);}
function frameUrl(id){return `/api/shot-frame/${id}?v=343reviewui&t=${Date.now()}`;}
function setReviewRole(role){
  reviewRole=['side','rear','overhead','multi'].includes(role)?role:'side';localStorage.setItem('3pm-review-role',reviewRole);
  $$('#reviewRoleTabs .review-role-btn').forEach(b=>b.classList.toggle('active',b.dataset.reviewRole===reviewRole));
  renderFilmstrip(selectedShot());loadShotReplay(selectedShot(),reviewRole==='multi'?'side':reviewRole);updateReviewControls();
}
function nearestShotFrameByOffset(shotId,role,offset=0){
  const frames=roleFramesForShot(shotId,role);if(!frames.length)return null;return frames.reduce((best,f)=>Math.abs(Number(f.offset_ms)-offset)<Math.abs(Number(best.offset_ms)-offset)?f:best,frames[0]);
}
function renderMultiReview(shot){
  const host=$('#reviewMultiView');if(!host)return;
  CAMERA_ROLES.forEach(role=>{
    const cell=host.querySelector(`[data-role="${role}"]`),img=$(`#reviewMulti${role[0].toUpperCase()+role.slice(1)}`),stateEl=$(`#reviewMulti${role[0].toUpperCase()+role.slice(1)}State`);
    // Coach overview prefers early follow-through (+0.10 s) once available; Release Onset remains in the filmstrip/replay.
    const frame=shot?nearestShotFrameByOffset(shot.id,role,100):null;
    if(frame){img.src=frameUrl(frame.id);cell?.classList.add('has-frame');if(stateEl)stateEl.textContent=`Captured · ${formatOffset(Number(frame.offset_ms)||0)}`;}
    else{if(img)img.removeAttribute('src');cell?.classList.remove('has-frame');if(stateEl)stateEl.textContent='No captured frame for this shot';}
  });
}
function renderFilmstrip(shot){
  const strip=$('#filmstrip'),status=$('#filmstripStatus'),multi=$('#reviewMultiView');if(!strip)return;
  $$('#reviewRoleTabs .review-role-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.reviewRole===reviewRole);
    if(b.dataset.reviewRole!=='multi'&&shot)b.classList.toggle('unavailable',roleFramesForShot(shot.id,b.dataset.reviewRole).length===0);else b.classList.remove('unavailable');
  });
  if(!shot){strip.innerHTML='<div class="filmstrip-empty">Select a shot to review key frames.</div>';multi?.classList.add('hidden');if(status)status.textContent='Select a shot. Active cameras are captured into one synchronized shot record.';return;}
  if(reviewRole==='multi'){
    strip.classList.add('hidden');multi?.classList.remove('hidden');renderMultiReview(shot);
    const counts=CAMERA_ROLES.map(r=>`${roleTitle(r)} ${roleFramesForShot(shot.id,r).length}`).join(' · ');
    if(status)status.textContent=`Shot #${shot.shot_no} · multi-view frames · ${counts}`;
    return;
  }
  multi?.classList.add('hidden');strip.classList.remove('hidden');
  const frames=roleFramesForShot(shot.id,reviewRole),token=`${shot.id}:${reviewRole}`;
  if(!frames.length){strip.innerHTML=`<div class="filmstrip-empty">${frameGenerationInFlight.has(token)?`Generating ${roleTitle(reviewRole)} frames…`:`No ${roleTitle(reviewRole)} frames captured for this shot.`}</div>`;if(status)status.textContent=`Shot #${shot.shot_no} · ${roleTitle(reviewRole)} unavailable for this shot${reviewRole==='side'?' · use Generate Key Frames if a saved video exists':''}.`;return;}
  if(status)status.textContent=`Shot #${shot.shot_no} · ${roleTitle(reviewRole)} · ${frames.length} coach keyframes`;
  strip.innerHTML=frames.map(f=>`<button class="frame-thumb ${Number(f.offset_ms)===0?'release-frame':''}" data-frame-id="${f.id}" data-source-time="${f.source_time_s??''}" type="button"><img src="${frameUrl(f.id)}" alt="${escapeHtml(frameBaseLabel(f))}" loading="lazy"><span class="frame-caption"><b>${escapeHtml(frameBaseLabel(f))}</b><span>${formatOffset(f.offset_ms)}</span></span></button>`).join('');
  $$('#filmstrip .frame-thumb').forEach(btn=>btn.onclick=()=>{
    $$('#filmstrip .frame-thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const frame=frames.find(f=>f.id===Number(btn.dataset.frameId));if(!frame)return;
    const v=$(`#${reviewRole}Video`),t=Number(frame.source_time_s);if(v&&!v.srcObject&&Number.isFinite(t)){try{v.currentTime=Math.max(0,t)}catch{}}
    $('#frameViewerImage').src=frameUrl(frame.id);$('#frameViewerTitle').textContent=`Shot #${shot.shot_no} · ${roleTitle(reviewRole)} · ${frameBaseLabel(frame)}`;$('#frameViewerTime').textContent=Number.isFinite(t)?`Video ${secToClock(t)}`:formatOffset(frame.offset_ms);$('#frameViewerDialog').showModal();
  });
}
function formatOffset(ms){if(ms===0)return"Release";return `${ms>0?"+":""}${(ms/1000).toFixed(Math.abs(ms)<1000?1:1)}s`;}

function drawTimeline(){
  const c=$("#timeline"); if(!c)return;
  const ctx=c.getContext("2d"),dpr=devicePixelRatio||1;
  const cssW=Math.max(320,c.clientWidth||900),cssH=220;
  c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=cssW,h=cssH;
  ctx.fillStyle="#07101a";ctx.fillRect(0,0,w,h);

  // Grid and labels
  ctx.strokeStyle="#20364d";ctx.lineWidth=1;
  ctx.fillStyle="#71869b";ctx.font="10px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  for(let i=0;i<=4;i++){
    const y=18+(h-42)*i/4;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(w-10,y);ctx.stroke();
  }
  for(let i=0;i<=5;i++){
    const x=40+(w-50)*i/5;ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,h-24);ctx.stroke();
  }

  const series=[
    {key:"draw",color:"#ff6d68",min:135,max:190},
    {key:"bow",color:"#59a9ff",min:135,max:190},
    {key:"shoulder",color:"#ffe769",min:-15,max:15},
    {key:"head",color:"#64df9d",min:0,max:40},
  ];
  let points=[];

  if(timelineMode==="live"){
    const now=performance.now(),start=now-10000;
    points=liveMetricHistory.filter(p=>p.t>=start);
    $("#timelineHint").textContent=points.length?"Live pose metrics · latest 10 seconds":"Waiting for live pose data…";
    for(let i=0;i<=5;i++){const sec=-10+2*i;ctx.fillText(`${sec}s`,35+(w-50)*i/5,h-7);}
    series.forEach(s=>{
      ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;
      points.forEach(p=>{
        const val=Number(p[s.key]);if(!Number.isFinite(val))return;
        const x=40+((p.t-start)/10000)*(w-50);
        const y=18+(1-(Math.max(s.min,Math.min(s.max,val))-s.min)/(s.max-s.min))*(h-42);
        if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
      });if(started)ctx.stroke();
    });
  }else{
    const shots=sessionShots();
    $("#timelineHint").textContent=shots.length?`Shot-to-shot measurements · ${shots.length} shot${shots.length===1?"":"s"}`:"No shot history yet.";
    shots.forEach((shot,i)=>ctx.fillText(String(shot.shot_no),40+(w-50)*(i/Math.max(shots.length-1,1))-3,h-7));
    const mapping={draw:"draw_elbow_deg",bow:"bow_arm_deg",shoulder:"shoulder_line_deg",head:"head_movement_mm"};
    series.forEach(s=>{
      ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;
      shots.forEach((shot,i)=>{
        const val=Number(shot[mapping[s.key]]);if(!Number.isFinite(val))return;
        const x=40+(w-50)*(i/Math.max(shots.length-1,1));
        const y=18+(1-(Math.max(s.min,Math.min(s.max,val))-s.min)/(s.max-s.min))*(h-42);
        if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
        if(shot.id===selectedShotId){ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();}
      });if(started)ctx.stroke();
    });
  }

  ctx.fillStyle="#8da2b7";ctx.fillText("Angles / relative motion",8,12);
}

function pushLiveMetricSample(metrics){
  if(!metrics?.detected)return;
  const now=performance.now(),last=liveMetricHistory.at(-1);
  if(last && now-last.t<80)return;
  liveMetricHistory.push({
    t:now,draw:metrics.drawElbowDeg,bow:metrics.bowArmDeg,
    shoulder:metrics.shoulderLineDeg,head:metrics.headMovementMm
  });
  while(liveMetricHistory.length && liveMetricHistory[0].t<now-12000)liveMetricHistory.shift();
  if(timelineMode==="live")drawTimeline();
}

function setTimelineMode(mode){
  timelineMode=mode==="shots"?"shots":"live";
  $("#timelineLiveBtn")?.classList.toggle("active",timelineMode==="live");
  $("#timelineShotsBtn")?.classList.toggle("active",timelineMode==="shots");
  drawTimeline();
}

function captureVideoDataUrl(video,width=360,quality=.70){
  if(!video || video.readyState<2 || !video.videoWidth || !video.videoHeight)return null;
  const canvas=document.createElement("canvas");
  const ratio=video.videoHeight/video.videoWidth;
  canvas.width=width;
  canvas.height=Math.max(1,Math.round(width*ratio));
  const ctx=canvas.getContext("2d",{alpha:false});
  try{
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",quality);
  }catch(err){
    console.warn("Direct frame capture failed",err);
    return null;
  }
}

function dataUrlToBlob(dataUrl){
  try{
    const parts=dataUrl.split(",");
    const mime=(parts[0].match(/data:([^;]+)/)||[])[1]||"image/jpeg";
    const bin=atob(parts[1]||"");
    const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }catch{return null;}
}
function captureVideoBlob(video,width=360,quality=.72){
  return new Promise(resolve=>{
    if(!video || video.readyState<2 || !video.videoWidth || !video.videoHeight){resolve(null);return;}
    const canvas=document.createElement("canvas");
    const ratio=video.videoHeight/video.videoWidth;
    canvas.width=width;canvas.height=Math.max(1,Math.round(width*ratio));
    const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:false});
    try{ctx.drawImage(video,0,0,canvas.width,canvas.height);}
    catch{resolve(null);return;}

    let settled=false;
    const finish=(blob)=>{
      if(settled)return;
      settled=true;
      if(blob){resolve(blob);return;}
      // Safari/WebKit fallback: if toBlob is late/returns null, use dataURL.
      try{resolve(dataUrlToBlob(canvas.toDataURL("image/jpeg",quality)));}
      catch{resolve(null);}
    };

    try{
      if(typeof canvas.toBlob==="function"){
        canvas.toBlob(finish,"image/jpeg",quality);
        // Some WebKit builds can delay the callback on busy live video.
        setTimeout(()=>finish(null),180);
      }else{
        finish(null);
      }
    }catch{finish(null);}
  });
}

function roleFrameLabel(role,label){return `${roleTitle(role)} · ${label||''}`;}
function frameRole(frame){
  const direct=String(frame?.camera_role||'').toLowerCase();if(CAMERA_ROLES.includes(direct))return direct;
  const label=String(frame?.label||'');
  if(/^Rear\s*[·|:-]/i.test(label))return 'rear';
  if(/^Overhead\s*[·|:-]/i.test(label))return 'overhead';
  if(/^Side\s*[·|:-]/i.test(label))return 'side';
  return 'side'; // legacy frames from older builds were Side-only
}
const LIVE_COACH_FRAME_PREFIX='K15@';
function liveCoachFrameToken(releaseEpochMs){const n=Math.round(Number(releaseEpochMs));return Number.isFinite(n)?`${LIVE_COACH_FRAME_PREFIX}${n}`:`${LIVE_COACH_FRAME_PREFIX}unknown`;}
function liveCoachFrameLabel(role,label,releaseEpochMs){return `${roleTitle(role)} · ${liveCoachFrameToken(releaseEpochMs)} · ${label||''}`;}
function frameCoachToken(frame){const m=String(frame?.label||'').match(/K15@(\d+|unknown)/i);return m?m[0]:null;}
function frameBaseLabel(frame){return String(frame?.label||'').replace(/^(Side|Rear|Overhead)\s*[·|:-]\s*/i,'').replace(/^K15@(\d+|unknown)\s*[·|:-]\s*/i,'')||'Key frame';}
function roleFramesForShot(shotId,role='side'){
  let rows=(STATE.shot_frames||[]).filter(f=>f.shot_id===Number(shotId)&&frameRole(f)===role).sort((a,b)=>a.offset_ms-b.offset_ms);
  // BLE4.3.8.8: if the backend ever reuses a numeric shot id, only show frames tagged
  // for THIS release epoch. Old thumbnails must never bleed into a new Capture.
  const adv=loadAdvancedShotMetrics(Number(shotId)),release=Number(adv?.release_epoch_ms||adv?.releaseEpochMs),wanted=Number.isFinite(release)?liveCoachFrameToken(release):null;
  if(wanted){const tagged=rows.filter(f=>frameCoachToken(f)===wanted);if(tagged.length)rows=tagged;}
  const byOffset=new Map();for(const f of rows){const k=Math.round(Number(f.offset_ms)||0),prev=byOffset.get(k);if(!prev||Number(f.id)>Number(prev.id))byOffset.set(k,f);}
  return [...byOffset.values()].sort((a,b)=>Number(a.offset_ms)-Number(b.offset_ms));
}
function allFramesForShot(shotId){return (STATE.shot_frames||[]).filter(f=>f.shot_id===Number(shotId)).sort((a,b)=>a.offset_ms-b.offset_ms);}
function evidenceBufferTargetWidth(role){
  const active=Math.max(1,CAMERA_ROLES.filter(r=>!!liveStreams[r]).length),v=$(`#${role}Video`),source=Number(v?.videoWidth)||1280;
  const phase=String(liveRoleMetrics[role]?.phase||livePhase||"Setup"),hot=/Expansion|Release|Follow/i.test(phase),working=/Draw|Anchor|Aim|Hold/i.test(phase);
  // Preserve detector budget first. Rolling evidence is compressed; the release-center fallback can still use a larger source crop.
  const budget=hot?(active===1?960:active===2?800:720):working?(active===1?800:720):(active===1?720:640);
  return Math.max(480,Math.min(source,budget));
}
function releaseSnapshotTargetWidth(role){
  const active=Math.max(1,CAMERA_ROLES.filter(r=>!!liveStreams[r]).length),v=$(`#${role}Video`),source=Number(v?.videoWidth)||1280;
  const budget=active===1?1440:(role==='side'?1280:960);
  return Math.max(640,Math.min(source,budget));
}

const lastBufferSampleAt = {side:0,rear:0,overhead:0};
function evidenceBufferCadenceMs(role){
  const phase=String(liveRoleMetrics[role]?.phase||livePhase||"Setup"),active=/Draw|Anchor|Aim|Hold|Expansion|Release|Follow/i.test(phase);
  const centralRole=window.PoseEngine?.getAuthorityRole?.()||null;
  // X2.7: Anchor is the only sparse-history phase that gets a short higher-density burst.
  // Release still belongs to the untouched Native30 rolling buffer, so this does not steal
  // release density or alter detector timing.
  if(/^Anchor$/i.test(phase))return centralRole===role?65:95;
  if(active)return centralRole===role?120:180;
  return 320;
}
async function sampleLiveFrameBuffer(role){
  const v=$(`#${role}Video`);
  if(!CAMERA_ROLES.includes(role)||liveBufferBusy[role]||!v?.srcObject||v.readyState<2)return;
  const captureEpoch=Date.now(),cadence=evidenceBufferCadenceMs(role);
  if(captureEpoch-lastBufferSampleAt[role]<cadence)return;
  lastBufferSampleAt[role]=captureEpoch;liveBufferBusy[role]=true;
  try{
    const targetWidth=evidenceBufferTargetWidth(role);const blob=await captureVideoBlob(v,targetWidth,.74);
    if(blob){
      const buf=liveFrameBuffers[role];const mediaTime=Number(v.currentTime);buf.push({epochMs:captureEpoch,mediaTime:Number.isFinite(mediaTime)?mediaTime:null,blob});
      // Retain a long low-density history for slow holds, while keeping the most recent release window dense.
      while(buf.length&&buf[0].epochMs<captureEpoch-30000)buf.shift();
      if(buf.length>360){
        const recentCut=captureEpoch-6500,kept=[];let lastOld=-Infinity;
        for(const f of buf){if(f.epochMs>=recentCut||f.epochMs-lastOld>=220){kept.push(f);if(f.epochMs<recentCut)lastOld=f.epochMs;}}
        liveFrameBuffers[role].splice(0,liveFrameBuffers[role].length,...kept.slice(-360));
      }
    }
  }finally{liveBufferBusy[role]=false;}
}
function updateLiveBufferStatus(){
  const el=$('#filmstripStatus');if(!el)return;
  const active=CAMERA_ROLES.filter(r=>!!liveStreams[r]);
  if(!active.length)return;
  const ready=active.map(role=>{
    const buf=liveFrameBuffers[role];
    if(!buf.length)return `${roleTitle(role)} warming`;
    const span=(buf.at(-1).epochMs-buf[0].epochMs)/1000,fps=denseEvidenceFps(role),dense=liveDenseFrameBuffers[role]?.length||0;
    return `${roleTitle(role)} ${Math.max(0,span).toFixed(1)}s history · Native ${Number.isFinite(fps)?fps.toFixed(0):"—"} fps (${dense})`;
  });
  if(!selectedShotId)el.textContent=`${ready.join(' · ')}`;
}
function startLiveFrameBuffer(){
  if(liveFrameTimer)return;
  liveFrameTimer=setInterval(async()=>{
    const active=CAMERA_ROLES.filter(r=>!!liveStreams[r]);
    await Promise.all(active.map(r=>sampleLiveFrameBuffer(r)));
    updateLiveBufferStatus();
  },32);
}
function nearestBufferedFrame(epochMs,role='side',maxDeltaMs=125){
  const buf=liveFrameBuffers[role]||[];let best=null,delta=Infinity;
  for(const f of buf){const d=Math.abs(f.epochMs-epochMs);if(d<delta){delta=d;best=f;}}
  // V5: missing evidence is preferable to a confidently mislabelled phase frame.
  return best&&delta<=maxDeltaMs?{...best,deltaMs:delta}:null;
}
function blobToDataUrl(blob){
  return new Promise(resolve=>{if(!blob){resolve(null);return;}const r=new FileReader();r.onload=()=>resolve(typeof r.result==='string'?r.result:null);r.onerror=()=>resolve(null);r.readAsDataURL(blob);});
}
async function uploadShotFrameData(shotId,dataUrl,offset,label,sourceTimeS=null){
  if(!dataUrl)return null;
  const payload={data_url:dataUrl,offset_ms:Number(offset)||0,label:label||'',source_time_s:Number.isFinite(sourceTimeS)?Number(sourceTimeS):null};
  return api(`/api/shots/${shotId}/frame-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function uploadShotFrame(shotId,blob,offset,label,sourceTimeS=null){
  if(!blob)return null;
  const fd=new FormData();fd.append('file',new File([blob],`shot_${shotId}_${offset}.jpg`,{type:blob.type||'image/jpeg'}));fd.append('offset_ms',String(offset));fd.append('label',label);if(Number.isFinite(sourceTimeS))fd.append('source_time_s',sourceTimeS.toFixed(4));
  return api(`/api/shots/${shotId}/frames`,{method:'POST',body:fd});
}
function coachEvidencePlan(metrics,eventEpochMs){
  const upgraded=window.CoachKeyframePlanCore?.build15?.(metrics?.phaseTimeline||[],eventEpochMs);
  if(upgraded?.requests?.length)return upgraded;
  const built=window.CoreEngine?.buildCoachEvidencePlan?.(metrics?.phaseTimeline||[],eventEpochMs);
  if(built?.requests?.length)return {...built,targetCount:15};
  return {source:'release-window-15',targetCount:15,requiredPostMs:1580,requests:[
    {offset:-2800,label:'Draw / Anchor Context',phase:'Draw',priority:5},{offset:-1600,label:'Anchor / Hold Context',phase:'Anchor',priority:6},
    {offset:-700,label:'Late Hold',phase:'Aim / Hold',priority:7},{offset:-450,label:'Expansion Context',phase:'Expansion',priority:7},
    {offset:-250,label:'Pre-Release · -0.25 s',phase:'Release',priority:10},{offset:-100,label:'Pre-Release · -0.10 s',phase:'Release',priority:10},
    {offset:0,label:'Release',phase:'Release',priority:10},{offset:80,label:'Post-Release · +0.08 s',phase:'Follow Through',priority:10},
    {offset:180,label:'Post-Release · +0.18 s',phase:'Follow Through',priority:10},{offset:300,label:'Post-Release · +0.30 s',phase:'Follow Through',priority:9},
    {offset:450,label:'Early Follow-through',phase:'Follow Through',priority:8},{offset:600,label:'Follow-through · +0.60 s',phase:'Follow Through',priority:8},
    {offset:800,label:'Follow-through · +0.80 s',phase:'Follow Through',priority:7},{offset:1000,label:'Follow-through · +1.00 s',phase:'Follow Through',priority:7},
    {offset:1400,label:'Late Follow-through / Recovery',phase:'Follow Through',priority:7}
  ]};
}
function keyframeFallbackLabel(offset){
  const o=Number(offset)||0;if(Math.abs(o)<=55)return 'Release Detail';if(o<0)return o<=-900?'Shot Context':o<=-350?'Hold / Expansion Context':'Pre-Release Detail';
  if(o<=350)return 'Post-Release Detail';if(o<=1100)return 'Follow-through';return 'Late Follow-through / Recovery';
}
const coachEvidenceBackfillBusy=new Set();
async function backfillCoachKeyframesFromEvidence(shotId,role,metrics,eventEpochMs){
  const token=`${Number(shotId)}:${role}`;if(coachEvidenceBackfillBusy.has(token))return false;coachEvidenceBackfillBusy.add(token);
  try{
    const rec=await evidenceDbGet(shotId,role,currentSessionId);if(!rec?.frames?.length)return false;
    await reload();selectedShotId=Number(shotId);
    const targetCount=15,existing=roleFramesForShot(shotId,role),existingOffsets=existing.map(f=>Number(f.offset_ms)).filter(Number.isFinite);
    if(existingOffsets.length>=targetCount)return false;
    const plan=coachEvidencePlan(metrics,eventEpochMs),usedEpochs=new Set(),candidates=[];
    const reservedOffsets=()=>[...existingOffsets,...candidates.map(c=>c.offset)];
    const pickNearest=(target,tolerance)=>{
      const targetOff=Number(target);let best=null,delta=Infinity;for(const f of rec.frames||[]){const epoch=Number(f.epochMs),off=Number(f.offsetMs);if(!Number.isFinite(epoch)||!Number.isFinite(off)||usedEpochs.has(epoch))continue;if(targetOff<=-60&&off>=-20)continue;if(targetOff>=60&&off<=20)continue;if(reservedOffsets().some(x=>Math.abs(x-off)<=55))continue;const d=Math.abs(off-targetOff);if(d<delta){delta=d;best=f;}}
      return best&&delta<=tolerance?best:null;
    };
    for(const req of (plan.requests||[]).slice(0,targetCount)){
      if(existingOffsets.length+candidates.length>=targetCount)break;
      if(reservedOffsets().some(x=>Math.abs(x-Number(req.offset))<=28))continue;
      const tolerance=Math.abs(Number(req.offset))<=350?190:Math.abs(Number(req.offset))<=1600?300:480,best=pickNearest(req.offset,tolerance);if(!best)continue;
      const actualOffset=Math.round(Number(best.offsetMs));usedEpochs.add(Number(best.epochMs));candidates.push({frame:best,offset:actualOffset,label:liveCoachFrameLabel(role,req.label||keyframeFallbackLabel(actualOffset),eventEpochMs)});
    }
    // Availability is allowed to vary (10 fps browser fallback vs ~30 fps native). If a
    // planned slot collides with another real frame, fill from the persisted evidence itself
    // until the coach gets up to 15 useful, spread-out summary frames.
    const fallbackTargets=[-5200,-4300,-3400,-2600,-2000,-1500,-1100,-800,-550,-350,-220,-120,-60,60,120,220,350,500,700,900,1150,1400,1650,2200,2800];
    for(const t of fallbackTargets){
      if(existingOffsets.length+candidates.length>=targetCount)break;const best=pickNearest(t,Math.abs(t)<=350?190:Math.abs(t)<=1650?360:650);if(!best)continue;
      const actualOffset=Math.round(Number(best.offsetMs));usedEpochs.add(Number(best.epochMs));candidates.push({frame:best,offset:actualOffset,label:liveCoachFrameLabel(role,keyframeFallbackLabel(actualOffset),eventEpochMs)});
    }
    // Last-resort max-gap fill: never invent a frame; use only real persisted evidence.
    while(existingOffsets.length+candidates.length<targetCount){
      const occupied=reservedOffsets();let best=null,bestScore=-Infinity;for(const f of rec.frames||[]){const epoch=Number(f.epochMs),off=Number(f.offsetMs);if(!Number.isFinite(epoch)||!Number.isFinite(off)||usedEpochs.has(epoch)||occupied.some(x=>Math.abs(x-off)<=55))continue;const minGap=occupied.length?Math.min(...occupied.map(x=>Math.abs(x-off))):9999;const releaseBonus=Math.abs(off)<=350?120:Math.abs(off)<=900?55:0;const score=minGap+releaseBonus;if(score>bestScore){bestScore=score;best=f;}}
      if(!best)break;const actualOffset=Math.round(Number(best.offsetMs));usedEpochs.add(Number(best.epochMs));candidates.push({frame:best,offset:actualOffset,label:liveCoachFrameLabel(role,keyframeFallbackLabel(actualOffset),eventEpochMs)});
    }
    let saved=0;
    for(const c of candidates){try{await uploadShotFrame(shotId,c.frame.blob,c.offset,c.label,null);existingOffsets.push(c.offset);saved++;}catch(err){console.warn('Coach 15-frame evidence backfill failed',role,c.offset,err);}}
    if(saved){await reload();selectedShotId=Number(shotId);renderFilmstrip(selectedShot());}
    return saved>0;
  }finally{coachEvidenceBackfillBusy.delete(token);}
}
async function snapshotPendingLiveFrames(ctx){
  if(!ctx?.eventEpochMs)return;
  const roles=(ctx.roles||CAMERA_ROLES.filter(r=>!!liveStreams[r]));
  const plan=ctx.evidencePlan||coachEvidencePlan(ctx.metrics,ctx.eventEpochMs);ctx.evidencePlan=plan;
  const selected=[];
  for(const role of roles){
    for(const k of plan.requests){
      const tolerance=Math.abs(k.offset)<=300?75:120;
      const f=nearestEvidenceFrame(ctx.eventEpochMs+k.offset,role,tolerance);
      if(f?.blob||f?.dataUrl||f?.bitmap){const actualOffset=Math.round(Number(f.epochMs)-Number(ctx.eventEpochMs));selected.push({offset:actualOffset,requestedOffset:k.offset,label:k.label,phase:k.phase,role,source:f,sourceEpochMs:Number(f.epochMs),sourceMediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,syncDeltaMs:f.deltaMs,evidenceSource:f.evidenceSource||null});}
    }
    const center=ctx.centerDataUrls?.[role];
    if(center&&!selected.some(f=>f.role===role&&f.offset===0))selected.push({role,offset:0,label:'Release Onset',phase:'Release',dataUrl:center,sourceEpochMs:Number(ctx.eventEpochMs),sourceMediaTime:null,syncDeltaMs:ctx.centerSyncDelta?.[role]??null,evidenceSource:'release-center-fallback'});
    if(!selected.some(f=>f.role===role&&f.offset===0)){
      const f=nearestEvidenceFrame(ctx.eventEpochMs,role,75);if(f)selected.push({role,offset:Math.round(Number(f.epochMs)-Number(ctx.eventEpochMs)),requestedOffset:0,label:'Release Onset',phase:'Release',source:f,sourceEpochMs:Number(f.epochMs),sourceMediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,syncDeltaMs:f.deltaMs,evidenceSource:f.evidenceSource||null});
    }
  }
  // X2.2: freeze selected native frames NOW. Upload happens later and may take >2.6 s;
  // never leave filmstrip candidates pointing at ImageBitmaps that the rolling buffer can prune/close.
  const refs=[...new Set(selected.map(x=>x.source?.denseRef).filter(Boolean))];refs.forEach(r=>r.pins=(r.pins||0)+1);
  const blobCache=new Map(),frames=[];
  try{
    for(let i=0;i<selected.length;i+=6){
      const batch=await Promise.all(selected.slice(i,i+6).map(async item=>{
        if(item.dataUrl)return {role:item.role,offset:item.offset,label:item.label,phase:item.phase,dataUrl:item.dataUrl,sourceEpochMs:item.sourceEpochMs??null,sourceMediaTime:item.sourceMediaTime??null,syncDeltaMs:item.syncDeltaMs,evidenceSource:item.evidenceSource};
        const f=item.source;if(!f)return null;
        if(f.blob)return {role:item.role,offset:item.offset,label:item.label,phase:item.phase,blob:f.blob,sourceEpochMs:item.sourceEpochMs??(Number(f.epochMs)||null),sourceMediaTime:item.sourceMediaTime??(Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null),syncDeltaMs:item.syncDeltaMs,evidenceSource:item.evidenceSource};
        const key=`${item.role}:${f.epochMs}`;let blob=blobCache.get(key);if(blob===undefined){blob=await evidenceFrameToBlob(f,.84);blobCache.set(key,blob||null);}
        return blob?{role:item.role,offset:item.offset,label:item.label,phase:item.phase,blob,sourceEpochMs:item.sourceEpochMs??(Number(f.epochMs)||null),sourceMediaTime:item.sourceMediaTime??(Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null),syncDeltaMs:item.syncDeltaMs,evidenceSource:item.evidenceSource}:null;
      }));
      frames.push(...batch.filter(Boolean));
    }
  }finally{refs.forEach(r=>r.pins=Math.max(0,(r.pins||1)-1));roles.forEach(role=>pruneDenseFrameBuffer(role,Date.now()));}
  const uniq=new Map();
  for(const f of frames){
    const role=f.role,mt=Number(f.sourceMediaTime),epoch=Number(f.sourceEpochMs);
    const same=[...uniq.values()].find(x=>x.role===role&&((Number.isFinite(mt)&&Number.isFinite(Number(x.sourceMediaTime))&&Math.abs(mt-Number(x.sourceMediaTime))<0.0008)||(Number.isFinite(epoch)&&Number.isFinite(Number(x.sourceEpochMs))&&Math.abs(epoch-Number(x.sourceEpochMs))<=8)));
    if(same)continue;
    const near=[...uniq.values()].find(x=>x.role===role&&Math.abs(Number(x.offset)-Number(f.offset))<45);if(near)continue;
    uniq.set(`${role}:${Number.isFinite(epoch)?epoch:f.offset}`,f);
  }
  ctx.frameCandidates=[...uniq.values()].sort((a,b)=>CAMERA_ROLES.indexOf(a.role)-CAMERA_ROLES.indexOf(b.role)||a.offset-b.offset);
}
async function persistPendingLiveFrames(shotId,ctx,{skipCenter=false}={}){
  const frames=(ctx?.frameCandidates||[]).filter(f=>!(skipCenter&&f.offset===0)).map(f=>({...f,label:liveCoachFrameLabel(f.role,f.label||formatOffset(f.offset),ctx?.eventEpochMs)}));
  if(!frames.length)return false;
  frameGenerationInFlight.add(shotId);renderFilmstrip(STATE.shots.find(x=>x.id===shotId));let saved=0;
  try{
    const failures=[];
    for(const f of frames){
      try{
        if(f.blob){await uploadShotFrame(shotId,f.blob,f.offset,f.label,null);saved++;}
        else if(f.bitmap){const blob=await evidenceFrameToBlob(f,.84);if(blob){await uploadShotFrame(shotId,blob,f.offset,f.label,null);saved++;}}
        else if(f.dataUrl){await uploadShotFrameData(shotId,f.dataUrl,f.offset,f.label,null);saved++;}
      }catch(err){failures.push(`${roleTitle(f.role)} ${f.label||formatOffset(f.offset)}`);console.warn('Key-frame save failed',f.role,f.offset,err);}
    }
    await reload();selectedShotId=shotId;renderFilmstrip(selectedShot());
    if(failures.length)toast(`${saved} evidence frames saved · ${failures.length} failed (${failures.slice(0,3).join(', ')}${failures.length>3?'…':''}).`,'warn',4200);
    else if(saved)toast(`${saved} phase-aware evidence frame${saved===1?'':'s'} saved.`,'good',1800);
    return saved>0;
  }catch(err){console.warn(err);toast(`Evidence-frame save failed: ${String(err?.message||err).slice(0,150)}`,'warn',5000);return false;}
  finally{frameGenerationInFlight.delete(shotId);}
}
function seekVideo(video,time){
  return new Promise((resolve,reject)=>{if(!video||!Number.isFinite(time)){reject(new Error('No video time'));return;}const t=Math.max(0,Math.min(Number.isFinite(video.duration)?Math.max(0,video.duration-.02):time,time));if(Math.abs((video.currentTime||0)-t)<.015){resolve();return;}const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(new Error('Video seek failed'));};const cleanup=()=>{video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};video.addEventListener('seeked',done,{once:true});video.addEventListener('error',fail,{once:true});try{video.currentTime=t;}catch(e){cleanup();reject(e);}});
}
async function generateSavedVideoKeyframesForRole(shotId,shotTime,role='side'){
  const v=$(`#${role}Video`),shot=STATE.shots.find(x=>x.id===Number(shotId)),centerLabel=shot?.phase&&shot.phase!=='Release'?'Shot Mark':'Release';
  if(!v||v.srcObject||!(v.currentSrc||v.src)){toast(`A saved ${roleTitle(role)} video is required to generate key frames.`,'warn');return false;}
  const token=`${shotId}:${role}`;if(frameGenerationInFlight.has(token))return false;frameGenerationInFlight.add(token);renderFilmstrip(shot);
  const originalTime=v.currentTime||0,wasPaused=v.paused;
  // Legacy/manual video import has no live phase timeline, so retain a compact release-window fallback.
  try{v.pause();for(const k of LEGACY_VIDEO_KEYFRAME_OFFSETS){const t=Math.max(0,Number(shotTime)+(k.offset/1000));if(Number.isFinite(v.duration)&&t>=v.duration)continue;await seekVideo(v,t);const dataUrl=captureVideoDataUrl(v,720,.82);if(dataUrl)await uploadShotFrameData(shotId,dataUrl,k.offset,roleFrameLabel(role,k.offset===0?centerLabel:k.label),t);}await reload();selectedShotId=shotId;renderFilmstrip(selectedShot());toast(`${roleTitle(role)} key frames generated.`,'good');return true;}catch(err){console.warn(err);toast(`Could not generate every ${roleTitle(role)} key frame.`,'warn');return false;}finally{try{await seekVideo(v,originalTime);}catch{}if(!wasPaused)v.play().catch(()=>{});frameGenerationInFlight.delete(token);}
}
async function generateSavedVideoKeyframes(shotId,shotTime){return generateSavedVideoKeyframesForRole(shotId,shotTime,reviewRole==='multi'?'side':reviewRole);}
function scheduleLiveKeyframesForAutoShot(shotId,eventEpochMs,centerDataUrls={},roles=null,metrics=null,centerSyncDelta={}){
  const evidencePlan=coachEvidencePlan(metrics,eventEpochMs);
  const ctx={eventEpochMs,centerDataUrls,centerSyncDelta,roles:roles||CAMERA_ROLES.filter(r=>!!liveStreams[r]),metrics,evidencePlan};
  // Wait only long enough for the selected post-release evidence. Shot creation itself already happened.
  setTimeout(async()=>{await snapshotPendingLiveFrames(ctx);await persistPendingLiveFrames(shotId,ctx,{skipCenter:true});},Math.min(1500,Math.max(700,evidencePlan.requiredPostMs||1050)));
}
function currentReviewVideoRole(){return reviewRole==='multi'?'side':reviewRole;}
function updateReviewControls(){
  const role=currentReviewVideoRole(),v=$(`#${role}Video`),shot=selectedShot(),saved=reviewRole!=='multi'&&!!(v&&!v.srcObject&&(v.currentSrc||v.src)),replay=!!shotReplayState.record?.frames?.length;
  ["prevFrameBtn","nextFrameBtn","replayMinusFrameBtn","replayPlusFrameBtn"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=!(replay||saved);});
  if($("#jumpReleaseBtn"))$("#jumpReleaseBtn").disabled=!shot||!(replay||saved);
  if($("#jumpAnchorBtn"))$("#jumpAnchorBtn").disabled=!shot||!replay||!Number.isFinite(replayAnchorOffsetForShot(shot));
  ["replayZoomOutBtn","replayZoomResetBtn","replayZoomInBtn"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=!replay;});
  ["replayPanLeftBtn","replayPanUpBtn","replayPanDownBtn","replayPanRightBtn"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=!replay||Number(shotReplayState.zoom)<=1.001;});
  if($("#replayPlayBtn"))$("#replayPlayBtn").disabled=!replay;
  if($("#replaySpeedSelect"))$("#replaySpeedSelect").disabled=!replay;
  if($("#generateFramesBtn"))$("#generateFramesBtn").disabled=!shot||!saved||frameGenerationInFlight.has(`${shot?.id}:${role}`);
}
function stepSavedVideo(delta){const role=currentReviewVideoRole(),v=$(`#${role}Video`);if(!v||v.srcObject)return false;try{v.currentTime=Math.max(0,(v.currentTime||0)+delta);return true;}catch{return false;}}
function stepReviewFrame(dir){if(stepShotReplay(dir))return;stepSavedVideo(dir/30);}
function jumpSelectedShot(){if(jumpReplayRelease())return;const role=currentReviewVideoRole(),shot=selectedShot(),v=$(`#${role}Video`);if(!shot||!v||v.srcObject)return;try{v.currentTime=Math.max(0,Number(shot.timestamp_s)||0);}catch{}}


// -----------------------------
// Analysis / interpretation
// -----------------------------
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmtNum(v,d=1,suffix=""){const n=Number(v);return Number.isFinite(n)?`${n.toFixed(d)}${suffix}`:"—";}
function sessionShots(sessionId=currentSessionId){return STATE.shots.filter(x=>x.session_id===Number(sessionId)).sort((a,b)=>a.shot_no-b.shot_no);}
function median(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function mad(values,med){const d=values.filter(Number.isFinite).map(v=>Math.abs(v-med));return median(d);}
function normalizeLineDeg(v){const n=Number(v);if(!Number.isFinite(n))return null;let x=n;while(x>90)x-=180;while(x<=-90)x+=180;return x;}
function metricValue(record,metric){const n=Number(record?.[metric.key]);if(!Number.isFinite(n))return null;return metric.key==="shoulder_line_deg"?normalizeLineDeg(n):n;}
const METRICS=[
  {key:"draw_elbow_deg",label:"Draw Elbow",unit:"°",floor:2.0},
  {key:"bow_arm_deg",label:"Bow Arm",unit:"°",floor:2.0},
  {key:"shoulder_line_deg",label:"Shoulder Line",unit:"°",floor:1.5},
  {key:"torso_lean_deg",label:"Torso Lean",unit:"°",floor:2.0},
  {key:"head_movement_mm",label:"Head Movement",unit:" mm",floor:8.0},
  {key:"hold_time_s",label:"Hold Time",unit:" s",floor:.45},
];
function shotIsBaselineEligible(shot){
  if(!shot||shot.status==='bad')return false;
  if(Number.isFinite(Number(shot.pose_confidence))&&Number(shot.pose_confidence)<.45)return false;
  if(shot.is_reference)return true;
  if(!shot.auto_detected)return true;
  const adv=loadAdvancedShotMetrics(shot.id);
  return adv?.confirmed_release===true;
}
function athleteSessionsForShot(shot){const sess=STATE.sessions.find(s=>s.id===shot?.session_id);return sess?STATE.sessions.filter(s=>s.athlete_id===sess.athlete_id):[];}
function baselineFor(sessionId=currentSessionId,excludeId=null){
  const currentShots=sessionShots(sessionId).filter(s=>s.id!==excludeId&&shotIsBaselineEligible(s));
  const session=STATE.sessions.find(s=>s.id===Number(sessionId));
  const athleteSessionIds=new Set(STATE.sessions.filter(s=>s.athlete_id===session?.athlete_id).map(s=>s.id));
  const athleteRefs=STATE.shots.filter(s=>s.id!==excludeId&&s.is_reference&&athleteSessionIds.has(s.session_id)&&shotIsBaselineEligible(s));
  const currentRefs=currentShots.filter(s=>s.is_reference);
  let source,sourceLabel;
  if(currentRefs.length>=3){source=currentRefs;sourceLabel="Coach reference shots · current session";}
  else if(athleteRefs.length>=3){source=athleteRefs;sourceLabel="Coach reference set · this athlete";}
  else{source=currentShots.filter(s=>METRICS.some(m=>Number.isFinite(Number(s[m.key]))));sourceLabel="Validated session baseline (mark 3+ reference shots for a coach-approved athlete baseline)";}
  const stats={};
  METRICS.forEach(m=>{const vals=source.map(s=>metricValue(s,m)).filter(Number.isFinite),med=median(vals),md=med==null?null:mad(vals,med);stats[m.key]={median:med,mad:md,n:vals.length,scale:Math.max(m.floor,Number.isFinite(md)?1.4826*md:0)};});
  return {source,sourceLabel,stats,ready:source.length>=3};
}
function advancedReferenceSet(shot){
  if(!shot)return[];const session=STATE.sessions.find(s=>s.id===shot.session_id);if(!session)return[];
  const sessionIds=new Set(STATE.sessions.filter(s=>s.athlete_id===session.athlete_id).map(s=>s.id));
  let refs=STATE.shots.filter(s=>s.is_reference&&s.id!==shot.id&&sessionIds.has(s.session_id)&&shotIsBaselineEligible(s));
  if(refs.length<3)refs=sessionShots(shot.session_id).filter(s=>s.id!==shot.id&&shotIsBaselineEligible(s));
  return refs.map(s=>({shot:s,adv:loadAdvancedShotMetrics(s.id)})).filter(x=>x.adv);
}
function advancedMedian(refs,key){const vals=refs.map(x=>Number(x.adv?.[key])).filter(Number.isFinite);return{median:median(vals),mad:vals.length?mad(vals,median(vals)):null,n:vals.length};}

function interpretShot(shot){
  if(!shot)return {label:"Building baseline",css:"building",summary:"No shot selected.",details:[]};
  if(shot.status==='bad')return {label:"Excluded",css:"review",summary:"Coach marked this event as excluded; it is not used to build the athlete baseline.",details:[],base:baselineFor(shot.session_id,shot.id)};
  if(shot.auto_detected&&!shot.is_reference&&loadAdvancedShotMetrics(shot.id)?.confirmed_release!==true)return {label:"Unverified event",css:"review",summary:"This auto event was not confirmed by the V5 completed-shot sequence and is excluded from baseline calculations.",details:[],base:baselineFor(shot.session_id,shot.id)};
  const base=baselineFor(shot.session_id,shot.id); if(!base.ready)return {label:"Building baseline",css:"building",summary:"Collect at least 3 validated shots, or mark coach-approved reference shots.",details:[],base};
  const deviations=[];
  METRICS.forEach(m=>{const v=metricValue(shot,m),st=base.stats[m.key];if(!Number.isFinite(v)||!Number.isFinite(st.median)||st.n<2)return;const delta=v-st.median,z=Math.abs(delta)/Math.max(st.scale,m.floor);deviations.push({metric:m,value:v,median:st.median,delta,z});});
  if(!deviations.length)return {label:"Building baseline",css:"building",summary:"This shot does not yet contain enough pose measurements.",details:[],base};
  deviations.sort((a,b)=>b.z-a.z);const max=deviations[0].z,avg=deviations.reduce((s,x)=>s+x.z,0)/deviations.length;
  let label="Stable",css="stable"; if(max>3||avg>2) {label="Significant Deviation";css="significant";} else if(max>1.5||avg>1.05){label="Review";css="review";}
  const top=deviations.filter(x=>x.z>1).slice(0,3);
  const summary=top.length?top.map(x=>`${x.metric.label} ${x.delta>=0?"+":""}${x.delta.toFixed(x.metric.key==="hold_time_s"?2:1)}${x.metric.unit} vs baseline`).join(" · "):"Measurements are close to this athlete's current baseline.";
  return {label,css,summary,details:deviations,base};
}
function renderAnchorReleaseAnalysis(shot){
  const anchorHost=$("#anchorAnalysis"),releaseHost=$("#releaseAnalysis");if(!anchorHost||!releaseHost)return;
  const adv=loadAdvancedShotMetrics(shot.id),refs=advancedReferenceSet(shot);
  if(!adv){
    anchorHost.innerHTML='<div class="intelligence-note low">Anchor detail was not stored for this shot. Capture a new V5 shot or use a coach reference created with the new detector.</div>';
    releaseHost.innerHTML='<div class="intelligence-note low">Release path was not stored for this shot. Older shots remain available, but V5 will not invent release-vector data.</div>';
    return;
  }
  const handXs=advancedMedian(refs,'anchor_ref_hand_x'),handYs=advancedMedian(refs,'anchor_ref_hand_y'),face=advancedMedian(refs,'anchor_ref_face_pct'),pitch=advancedMedian(refs,'anchor_ref_head_pitch');
  const handDev=Number.isFinite(Number(adv.anchor_ref_hand_x))&&Number.isFinite(Number(handXs.median))&&Number.isFinite(Number(adv.anchor_ref_hand_y))&&Number.isFinite(Number(handYs.median))?Math.hypot((adv.anchor_ref_hand_x-handXs.median)*100,(adv.anchor_ref_hand_y-handYs.median)*100):null;
  const faceDev=Number.isFinite(Number(adv.anchor_ref_face_pct))&&Number.isFinite(Number(face.median))?adv.anchor_ref_face_pct-face.median:null;
  const pitchDev=Number.isFinite(Number(adv.anchor_ref_head_pitch))&&Number.isFinite(Number(pitch.median))?adv.anchor_ref_head_pitch-pitch.median:null;
  let anchorLabel='Building reference';let anchorCls='';
  if(refs.length>=3&&Number.isFinite(handDev)){
    const threshold=Math.max(2.5,1.4826*Math.max(Number(handXs.mad)||0,Number(handYs.mad)||0)*100*2.2);
    if(handDev<=threshold&&Math.abs(faceDev||0)<=4) {anchorLabel='Within reference';anchorCls='good';}
    else {anchorLabel='Review anchor position';anchorCls='review';}
  }
  const headContribution=Number(adv.head_toward_draw_pct);
  let headText=Number.isFinite(headContribution)?`${headContribution>=0?'+':''}${headContribution.toFixed(1)}% toward draw hand from anchor reference`:'—';
  anchorHost.innerHTML=`<div class="intelligence-note ${anchorCls}"><b>${anchorLabel}</b><br>${refs.length>=3?'Compared with this athlete’s coach/reference history.':'Mark 3+ representative shots as Reference to establish the athlete’s own anchor band.'}</div>
    <div class="intelligence-row"><span>Anchor hand repeatability</span><b>${Number.isFinite(handDev)?`${handDev.toFixed(1)}% shoulder-width from reference`:'Reference building'}</b><small>This separates hand-position change from head movement.</small></div>
    <div class="intelligence-row"><span>Anchor stability during hold</span><b>${Number.isFinite(Number(adv.anchor_hand_rms_pct))?`${Number(adv.anchor_hand_rms_pct).toFixed(1)}% RMS`:'—'}</b><small>Lower means the hand stayed in a tighter area after anchor confirmation.</small></div>
    <div class="intelligence-row"><span>Hand → face relationship</span><b>${Number.isFinite(Number(adv.anchor_ref_face_pct))?`${Number(adv.anchor_ref_face_pct).toFixed(1)}% shoulder-width${Number.isFinite(faceDev)?` · Δ ${faceDev>=0?'+':''}${faceDev.toFixed(1)}%`:''}`:'—'}</b></div>
    <div class="intelligence-row"><span>Head contribution</span><b>${headText}</b><small>A positive value means the head moved toward the draw-hand/string side after anchor was established.</small></div>
    <div class="intelligence-row"><span>Head pitch at anchor</span><b>${Number.isFinite(Number(adv.anchor_ref_head_pitch))?`${Number(adv.anchor_ref_head_pitch).toFixed(1)}°${Number.isFinite(pitchDev)?` · Δ ${pitchDev>=0?'+':''}${pitchDev.toFixed(1)}°`:''}`:'—'}</b></div>
    <div class="intelligence-row"><span>Anchor settle time</span><b>${Number.isFinite(Number(adv.anchor_settle_s))?`${Number(adv.anchor_settle_s).toFixed(2)} s`:'—'}</b></div>`;

  const conf=Number(adv.release_path_confidence),rear=Number(adv.release_rear_pct),off=Number(adv.release_offaxis_pct),offRef=advancedMedian(refs,'release_offaxis_pct'),handOpen=Number(adv.hand_opening_delta_pct);
  let relLabel='Release evidence stored',relCls='';let relNote=`${roleTitle(adv.source_role||'side')} supplied the primary completed-shot evidence. Hand path is body-relative evidence; it does not directly measure string pressure.`;
  if(!Number.isFinite(conf)||conf<.62){relLabel='Low-confidence release path';relCls='low';relNote='Camera angle, occlusion or frame rate did not support a strong release classification.';}
  else if(Number.isFinite(off)&&offRef.n>=3&&Number.isFinite(offRef.median)){
    const limit=Math.max(10,(Number(offRef.mad)||0)*2.5);const delta=off-offRef.median;
    if(delta>limit&&off>30){relLabel='Possible off-axis / pluck-like pattern';relCls='review';relNote=`Off-axis hand motion is ${delta.toFixed(0)} percentage points above this athlete’s reference median. Review video before coaching the cause.`;}
    else{relLabel='Release path within reference';relCls='good';relNote='Early hand path is within this athlete’s current reference band.';}
  }
  releaseHost.innerHTML=`<div class="intelligence-note ${relCls}"><b>${relLabel}</b><br>${escapeHtml(relNote)}</div>
    <div class="intelligence-row"><span>Early release path</span><b>${Number.isFinite(rear)&&Number.isFinite(off)?`${rear.toFixed(0)}% rearward / ${off.toFixed(0)}% off-axis`:'—'}</b><small>Off-axis is a body-relative 2D motion component from the stored evidence view; it is evidence, not automatic proof of plucking.</small></div>
    <div class="intelligence-row"><span>Draw-hand travel</span><b>${Number.isFinite(Number(adv.release_rear_travel_pct))?`${Number(adv.release_rear_travel_pct).toFixed(1)}% shoulder-width rearward`:'—'}</b></div>
    <div class="intelligence-row"><span>Draw-elbow continuation</span><b>${Number.isFinite(Number(adv.release_elbow_travel_pct))?`${Number(adv.release_elbow_travel_pct).toFixed(1)}% shoulder-width`:'—'}</b></div>
    <div class="intelligence-row"><span>Bow-arm reaction</span><b>${Number.isFinite(Number(adv.follow_bow_arm_delta_deg))?`${Number(adv.follow_bow_arm_delta_deg)>=0?'+':''}${Number(adv.follow_bow_arm_delta_deg).toFixed(1)}° early follow-through`:'—'}</b></div>
    <div class="intelligence-row"><span>Head movement after release</span><b>${Number.isFinite(Number(adv.follow_head_move_pct))?`${Number(adv.follow_head_move_pct).toFixed(1)}% shoulder-width`:'—'}</b></div>
    <div class="intelligence-row"><span>Path confidence</span><b>${Number.isFinite(conf)?`${Math.round(conf*100)}%`:'—'}</b></div>
    <div class="intelligence-row"><span>Coarse hand-opening evidence</span><b>${Number.isFinite(handOpen)?`${handOpen>=0?'+':''}${handOpen.toFixed(1)}% shoulder-width change`:'Not reliable for this shot'}</b><small>Derived from pose hand points only. Useful as supporting evidence, not proof of finger plucking.</small></div>
    <div class="intelligence-row"><span>Shot timing signature</span><b>${Number.isFinite(Number(adv.draw_to_anchor_s))?`Draw→Anchor ${Number(adv.draw_to_anchor_s).toFixed(2)} s`:''}${Number.isFinite(Number(adv.anchor_to_arm_s))?` · Anchor settle ${Number(adv.anchor_to_arm_s).toFixed(2)} s`:''}</b><small>Used for athlete-specific rhythm and equipment-demand trends.</small></div>
    <div class="intelligence-row"><span>Draw smoothness evidence</span><b>${Number.isFinite(Number(adv.draw_speed_cv))?`Speed variation CV ${Number(adv.draw_speed_cv).toFixed(2)}`:'—'}</b><small>Lower is more uniform within the measured Draw phase. Compare with this athlete’s own shots rather than using a universal ideal.</small></div>
    ${adv.hand_release_analyzer?`<div class="intelligence-note"><b>Hand Release Analyzer</b><br>${adv.hand_release_analyzer.samples} trajectory samples · ${Number.isFinite(Number(adv.hand_release_analyzer.confidence))?`confidence ${Math.round(Number(adv.hand_release_analyzer.confidence)*100)}%`:'confidence building'} · full 30 fps camera evidence remains available in Replay.</div>
    <div class="intelligence-row"><span>Rearward hand travel</span><b>${Number(adv.hand_release_analyzer.rear_travel_pct).toFixed(1)}% shoulder-width</b></div>
    <div class="intelligence-row"><span>Off-axis hand travel</span><b>${Number(adv.hand_release_analyzer.off_axis_travel_pct).toFixed(1)}% shoulder-width</b></div>
    <div class="intelligence-row"><span>Elbow continuation</span><b>${Number(adv.hand_release_analyzer.elbow_continuation_pct).toFixed(1)}% shoulder-width</b></div>
    <div class="intelligence-row"><span>Path efficiency</span><b>${Number.isFinite(Number(adv.hand_release_analyzer.path_efficiency_pct))?`${Number(adv.hand_release_analyzer.path_efficiency_pct).toFixed(0)}%`:'—'}</b><small>Trajectory straightness evidence, not a universal good/bad score.</small></div>
    <div class="intelligence-row"><span>Forward return / collapse evidence</span><b>${Number(adv.hand_release_analyzer.forward_return_pct).toFixed(1)}% shoulder-width</b><small>Amount the hand returned forward after its rearward peak within the early follow-through window.</small></div>`:'<div class="intelligence-note low"><b>Hand Release Analyzer</b><br>Trajectory evidence is still building for this shot.</div>'}
    <div class="intelligence-row"><span>Fine finger timing</span><b>Not claimed from pose-only evidence</b><small>The current analyzer measures wrist/hand-path and elbow continuation. Individual finger opening timing remains outside pose-only evidence.</small></div>`;
}

function renderMultiViewAnalysis(shot){
  const host=$('#multiViewAnalysis');if(!host)return;
  const adv=loadAdvancedShotMetrics(shot?.id),views=adv?.views||{};
  const roles=CAMERA_ROLES.filter(r=>views[r]||roleFramesForShot(shot?.id,r).length);
  if(!shot||!roles.length){host.innerHTML='<div class="intelligence-note low">No multi-view evidence was captured for this shot. Analysis remains limited to the available camera evidence.</div>';return;}
  const rows=roles.map(role=>{
    const v=views[role]||{},frames=roleFramesForShot(shot.id,role).length,q=Number(v.quality),sync=Number(v.sync_delta_ms);
    const details=[];
    if(Number.isFinite(q))details.push(`Tracking ${Math.round(q*100)}%`);
    if(Number.isFinite(Number(v.draw_elbow_deg)))details.push(`Elbow ${Number(v.draw_elbow_deg).toFixed(1)}°`);
    if(Number.isFinite(Number(v.shoulder_line_deg)))details.push(`Shoulder ${Number(v.shoulder_line_deg).toFixed(1)}°`);
    const metricSync=Number(v.metric_sync_delta_ms),frameSync=Number(v.frame_sync_delta_ms);
    if(Number.isFinite(metricSync))details.push(`metric Δ ${Math.round(metricSync)} ms`);else if(Number.isFinite(sync))details.push(`metric Δ ${Math.round(sync)} ms`);
    if(Number.isFinite(frameSync))details.push(`frame Δ ${Math.round(frameSync)} ms`);
    return `<div class="intelligence-row"><span>${roleTitle(role)}</span><b>${frames} frame${frames===1?'':'s'} captured</b><small>${escapeHtml(details.join(' · ')||'Captured for coach cross-check')}</small></div>`;
  }).join('');
  const rearGood=Number(views.rear?.quality)>=.45,overGood=Number(views.overhead?.quality)>=.45;
  const note=(rearGood||overGood)?'Supplemental camera evidence is available for coach cross-check. Shot timing can now be triggered by any camera that completes a valid shot sequence; per-metric interpretation still uses only views with sufficient evidence.':'Additional views were captured, but tracking confidence was too low to promote them into automated conclusions.';
  host.innerHTML=`<div class="intelligence-note ${rearGood||overGood?'good':'low'}"><b>${roles.length}-view shot record</b><br>${escapeHtml(note)}</div>${rows}`;
}

function setView(name){
  $$(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.view===name));
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  if(name==="analyze")renderAnalyze(); if(name==="compare")renderCompare(); if(name==="impact")renderImpact(); if(name==="reports")renderReport(); if(name==="home")renderHome();
}
function resolveAdaptiveLayout(){
  const w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
  const h=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0);
  let mode=layoutPreference;
  if(mode==="auto"){
    if(w<1180 || h<760) mode="compact";
    else if(w<1680 || h<930) mode="standard";
    else mode="wide";
  }
  resolvedLayoutMode=mode;
  document.body.dataset.layoutMode=mode;
  const label=mode==="compact"?"Compact":mode==="wide"?"Wide":"Standard";
  const badge=$("#adaptiveLayoutBadge");
  if(badge){badge.textContent=`Layout: ${layoutPreference==="auto"?"Auto · ":""}${label}`;badge.className="status-pill neutral compact-status";}
  const settingsBadge=$("#layoutDetectedBadge");
  if(settingsBadge){settingsBadge.textContent=`${label} · ${w}×${h}`;settingsBadge.className="status-pill good";}
  const diag=$("#displayDiagnostics");
  if(diag)diag.textContent=`Viewport ${w} × ${h} CSS px · device pixel ratio ${Number(window.devicePixelRatio||1).toFixed(2)} · ${layoutPreference==="auto"?"Auto":"Manual"} → ${label}`;
  updateCameraWorkspace();
}
function scheduleAdaptiveLayout(){
  clearTimeout(layoutResizeTimer);
  layoutResizeTimer=setTimeout(resolveAdaptiveLayout,80);
}
function selectedAuxCount(){
  return ["rear","overhead"].filter(r=>!!($(`#${r}CameraSelect`)?.value||liveStreams[r])).length;
}
function updateCameraAssignmentSummary(){
  const el=$("#cameraAssignmentSummary");if(!el)return;
  const text=CAMERA_ROLES.map(role=>{const sel=$(`#${role}CameraSelect`),id=sel?.value||getAssignment(role),opt=sel?.selectedOptions?.[0],label=id?(opt?.textContent||"Assigned"):"None";return `${roleTitle(role)} ${label}`;}).join(" · ");
  el.textContent=text;
}
function updateCameraWorkspace(){
  const auxSelected=selectedAuxCount();
  const forceAll=workspaceMode==="review"||workspaceMode==="coach";
  const singleFocus=!forceAll&&!auxViewsExpanded&&auxSelected===0;
  document.body.dataset.cameraFocus=singleFocus?"single":"multi";
  document.body.dataset.focusRole=focusCameraRole;
  document.body.classList.toggle("aux-expanded",!singleFocus);
  $$('[data-camera-card]').forEach(card=>card.classList.toggle('coach-focus',card.dataset.cameraCard===focusCameraRole));
  $$('[data-focus-role]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.focusRole===focusCameraRole);btn.setAttribute('aria-pressed',String(btn.dataset.focusRole===focusCameraRole));});
  const focusBadge=$("#focusViewBadge");if(focusBadge)focusBadge.textContent=`Focus: ${roleTitle(focusCameraRole)}`;
  const badge=$("#singleCameraBadge");
  if(badge){
    const activeCount=Math.max(1,CAMERA_ROLES.filter(r=>$(`#${r}CameraSelect`)?.value||liveStreams[r]).length);
    badge.textContent=singleFocus?"1-Camera Ready · Any View":`${activeCount}-View Evidence Workspace`;
    badge.className=`status-pill ${singleFocus?"good":"neutral"} compact-status`;
  }
  const btn=$("#auxViewsToggle");
  if(btn){btn.disabled=forceAll;btn.textContent=forceAll?"All camera roles shown":(singleFocus?"Show Rear / Overhead":"Hide Rear / Overhead");}
  const status=$("#oneCameraSettingStatus");if(status)status.textContent=singleFocus?"Single Camera · Adaptive Shot Detection":"Multi-view Active";
  updateCameraAssignmentSummary();
}
function setFocusCameraRole(role){
  const safe=CAMERA_FOCUS_SAFE(role);if(!safe)return;
  focusCameraRole=safe;localStorage.setItem('3pm-focus-role',safe);updateCameraWorkspace();
}
function toggleAuxViews(){
  auxViewsExpanded=!auxViewsExpanded;
  localStorage.setItem("3pm-aux-views",String(auxViewsExpanded));
  updateCameraWorkspace();
}
function bestLiveShotRole(){
  const tracked=window.PoseEngine?.getAuthorityRole?.();
  if(tracked&&liveRoleMetrics[tracked]?.detected)return {role:tracked,m:liveRoleMetrics[tracked],score:window.CoreEngine?.evidenceScore?.(liveRoleMetrics[tracked])??0,reason:"tracked authority"};
  const core=window.CoreEngine?.selectAuthorityRole?.(liveRoleMetrics);
  if(core?.role&&liveRoleMetrics[core.role]?.detected)return {role:core.role,m:liveRoleMetrics[core.role],score:core.score,reason:core.reason};
  const roles=CAMERA_ROLES.map(role=>({role,m:liveRoleMetrics[role]})).filter(x=>x.m?.detected);
  roles.sort((a,b)=>(Number(b.m.shotObservability)||0)-(Number(a.m.shotObservability)||0));
  return roles[0]||null;
}
function onPoseMetrics(role,metrics){
  if(!CAMERA_ROLES.includes(role))return;liveRoleMetrics[role]=metrics||null;appendPhaseTrace(role,metrics);appendPendingTrajectory(role,metrics);finalizeFollowEvidenceFromMetrics(metrics);
  const best=bestLiveShotRole();
  if(best)updateShotReadiness({...best.m,_bestRole:best.role});
  else if(metrics?.identityAmbiguous)updateShotReadiness({...metrics,_bestRole:role});
  else updateShotReadiness(null);
}
function updateShotReadiness(metrics){
  const el=$("#shotReadiness"); if(!el)return;
  const liveCount=CAMERA_ROLES.filter(r=>!!liveStreams[r]).length;
  const source=metrics?roleTitle(metrics._bestRole||metrics.role||"side"):null;
  let text=liveCount?"Finding athlete / shot posture":"Waiting for live camera",cls="waiting";
  const phaseQ=Number.isFinite(Number(metrics?.phaseQuality))?Number(metrics.phaseQuality):Number(metrics?.quality||0);const releaseQ=Number.isFinite(Number(metrics?.releaseQuality))?Number(metrics.releaseQuality):phaseQ;
  if(liveCount){
    if(metrics?.identityAmbiguous){text=`${source}: athlete identity uncertain / occluded · shot decision paused`;cls="warn";}
    else if(!metrics?.detected){text="Move athlete into any live camera view";cls="warn";}
    else if(metrics.releaseCandidate){text=`${source}: release candidate · verifying release evidence`;cls="warn";}
    else if(metrics.armed){text=`${source}: ARMED · ${metrics.phase}${Number.isFinite(metrics.holdTimeS)?` · ${metrics.holdTimeS.toFixed(2)}s`:""}`;cls="ready";}
    else if(metrics.phase==="Anchor"){text=`${source}: Anchor confirmed · stabilizing before ARM`;cls="ready";}
    else if(metrics.shotBlocker==="recovering_anchor"){text=`${source}: shot posture found · recovering Anchor sequence`;cls="ready";}
    else if(metrics.shotBlocker==="waiting_draw"){text=`${source}: Set · waiting for Draw evidence`;cls="ready";}
    else if(metrics.shotBlocker==="waiting_anchor"){text=`${source}: Draw · waiting for Anchor`;cls="ready";}
    else if(metrics.shotBlocker==="tracking_low"||phaseQ<.28||releaseQ<.26||Number(metrics.shotObservability||0)<.20){text=`${source}: tracking too low · keep draw elbow/wrist visible`;cls="warn";}
    else if(metrics.phase==="Release"||metrics.phase==="Follow Through"){text=currentSessionId?`${source}: release confirmed · committing shot`:`${source}: release confirmed · no session to save`;cls=currentSessionId?"captured":"warn";}
    else {text=currentSessionId?`${source}: detector ready · ${metrics.phase||"Setup"}`:`${source}: detector ready · create/select session to save`;cls=currentSessionId?"ready":"warn";}
  }
  el.textContent=text;el.className=`readiness-chip ${cls}`;
  const overlay=$("#shotReadinessOverlay");
  if(overlay){overlay.textContent=text;overlay.className=`readiness-overlay ${cls}`;}
  updateShotSaveStatus();
}
function showShotCaptureFlash(shotNo,metrics){
  const el=$("#shotCaptureFlash"), detail=$("#shotCaptureFlashDetail"); if(!el)return;
  const hold=Number.isFinite(metrics?.holdTimeS)?` · Hold ${metrics.holdTimeS.toFixed(2)}s`:"";
  el.querySelector("b").textContent=`SHOT #${shotNo} SAVED`;
  if(detail)detail.textContent=`Release captured${hold}`;
  el.classList.remove("hidden");
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  clearTimeout(showShotCaptureFlash._t);showShotCaptureFlash._t=setTimeout(()=>el.classList.add("hidden"),1350);
}

function applyWorkspaceMode(mode){
  const nextMode=["capture","review","coach"].includes(mode)?mode:"capture";
  const changed=workspaceMode!==nextMode;
  workspaceMode=nextMode;
  localStorage.setItem("3pm-workspace-mode",workspaceMode);
  document.body.dataset.workspaceMode=workspaceMode;
  $$("#workspaceMode .mode-btn").forEach(b=>b.classList.toggle("active",b.dataset.mode===workspaceMode));
  if(workspaceMode==="review"&&selectedShotId)renderShotDetail();
  resolveAdaptiveLayout();
  // Changing workspace modes can preserve an old page scroll position. In Review that
  // previously placed the Rear title/select row underneath the sticky camera toolbar.
  // Reset only when the user actually changes mode; ordinary Review scrolling remains untouched.
  if(changed && $("#view-sessions")?.classList.contains("active")){
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));
  }
}
function renderHome(){
  if(!$("#homeAthleteCount"))return;
  $("#homeAthleteCount").textContent=STATE.athletes.length;$("#homeSessionCount").textContent=STATE.sessions.length;$("#homeShotCount").textContent=STATE.shots.length;$("#homeReferenceCount").textContent=STATE.shots.filter(x=>x.is_reference).length;
  $("#homeAutoMarkReady").textContent=($("#autoMarkToggle")?.checked??true)?"On":"Off";
  $("#recentSessions").innerHTML=STATE.sessions.slice(0,6).map(s=>{const a=athleteFor(s);return `<div class="recent-item" data-session="${s.id}"><div><b>${escapeHtml(s.title)}</b><span>${escapeHtml(a?.name||"—")} · ${fmt(s.distance_m," m")} · ${escapeHtml(s.mode||"")}</span></div><span>${escapeHtml(s.session_date||"")}</span></div>`}).join("")||'<span class="muted">No sessions yet.</span>';
  $$("#recentSessions .recent-item").forEach(el=>el.onclick=()=>{currentSessionId=Number(el.dataset.session);selectedShotId=null;populateSelectors();renderSession();setView("sessions");});
}
function renderAthletes(){
  const list=$("#athleteList");
  if(list){
    list.innerHTML=STATE.athletes.map(a=>`<div class="person-card ${a.archived?"archived":""}">
      <div class="profile-card-head"><div><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.discipline)} · ${escapeHtml(a.handedness)}${a.archived?" · Archived":""}</span></div><button class="small-btn athlete-edit-btn" data-id="${a.id}">Edit</button></div>
      <div class="profile-card-meta"><span>Height ${fmt(a.height_cm," cm")}</span><span>Arm ${fmt(a.arm_span_cm," cm")}</span><span>DL ${fmt(a.draw_length_in,'"')}</span><span>${escapeHtml(a.experience_level||"")}</span></div>
    </div>`).join("")||'<div class="empty-state">No athletes yet. Use “+ New Athlete”.</div>';
    $$(".athlete-edit-btn").forEach(b=>b.onclick=()=>editAthlete(Number(b.dataset.id)));
  }
  const eList=$("#equipmentList");
  if(eList){
    eList.innerHTML=STATE.equipment.map(e=>{const a=STATE.athletes.find(x=>x.id===e.athlete_id);const unit=e.weight_unit||"g";return `<div class="equipment-card">
      <div class="profile-card-head"><div><b>${e.is_default?"★ ":""}${escapeHtml(e.name)}</b><span>${escapeHtml(a?.name||"—")} · ${escapeHtml(e.discipline||"")}</span></div><button class="small-btn equipment-edit-btn" data-id="${e.id}">Edit</button></div>
      <div class="profile-card-meta"><span>OTF ${fmt(e.actual_draw_weight_lb," lb")}</span><span>${escapeHtml(formatBowSetup(e))}</span><span>Long ${fmt(e.long_rod_length_in,'"')}</span><span>V-Bar ${fmt(e.vbar_angle_out_deg,"°")}/${fmt(e.vbar_angle_down_deg,"°")}</span><span>Components ${(()=>{const w=equipmentWeightSummary(e),shown=displayWeightFromGrams(w.total,e.weight_unit||"g");return !shown?"Unknown":`${shown.text}${w.unknown?" · partial":""}`;})()}</span></div>
    </div>`}).join("")||'<div class="empty-state">No equipment profiles yet.</div>';
    $$(".equipment-edit-btn").forEach(b=>b.onclick=()=>editEquipment(Number(b.dataset.id)));
  }
}

function resetAthleteEditor(){
  editingAthleteId=null;const f=$("#athleteForm");if(!f)return;f.reset();f.elements.athlete_id.value="";if(f.elements.handedness)f.elements.handedness.value="Right-handed";if(f.elements.discipline)f.elements.discipline.value="Olympic Recurve";if(f.elements.age_group)f.elements.age_group.value="Adult";if(f.elements.experience_level)f.elements.experience_level.value="Intermediate";$("#athleteEditorTitle").textContent="Add Athlete";$("#saveAthleteBtn").textContent="Save Athlete";$("#deleteAthleteBtn").classList.add("hidden");$("#cancelAthleteEditBtn").classList.add("hidden");
}
function editAthlete(id){
  const a=STATE.athletes.find(x=>x.id===id);if(!a)return;editingAthleteId=id;const f=$("#athleteForm");Object.entries(a).forEach(([k,v])=>{if(!f.elements[k])return;if(f.elements[k].type==="checkbox")f.elements[k].checked=!!v;else f.elements[k].value=v??"";});f.elements.athlete_id.value=id;$("#athleteEditorTitle").textContent=`Edit Athlete · ${a.name}`;$("#saveAthleteBtn").textContent="Save Changes";$("#deleteAthleteBtn").classList.remove("hidden");$("#cancelAthleteEditBtn").classList.remove("hidden");f.scrollIntoView({behavior:"smooth",block:"start"});
}
function nominalAmoBowLength(riserIn,limbSize){
  const r=Number(riserIn),key=String(limbSize||"").trim().toLowerCase(),offset={short:41,medium:43,long:45}[key];
  return Number.isFinite(r)&&Number.isFinite(offset)?r+offset:null;
}
function updateBowLengthAuto(force=false){
  const f=$("#equipmentForm"),toggle=$("#autoBowLengthToggle");if(!f||!toggle||(!toggle.checked&&!force))return;
  const v=nominalAmoBowLength(f.elements.riser_in?.value,f.elements.limb_size?.value);
  if(Number.isFinite(v)&&f.elements.bow_length_in)f.elements.bow_length_in.value=Number.isInteger(v)?String(v):v.toFixed(2);
}
function syncAutoBowToggle(existing=null){
  const f=$("#equipmentForm"),toggle=$("#autoBowLengthToggle");if(!f||!toggle)return;
  const calc=nominalAmoBowLength(f.elements.riser_in?.value,f.elements.limb_size?.value),saved=Number(existing?.bow_length_in);
  toggle.checked=!Number.isFinite(saved)||!Number.isFinite(calc)||Math.abs(saved-calc)<.02;
  if(toggle.checked)updateBowLengthAuto(true);
}
function resetEquipmentEditor(){
  editingEquipmentId=null;const f=$("#equipmentForm");if(!f)return;f.reset();f.elements.equipment_id.value="";if(f.elements.discipline)f.elements.discipline.value="Olympic Recurve";if(f.elements.weight_unit){f.elements.weight_unit.value="g";f.elements.weight_unit.dataset.prevUnit="g";}if(f.elements.setup_distance_unit)f.elements.setup_distance_unit.value="mm";if(f.elements.riser_in)f.elements.riser_in.value="25";if(f.elements.limb_size)f.elements.limb_size.value="Medium";if($("#autoBowLengthToggle"))$("#autoBowLengthToggle").checked=true;updateBowLengthAuto(true);$("#equipmentEditorTitle").textContent="Add Equipment Profile";$("#saveEquipmentBtn").textContent="Save Equipment";$("#deleteEquipmentBtn").classList.add("hidden");$("#cancelEquipmentEditBtn").classList.add("hidden");populateSelectors();updateEquipmentWeightUnitLabels();updateEquipmentTotal();updateTillerDifference();
}
function editEquipment(id){
  const e=STATE.equipment.find(x=>x.id===id);if(!e)return;editingEquipmentId=id;const f=$("#equipmentForm");Object.entries(e).forEach(([k,v])=>{if(!f.elements[k])return;if(f.elements[k].type==="checkbox")f.elements[k].checked=!!v;else f.elements[k].value=v??"";});if(f.elements.setup_distance_unit&&!f.elements.setup_distance_unit.value)f.elements.setup_distance_unit.value="mm";if(f.elements.weight_unit)f.elements.weight_unit.dataset.prevUnit=f.elements.weight_unit.value||"g";f.elements.equipment_id.value=id;syncAutoBowToggle(e);$("#equipmentEditorTitle").textContent=`Edit Equipment · ${e.name}`;$("#saveEquipmentBtn").textContent="Save Changes";$("#deleteEquipmentBtn").classList.remove("hidden");$("#cancelEquipmentEditBtn").classList.remove("hidden");updateEquipmentWeightUnitLabels();updateEquipmentTotal();updateTillerDifference();f.scrollIntoView({behavior:"smooth",block:"start"});
}
const WEIGHT_FIELDS=["long_rod_self_weight","long_rod_end_weight","left_side_rod_self_weight","left_side_rod_end_weight","right_side_rod_self_weight","right_side_rod_end_weight","extender_weight","vbar_weight","damper_weight","riser_top_weight","riser_bottom_weight","riser_front_weight","riser_other_weight","sight_weight","other_bow_weight"];
function updateEquipmentWeightUnitLabels(){
  const f=$("#equipmentForm");if(!f)return;const unit=f.elements.weight_unit?.value||"g";
  for(const [field,base] of Object.entries(UNIT_AWARE_WEIGHT_LABELS)){
    const input=f.elements[field],label=input?.closest?.("label");if(!label)continue;
    const textNode=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(textNode)textNode.nodeValue=`${base} (${unit})`;
  }
  const totalLabel=$("#equipmentTotalWeightLabel");if(totalLabel)totalLabel.textContent=`Known Component Weight Subtotal (${unit})`;
}
function displayWeightFromGrams(totalGrams,unit="g"){
  if(!Number.isFinite(Number(totalGrams)))return null;const g=Number(totalGrams);return unit==="oz"?{value:g/28.3495,text:`${(g/28.3495).toFixed(2)} oz`}:{value:g,text:`${g.toFixed(0)} g`};
}
function convertEquipmentUnitAwareValues(fromUnit,toUnit){
  const f=$("#equipmentForm");if(!f||fromUnit===toUnit)return;
  for(const field of Object.keys(UNIT_AWARE_WEIGHT_LABELS)){
    const input=f.elements[field];if(!input||!valueKnown(input.value))continue;const n=Number(input.value);
    const converted=fromUnit==="oz"&&toUnit==="g"?n*28.3495:fromUnit==="g"&&toUnit==="oz"?n/28.3495:n;
    input.value=toUnit==="oz"?converted.toFixed(3):converted.toFixed(1);
  }
}
function updateEquipmentTotal(){
  const f=$("#equipmentForm");if(!f)return;let totalGrams=0,known=0;const unit=f.elements.weight_unit?.value||"g";
  WEIGHT_FIELDS.forEach(k=>{const raw=f.elements[k]?.value;const g=equipmentWeightToGrams(raw,unit,k);if(g!==null){totalGrams+=g;known++;}});
  updateEquipmentWeightUnitLabels();const unknown=WEIGHT_FIELDS.length-known,shown=displayWeightFromGrams(totalGrams,unit);
  $("#equipmentTotalWeight").textContent=known?`${shown.text}${unknown?` · known subtotal (${unknown} unknown)`:" · complete"}`:"Unknown · no weight values entered";
}
function updateTillerDifference(){
  const f=$("#equipmentForm"),el=$("#equipmentTillerDiff");if(!f||!el)return;
  const u=f.elements.setup_distance_unit?.value||"mm",upper=f.elements.upper_tiller?.value,lower=f.elements.lower_tiller?.value;
  if(String(upper??"").trim()===""||String(lower??"").trim()===""||!Number.isFinite(Number(upper))||!Number.isFinite(Number(lower))){el.textContent="—";return;}
  const d=Number(upper)-Number(lower),digits=u==="in"?3:1;el.textContent=`${d>=0?"+":""}${d.toFixed(digits)} ${u} · ${d>0?"upper > lower":d<0?"upper < lower":"equal"}`;
}

function populateShotSelectors(){
  const shots=sessionShots(); const opts=shots.map(s=>`<option value="${s.id}">Shot #${s.shot_no}${s.score!=null?` · ${s.is_x?`${s.score}X`:s.score}`:""}${s.is_reference?" · ★":""}</option>`).join("");
  const sel=$("#analyzeShotSelect");if(sel){sel.innerHTML=opts;if(selectedShotId)sel.value=String(selectedShotId);}
  if(!compareShotAId&&shots.length)compareShotAId=shots[Math.max(0,shots.length-2)]?.id;
  if(!compareShotBId&&shots.length)compareShotBId=shots[shots.length-1]?.id;
  [["compareShotA",compareShotAId],["compareShotB",compareShotBId]].forEach(([id,val])=>{const el=$("#"+id);if(el){el.innerHTML=opts;if(val)el.value=String(val);}});
}
function clearLiveAnalysisUI(){
  livePhase="—";pendingShotContext=null;liveMetricHistory.length=0;
  ["mHold","mElbow","mBowArm","mShoulder","mTorso","mHeadMm","mHeadPitch","mAnchorFace","mHeadTowardDraw","mAnchorDrift","mAnchorStability","mReleasePath","mPoseQuality"].forEach(id=>{const el=$("#"+id);if(el){el.textContent="—";el.className="";}});
  if($("#livePhaseBadge"))$("#livePhaseBadge").textContent="Phase: —";
  if($("#shotNotes"))$("#shotNotes").textContent="Select a shot.";
  CAMERA_ROLES.forEach(role=>window.PoseEngine?.resetShotCycle?.(role));
  window.PoseEngine?.resetBaseline?.();
}
function switchActiveAthlete(id){
  const next=Number(id)||null;if(next===Number(activeAthleteId))return;
  activeAthleteId=next;if(next)localStorage.setItem("3pm-active-athlete",String(next));
  currentSessionId=latestSessionForAthlete(next)?.id||null;selectedShotId=null;compareShotAId=null;compareShotBId=null;expandedShotEnds.clear();
  clearLiveAnalysisUI();populateSelectors();renderAll();updateLiveButtons();
  const a=STATE.athletes.find(x=>x.id===next);toast(a?`Active athlete: ${a.name}. Live shot state reset; saved history is unchanged.`:"No active athlete selected.","good",2600);
}
function syncGlobalSession(id){
  const next=Number(id)||null;const s=STATE.sessions.find(x=>x.id===next);currentSessionId=next;if(s){activeAthleteId=s.athlete_id;localStorage.setItem("3pm-active-athlete",String(activeAthleteId));}
  selectedShotId=null;compareShotAId=null;compareShotBId=null;expandedShotEnds.clear();clearLiveAnalysisUI();populateSelectors();renderSession();renderAnalyze();renderCompare();renderImpact();renderReport();
}
function valueKnown(v){return v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));}
function equipmentFieldUnit(fieldName,unit){return STABILIZER_END_WEIGHT_FIELDS.includes(fieldName)?"oz":(unit||"g");}
function equipmentWeightToGrams(v,unit,fieldName=""){if(!valueKnown(v))return null;const n=Number(v);return equipmentFieldUnit(fieldName,unit)==="oz"?n*28.3495:n;}
function equipmentWeightSummary(e){
  if(!e)return{known:0,unknown:WEIGHT_FIELDS.length,total:null,completeness:0};
  let total=0,known=0;for(const k of WEIGHT_FIELDS){const g=equipmentWeightToGrams(e[k],e.weight_unit,k);if(g!==null){total+=g;known++;}}
  return{known,unknown:WEIGHT_FIELDS.length-known,total:known?total:null,completeness:known/WEIGHT_FIELDS.length};
}
function equipmentLeverSummary(e){
  const inch=2.54,unit=e?.weight_unit||'g',g=(field)=>equipmentWeightToGrams(e?.[field],unit,field),len=v=>valueKnown(v)?Number(v)*inch:null;
  const long=len(e?.long_rod_length_in),ext=len(e?.extender_length_in)||0,left=len(e?.left_side_rod_length_in),right=len(e?.right_side_rod_length_in);
  let front=0,frontParts=0,side=0,sideParts=0;
  const longEnd=g('long_rod_end_weight');if(long!==null&&longEnd!==null){front+=longEnd*(ext+long);frontParts++;}
  const longSelf=g('long_rod_self_weight');if(long!==null&&longSelf!==null){front+=longSelf*(ext+long*.5);frontParts++;}
  const extW=g('extender_weight');if(extW!==null&&ext>0){front+=extW*(ext*.5);frontParts++;}
  const le=g('left_side_rod_end_weight');if(left!==null&&le!==null){side+=le*left;sideParts++;}
  const ls=g('left_side_rod_self_weight');if(left!==null&&ls!==null){side+=ls*left*.5;sideParts++;}
  const re=g('right_side_rod_end_weight');if(right!==null&&re!==null){side+=re*right;sideParts++;}
  const rs=g('right_side_rod_self_weight');if(right!==null&&rs!==null){side+=rs*right*.5;sideParts++;}
  return{front:frontParts?front:null,side:sideParts?side:null,frontParts,sideParts};
}
function equipmentProfileWeightGrams(e){return equipmentWeightSummary(e).total;}
function equipmentSideMomentSummary(e){
  const unit=e?.weight_unit||'g',g=f=>equipmentWeightToGrams(e?.[f],unit,f),cm=v=>valueKnown(v)?Number(v)*2.54:null;
  const side=(prefix)=>{const len=cm(e?.[`${prefix}_side_rod_length_in`]);if(len===null)return null;let m=0,n=0;const end=g(`${prefix}_side_rod_end_weight`),self=g(`${prefix}_side_rod_self_weight`);if(end!==null){m+=end*len;n++;}if(self!==null){m+=self*len*.5;n++;}return n?m:null;};
  const left=side('left'),right=side('right');const total=(left||0)+(right||0),asym=(left!==null&&right!==null&&total>0)?Math.abs(left-right)/(total/2):null;
  return{left,right,asymmetry:asym};
}
function trendDelta(values){const a=(values||[]).filter(Number.isFinite);if(a.length<6)return null;const n=Math.max(2,Math.floor(a.length/3));return median(a.slice(-n))-median(a.slice(0,n));}
function evidenceLevel(score){return score>=70?'strong':score>=45?'moderate':score>=25?'limited':'low';}
function directEquipmentEvidence(sess,e,shots){
  const eligible=(shots||[]).filter(shotIsBaselineEligible).sort((a,b)=>Number(a.shot_no||0)-Number(b.shot_no||0));
  if(eligible.length<6)return{ready:false,n:eligible.length,items:[],summary:`${eligible.length}/6 validated shots · direct equipment-response profile is still building.`};
  const adv=eligible.map(x=>loadAdvancedShotMetrics(x.id)||{}),nums=(key,src=eligible)=>src.map(x=>Number(x?.[key])).filter(Number.isFinite);
  const holdD=trendDelta(nums('hold_time_s')),bowD=trendDelta(nums('bow_arm_deg')),headD=trendDelta(nums('head_movement_mm'));
  const drawD=trendDelta(nums('draw_to_anchor_s',adv)),settleD=trendDelta(nums('anchor_to_arm_s',adv)),drawCvD=trendDelta(nums('draw_speed_cv',adv));
  const off=nums('release_offaxis_pct',adv),offVar=off.length>=5?mad(off,median(off)):null;
  const torso=nums('torso_lean_deg'),torsoVar=torso.length>=5?mad(torso,median(torso)):null;
  const ws=equipmentWeightSummary(e),lever=equipmentLeverSummary(e),side=equipmentSideMomentSummary(e);
  let drawScore=0,frontScore=0,sideScore=0,massScore=0;const reasons={draw:[],front:[],side:[],mass:[]};
  if(Number.isFinite(drawD)&&drawD>.18){drawScore+=30;reasons.draw.push(`Draw→Anchor slows ${drawD.toFixed(2)} s late-session`);} if(Number.isFinite(drawCvD)&&drawCvD>.08){drawScore+=18;reasons.draw.push(`Draw speed becomes less uniform (CV +${drawCvD.toFixed(2)})`);} if(Number.isFinite(settleD)&&settleD>.14){drawScore+=18;reasons.draw.push(`Anchor settling adds ${settleD.toFixed(2)} s`);} if(Number.isFinite(holdD)&&holdD>.35){drawScore+=14;reasons.draw.push(`Hold rises ${holdD.toFixed(2)} s`);} if(Number.isFinite(headD)&&headD>4){drawScore+=10;reasons.draw.push(`Head movement rises ${headD.toFixed(1)} mm`);} if(valueKnown(e.actual_draw_weight_lb))drawScore+=6;
  if(Number.isFinite(bowD)&&bowD<-1.5){frontScore+=34;reasons.front.push(`Bow-arm angle drops ${Math.abs(bowD).toFixed(1)}° late-session`);} if(Number.isFinite(holdD)&&holdD>.30){frontScore+=20;reasons.front.push(`Holding time rises ${holdD.toFixed(2)} s`);} if(Number.isFinite(headD)&&headD>4){frontScore+=12;reasons.front.push(`Head compensation increases`);} if(lever.front!==null){frontScore+=12;reasons.front.push(`Known front moment ${Math.round(lever.front)} g·cm`);} if(lever.front!==null&&lever.side!==null&&lever.front>lever.side*1.7){frontScore+=12;reasons.front.push(`Front moment dominates known side moment`);}
  if(Number.isFinite(side.asymmetry)&&side.asymmetry>.18){sideScore+=38;reasons.side.push(`Left/right side-rod moment differs ${Math.round(side.asymmetry*100)}%`);} if(Number.isFinite(offVar)&&offVar>10){sideScore+=24;reasons.side.push(`Release off-axis variation is high (${offVar.toFixed(1)})`);} if(Number.isFinite(torsoVar)&&torsoVar>2.2){sideScore+=18;reasons.side.push(`Torso lean varies ${torsoVar.toFixed(1)}° MAD`);} if(side.left!==null&&side.right!==null)sideScore+=8;
  if(Number.isFinite(holdD)&&holdD>.35){massScore+=25;reasons.mass.push(`Hold demand rises late-session`);} if(Number.isFinite(headD)&&headD>4){massScore+=20;reasons.mass.push(`Head stability degrades`);} if(Number.isFinite(bowD)&&Math.abs(bowD)>1.5){massScore+=18;reasons.mass.push(`Bow-arm geometry changes`);} if(ws.total!==null&&ws.completeness>=.45){const shown=displayWeightFromGrams(ws.total,e?.weight_unit||"g");massScore+=14;reasons.mass.push(`Known bow/accessory mass subtotal ${shown?.text||`${Math.round(ws.total)} g`}`);}
  const clampScore=v=>Math.max(0,Math.min(100,Math.round(v))),scores={draw:clampScore(drawScore),front:clampScore(frontScore),side:clampScore(sideScore),mass:clampScore(massScore)};
  const ranked=[['draw','Draw-weight / draw-demand'],['front','Long-rod / front-moment'],['side','Side-rod / lateral-balance'],['mass','Total bow-mass / holding-demand']].map(([key,label])=>({key,label,score:scores[key],reasons:reasons[key]})).sort((a,b)=>b.score-a.score);
  return{ready:true,n:eligible.length,scores,ranked,holdD,bowD,headD,drawD,settleD,drawCvD,offVar,side,summary:`Direct session evidence · ${eligible.length} validated shots · top check: ${ranked[0].label} (${evidenceLevel(ranked[0].score)} evidence)`};
}
function sessionEquipmentHints(shot){
  const sess=STATE.sessions.find(s=>s.id===shot?.session_id),e=equipFor(sess),a=athleteFor(sess);if(!e)return {summary:"No equipment profile is attached to this session.",items:[]};
  const ws=equipmentWeightSummary(e),lever=equipmentLeverSummary(e),items=[];
  const shots=sessionShots(sess.id).filter(x=>shotIsBaselineEligible(x)),metricVals=k=>shots.map(x=>Number(x[k])).filter(Number.isFinite);
  const hold=metricVals('hold_time_s'),head=metricVals('head_movement_mm'),bow=metricVals('bow_arm_deg');
  const first3=hold.slice(0,3),last3=hold.slice(-3),fatigueHold=first3.length>=3&&last3.length>=3&&median(last3)>median(first3)+.40;
  const bowFirst=bow.slice(0,3),bowLast=bow.slice(-3),bowLateDrop=bowFirst.length>=3&&bowLast.length>=3&&median(bowLast)<median(bowFirst)-2.0;
  const headVar=head.length>=4?mad(head,median(head)):0;
  if(ws.unknown){items.push({level:"stable",title:"Equipment data is partial",text:`${ws.known} of ${WEIGHT_FIELDS.length} weight fields are known. Blank values stay Unknown, not zero, and are excluded from load conclusions.`});}
  const direct=directEquipmentEvidence(sess,e,shots);
  if(!direct.ready){items.push({level:"stable",title:"Direct biomechanics assessment is building",text:direct.summary+" No comparison setup is required; the app builds the response profile from this setup itself."});}
  else{
    const top=direct.ranked[0],second=direct.ranked[1];
    if(top.score>=45)items.push({level:"review",title:`Primary equipment contributor to check: ${top.label}`,text:`${evidenceLevel(top.score)} evidence index ${top.score}/100 (not a probability). ${top.reasons.slice(0,3).join(" · ")}. ${second?.score>=35?`Second check: ${second.label} ${second.score}/100.`:""} Coach verification is still required before changing hardware.`});
    else items.push({level:"stable",title:"No strong component-specific overload pattern",text:`Direct evidence indices remain low/moderate after ${direct.n} validated shots. The current setup is not showing a repeatable limb/front/side overload signature from biomechanics alone.`});
  }
  const sameAthlete=STATE.equipment.filter(x=>x.athlete_id===e.athlete_id&&x.id!==e.id).map(x=>({e:x,s:equipmentWeightSummary(x)})).filter(x=>x.s.total!==null&&x.s.completeness>=.45);
  const peerTotals=sameAthlete.map(x=>x.s.total).filter(Number.isFinite),peerMed=median(peerTotals);
  if(ws.total!==null&&ws.completeness>=.45&&peerMed&&ws.total>peerMed*1.20&&(fatigueHold||bowLateDrop||headVar>8))items.push({level:"review",title:"Heavier-load hypothesis worth A/B testing",text:`Known external weight is about ${Math.round((ws.total/peerMed-1)*100)}% above this athlete’s other sufficiently-described profiles, while this session also shows a holding/follow-through signal. Treat this as a test hypothesis, not a diagnosis.`});
  if(lever.front!==null&&lever.side!==null&&lever.front>lever.side*1.8&&(fatigueHold||bowLateDrop))items.push({level:"review",title:"Front lever may be demanding",text:"Known long-rod/extender weight sits on a larger lever than the known side-rod load, and late-session hold/bow-arm behaviour changed. Try a controlled A/B setup before changing equipment permanently."});
  if(valueKnown(e.actual_draw_weight_lb)&&fatigueHold&&headVar>8)items.push({level:"review",title:"Possible holding-load pattern",text:`Hold time rises later in the session while head movement varies. With ${Number(e.actual_draw_weight_lb).toFixed(1)} lb OTF saved, compare against a lighter known setup; video alone cannot prove draw weight is excessive.`});
  const advShots=shots.map(x=>loadAdvancedShotMetrics(x.id)).filter(Boolean),off=advShots.map(x=>Number(x.release_offaxis_pct)).filter(Number.isFinite);if(off.length>=5&&mad(off,median(off))>12)items.push({level:"review",title:"Release follow-through varies with this setup",text:"Off-axis release-path variation is high in this session. Review anchor and equipment balance together before attributing the pattern to one cause."});
  if(!items.some(x=>x.level==='review'))items.push({level:"stable",title:"No strong equipment-related pattern yet",text:"The current evidence does not support a strong heavy/light conclusion. Continue collecting validated shots; A/B testing is optional and can strengthen a later equipment decision."});
  const totalText=ws.total===null?'Unknown':`${ws.total.toFixed(0)} g known subtotal${ws.unknown?' · partial':''}`;
  const leverText=lever.front!==null?` · front lever index ${Math.round(lever.front)} g·cm (known parts only)`:'';
  const directSummary=direct?.ready?` · Direct equipment evidence: ${direct.ranked[0].label} ${direct.ranked[0].score}/100`:'';
  const summary=`${escapeHtml(e.name)} · ${escapeHtml(e.discipline||a?.discipline||"")} · ${escapeHtml(formatBowSetup(e))} · Known components ${totalText}${leverText} · OTF ${fmt(e.actual_draw_weight_lb," lb")} · Long rod ${fmt(e.long_rod_length_in,'"')}${directSummary}`;
  return {summary,items};
}

function framesForShot(shotId,role="side"){return roleFramesForShot(shotId,role).sort((a,b)=>Math.abs(a.offset_ms)-Math.abs(b.offset_ms)||a.offset_ms-b.offset_ms);}
function sessionHasRoleVideo(session,role){return !!session?.[`${role}_video`];}
function roleHasShotEvidence(shot,session,role){return !!(shot&&(roleFramesForShot(shot.id,role).length||sessionHasRoleVideo(session,role)));}
function resolvedAnalysisRole(shot,session){
  const requested=["side","rear","overhead"].includes(analysisMediaRole)?analysisMediaRole:null;
  if(requested&&roleHasShotEvidence(shot,session,requested))return requested;
  for(const role of ["side","rear","overhead"]){if(roleHasShotEvidence(shot,session,role))return role;}
  return requested||"side";
}
function syncAnalysisRoleControl(shot,session){
  const sel=$("#analysisRoleSelect");if(!sel)return;
  [...sel.options].forEach(o=>{if(o.value==="auto"){o.disabled=false;return;}o.disabled=!roleHasShotEvidence(shot,session,o.value);});
  const explicit=["side","rear","overhead"].includes(analysisMediaRole)?analysisMediaRole:null;
  sel.value=explicit&&roleHasShotEvidence(shot,session,explicit)?explicit:"auto";
}
function applyAnalysisMediaMode(){
  const img=$("#analysisImage"),v=$("#analysisVideo"),empty=$("#analysisEmpty"),frameBtn=$("#analysisFrameModeBtn"),videoBtn=$("#analysisVideoModeBtn");
  const hasFrame=!!img?.src&&!img.classList.contains("no-frame"),hasVideo=!!(v?.currentSrc||v?.src||v?.dataset?.src);
  if(analysisMediaMode==="video"&&!hasVideo)analysisMediaMode="frame";
  if(analysisMediaMode==="frame"&&!hasFrame&&hasVideo)analysisMediaMode="video";
  if(frameBtn){frameBtn.disabled=!hasFrame;frameBtn.classList.toggle("active",analysisMediaMode==="frame");}
  if(videoBtn){videoBtn.disabled=!hasVideo;videoBtn.classList.toggle("active",analysisMediaMode==="video");}
  if(img)img.classList.toggle("hidden",analysisMediaMode!=="frame"||!hasFrame);
  if(v){v.classList.toggle("media-behind",analysisMediaMode!=="video");v.controls=analysisMediaMode==="video";}
  if(empty)empty.style.display=(!hasFrame&&!hasVideo)?"flex":"none";
}
function setAnalysisMediaMode(mode){analysisMediaMode=mode;applyAnalysisMediaMode();}
function showAnalysisFrame(frame){
  const img=$("#analysisImage"),empty=$("#analysisEmpty");
  if(!frame){img.removeAttribute("src");img.classList.add("no-frame","hidden");applyAnalysisMediaMode();return;}
  img.src=frame.url||frameUrl(frame.id);img.classList.remove("no-frame");if(empty)empty.style.display="none";analysisMediaMode="frame";applyAnalysisMediaMode();
}
function renderBiomechanicsMatrix(shot){
  const host=$('#biomechanicsMatrix');if(!host)return;
  if(!shot){host.textContent='Select a measured shot.';return;}
  const adv=loadAdvancedShotMetrics(shot.id)||{},cells=Array.isArray(adv.biomechanics_matrix)?adv.biomechanics_matrix:[];
  const timeline=Array.isArray(adv.phase_timeline)?adv.phase_timeline:[];
  if(!cells.length){host.innerHTML='<div class="intelligence-note low"><b>Legacy / incomplete evidence</b><br>This shot predates the V5 Biomechanics Matrix or does not contain enough structured evidence. No values are invented.</div>';return;}
  const rel=Number(adv.release_epoch_ms);
  const phaseLine=timeline.length?`<div class="biomatrix-phase-line">${timeline.map(x=>{const dt=Number.isFinite(rel)&&Number.isFinite(Number(x.epochMs))?`${((Number(x.epochMs)-rel)/1000).toFixed(2)}s`:'';return `<span><b>${escapeHtml(x.phase)}</b>${dt?` <small>${dt}</small>`:''}</span>`;}).join('<i>→</i>')}</div>`:'';
  const rows=cells.map(c=>{
    const value=typeof c.value==='number'&&Number.isFinite(c.value)?`${c.value.toFixed(c.unit==='°'?1:1)}${escapeHtml(c.unit||'')}`:(c.value??'—');
    const conf=Number(c.confidence),confText=Number.isFinite(conf)?`${Math.round(conf*100)}%`:'—';
    const status=String(c.status||'unavailable');
    return `<tr><td>${escapeHtml(c.phase||'—')}</td><td>${escapeHtml(c.segment||'—')}</td><td>${escapeHtml(c.metric||'—')}</td><td><b>${escapeHtml(value)}</b></td><td>${escapeHtml(c.sourceRole?roleTitle(c.sourceRole):'—')}</td><td><span class="matrix-confidence ${escapeHtml(status)}">${confText} · ${escapeHtml(status)}</span></td></tr>`;
  }).join('');
  host.innerHTML=`${phaseLine}<div class="biomatrix-note">Observed measurements are kept separate from interpretation. Confidence reflects the available camera evidence; unavailable values are not guessed.</div><div class="biomatrix-table-wrap"><table class="biomatrix-table"><thead><tr><th>Phase</th><th>Body</th><th>Metric</th><th>Measurement</th><th>Source</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderAnalyze(){
  if(!$("#analysisShotTitle"))return; populateShotSelectors(); const shots=sessionShots();let shot=STATE.shots.find(x=>x.id===selectedShotId&&x.session_id===Number(currentSessionId));if(!shot&&shots.length&&$("#view-analyze")?.classList.contains("active")){shot=shots[shots.length-1];selectedShotId=shot.id;}
  const s=currentSession(),v=$("#analysisVideo"),img=$("#analysisImage"),empty=$("#analysisEmpty");
  v.classList.remove("media-behind");img.classList.add("hidden","no-frame");img.removeAttribute("src");empty.style.display="flex";
  if(!shot){syncAnalysisRoleControl(null,s);$("#analysisShotTitle").textContent="No shots yet";$("#analysisInterpretation").innerHTML='<div class="finding"><b>No measured shot selected.</b><span>Create a session, capture/mark a shot, then return here.</span></div>';$("#analysisMetrics").innerHTML="";$("#analysisFrameStrip").innerHTML="";$("#equipmentContextSummary").textContent="No shot selected.";$("#equipmentContextHints").innerHTML="";if($("#anchorAnalysis"))$("#anchorAnalysis").textContent="Select a measured shot.";if($("#releaseAnalysis"))$("#releaseAnalysis").textContent="Select a measured shot.";if($("#multiViewAnalysis"))$("#multiViewAnalysis").textContent="Select a measured shot.";renderBiomechanicsMatrix(null);applyAnalysisMediaMode();return;}
  const mediaRole=resolvedAnalysisRole(shot,s);syncAnalysisRoleControl(shot,s);const roleVideoFile=s?.[`${mediaRole}_video`];
  if(roleVideoFile){const url=`/api/media/${s.id}/${mediaRole}?v=${encodeURIComponent(roleVideoFile)}`;if(v.dataset.src!==url){v.src=url;v.dataset.src=url;}if(Number.isFinite(Number(shot.timestamp_s))){const seek=()=>{try{v.currentTime=Math.max(0,Number(shot.timestamp_s)-.35)}catch{}};if(v.readyState>=1)seek();else v.addEventListener("loadedmetadata",seek,{once:true});}empty.style.display="none";}else{v.removeAttribute("src");v.dataset.src="";try{v.load()}catch{}}
  $("#analysisVideoModeBtn").textContent=`${roleTitle(mediaRole)} Video`;
  const primaryEvidenceRole=loadAdvancedShotMetrics(shot.id)?.source_role;
  $("#analysisVideoHint").textContent=`Viewing ${roleTitle(mediaRole)} evidence. ${primaryEvidenceRole?`${roleTitle(primaryEvidenceRole)} supplied the strongest completed-shot timing evidence for this shot.`:"Timing source was not stored for this legacy shot."} Metrics remain view/confidence gated.`;
  $("#analyzeShotSelect").value=String(shot.id);$("#analysisShotTitle").textContent=`Shot #${shot.shot_no}${shot.score!=null?` · Score ${shot.is_x?`${shot.score}X`:shot.score}`:""} · ${roleTitle(mediaRole)} view`;
  const frames=framesForShot(shot.id,mediaRole);const center=frames.find(f=>Number(f.offset_ms)===0)||frames[0];if(center)showAnalysisFrame(center);else if(!roleVideoFile){empty.textContent=`No saved ${roleTitle(mediaRole)} frame/video for this shot. Choose another available camera view.`;empty.style.display="flex";}
  $("#analysisFrameStrip").innerHTML=frames.length?frames.slice().sort((a,b)=>a.offset_ms-b.offset_ms).map(f=>`<button class="analysis-frame-btn ${f.id===center?.id?"active":""}" data-frame-id="${f.id}"><img src="${f.url||frameUrl(f.id)}"><span>${escapeHtml(frameBaseLabel(f)||`${f.offset_ms} ms`)}</span></button>`).join(""):`<span class="muted">No ${roleTitle(mediaRole)} key frames saved for this shot.</span>`;
  $$("#analysisFrameStrip .analysis-frame-btn").forEach(b=>b.onclick=()=>{const f=frames.find(x=>x.id===Number(b.dataset.frameId));showAnalysisFrame(f);$$("#analysisFrameStrip .analysis-frame-btn").forEach(x=>x.classList.toggle("active",x===b));});
  if(!center)applyAnalysisMediaMode();
  const a=interpretShot(shot),label=$("#analysisLabel");label.textContent=a.label;label.className=`analysis-label ${a.css}`;
  const quality=shot.pose_confidence==null?"":`Tracking ${Math.round(Number(shot.pose_confidence)*100)}%`;const adv=loadAdvancedShotMetrics(shot.id);
  const withheld=adv?.metric_confidence?Object.entries(adv.metric_confidence).filter(([,q])=>Number(q)<.45).map(([k])=>k):[];
  const integrity=Number.isFinite(Number(adv?.release_quality))?`Release evidence ${Math.round(Number(adv.release_quality)*100)}%${adv?.visual_status?` · image ${adv.visual_status}`:""}`:"Evidence quality recorded from available camera data";
  $("#analysisInterpretation").innerHTML=`<div class="finding"><b>${escapeHtml(a.summary)}</b><span>${escapeHtml(a.base?.sourceLabel||"")}${quality?` · ${quality}`:""}</span></div><div class="finding"><b>Measurement integrity</b><span>${escapeHtml(integrity)}${withheld.length?` · low-confidence measurements withheld: ${escapeHtml(withheld.join(", "))}`:""}</span></div>${a.details.slice(0,4).map(d=>`<div class="finding"><b>${escapeHtml(d.metric.label)}: ${fmtNum(d.value,d.metric.key==="hold_time_s"?2:1,d.metric.unit)}</b><span>Baseline median ${fmtNum(d.median,d.metric.key==="hold_time_s"?2:1,d.metric.unit)} · difference ${d.delta>=0?"+":""}${d.delta.toFixed(d.metric.key==="hold_time_s"?2:1)}${d.metric.unit}</span></div>`).join("")}`;
  $("#toggleReferenceBtn").textContent=shot.is_reference?"★ Reference Shot":"☆ Mark as Reference";
  $("#analysisMetrics").innerHTML=METRICS.map(m=>`<div class="card analysis-metric"><span>${m.label}</span><strong>${fmtNum(metricValue(shot,m),m.key==="hold_time_s"?2:1,m.unit)}</strong><small>${m.key==="head_movement_mm"?"estimated · calibration improves absolute scale":"measured at release / shot mark"}</small></div>`).join("");
  $("#baselineSource").textContent=a.base?.sourceLabel||"—";
  $("#baselineTable").innerHTML=`<table class="baseline-table"><thead><tr><th>Metric</th><th>This Shot</th><th>Baseline Median</th><th>Difference</th><th>Samples</th></tr></thead><tbody>${METRICS.map(m=>{const st=a.base?.stats?.[m.key],val=metricValue(shot,m);const delta=Number.isFinite(val)&&Number.isFinite(st?.median)?val-st.median:null;return `<tr><td>${m.label}</td><td>${fmtNum(val,m.key==="hold_time_s"?2:1,m.unit)}</td><td>${fmtNum(st?.median,m.key==="hold_time_s"?2:1,m.unit)}</td><td>${delta==null?"—":`${delta>=0?"+":""}${delta.toFixed(m.key==="hold_time_s"?2:1)}${m.unit}`}</td><td>${st?.n??0}</td></tr>`}).join("")}</tbody></table>`;
  renderAnchorReleaseAnalysis(shot);
  renderMultiViewAnalysis(shot);
  renderBiomechanicsMatrix(shot);
  const eq=sessionEquipmentHints(shot);$("#equipmentContextSummary").innerHTML=eq.summary;$("#equipmentContextHints").innerHTML=eq.items.map(x=>`<div class="equipment-hint ${x.level}"><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.text)}</span></div>`).join("");
}

function differencePhrase(a,b,m){
  const av=Number(a),bv=Number(b);if(!Number.isFinite(av)||!Number.isFinite(bv))return '—';
  const d=bv-av,eps=m.key==='hold_time_s'?.005:.05;if(Math.abs(d)<eps)return 'Nearly the same';
  const mag=Math.abs(d).toFixed(m.key==='hold_time_s'?2:1),unit=m.unit;
  const word=m.key==='hold_time_s'?(d>0?'longer':'shorter'):(d>0?'higher':'lower');
  return `B is ${mag}${unit} ${word}`;
}

function renderCompare(){
  if(!$("#compareTable"))return;populateShotSelectors();const A=STATE.shots.find(x=>x.id===Number(compareShotAId)),B=STATE.shots.find(x=>x.id===Number(compareShotBId));
  if(!A||!B){$("#compareTable").innerHTML='<span class="muted">Need at least two shots.</span>';return;}
  $("#compareShotA").value=String(A.id);$("#compareShotB").value=String(B.id);$("#compareATitle").textContent=`Shot #${A.shot_no}`;$("#compareBTitle").textContent=`Shot #${B.shot_no}`;
  const ai=interpretShot(A),bi=interpretShot(B);const info=x=>`<div class="shot-summary-kv"><span>Score</span><span>${x.score==null?"—":(x.is_x?`${x.score}X`:x.score)}</span><span>Analysis</span><span>${interpretShot(x).label}</span><span>Reference</span><span>${x.is_reference?"Yes":"No"}</span><span>Hold</span><span>${fmtNum(x.hold_time_s,2," s")}</span></div>`;$("#compareAInfo").innerHTML=info(A);$("#compareBInfo").innerHTML=info(B);
  $("#compareTable").innerHTML=`<table class="compare-table"><thead><tr><th>Metric</th><th>Shot A</th><th>Shot B</th><th>How B differs from A</th></tr></thead><tbody>${METRICS.map(m=>{const av=metricValue(A,m),bv=metricValue(B,m);return `<tr><td>${m.label}</td><td>${fmtNum(av,m.key==="hold_time_s"?2:1,m.unit)}</td><td>${fmtNum(bv,m.key==="hold_time_s"?2:1,m.unit)}</td><td>${differencePhrase(av,bv,m)}</td></tr>`}).join("")}</tbody></table>`;
}
const CONSISTENCY_METRICS=[
  {id:"anchor_pos",label:"Anchor hand position",unit:"% shoulder-width",digits:1,advanced:true,vector:["anchor_ref_hand_x","anchor_ref_hand_y"],note:"Median radial distance from the session/reference anchor centre."},
  {id:"draw_elbow",label:"Draw elbow angle",unit:"°",digits:1,key:"draw_elbow_deg",note:"Shot-to-shot angle spread at the measured shot point."},
  {id:"anchor_stability",label:"Anchor stability",unit:"% RMS",digits:1,advanced:true,key:"anchor_hand_rms_pct",note:"Variation in how tightly the hand stayed after anchor confirmation."},
  {id:"hold",label:"Hold time",unit:" s",digits:2,key:"hold_time_s",note:"Shot-to-shot timing spread."},
  {id:"release_offaxis",label:"Release off-axis path",unit:"%",digits:1,advanced:true,key:"release_offaxis_pct",note:"Body-relative early draw-hand off-axis component."},
  {id:"release_travel",label:"Draw-hand rearward travel",unit:"% shoulder-width",digits:1,advanced:true,key:"release_rear_travel_pct",note:"Rearward hand travel during early release/follow-through."},
  {id:"elbow_cont",label:"Draw-elbow continuation",unit:"% shoulder-width",digits:1,advanced:true,key:"release_elbow_travel_pct",note:"Elbow continuation after release."},
  {id:"bow_reaction",label:"Bow-arm early reaction",unit:"°",digits:1,advanced:true,key:"follow_bow_arm_delta_deg",note:"Early follow-through bow-arm change; descriptive, not a universal ideal."}
];
function consistencyEligibleShots(sessionId){return sessionShots(sessionId).filter(shotIsBaselineEligible);}
function consistencyReferenceShots(sessionId){
  const session=STATE.sessions.find(s=>s.id===Number(sessionId));if(!session)return[];
  const current=consistencyEligibleShots(sessionId),currentRefs=current.filter(s=>s.is_reference);
  if(currentRefs.length>=3)return currentRefs;
  const athleteSessionIds=new Set(STATE.sessions.filter(s=>s.athlete_id===session.athlete_id).map(s=>s.id));
  return STATE.shots.filter(s=>s.is_reference&&athleteSessionIds.has(s.session_id)&&shotIsBaselineEligible(s));
}
function consistencyScalarValues(shots,def){
  return shots.map(s=>{if(def.advanced){const adv=loadAdvancedShotMetrics(s.id);return Number(adv?.[def.key]);}return Number(s?.[def.key]);}).filter(Number.isFinite);
}
function consistencyVectorSpread(shots,def){
  const pts=shots.map(s=>{const adv=loadAdvancedShotMetrics(s.id);const x=Number(adv?.[def.vector[0]]),y=Number(adv?.[def.vector[1]]);return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;}).filter(Boolean);
  if(pts.length<2)return {spread:null,n:pts.length};
  const cx=median(pts.map(p=>p.x)),cy=median(pts.map(p=>p.y));
  const radial=pts.map(p=>Math.hypot(p.x-cx,p.y-cy)*100);
  return {spread:median(radial),n:pts.length};
}
function consistencyMetricStats(shots,def){
  if(def.vector)return consistencyVectorSpread(shots,def);
  const vals=consistencyScalarValues(shots,def);if(vals.length<2)return {spread:null,median:vals.length?vals[0]:null,n:vals.length};
  const med=median(vals);return {spread:mad(vals,med),median:med,n:vals.length};
}
function consistencyComparison(cur,ref){
  if(!Number.isFinite(cur?.spread)||cur.n<3)return {label:"Building session",cls:"building"};
  if(!Number.isFinite(ref?.spread)||ref.n<3)return {label:"Reference building",cls:"building"};
  if(Math.abs(ref.spread)<=1e-6)return Math.abs(cur.spread)<=1e-6?{label:"Similar to reference",cls:"similar"}:{label:"Wider than reference",cls:"wide"};
  const floor=Math.max(1e-6,Math.abs(ref.spread)*.15),ratio=cur.spread/Math.max(floor,ref.spread);
  if(ratio<.80)return {label:"Tighter than reference",cls:"tight"};
  if(ratio>1.25)return {label:"Wider than reference",cls:"wide"};
  return {label:"Similar to reference",cls:"similar"};
}
function formatConsistencySpread(stat,def){return Number.isFinite(stat?.spread)?`${stat.spread.toFixed(def.digits)}${def.unit}`:"—";}
function renderConsistencyPanel(sessionId=currentSessionId){
  const host=$("#consistencyPanel");if(!host)return;
  const current=consistencyEligibleShots(sessionId),refs=consistencyReferenceShots(sessionId);
  if(current.length<3){host.innerHTML=`<div class="consistency-empty"><b>Building session consistency</b><span>${current.length}/3 validated shots available. Capture at least 3 valid shots; 5–12+ gives a more useful spread.</span></div>`;return;}
  const rows=CONSISTENCY_METRICS.map(def=>{const cur=consistencyMetricStats(current,def),ref=consistencyMetricStats(refs,def),cmp=consistencyComparison(cur,ref);return {def,cur,ref,cmp};});
  const comparable=rows.filter(r=>r.ref.n>=3&&Number.isFinite(r.ref.spread)&&Number.isFinite(r.cur.spread));
  const counts={tight:0,similar:0,wide:0};comparable.forEach(r=>counts[r.cmp.cls]=(counts[r.cmp.cls]||0)+1);
  const refLabel=refs.length>=3?`${refs.length} coach reference shot${refs.length===1?'':'s'}`:'No 3-shot coach reference set yet';
  const overview=comparable.length?`${counts.tight||0} tighter · ${counts.similar||0} similar · ${counts.wide||0} wider than reference`:'Session spread is shown now; mark 3+ representative shots as Reference for athlete-baseline comparison.';
  host.innerHTML=`<div class="consistency-overview"><div><span>Validated shots</span><b>${current.length}</b></div><div><span>Reference source</span><b>${escapeHtml(refLabel)}</b></div><div class="span2"><span>Pattern</span><b>${escapeHtml(overview)}</b></div></div><div class="consistency-grid">${rows.map(({def,cur,ref,cmp})=>`<div class="consistency-metric"><div class="consistency-metric-head"><b>${escapeHtml(def.label)}</b><span class="consistency-state ${cmp.cls}">${escapeHtml(cmp.label)}</span></div><div class="consistency-values"><span>Session spread <strong>${escapeHtml(formatConsistencySpread(cur,def))}</strong> · n=${cur.n}</span><span>Reference spread <strong>${escapeHtml(formatConsistencySpread(ref,def))}</strong> · n=${ref.n}</span></div><small>${escapeHtml(def.note)}</small></div>`).join("")}</div><div class="consistency-footnote">Spread uses robust median/MAD-style statistics. Smaller spread means tighter repeatability, but the app does not treat tighter as automatically better technique. Coach review and video evidence remain the decision point.</div>`;
}

function renderReport(){
  if(!$("#reportHeader"))return;const s=currentSession();if(!s){return}const a=athleteFor(s),shots=sessionShots();const analyses=shots.map(x=>interpretShot(x));const counts={stable:0,review:0,significant:0,building:0};analyses.forEach(x=>counts[x.css]=(counts[x.css]||0)+1);
  $("#reportHeader").innerHTML=`<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(a?.name||"—")} · ${escapeHtml(a?.discipline||"—")} · ${fmt(s.distance_m," m")} · ${escapeHtml(s.environment||"")} · ${escapeHtml(s.mode||"")}</p><p class="muted">${escapeHtml(sessionConditionSummary(s))}</p>`;
  const avgScore=shots.filter(x=>x.score!=null).length?shots.filter(x=>x.score!=null).reduce((n,x)=>n+Number(x.score),0)/shots.filter(x=>x.score!=null).length:null;
  $("#reportStats").innerHTML=`<div class="stat-card card"><span>Shots</span><strong>${shots.length}</strong></div><div class="stat-card card"><span>Stable</span><strong>${counts.stable||0}</strong></div><div class="stat-card card"><span>Review / Deviation</span><strong>${(counts.review||0)+(counts.significant||0)}</strong></div><div class="stat-card card"><span>Avg Score</span><strong>${avgScore==null?"—":avgScore.toFixed(1)}</strong></div>`;
  renderConsistencyPanel(s.id);
  const base=baselineFor(),validatedShots=shots.filter(shotIsBaselineEligible);let findings=[];METRICS.forEach(m=>{const vals=validatedShots.map(x=>metricValue(x,m)).filter(Number.isFinite);if(vals.length<3)return;const med=median(vals),md=mad(vals,med);findings.push({label:m.label,text:`Median ${fmtNum(med,m.key==="hold_time_s"?2:1,m.unit)} · consistency spread ${fmtNum(md,m.key==="hold_time_s"?2:1,m.unit)}`,spread:(md||0)/m.floor});});findings.sort((x,y)=>y.spread-x.spread);
  $("#reportFindings").innerHTML=`<div class="finding-list">${findings.slice(0,5).map((f,i)=>`<div class="finding-box"><b>${i===0?"Most variable: ":""}${f.label}</b><span>${f.text}</span></div>`).join("")||'<span class="muted">More measured shots are needed for session findings.</span>'}<div class="finding-box"><b>Consistency spread</b><span>Uses Median Absolute Deviation (MAD) internally: a robust measure of typical shot-to-shot variation. Smaller means tighter repeatability.</span></div><div class="finding-box"><b>Baseline source</b><span>${escapeHtml(base.sourceLabel)}</span></div></div>`;
  $("#reportShotTable").innerHTML=`<div class="report-table-wrap"><table class="report-table"><thead><tr><th>#</th><th>Score</th><th>Analysis</th><th>Hold</th><th>Draw Elbow</th><th>Bow Arm</th><th>Head Move</th><th>Reference</th><th>Note</th></tr></thead><tbody>${shots.map((x,i)=>`<tr><td>${x.shot_no}</td><td>${x.score==null?"—":(x.is_x?`${x.score}X`:x.score)}</td><td>${analyses[i].label}</td><td>${fmtNum(x.hold_time_s,2," s")}</td><td>${fmtNum(x.draw_elbow_deg,1,"°")}</td><td>${fmtNum(x.bow_arm_deg,1,"°")}</td><td>${fmtNum(x.head_movement_mm,1," mm")}</td><td>${x.is_reference?"★":""}</td><td>${escapeHtml(x.note||"")}</td></tr>`).join("")}</tbody></table></div>`;
}

function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function impactRecordForShot(shot){
  const data=loadImpactData(shot?.session_id||currentSessionId),cfg=data.config||{};
  for(const [endKey,end] of Object.entries(data.ends||{})){
    for(let i=0;i<(end.arrows||[]).length;i++){
      const a=end.arrows[i];if(!a)continue;
      const linked=a.shotId?Number(a.shotId)===Number(shot.id):linkedShotForArrow(Number(endKey),i,cfg)?.id===shot.id;
      if(linked){const spec=targetFaceSpec(cfg.faceType||'80-full'),pt=normalizedImpactPoint(a,spec);return {end_no:Number(endKey),arrow_no:i+1,x_cm:pt.x,y_cm:pt.y,score:a.score,is_x:!!a.isX,spot:a.spot??0,conditions:end.conditions||{}};}
    }
  }
  return null;
}
function buildEnrichedSessionExport(){
  const s=currentSession();if(!s)return null;
  const a=athleteFor(s),e=equipFor(s),ctx=loadSessionContext(s.id),impact=loadImpactData(s.id),shots=sessionShots(s.id).map(shot=>({...shot,impact:impactRecordForShot(shot)}));
  return {version:`3PM Archery Form Analyzer V${APP_VERSION} ${APP_BUILD_LABEL}`,exported_at:new Date().toISOString(),session:s,session_context:ctx,athlete:a||null,equipment:e||null,impact,shots};
}
function downloadText(filename,text,mime='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportEnrichedJson(){const data=buildEnrichedSessionExport();if(!data){toast('Select a session first.','warn');return;}downloadText(`3PM_session_${data.session.id}.json`,JSON.stringify(data,null,2),'application/json;charset=utf-8');}
function exportEnrichedCsv(){
  const data=buildEnrichedSessionExport();if(!data){toast('Select a session first.','warn');return;}
  const c=data.session_context||{},headers=['session_id','session_title','distance_m','environment','training_mode','target_face','weather','wind_pattern','wind_speed','wind_unit','relative_wind','shot_no','timestamp_s','score','is_x','hold_time_s','draw_elbow_deg','bow_arm_deg','shoulder_line_deg','torso_lean_deg','head_movement_mm','impact_end','impact_arrow','impact_x_cm','impact_y_cm','impact_score','impact_is_x','end_wind_speed','end_wind_relative','sight_adjustment','end_note'];
  const rows=data.shots.map(x=>{const im=x.impact||{},ec=im.conditions||{};return [data.session.id,data.session.title,data.session.distance_m,data.session.environment,data.session.mode,data.session.target_face,c.weather_condition,c.wind_pattern,c.wind_speed,c.wind_unit,c.wind_direction_relative,x.shot_no,x.timestamp_s,x.score,x.is_x,x.hold_time_s,x.draw_elbow_deg,x.bow_arm_deg,x.shoulder_line_deg,x.torso_lean_deg,x.head_movement_mm,im.end_no,im.arrow_no,im.x_cm,im.y_cm,im.score,im.is_x,ec.wind_speed,ec.wind_relative,ec.sight_adjustment,ec.note];});
  downloadText(`3PM_session_${data.session.id}.csv`,[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8');
}

function updateShotSaveStatus(){
  const el=$("#shotSaveStatus"); if(!el)return;
  if(!currentSessionId){el.textContent="Test mode · no session · not saved";el.className="status-pill warn compact-status";return;}
  if(!CAMERA_ROLES.some(r=>!!liveStreams[r])){el.textContent="Shot Save: waiting for camera";el.className="status-pill neutral compact-status";return;}
  if(!($("#autoMarkToggle")?.checked??true)){el.textContent="Shot Save: Auto OFF";el.className="status-pill warn compact-status";return;}
  if(!($("#phaseDetectToggle")?.checked??true)){el.textContent="Shot Save: Phase OFF";el.className="status-pill warn compact-status";return;}
  el.textContent="Shot Save: READY";el.className="status-pill good compact-status";
}

function updateLivePhase(phase,metrics){
  livePhase=phase||"—";
  const badge=$("#livePhaseBadge");
  if(badge)badge.textContent=`Phase: ${livePhase}${Number.isFinite(metrics?.holdTimeS)?` · Hold ${metrics.holdTimeS.toFixed(2)} s`:""}`;
  $$("#phaseButtons [data-phase]").forEach(b=>b.classList.toggle("live-active",b.dataset.phase===livePhase));
  $("#mHold").textContent=Number.isFinite(metrics?.holdTimeS)?metrics.holdTimeS.toFixed(2):"—";
  updateShotReadiness(metrics);
  pushLiveMetricSample(metrics);
}
function capturePreflight(){
  const reasons=[];
  if(!currentSessionId)reasons.push("no active session");
  if(!CAMERA_ROLES.some(r=>!!liveStreams[r]))reasons.push("no live camera");
  if(!($("#autoMarkToggle")?.checked??true))reasons.push("Auto Release Marking is off");
  if(!($("#phaseDetectToggle")?.checked??true))reasons.push("Phase Detection is off");
  return {ready:reasons.length===0,reasons};
}

function shotEvidenceScore(m){return window.CoreEngine?.evidenceScore?.(m)??((Number(m?.releaseConfidence)||0)*.42+(Number(m?.releaseQuality)||0)*.22+(Number(m?.shotObservability)||0)*.22+(Number(m?.identityConfidence)||0)*.14);}
function onShotEvidence(metrics){
  const validation=window.CoreEngine?.validateCompletedShotEvidence?.(metrics);
  if(validation&&!validation.accepted){console.warn("Core rejected shot evidence:",validation.reason,metrics);return;}
  if(!metrics?.shotComplete)return;
  if(shotCoordinator){
    const offered=shotCoordinator.offer(metrics);if(!offered.accepted)return;
    if(shotEvidenceTimer)return;
    shotEvidenceTimer=setTimeout(async()=>{
      shotEvidenceTimer=null;const r=shotCoordinator.flush();if(!r?.commit)return;
      await onAutoRelease({...r.commit,evidenceRoles:r.evidenceRoles});
    },180);
    return;
  }
  // Compatibility fallback if the typed core could not load.
  const epoch=Number(metrics.releaseEpochMs)||Date.now();
  if(lastAutoReleaseEpochMs&&Math.abs(epoch-lastAutoReleaseEpochMs)<900)return;
  shotEvidenceQueue=shotEvidenceQueue.filter(x=>Math.abs((Number(x.releaseEpochMs)||epoch)-epoch)<650);
  const existing=shotEvidenceQueue.findIndex(x=>(x.role||"side")===(metrics.role||"side"));
  if(existing>=0)shotEvidenceQueue[existing]=metrics;else shotEvidenceQueue.push(metrics);
  if(shotEvidenceTimer)return;
  shotEvidenceTimer=setTimeout(async()=>{shotEvidenceTimer=null;const evidence=shotEvidenceQueue.splice(0);if(!evidence.length)return;evidence.sort((a,b)=>shotEvidenceScore(b)-shotEvidenceScore(a));const best={...evidence[0],evidenceRoles:evidence.map(x=>x.role||"side")};await onAutoRelease(best);},180);
}

function fusedMetricsForShot(trigger,eventEpochMs){
  const candidates=CAMERA_ROLES.map(role=>{const near=window.PoseEngine?.getMetricsNearEpoch?.(role,eventEpochMs,520);const m=near?.metrics||null;return m?.detected?{role,m,delta:Number(near?.deltaMs)||0}:null;}).filter(Boolean);
  if(!candidates.length)return trigger;
  const defs={
    drawElbowDeg:{q:'drawElbow',view:'any'},bowArmDeg:{q:'bowArm',view:'any'},shoulderLineDeg:{q:'shoulderLine',view:'frontal'},torsoLeanDeg:{q:'torsoLean',view:'frontal'},headMovementMm:{q:'headMovement',view:'any'},headOffsetPct:{q:'headMovement',view:'any'}
  };
  const out={...trigger,metricConfidence:{...(trigger?.metricConfidence||{})},metricSources:{}};
  for(const [key,d] of Object.entries(defs)){
    const ranked=candidates.map(c=>{const v=Number(c.m?.[key]);if(!Number.isFinite(v))return null;const q=Number(c.m.metricConfidence?.[d.q]??c.m.quality??0);let viewBonus=0;if(d.view==='frontal'){viewBonus=c.m.viewType==='front/rear-like'?.18:c.m.viewType==='oblique'?.08:-.08;}const score=q*.55+(Number(c.m.identityConfidence)||0)*.15+(Number(c.m.shotObservability)||0)*.15+Math.max(0,1-c.delta/520)*.15+viewBonus;return{...c,value:v,q,score};}).filter(Boolean).sort((a,b)=>b.score-a.score);
    const best=ranked[0];if(!best||best.q<.42)continue;out[key]=best.value;out.metricConfidence[d.q]=best.q;out.metricSources[key]={role:best.role,confidence:best.q,sync_delta_ms:best.delta,view_type:best.m.viewType||null};
  }
  return out;
}

function clearReviewForIncomingCapture(){
  stopShotReplay();shotReplayState.loadToken++;clearShotReplayObjectUrl();shotReplayState.shotId=null;shotReplayState.record=null;shotReplayState.index=0;shotReplayState.zoom=1;shotReplayState.panX=0;shotReplayState.panY=0;
  const img=$('#shotReplayImage');if(img)img.removeAttribute('src');const empty=$('#shotReplayEmpty');if(empty)empty.textContent='Capturing new shot…';const slider=$('#shotReplaySlider');if(slider){slider.value='0';slider.max='0';slider.disabled=true;}const meta=$('#shotReplayMeta');if(meta)meta.textContent='New Capture · waiting for verified real-frame evidence';
  const strip=$('#filmstrip');if(strip){strip.classList.remove('hidden');strip.innerHTML='<div class="filmstrip-empty">Capturing new shot · previous thumbnails cleared</div>';}
  const status=$('#filmstripStatus');if(status)status.textContent='New Capture in progress · previous shot display cleared';
}

async function onAutoRelease(metrics){
  const pre=capturePreflight();
  if(!pre.ready){
    // A release event should never disappear silently. Keep the user informed
    // about the exact prerequisite that blocked automatic capture.
    toast(`Shot sequence confirmed but not captured: ${pre.reasons.join(" · ")}.`,"warn",4200);
    return;
  }
  if(autoReleaseBusy)return;

  const now=Date.now();
  if(now-lastAutoReleaseAt<1400)return;

  lastAutoReleaseAt=now;
  lastAutoReleaseEpochMs=Number.isFinite(Number(metrics?.releaseEpochMs))?Number(metrics.releaseEpochMs):now;
  autoReleaseBusy=true;
  const eventEpochMs=Number.isFinite(Number(metrics?.releaseEpochMs))?Number(metrics.releaseEpochMs):now;

  // V5 freezes the image nearest the retrospectively resolved Release Onset from the rolling buffer.
  // Confirmation may happen later; the displayed release frame does not move later with it.
  const activeRoles=CAMERA_ROLES.filter(role=>!!liveStreams[role]);
  const centerDataUrls={};
  const centerSyncDelta={};
  for(const role of activeRoles){
    const buffered=nearestEvidenceFrame(eventEpochMs,role,95);
    centerDataUrls[role]=await evidenceFrameToDataUrl(buffered,.86)||captureVideoDataUrl($(`#${role}Video`),releaseSnapshotTargetWidth(role),.86);
    centerSyncDelta[role]=Number.isFinite(buffered?.deltaMs)?buffered.deltaMs:null;
  }
  // One short auxiliary cycle improves cross-view evidence; it is not a follow-through hold gate.
  await new Promise(r=>setTimeout(r,90));
  const multiViewEvidence=collectMultiViewEvidence(eventEpochMs);

  const stamp=isRecording&&recordStartedAt
    ? (eventEpochMs-recordStartedAt)/1000
    : (eventEpochMs-liveSessionStartedAt)/1000;

  // Clear the previous review NOW that current release snapshots are frozen. Old frames must never remain on screen while the new shot is being persisted.
  clearReviewForIncomingCapture();

  const shotMetrics=fusedMetricsForShot(metrics,eventEpochMs);
  const fd=shotFormDataFromMetrics(shotMetrics);
  fd.append("session_id",String(currentSessionId));
  fd.append("timestamp_s",Math.max(0,stamp).toFixed(3));
  fd.append("phase","Release");
  fd.append("auto_detected","true");
  fd.append("status","ok");
  if(Number.isFinite(metrics?.releaseConfidence)){
    fd.append("release_confidence",metrics.releaseConfidence.toFixed(3));
  }

  try{
    const r=await api("/api/shots",{method:"POST",body:fd});
    saveAdvancedShotMetrics(r.id,shotMetrics,multiViewEvidence);
    // A backend reset/import can reuse numeric shot ids. Clear any local replay slot before
    // this brand-new shot starts writing evidence so yesterday can never bleed into today.
    await evidenceDbDeleteShot(r.id,currentSessionId).catch(err=>console.warn("Could not prepare clean evidence slot",err));

    // Save one release frame per active camera immediately. A failure on one role
    // must never prevent the other live views from being preserved.
    const centerSaveFailures=[];
    for(const role of activeRoles){
      const dataUrl=centerDataUrls[role];
      if(!dataUrl){centerSaveFailures.push(role);continue;}
      try{await uploadShotFrameData(r.id,dataUrl,0,liveCoachFrameLabel(role,"Release",eventEpochMs),null);}
      catch(frameErr){centerSaveFailures.push(role);console.warn(`${roleTitle(role)} center release frame save failed`,frameErr);}
    }

    selectedShotId=r.id;
    await reload();
    selectedShotId=r.id;

    // Verify the backend actually returned one captured frame for every live role.
    // Retry missing center frames once from the pre-network snapshots.
    const missingAfterFirst=activeRoles.filter(role=>roleFramesForShot(r.id,role).length===0);
    let retried=false;
    for(const role of missingAfterFirst){
      const dataUrl=centerDataUrls[role];if(!dataUrl)continue;
      try{await uploadShotFrameData(r.id,dataUrl,0,liveCoachFrameLabel(role,"Release Retry",eventEpochMs),null);retried=true;}
      catch(frameErr){console.warn(`${roleTitle(role)} center release retry failed`,frameErr);}
    }
    if(retried){await reload();selectedShotId=r.id;}
    const capturedRoles=activeRoles.filter(role=>roleFramesForShot(r.id,role).length>0);
    const missingRoles=activeRoles.filter(role=>roleFramesForShot(r.id,role).length===0);
    renderShots();
    renderShotDetail();
    if(missingRoles.length){
      toast(`Shot #${r.shot_no}: captured ${capturedRoles.map(roleTitle).join(' + ')||'no camera frames'} · missing ${missingRoles.map(roleTitle).join(' + ')}.`,'warn',5200);
    }else if(activeRoles.length>1){
      toast(`Shot #${r.shot_no}: multi-view captured · ${capturedRoles.map(roleTitle).join(' + ')}.`,'good',2200);
    }

    // Pre/post frames are supplemental; they cannot prevent Shot List creation.
    scheduleLiveKeyframesForAutoShot(r.id,eventEpochMs,centerDataUrls,activeRoles,shotMetrics,centerSyncDelta);
    // Persist phase-weighted real-frame evidence separately from AI keyframes.
    // Release receives maximum native density; later Follow-through/Recovery is summarized. It never gates Shot creation.
    scheduleFullShotEvidence(r.id,currentSessionId,eventEpochMs,activeRoles,shotMetrics);
    registerPendingFollowEvidence(r.id,currentSessionId,shotMetrics,activeRoles);

    const hold=Number.isFinite(metrics?.holdTimeS)
      ? ` · Hold ${metrics.holdTimeS.toFixed(2)} s`
      : "";
    showShotCaptureFlash(r.shot_no,metrics);
    toast(`Shot #${r.shot_no} saved${hold}`,"good",2400);
  }catch(err){
    console.error("Auto completed-shot save failed",err);
    toast(`Completed shot detected but could not be saved: ${String(err?.message||err).slice(0,140)}`,"warn",5200);
  }finally{
    autoReleaseBusy=false;
  }
}

function shotFormDataFromMetrics(m){
  const fd=new FormData();if(!m)return fd;const q=m.metricConfidence||{};
  const reliable=(name,threshold=.45)=>!Number.isFinite(Number(q[name]))||Number(q[name])>=threshold;
  const pairs=[["hold_time_s",m.holdTimeS,true],["draw_elbow_deg",m.drawElbowDeg,reliable("drawElbow")],["bow_arm_deg",m.bowArmDeg,reliable("bowArm")],["shoulder_line_deg",m.shoulderLineDeg,reliable("shoulderLine",.48)],["torso_lean_deg",m.torsoLeanDeg,reliable("torsoLean",.50)],["head_movement_mm",m.headMovementMm,reliable("headMovement",.50)],["pose_confidence",m.quality,true],["head_offset_pct",m.headOffsetPct,reliable("headMovement",.48)]];
  pairs.forEach(([k,v,ok])=>{if(ok&&Number.isFinite(v))fd.append(k,v.toFixed(k==="pose_confidence"?4:3));});return fd;
}

// -----------------------------
// Storage
// -----------------------------
function bytesHuman(n){
  if(n===null || n===undefined) return "—";
  const units=["B","KB","MB","GB","TB"];
  let v=Number(n), i=0;
  while(v>=1024 && i<units.length-1){v/=1024;i++;}
  return `${v.toFixed(i>=3?2:1)} ${units[i]}`;
}

async function refreshStorageStatus(){
  try{
    const s=await api("/api/storage");
    $("#storagePath").textContent=s.root || "—";
    $("#storageMeta").textContent=s.available
      ? `${s.kind} storage · ${bytesHuman(s.free_bytes)} free of ${bytesHuman(s.total_bytes)}`
      : `${s.kind} storage · unavailable · ${s.message}`;

    const header=$("#storageStatus");
    const badge=$("#storageReadyBadge");
    if(s.available){
      header.textContent=`Storage: ${s.external?"External":"Internal"} · ${bytesHuman(s.free_bytes)} free`;
      header.className="status-pill good"; if($("#homeStorageReady"))$("#homeStorageReady").textContent=`${s.external?"External":"Internal"} · ${bytesHuman(s.free_bytes)} free`;
      badge.textContent="Ready";
      badge.className="status-pill good";
      $("#openStorageBtn").disabled=false;
    }else{
      header.textContent="Storage: unavailable";
      header.className="status-pill bad"; if($("#homeStorageReady"))$("#homeStorageReady").textContent="Unavailable";
      badge.textContent="Unavailable";
      badge.className="status-pill bad";
      $("#openStorageBtn").disabled=true;
    }
    return s;
  }catch(err){
    console.error(err);
    $("#storageStatus").textContent="Storage: error"; if($("#homeStorageReady"))$("#homeStorageReady").textContent="Error";
    $("#storageStatus").className="status-pill bad";
  }
}

async function chooseStorage(){
  const btn=$("#chooseStorageBtn");
  btn.disabled=true; btn.textContent="Waiting for folder…";
  try{
    const s=await api("/api/storage/choose",{method:"POST"});
    if(!s.cancelled) await refreshStorageStatus();
  }catch(err){
    alert("Storage folder could not be changed: "+err.message);
  }finally{
    btn.disabled=false; btn.textContent="Choose Storage Folder…";
  }
}

async function useInternalStorage(){
  if(!confirm("Use storage inside the Form Analyzer folder for NEW recordings and analysis data? Existing files will stay where they are.")) return;
  try{
    await api("/api/storage/internal",{method:"POST"});
    await refreshStorageStatus();
  }catch(err){alert("Could not change storage: "+err.message);}
}

async function openStorage(){
  try{await api("/api/storage/open",{method:"POST"});}
  catch(err){alert("Could not open storage folder: "+err.message);}
}


// -----------------------------
// V5 Dev2 Session Archive / Restore
// -----------------------------
const SESSION_ARCHIVE_FORMAT="3PM Archery Form Analyzer Session Archive";
const SESSION_ARCHIVE_VERSION=1;
const SESSION_BACKEND_FIELDS=["athlete_id","equipment_id","title","session_date","distance_m","target_face","environment","mode","notes"];
const SHOT_BACKEND_FIELDS=["timestamp_s","score","is_x","status","phase","note","is_reference","auto_detected","hold_time_s","draw_elbow_deg","bow_arm_deg","shoulder_line_deg","torso_lean_deg","head_movement_mm","pose_confidence","head_offset_pct","release_confidence","execution_label"];
let archiveBusy=false;

function archiveFsSupported(){return typeof window.showDirectoryPicker==="function" && !!window.crypto?.subtle;}
function safeArchiveName(v,fallback="Session"){
  const x=String(v??"").trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g,"-").replace(/\s+/g," ").slice(0,72);
  return x||fallback;
}
function extensionFor(name,type=""){
  const m=String(name||"").match(/(\.[A-Za-z0-9]{1,8})$/);if(m)return m[1].toLowerCase();
  const t=String(type||"").toLowerCase();
  if(t.includes("webm"))return ".webm";if(t.includes("mp4"))return ".mp4";if(t.includes("jpeg"))return ".jpg";if(t.includes("png"))return ".png";return ".bin";
}
function archiveStatus(text,done=null,total=null,kind="neutral"){
  const dlg=$("#archiveProgressDialog"),msg=$("#archiveProgressText"),bar=$("#archiveProgressBar"),badge=$("#archiveProgressBadge");
  if(dlg&&!dlg.open)dlg.showModal();if(msg)msg.textContent=text;
  if(bar&&Number.isFinite(done)&&Number.isFinite(total)&&total>0){bar.max=total;bar.value=Math.min(done,total);}else if(bar){bar.removeAttribute("value");}
  if(badge){badge.textContent=kind==="good"?"Verified":kind==="bad"?"Stopped":"Working";badge.className=`status-pill ${kind==="good"?"good":kind==="bad"?"bad":"neutral"}`;}
}
function closeArchiveStatus(){const dlg=$("#archiveProgressDialog");if(dlg?.open)dlg.close();}
async function sha256Blob(blob){const data=await blob.arrayBuffer(),digest=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function directoryForPath(root,parts,create=true){let dir=root;for(const p of parts){dir=await dir.getDirectoryHandle(p,{create});}return dir;}
async function writeVerifiedArchiveFile(root,relativePath,blob){
  const parts=String(relativePath).split("/").filter(Boolean),name=parts.pop(),dir=await directoryForPath(root,parts,true),fh=await dir.getFileHandle(name,{create:true}),w=await fh.createWritable();
  await w.write(blob);await w.close();
  const written=await fh.getFile();if(written.size!==blob.size)throw new Error(`Verification failed for ${relativePath}: expected ${blob.size} bytes, found ${written.size}.`);
  const srcHash=await sha256Blob(blob),dstHash=await sha256Blob(written);if(srcHash!==dstHash)throw new Error(`Checksum verification failed for ${relativePath}.`);
  return {path:relativePath,size:blob.size,sha256:srcHash,type:blob.type||written.type||"application/octet-stream"};
}
async function readArchiveFile(root,relativePath){
  const parts=String(relativePath).split("/").filter(Boolean),name=parts.pop();let dir=root;for(const p of parts)dir=await dir.getDirectoryHandle(p);const fh=await dir.getFileHandle(name);return fh.getFile();
}
async function fetchArchiveBlob(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`Could not read archive source (${r.status}).`);return r.blob();}
function equipmentSnapshotForSession(session){const e=displayEquipmentForSession(session),supp=loadEquipmentSupplements();return e?{...e,supplement:supp[String(e.id)]||null}:null;}
function archiveStructuredData(session){
  const athlete=STATE.athletes.find(a=>a.id===Number(session.athlete_id))||null,shots=sessionShots(session.id);
  return {format:SESSION_ARCHIVE_FORMAT,archive_version:SESSION_ARCHIVE_VERSION,app_version:APP_VERSION,created_at:new Date().toISOString(),source:{session_id:session.id,athlete_id:session.athlete_id,equipment_id:session.equipment_id||null},athlete_snapshot:athlete?{...athlete}:null,equipment_snapshot:equipmentSnapshotForSession(session),session:{...session},session_context:loadSessionContext(session.id),impact:loadImpactData(session.id),shots:shots.map(shot=>({record:{...shot},advanced:loadAdvancedShotMetrics(shot.id)})),frames:[],evidence:[],media:[]};
}
function sessionArchiveCounts(session){const shots=sessionShots(session.id),ids=new Set(shots.map(x=>x.id)),frames=(STATE.shot_frames||[]).filter(f=>ids.has(Number(f.shot_id))),videos=CAMERA_ROLES.filter(r=>session?.[`${r}_video`]).length;return {shots:shots.length,frames:frames.length,videos};}
function renderSessionArchiveSummary(){
  const box=$("#sessionArchiveSummary"),s=currentSession(),archiveBtn=$("#archiveSessionBtn"),removeBtn=$("#archiveRemoveSessionBtn");if(!box)return;
  if(archiveBtn)archiveBtn.disabled=!s;if(removeBtn)removeBtn.disabled=!s;
  if(!s){box.innerHTML='<span class="muted">Select a session to archive, restore or remove its local data.</span>';return;}
  const c=sessionArchiveCounts(s);box.innerHTML=`<b>${escapeHtml(s.title)}</b><span>${c.shots} shot${c.shots===1?'':'s'} · ${c.frames} key frame${c.frames===1?'':'s'} · ${c.videos} session video${c.videos===1?'':'s'}</span>`;
}
async function archiveCurrentSession({removeLocal=false}={}){
  const session=currentSession();if(!session){toast("Select a session first.","warn");return;}if(archiveBusy)return;
  if(!archiveFsSupported()){toast("Direct external-drive archive needs Chrome/Edge desktop with folder access. No local data was changed.","warn",6500);return;}
  if(removeLocal){const ok=confirm(`Archive & remove local session?\n\nThis session will be copied to the selected external drive. After the archive is verified, all local data for this session will be removed from this computer.\n\nThe session will no longer be available for Review or Analysis until it is imported again.`);if(!ok)return;}
  archiveBusy=true;const sourceShotIds=sessionShots(session.id).map(x=>x.id);
  try{
    const parent=await window.showDirectoryPicker({mode:"readwrite",id:"3pm-session-archive"}),athlete=STATE.athletes.find(a=>a.id===Number(session.athlete_id)),stamp=new Date().toISOString().slice(11,19).replace(/:/g,"") ,folderName=`3PM_Session_${safeArchiveName(session.session_date||new Date().toISOString().slice(0,10),"Date")}_${safeArchiveName(athlete?.name,"Athlete")}_${safeArchiveName(session.title,"Session")}_S${session.id}_${stamp}`,folder=await parent.getDirectoryHandle(folderName,{create:true});
    const incomplete=await folder.getFileHandle("ARCHIVE_INCOMPLETE.txt",{create:true}),iw=await incomplete.createWritable();await iw.write(new Blob([`Archive started ${new Date().toISOString()}\nDo not remove the source session unless manifest.json says completed=true.\n`],{type:"text/plain"}));await iw.close();
    const data=archiveStructuredData(session),shots=sessionShots(session.id),shotIds=new Set(shots.map(x=>x.id)),frames=(STATE.shot_frames||[]).filter(f=>shotIds.has(Number(f.shot_id))).sort((a,b)=>Number(a.shot_id)-Number(b.shot_id)||Number(a.offset_ms)-Number(b.offset_ms)),work=[];
    const evidenceRecords=await evidenceDbRecordsForSession(session.id),evidenceEntries=new Map();
    for(const rec of evidenceRecords){const shot=STATE.shots.find(x=>x.id===Number(rec.shotId));const entry={old_shot_id:Number(rec.shotId),shot_no:shot?.shot_no||null,camera_role:rec.role,release_epoch_ms:Number(rec.releaseEpochMs)||null,anchor_epoch_ms:Number(rec.anchorEpochMs)||null,anchor_settled_epoch_ms:Number(rec.anchorSettledEpochMs)||null,anchor_focus_epoch_ms:Number(rec.anchorFocusEpochMs)||null,capture_kind:rec.captureKind||"real-rolling-camera-frames",frames:[]};evidenceEntries.set(rec.key,entry);data.evidence.push(entry);(rec.frames||[]).forEach((frame,index)=>work.push({kind:"evidence",record:rec,frame,index,entry}));}
    for(const role of CAMERA_ROLES){const file=session?.[`${role}_video`];if(file)work.push({kind:"video",role,file});}for(const f of frames)work.push({kind:"frame",frame:f});
    const total=Math.max(1,work.length+1),files=[];let done=0;archiveStatus(`Preparing “${session.title}”…`,done,total);
    for(const item of work){
      if(item.kind==="video"){
        archiveStatus(`Copying ${roleTitle(item.role)} session video…`,done,total);const blob=await fetchArchiveBlob(`/api/media/${session.id}/${item.role}?v=${encodeURIComponent(item.file)}&archive=${Date.now()}`),path=`media/${item.role}${extensionFor(item.file,blob.type)}`,meta=await writeVerifiedArchiveFile(folder,path,blob);files.push(meta);data.media.push({role:item.role,original_name:item.file,...meta});
      }else if(item.kind==="frame"){
        const f=item.frame,shot=STATE.shots.find(x=>x.id===Number(f.shot_id)),role=frameRole(f),path=`frames/shot-${String(shot?.shot_no||f.shot_id).padStart(4,"0")}-${role}-${String(Number(f.offset_ms)||0).replace('-','m')}ms-${f.id}.jpg`;
        archiveStatus(`Copying Shot #${shot?.shot_no||'?'} · ${roleTitle(role)} · ${frameBaseLabel(f)}…`,done,total);const blob=await fetchArchiveBlob(`/api/shot-frame/${f.id}?archive=${Date.now()}`),meta=await writeVerifiedArchiveFile(folder,path,blob);files.push(meta);data.frames.push({old_frame_id:f.id,old_shot_id:f.shot_id,shot_no:shot?.shot_no||null,camera_role:role,offset_ms:Number(f.offset_ms)||0,label:f.label||roleFrameLabel(role,frameBaseLabel(f)),source_time_s:Number.isFinite(Number(f.source_time_s))?Number(f.source_time_s):null,...meta});
      }else{
        const rec=item.record,f=item.frame,shotNo=item.entry.shot_no||rec.shotId,path=`evidence/shot-${String(shotNo).padStart(4,"0")}-${rec.role}/frame-${String(item.index+1).padStart(4,"0")}.jpg`;
        archiveStatus(`Copying Shot #${shotNo} · ${roleTitle(rec.role)} Full Shot Evidence ${item.index+1}/${rec.frames.length}…`,done,total);const meta=await writeVerifiedArchiveFile(folder,path,f.blob);files.push(meta);item.entry.frames.push({index:item.index,epoch_ms:Number(f.epochMs),offset_ms:Number(f.offsetMs),...meta});
      }
      done++;archiveStatus(`Archived ${done} of ${work.length} evidence file${work.length===1?'':'s'}…`,done,total);
    }
    const manifest={format:SESSION_ARCHIVE_FORMAT,archive_version:SESSION_ARCHIVE_VERSION,app_version:APP_VERSION,completed:true,created_at:data.created_at,session_id:session.id,session_title:session.title,athlete_name:athlete?.name||"",counts:{shots:shots.length,frames:data.frames.length,evidence_frames:data.evidence.reduce((n,e)=>n+(e.frames?.length||0),0),videos:data.media.length},files,structured:data},manifestBlob=new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"});await writeVerifiedArchiveFile(folder,"manifest.json",manifestBlob);
    const savedManifest=JSON.parse(await (await readArchiveFile(folder,"manifest.json")).text());if(savedManifest?.completed!==true||savedManifest?.format!==SESSION_ARCHIVE_FORMAT)throw new Error("Archive manifest verification failed.");try{await folder.removeEntry("ARCHIVE_INCOMPLETE.txt");}catch{}
    archiveStatus(`Archive verified · ${shots.length} shots · ${data.frames.length} key frames · ${data.evidence.reduce((n,e)=>n+(e.frames?.length||0),0)} replay frames · ${data.media.length} videos`,total,total,"good");
    if(removeLocal){await deleteSessionPermanently(session,{skipConfirm:true,sourceShotIds});toast(`Archive verified. “${session.title}” was removed from local storage.`,`good`,5200);}else toast("Session archive verified on the selected drive.","good",4200);setTimeout(closeArchiveStatus,1400);
  }catch(err){if(err?.name==="AbortError"){closeArchiveStatus();toast("Archive cancelled. Local session was not changed.","warn",3600);}else{console.error(err);archiveStatus(`Archive stopped: ${err.message||err}`,null,null,"bad");toast("Archive was not completed. Local session was not deleted.","bad",6200);}}
  finally{archiveBusy=false;renderSessionArchiveSummary();}
}
function appendField(fd,key,value){if(value===null||value===undefined||value==="")return;if(typeof value==="boolean")fd.append(key,value?"true":"false");else fd.append(key,String(value));}
function sessionImportFormData(record,athleteId,equipmentId,title){const fd=new FormData();for(const k of SESSION_BACKEND_FIELDS){let v=record?.[k];if(k==="athlete_id")v=athleteId;if(k==="equipment_id")v=equipmentId;if(k==="title")v=title;appendField(fd,k,v);}return fd;}
function shotImportFormData(record,newSessionId){const fd=new FormData();appendField(fd,"session_id",newSessionId);for(const k of SHOT_BACKEND_FIELDS)appendField(fd,k,record?.[k]);return fd;}
function findArchiveAthlete(snapshot){if(!snapshot)return null;const exact=STATE.athletes.find(a=>a.id===Number(snapshot.id)&&String(a.name).trim().toLowerCase()===String(snapshot.name).trim().toLowerCase());if(exact)return exact;const same=STATE.athletes.filter(a=>String(a.name).trim().toLowerCase()===String(snapshot.name).trim().toLowerCase());return same.length===1?same[0]:null;}
function findArchiveEquipment(snapshot,athleteId){if(!snapshot)return null;const exact=STATE.equipment.find(e=>e.id===Number(snapshot.id)&&e.athlete_id===Number(athleteId));if(exact)return exact;const same=STATE.equipment.filter(e=>e.athlete_id===Number(athleteId)&&String(e.name).trim().toLowerCase()===String(snapshot.name).trim().toLowerCase());return same.length===1?same[0]:null;}
async function verifyArchiveDirectory(dir,manifest){const files=Array.isArray(manifest?.files)?manifest.files:[];let i=0;for(const meta of files){archiveStatus(`Verifying ${meta.path}…`,i,Math.max(1,files.length));const file=await readArchiveFile(dir,meta.path);if(file.size!==Number(meta.size))throw new Error(`Size check failed: ${meta.path}`);const hash=await sha256Blob(file);if(hash!==meta.sha256)throw new Error(`Checksum failed: ${meta.path}`);i++;}return true;}
async function importArchivedSession(){
  if(archiveBusy)return;if(!archiveFsSupported()){toast("Archive import needs Chrome/Edge desktop with folder access.","warn",6000);return;}archiveBusy=true;
  try{
    const dir=await window.showDirectoryPicker({mode:"read",id:"3pm-session-import"});archiveStatus("Reading archive manifest…",0,1);const manifest=JSON.parse(await (await readArchiveFile(dir,"manifest.json")).text());if(manifest?.format!==SESSION_ARCHIVE_FORMAT||manifest?.completed!==true||!manifest?.structured?.session)throw new Error("This folder is not a completed 3PM Session Archive.");
    await verifyArchiveDirectory(dir,manifest);const data=manifest.structured,athlete=findArchiveAthlete(data.athlete_snapshot);if(!athlete)throw new Error(`Athlete profile “${data.athlete_snapshot?.name||'unknown'}” was not found locally. Create/select the athlete profile before importing this session.`);const equip=findArchiveEquipment(data.equipment_snapshot,athlete.id)||defaultEquipmentForAthlete(athlete.id)||null;
    const duplicate=STATE.sessions.some(s=>s.athlete_id===athlete.id&&String(s.title)===String(data.session.title)&&String(s.session_date||"")===String(data.session.session_date||""));let title=data.session.title||"Imported Session";if(duplicate){if(!confirm(`A local session named “${title}” already exists for ${athlete.name} on ${data.session.session_date||'that date'}. Import a second copy?`)){closeArchiveStatus();return;}title=`${title} (Restored)`;}
    const newSession=await api("/api/sessions",{method:"POST",body:sessionImportFormData(data.session,athlete.id,equip?.id||null,title)});saveSessionContext(newSession.id,data.session_context||{});if(data.impact)saveImpactData(data.impact,newSession.id);let done=0,total=(data.media?.length||0)+(data.shots?.length||0)+(data.frames?.length||0)+(data.evidence||[]).reduce((n,e)=>n+(e.frames?.length||0),0)+1;
    for(const media of (data.media||[])){archiveStatus(`Restoring ${roleTitle(media.role)} session video…`,done,total);const blob=await readArchiveFile(dir,media.path),fd=new FormData();fd.append("file",new File([blob],media.original_name||`session-${media.role}${extensionFor(media.path,blob.type)}`,{type:blob.type||media.type||"video/webm"}));await api(`/api/upload/${newSession.id}/${media.role}`,{method:"POST",body:fd});done++;}
    const newShotByOldId=new Map();for(const item of [...(data.shots||[])].sort((a,b)=>Number(a.record?.shot_no)-Number(b.record?.shot_no))){archiveStatus(`Restoring Shot #${item.record?.shot_no||'?'}…`,done,total);const saved=await api("/api/shots",{method:"POST",body:shotImportFormData(item.record,newSession.id)});newShotByOldId.set(Number(item.record.id),saved.id);if(item.advanced)try{localStorage.setItem(advancedShotKey(saved.id),JSON.stringify(item.advanced));}catch{}done++;}
    for(const f of (data.frames||[])){const newShotId=newShotByOldId.get(Number(f.old_shot_id));if(!newShotId)continue;archiveStatus(`Restoring Shot #${f.shot_no||'?'} key frame…`,done,total);const blob=await readArchiveFile(dir,f.path);await uploadShotFrame(newShotId,blob,Number(f.offset_ms)||0,f.label||roleFrameLabel(f.camera_role,"Key frame"),Number.isFinite(Number(f.source_time_s))?Number(f.source_time_s):null);done++;}
    for(const ev of (data.evidence||[])){const newShotId=newShotByOldId.get(Number(ev.old_shot_id));if(!newShotId||!CAMERA_ROLES.includes(ev.camera_role))continue;const frames=[];for(const f of (ev.frames||[])){archiveStatus(`Restoring Shot #${ev.shot_no||'?'} · ${roleTitle(ev.camera_role)} replay frame…`,done,total);const blob=await readArchiveFile(dir,f.path);frames.push({epochMs:Number(f.epoch_ms),offsetMs:Number(f.offset_ms),blob});done++;}if(frames.length)await evidenceDbPut({key:evidenceRecordKey(newSession.id,newShotId,ev.camera_role),shotId:newShotId,sessionId:newSession.id,role:ev.camera_role,releaseEpochMs:Number(ev.release_epoch_ms)||Date.now(),anchorEpochMs:Number(ev.anchor_epoch_ms)||null,anchorSettledEpochMs:Number(ev.anchor_settled_epoch_ms)||null,anchorFocusEpochMs:Number(ev.anchor_focus_epoch_ms)||null,startEpochMs:frames[0].epochMs,endEpochMs:frames.at(-1).epochMs,createdAt:new Date().toISOString(),captureKind:ev.capture_kind||"real-rolling-camera-frames",frames});}
    activeAthleteId=athlete.id;localStorage.setItem("3pm-active-athlete",String(athlete.id));currentSessionId=newSession.id;selectedShotId=null;await reload();renderSessionArchiveSummary();archiveStatus(`Session restored · ${data.shots?.length||0} shots`,total,total,"good");toast(`Archived session restored for ${athlete.name}.`,`good`,4600);setTimeout(closeArchiveStatus,1200);
  }catch(err){if(err?.name==="AbortError"){closeArchiveStatus();toast("Import cancelled.","warn");}else{console.error(err);archiveStatus(`Import stopped: ${err.message||err}`,null,null,"bad");toast(`Import failed: ${String(err?.message||err).slice(0,180)}`,"bad",6500);}}
  finally{archiveBusy=false;}
}
async function deleteSessionPermanently(session=currentSession(),{skipConfirm=false,sourceShotIds=null}={}){
  if(!session)return false;const shotIds=sourceShotIds||sessionShots(session.id).map(x=>x.id);if(!skipConfirm&&!confirm(`Permanently delete session “${session.title}”?\n\nAll locally stored shot data, Full Shot Evidence, videos, key frames and analysis for this session will be permanently deleted.\n\nThis cannot be undone.`))return false;
  await api(`/api/sessions/${session.id}`,{method:"DELETE"});try{await evidenceDbDeleteSession(session.id,shotIds);}catch(err){console.warn('Could not clear full shot evidence for session',err);}for(const id of shotIds)deleteAdvancedShotMetrics(id);deleteSessionContext(session.id);localStorage.removeItem(`3pm-impact-${IMPACT_STORAGE_VERSION}-session-${session.id}`);if(Number(currentSessionId)===Number(session.id)){currentSessionId=null;selectedShotId=null;}await reload();renderSessionArchiveSummary();return true;
}

// -----------------------------
// Camera detection / live video
// -----------------------------
async function ensureCameraPermission(){
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not expose camera access. Use a current Chrome, Edge or Safari browser.");
  // Keep the permission stream alive until enumeration has completed. Some macOS
  // browsers expose zero/anonymous cameras before permission is granted.
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
  cameraPermissionGranted=true;cameraPermissionState="granted";
  return stream;
}

async function queryCameraPermission(){
  try{
    if(!navigator.permissions?.query)return cameraPermissionState;
    const status=await navigator.permissions.query({name:"camera"});
    if(status?.state){cameraPermissionState=status.state;cameraPermissionGranted=status.state==="granted";}
  }catch{} // Safari may not expose the camera permission through Permissions API.
  return cameraPermissionState;
}

function streamDeviceInfo(stream){
  const track=stream?.getVideoTracks?.()[0]||null;
  const settings=track?.getSettings?.()||{};
  return {track,deviceId:settings.deviceId||"",label:track?.label||"",settings};
}

function rememberRoleFromStream(role,stream){
  const info=streamDeviceInfo(stream);
  if(info.deviceId||info.label)setAssignment(role,info.deviceId||getAssignment(role),info.label);
}

function normalizeDetectedCameras(devices=[]){
  const seen=new Set();
  return devices.filter(d=>d?.kind==="videoinput").filter(d=>{
    const key=d.deviceId||`label:${d.label||""}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}

function populateCameraSelectors(){
  $$("#workspaceMode .mode-btn").forEach(b=>b.onclick=()=>applyWorkspaceMode(b.dataset.mode));
  applyWorkspaceMode(workspaceMode);

  CAMERA_ROLES.forEach(role=>{
    const sel=$(`#${role}CameraSelect`); if(!sel)return;
    let list=[...detectedCameras];
    const live=liveStreams[role],liveInfo=streamDeviceInfo(live);
    if(liveInfo.track && !list.some(d=>(liveInfo.deviceId&&d.deviceId===liveInfo.deviceId)||(!liveInfo.deviceId&&liveInfo.label&&d.label===liveInfo.label))){
      list.unshift({kind:"videoinput",deviceId:liveInfo.deviceId||getAssignment(role),label:liveInfo.label||`${roleTitle(role)} Camera`});
    }
    let current=getAssignment(role),savedLabel=getAssignmentLabel(role);
    if(current && !list.some(d=>d.deviceId===current))current="";
    if(!current && savedLabel){
      const byLabel=list.find(d=>d.label===savedLabel);
      if(byLabel){current=byLabel.deviceId;setAssignment(role,current,byLabel.label);}
    }
    if(!current && liveInfo.track){
      current=liveInfo.deviceId || list.find(d=>d.label===liveInfo.label)?.deviceId || "";
      if(current)setAssignment(role,current,liveInfo.label);
    }
    sel.innerHTML=`<option value="">No camera</option>`+list.map((d,i)=>{
      const label=d.label||`Camera ${i+1}`;
      return `<option value="${escapeHtml(d.deviceId||"")}" ${d.deviceId===current?"selected":""}>${escapeHtml(label)}</option>`;
    }).join("");
    if(current)sel.value=current;
  });
}

async function enumerateCamerasAfterPermission(){
  const devices=await navigator.mediaDevices.enumerateDevices();
  detectedCameras=normalizeDetectedCameras(devices);
  // First successful discovery of multiple physical inputs should reveal the
  // auxiliary-role controls automatically. If the coach later hides them,
  // preserve that explicit preference.
  if(detectedCameras.length>1 && localStorage.getItem("3pm-aux-views")===null){
    auxViewsExpanded=true;localStorage.setItem("3pm-aux-views","true");
  }
  populateCameraSelectors();
  updateCameraWorkspace();
  return detectedCameras;
}

async function detectCameras({autoStart=false,requestPermission=false}={}){
  if(cameraScanBusy)return;
  cameraScanBusy=true;
  setCameraStatus("checking","Camera: checking…");
  if($("#cameraSummary"))$("#cameraSummary").textContent=requestPermission?"Requesting camera access and scanning inputs…":"Scanning camera inputs…";
  let permissionStream=null;
  try{
    if(!navigator.mediaDevices?.enumerateDevices)throw new Error("Camera enumeration is not available in this browser.");
    await queryCameraPermission();
    if(requestPermission)permissionStream=await ensureCameraPermission();
    const devices=await navigator.mediaDevices.enumerateDevices();
    detectedCameras=normalizeDetectedCameras(devices);
    populateCameraSelectors();
    if(detectedCameras.length>1 && localStorage.getItem("3pm-aux-views")===null){auxViewsExpanded=true;localStorage.setItem("3pm-aux-views","true");}

    // Restore Side by exact id, then saved label. Only auto-pick a first device when
    // permission has been granted; before permission a browser may expose a fake/default entry.
    const side=$("#sideCameraSelect"),saved=getAssignment("side"),savedLabel=getAssignmentLabel("side");
    let chosen=detectedCameras.find(d=>d.deviceId===saved) || (savedLabel?detectedCameras.find(d=>d.label===savedLabel):null);
    if(!chosen && permissionStream){
      const info=streamDeviceInfo(permissionStream);
      chosen=detectedCameras.find(d=>(info.deviceId&&d.deviceId===info.deviceId)||(info.label&&d.label===info.label)) || detectedCameras[0];
    }
    if(!chosen && cameraPermissionGranted)chosen=detectedCameras[0];
    if(side&&chosen){side.value=chosen.deviceId;setAssignment("side",chosen.deviceId,chosen.label||"");}

    updateCameraWorkspace();
    const liveCount=CAMERA_ROLES.filter(r=>!!liveStreams[r]).length;
    if(detectedCameras.length){
      $("#permissionBanner")?.classList.add("hidden");
      setCameraStatus(liveCount?"good":"good",liveCount?`LIVE: ${liveCount}`:`Cameras: ${detectedCameras.length}`);
      if($("#cameraSummary"))$("#cameraSummary").textContent=`${detectedCameras.length} camera${detectedCameras.length===1?"":"s"} detected${cameraPermissionGranted?"":" · press Start Live to enable labels/access"}.`;
    }else{
      setCameraStatus("warn","Camera: access needed");
      $("#permissionBanner")?.classList.remove("hidden");
      if($("#cameraSummary"))$("#cameraSummary").textContent="No camera list is visible yet. Press Start Live or Enable Cameras once so macOS/browser can expose the built-in and USB cameras.";
    }
    if(autoStart){
      // Do not close/reopen the same camera on macOS. If this permission stream is
      // the desired Side device, hand it directly to Side and keep it alive.
      if(permissionStream){
        const info=streamDeviceInfo(permissionStream),sideId=$("#sideCameraSelect")?.value;
        const same=!sideId || (info.deviceId&&sideId===info.deviceId) || (info.label&&detectedCameras.find(d=>d.deviceId===sideId)?.label===info.label);
        if(same){await configureInitialCameraStream(permissionStream,"side");await attachLiveStream("side",permissionStream);permissionStream=null;}
      }
      await startAllLive({silent:true,skipBootstrap:true});
    }
  }catch(err){
    console.error(err);
    if(requestPermission){cameraPermissionGranted=false;cameraPermissionState="denied";setCameraStatus("bad","Camera: permission blocked");$("#permissionBanner")?.classList.remove("hidden");if($("#cameraSummary"))$("#cameraSummary").textContent="Camera access was denied or unavailable. Check browser and macOS Camera privacy settings.";}
    else{setCameraStatus("warn","Camera: access needed");$("#permissionBanner")?.classList.remove("hidden");if($("#cameraSummary"))$("#cameraSummary").textContent="Passive camera scan could not expose the devices. Press Start Live or Enable Cameras.";}
  }finally{
    if(permissionStream)permissionStream.getTracks().forEach(t=>t.stop());
    cameraScanBusy=false;
  }
}

function setCameraStatus(kind,text){
  const el=$("#cameraStatus");if(el){el.textContent=text;el.className=`status-pill ${kind}`;}
  if($("#homeCameraReady"))$("#homeCameraReady").textContent=text;
}

function autoAssignCameras(){
  const used=new Set();
  CAMERA_ROLES.forEach(role=>{
    const saved=getAssignment(role),savedLabel=getAssignmentLabel(role);
    const valid=detectedCameras.find(d=>d.deviceId===saved&&!used.has(d.deviceId));
    const byLabel=!valid&&savedLabel?detectedCameras.find(d=>d.label===savedLabel&&!used.has(d.deviceId)):null;
    const fallback=detectedCameras.find(d=>!used.has(d.deviceId));
    const chosen=valid||byLabel||fallback||null,sel=$(`#${role}CameraSelect`);
    if(chosen){sel.value=chosen.deviceId;setAssignment(role,chosen.deviceId,chosen.label||"");used.add(chosen.deviceId);}else{sel.value="";setAssignment(role,"");}
  });
  updateCameraWorkspace();
}

function validateUniqueAssignments(){
  const ids=CAMERA_ROLES.map(r=>$(`#${r}CameraSelect`)?.value).filter(Boolean);
  return new Set(ids).size===ids.length;
}

async function attachLiveStream(role,stream){
  if(!stream)return false;
  const wasAnyLive=CAMERA_ROLES.some(r=>!!liveStreams[r]);
  const old=liveStreams[role];
  if(old&&old!==stream)old.getTracks().forEach(t=>t.stop());
  liveStreams[role]=stream;
  updateLiveButtons();
  liveFrameBuffers[role].length=0;clearDenseFrameBuffer(role);
  if(!wasAnyLive){liveSessionStartedAt=Date.now();liveMetricHistory.length=0;setTimelineMode("live");}
  const v=$(`#${role}Video`);
  v.pause();v.removeAttribute("src");v.dataset.src="";v.srcObject=stream;v.controls=false;v.muted=true;setRoleMediaVisible(role,true);
  await v.play().catch(()=>{});
  startNativeEvidencePump(role);
  await sampleLiveFrameBuffer(role);
  startLiveFrameBuffer();updateLiveBufferStatus();
  const info=streamDeviceInfo(stream),track=info.track;
  rememberRoleFromStream(role,stream);
  if(track){track.addEventListener("ended",()=>{
    if(liveStreams[role]===stream){stopNativeEvidencePump(role);clearDenseFrameBuffer(role);liveStreams[role]=null;const vv=$(`#${role}Video`);if(vv?.srcObject===stream)vv.srcObject=null;$(`#${role}LiveBadge`)?.classList.add("hidden");$(`#${role}Mode`).textContent="STOPPED";$(`#${role}Info`).textContent="Camera stream ended · Start Live to reconnect";updateLiveButtons();stopCameraAutoTuneIfIdle();updateCameraTuneSummary();setCameraStatus("warn","Camera: stream ended");}
  },{once:true});}
  $(`#${role}Empty`).style.display="none";$(`#${role}LiveBadge`).classList.remove("hidden");$(`#${role}Mode`).textContent="LIVE";
  refreshRoleCameraInfo(role);startCameraAutoTune();setTimeout(()=>{tuneCameras({force:true}).catch(()=>{});},260);updateCameraWorkspace();updateCameraTuneSummary();
  return true;
}

function cameraMode(){return ["auto","detail","performance"].includes(cameraQualityMode)?cameraQualityMode:"auto";}
function activeCameraCountIncluding(role){return Math.max(1,CAMERA_ROLES.filter(r=>!!liveStreams[r]&&r!==role).length+1);}
function cameraCapabilitiesText(track){
  try{const c=track?.getCapabilities?.()||{},w=Number(c.width?.max),h=Number(c.height?.max),f=Number(c.frameRate?.max);return Number.isFinite(w)&&Number.isFinite(h)?`max ${w}×${h}${Number.isFinite(f)?` @ ${Math.round(f)} fps`:""}`:"capability range unavailable";}catch{return "capability range unavailable";}
}
function refreshRoleCameraInfo(role){
  const stream=liveStreams[role];if(!stream)return;const info=streamDeviceInfo(stream),s=info.settings||{},m=window.PoseEngine?.getLatestMetrics?.(role);
  const health=window.PoseEngine?.getRoleHealth?.(role),inf=health?.inferenceSize;
  const perf=Number.isFinite(Number(m?.effectiveInferenceHz))?` · Pose ${Number(m.effectiveInferenceHz).toFixed(0)} Hz${inf?.width?` @ ${inf.width}×${inf.height}`:""}`:"";
  const capability=stream._3pmCapabilityText?` · ${stream._3pmCapabilityText}`:"";
  const label=info.label||roleTitle(role)+" Camera";
  const el=$(`#${role}Info`);if(el)el.textContent=`${label}${s.width?` · ${s.width}×${s.height}`:""}${s.frameRate?` · ${Math.round(s.frameRate)} fps`:""}${stream._3pmProfile?` · ${stream._3pmProfile}`:""}${perf}${capability}`;
}
function updateCameraTuneSummary(extra=""){
  const el=$("#cameraTuneSummary");if(!el)return;const active=CAMERA_ROLES.filter(r=>!!liveStreams[r]);
  if(!active.length){el.textContent="Auto Tune: waiting for live camera…";return;}
  const parts=active.map(role=>{const track=liveStreams[role]?.getVideoTracks?.()[0],s=track?.getSettings?.()||{},m=window.PoseEngine?.getLatestMetrics?.(role),inf=window.PoseEngine?.getRoleHealth?.(role)?.inferenceSize;return `${roleTitle(role)} ${s.width||"?"}×${s.height||"?"}@${Math.round(Number(s.frameRate)||0)}${Number.isFinite(Number(m?.effectiveInferenceHz))?` · pose ${Number(m.effectiveInferenceHz).toFixed(0)}Hz${inf?.width?` ${inf.width}×${inf.height}`:""}`:""}`;});
  el.textContent=`Camera ${cameraMode()==="auto"?"Auto Tune":cameraMode()==="detail"?"High Detail":"Performance"} · ${parts.join(" · ")}${extra?` · ${extra}`:""}`;
}
async function applyCameraModeProfiles(){
  if(isRecording){updateCameraTuneSummary("mode change waits until recording stops");return false;}
  const active=CAMERA_ROLES.filter(r=>!!liveStreams[r]);if(!active.length)return false;
  const unsafe=active.some(role=>{const m=window.PoseEngine?.getLatestMetrics?.(role)||{};return m.armed||m.releaseCandidate||["Draw","Anchor","Aim / Hold","Expansion","Release","Follow Through"].includes(m.phase);});
  if(unsafe){updateCameraTuneSummary("mode change waits until shot is complete");return false;}
  let changed=false;
  for(const role of active){const stream=liveStreams[role],track=stream?.getVideoTracks?.()[0];if(!track)continue;let caps=stream._3pmCapabilities||{};if(!Object.keys(caps).length){try{caps=track.getCapabilities?.()||{};}catch{}}
    const profiles=window.CameraPolicy?.candidates?.(role,active.length,cameraMode(),caps)||[],target=profiles[0];if(!target)continue;
    const s=track.getSettings?.()||{};if(Math.abs((Number(s.width)||0)-target.width)<8&&Math.abs((Number(s.height)||0)-target.height)<8)continue;
    if(await tryApplyCameraProfile(track,target)){stream._3pmProfile=target.id;refreshRoleCameraInfo(role);changed=true;}
  }
  cameraTuneLastActionAt=Date.now();updateCameraTuneSummary(changed?"mode profile applied":"mode profile already active");return changed;
}
async function tuneCameras({force=false}={}){
  // A5 field-stability rule: once a live stream is attached, never change the
  // physical capture resolution automatically. A4 could step 16:9 -> 4:3 -> 16:9
  // while the athlete was moving, which looked like zoom/pan and invalidated the
  // on-screen framing guide. Realtime load adaptation now happens only inside the
  // hidden Pose inference surface/cadence; evidence video stays geometrically stable.
  const active=CAMERA_ROLES.filter(r=>!!liveStreams[r]);if(!active.length){updateCameraTuneSummary();return false;}
  active.forEach(refreshRoleCameraInfo);
  updateCameraTuneSummary(isRecording?"capture locked while recording":"capture locked · pose analysis adapts without resizing video");
  return false;
}
function startCameraAutoTune(){
  if(cameraAutoTuneTimer)return;cameraAutoTuneTimer=setInterval(()=>{tuneCameras().catch(err=>console.warn("Camera Auto Tune",err));},3200);setTimeout(()=>{tuneCameras({force:true}).catch(()=>{});},900);
}
function stopCameraAutoTuneIfIdle(){if(!CAMERA_ROLES.some(r=>!!liveStreams[r])&&cameraAutoTuneTimer){clearInterval(cameraAutoTuneTimer);cameraAutoTuneTimer=null;updateCameraTuneSummary();}}
async function tryApplyCameraProfile(track,p){
  if(!track||!p)return false;const acceptable=()=>{const s=track.getSettings?.()||{},fps=Number(s.frameRate)||0,minFps=p.fps>=30?24:Math.max(18,p.fps*.75);return Number(s.width)>=p.width*.88&&Number(s.height)>=p.height*.88&&(!fps||fps>=minFps);};
  const exact={width:{exact:p.width},height:{exact:p.height},frameRate:{ideal:p.fps,max:p.fps}};
  try{await track.applyConstraints(exact);if(acceptable())return true;}catch{}
  try{await track.applyConstraints({width:{ideal:p.width},height:{ideal:p.height},frameRate:{ideal:p.fps,max:p.fps}});return acceptable();}catch{return false;}
}
async function configureInitialCameraStream(stream,role="side"){
  const track=stream?.getVideoTracks?.()[0];if(!track)return stream;
  let caps={};try{caps=track.getCapabilities?.()||{};}catch{}
  const profiles=window.CameraPolicy?.candidates?.(role,activeCameraCountIncluding(role),cameraMode(),caps)||[];
  let chosen=null;
  for(const p of profiles){if(await tryApplyCameraProfile(track,p)){chosen=p;break;}}
  const s=track.getSettings?.()||{};
  stream._3pmCapabilities=caps;stream._3pmProfiles=profiles;stream._3pmProfile=chosen?.id||`${s.width||"?"}×${s.height||"?"}`;stream._3pmCapabilityText=cameraCapabilitiesText(track);
  return stream;
}
async function openCameraAdaptive(deviceId,role="side"){
  let stream=null,lastErr=null;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{deviceId:{exact:deviceId}}});}
  catch(err){lastErr=err;}
  if(!stream)throw lastErr||new Error("Camera could not be opened.");
  try{return await configureInitialCameraStream(stream,role);}catch(err){console.warn("Camera capability tuning failed; using camera default",err);stream._3pmProfile="camera default";return stream;}
}
async function stepCameraProfile(role,direction="down",authority=null){
  const stream=liveStreams[role],track=stream?.getVideoTracks?.()[0];if(!track)return false;
  let caps=stream._3pmCapabilities||{};if(!Object.keys(caps).length){try{caps=track.getCapabilities?.()||{};}catch{}}
  const profiles=window.CameraPolicy?.candidates?.(role,Math.max(1,CAMERA_ROLES.filter(r=>!!liveStreams[r]).length),cameraMode(),caps,authority)||[];if(!profiles.length)return false;
  const settings=track.getSettings?.()||{},current=window.CameraPolicy?.nearestIndex?.(settings,profiles)??0;
  const overCeiling=((Number(settings.width)||0)*(Number(settings.height)||0))>((profiles[0].width*profiles[0].height)*1.08);
  let target=direction==="up"?Math.max(0,current-1):Math.min(profiles.length-1,current+1);
  if(direction==="down"&&overCeiling)target=0;
  if(target===current&&!overCeiling)return false;
  const p=profiles[target];if(!p)return false;
  if(await tryApplyCameraProfile(track,p)){stream._3pmProfile=p.id;await new Promise(r=>setTimeout(r,80));refreshRoleCameraInfo(role);return true;}return false;
}
async function relieveCameraBandwidth(){
  let changed=false;for(const r of CAMERA_ROLES){if(liveStreams[r]&&await stepCameraProfile(r,"down"))changed=true;}return changed;
}
async function startRoleLive(role){
  const deviceId=$(`#${role}CameraSelect`)?.value;
  if(!deviceId){stopRoleLive(role);return false;}
  stopRoleLive(role);
  let stream;
  try{stream=await openCameraAdaptive(deviceId,role);}
  catch(err){
    if(CAMERA_ROLES.some(r=>!!liveStreams[r])){const relieved=await relieveCameraBandwidth();if(relieved){await new Promise(r=>setTimeout(r,120));stream=await openCameraAdaptive(deviceId,role);}else throw err;}else throw err;
  }
  cameraPermissionGranted=true;cameraPermissionState="granted";
  const ok=await attachLiveStream(role,stream);
  try{await enumerateCamerasAfterPermission();}catch(err){console.warn("Post-permission camera refresh failed",err);}
  return ok;
}

function stopRoleLive(role){
  stopNativeEvidencePump(role);clearDenseFrameBuffer(role);
  const stream=liveStreams[role];if(stream)stream.getTracks().forEach(t=>t.stop());
  liveStreams[role]=null;liveFrameBuffers[role].length=0;
  if(!CAMERA_ROLES.some(r=>!!liveStreams[r])&&typeof liveFrameTimer!=="undefined"&&liveFrameTimer){clearInterval(liveFrameTimer);liveFrameTimer=null;}
  const v=$(`#${role}Video`);if(v?.srcObject)v.srcObject=null;if(!v?.getAttribute("src"))setRoleMediaVisible(role,false);
  $(`#${role}LiveBadge`)?.classList.add("hidden");if($(`#${role}Mode`))$(`#${role}Mode`).textContent="SAVED";if($(`#${role}Info`))$(`#${role}Info`).textContent="No live camera";
  updateCameraWorkspace();stopCameraAutoTuneIfIdle();updateCameraTuneSummary();liveRoleMetrics[role]=null;updateShotReadiness(bestLiveShotRole()?.m||null);
}

async function bootstrapDefaultCamera(role="side"){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable in this browser.");
  if(!CAMERA_ROLES.includes(role))role="side";
  let stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
  await configureInitialCameraStream(stream,role);
  cameraPermissionGranted=true;cameraPermissionState="granted";
  let devices=[];try{devices=await navigator.mediaDevices.enumerateDevices();}catch{}
  detectedCameras=normalizeDetectedCameras(devices);
  const info=streamDeviceInfo(stream);
  if(!detectedCameras.length && (info.deviceId||info.label))detectedCameras=[{kind:"videoinput",deviceId:info.deviceId,label:info.label||"Active Camera"}];
  populateCameraSelectors();
  let chosen=detectedCameras.find(d=>(info.deviceId&&d.deviceId===info.deviceId)||(info.label&&d.label===info.label))||detectedCameras[0];
  const select=$(`#${role}CameraSelect`);
  if(chosen&&select){select.value=chosen.deviceId;setAssignment(role,chosen.deviceId,chosen.label||info.label);}
  await attachLiveStream(role,stream);
  try{await enumerateCamerasAfterPermission();}catch(err){console.warn("Camera list refresh failed",err);}
  $("#permissionBanner")?.classList.add("hidden");
  return true;
}

async function startAllLive({silent=false,skipBootstrap=false}={}){
  if(!navigator.mediaDevices?.getUserMedia){if(!silent)alert("Camera access is not available in this browser.");return;}
  await queryCameraPermission();
  try{if(!detectedCameras.length)await detectCameras({autoStart:false,requestPermission:false});}catch{}

  const assignedBefore=CAMERA_ROLES.filter(role=>$(`#${role}CameraSelect`)?.value);
  const hasValidAssignment=assignedBefore.some(role=>{const id=$(`#${role}CameraSelect`)?.value;return id&&detectedCameras.some(d=>d.deviceId===id);});
  // Critical recovery path: pre-permission enumerateDevices may return zero cameras.
  // Bootstrap whichever UI role the user already chose; fall back to Side only when
  // there is no role assignment yet. This keeps camera roles organizational rather
  // than making Side a mandatory detector source.
  if(!skipBootstrap && !CAMERA_ROLES.some(r=>!!liveStreams[r]) && (!detectedCameras.length || !hasValidAssignment)){
    const bootstrapRole=assignedBefore[0]||"side";
    try{await bootstrapDefaultCamera(bootstrapRole);}catch(err){
      console.error(`Default ${roleTitle(bootstrapRole)} camera bootstrap failed`,err);
      if(err?.name==="NotAllowedError"||/permission|denied/i.test(String(err?.message||""))){cameraPermissionState="denied";$("#permissionBanner")?.classList.remove("hidden");}
      setCameraStatus("bad","Camera: start failed");if($("#cameraSummary"))$("#cameraSummary").textContent=`Camera could not start: ${err?.message||err}`;
      if(!silent)alert(`Camera could not start: ${err?.message||err}`);return;
    }
  }

  // Restore label-based assignments after permission/device IDs changed.
  populateCameraSelectors();
  const anyAssigned=CAMERA_ROLES.some(role=>$(`#${role}CameraSelect`)?.value);
  if(!anyAssigned&&detectedCameras.length){const sideSel=$("#sideCameraSelect");if(sideSel){sideSel.value=detectedCameras[0].deviceId;setAssignment("side",sideSel.value,detectedCameras[0].label||"");}}
  if(!validateUniqueAssignments()){if(!silent)alert("The same camera is assigned to more than one active view. Choose a different device for each active role.");return;}

  const assigned=CAMERA_ROLES.filter(role=>$(`#${role}CameraSelect`)?.value);
  if(!assigned.length&&!liveStreams.side){setCameraStatus("warn","Camera: no assignment");$("#permissionBanner")?.classList.remove("hidden");if(!silent)alert("No camera is assigned. Press Start Live again to enable camera access.");return;}
  let started=CAMERA_ROLES.filter(r=>!!liveStreams[r]).length,failures=[];
  for(const role of assigned){
    try{if(liveStreams[role])continue;if(await startRoleLive(role))started++;}
    catch(err){console.error(role,err);failures.push(`${roleTitle(role)}: ${err.message}`);}
  }
  updateLiveButtons();
  if(started){$("#permissionBanner")?.classList.add("hidden");$("#cameraSummary").textContent=`${started} live camera${started===1?"":"s"} active · ${detectedCameras.length} input${detectedCameras.length===1?"":"s"} available.`;setCameraStatus("good",`LIVE: ${started}`);}
  else{setCameraStatus("bad",cameraPermissionState==="denied"?"Camera: permission blocked":"Camera: start failed");$("#permissionBanner")?.classList.remove("hidden");}
  if(failures.length&&!silent)alert(`Some cameras could not start:\n${failures.join("\n")}`);
}
function stopAllLive({restoreSaved=true}={}){
  if(isRecording)return;CAMERA_ROLES.forEach(stopRoleLive);clearLiveAnalysisUI();updateShotReadiness(null);updateLiveButtons();if(restoreSaved)renderSession();
  CAMERA_ROLES.forEach(role=>{const g=$(`#${role}PositionGuide`);if(g){g.textContent="Position: waiting for live camera";g.className="position-guide waiting";}});
  setCameraStatus(detectedCameras.length?"good":"warn",`Cameras: ${detectedCameras.length}`);
  $("#cameraSummary").textContent=detectedCameras.length?"Live preview stopped. Camera assignments remain saved.":"Camera access is not initialized. Press Start Live to discover cameras.";
}

function updateLiveButtons(){
  const liveCount=CAMERA_ROLES.filter(r=>!!liveStreams[r]).length;
  $("#startLiveBtn").disabled=isRecording;$("#stopLiveBtn").disabled=!liveCount||isRecording;$("#recordAllBtn").disabled=!liveCount||isRecording||!currentSessionId;$("#stopRecordBtn").disabled=!isRecording;
  CAMERA_ROLES.forEach(role=>{$(`#${role}CameraSelect`).disabled=isRecording;});updateShotSaveStatus();
}

function chooseMimeType(){
  const candidates=[
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  return candidates.find(t=>window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

function extensionForMime(mime){ return mime.includes("mp4") ? "mp4" : "webm"; }

async function startRecording(){
  if(isRecording) return;
  if(!currentSessionId){ alert("Create or select a session before recording."); return; }
  const active=CAMERA_ROLES.filter(r=>liveStreams[r]);
  if(!active.length){ alert("Start a live camera first."); return; }
  if(!window.MediaRecorder){ alert("This browser does not support MediaRecorder. Try current Chrome or Safari."); return; }

  await tuneCameras({force:true});
  const mime=chooseMimeType();
  try{
    active.forEach(role=>{
      recordingChunks[role]=[];
      const opts=mime?{mimeType:mime}:undefined;
      const rec=new MediaRecorder(liveStreams[role],opts);
      rec.ondataavailable=e=>{if(e.data && e.data.size) recordingChunks[role].push(e.data);};
      recorders[role]=rec;
      rec.start(1000);
    });
  }catch(err){
    console.error(err);
    alert("Recording could not start: "+err.message);
    return;
  }
  isRecording=true;
  recordStartedAt=Date.now();
  try{ window.PoseEngine?.beginRecording?.(currentSessionId); }catch(err){ console.warn("Pose log start failed",err); }
  recordTimerHandle=setInterval(updateRecordTimer,250);
  updateRecordTimer();
  updateLiveButtons();
  setCameraStatus("recording","● RECORDING");
  $("#cameraSummary").textContent=`Recording ${active.length} camera${active.length===1?"":"s"} to the selected session.`;
  document.body.classList.add("recording");
}

function updateRecordTimer(){
  if(!recordStartedAt){$("#recordTimer").textContent="00:00";return;}
  const s=Math.floor((Date.now()-recordStartedAt)/1000);
  const m=Math.floor(s/60).toString().padStart(2,"0"), sec=(s%60).toString().padStart(2,"0");
  $("#recordTimer").textContent=`${m}:${sec}`;
}

function stopRecorderPromise(role){
  const rec=recorders[role];
  if(!rec || rec.state==="inactive") return Promise.resolve(null);
  return new Promise(resolve=>{
    rec.onstop=()=>{
      const mime=rec.mimeType || chooseMimeType() || "video/webm";
      const blob=new Blob(recordingChunks[role],{type:mime});
      resolve({role,blob,mime});
    };
    rec.stop();
  });
}

async function stopRecordingAndSave(){
  if(!isRecording) return;
  $("#stopRecordBtn").disabled=true;
  $("#cameraSummary").textContent="Stopping recorders and saving video files…";
  const active=CAMERA_ROLES.filter(r=>recorders[r]);
  const results=(await Promise.all(active.map(stopRecorderPromise))).filter(Boolean);
  isRecording=false;
  clearInterval(recordTimerHandle); recordTimerHandle=null;
  recordStartedAt=null;
  document.body.classList.remove("recording");

  let saved=0;
  for(const item of results){
    if(!item.blob.size) continue;
    const ext=extensionForMime(item.mime);
    const file=new File([item.blob],`${item.role}_live_${Date.now()}.${ext}`,{type:item.mime});
    const fd=new FormData();fd.append("file",file);
    try{
      await api(`/api/upload/${currentSessionId}/${item.role}`,{method:"POST",body:fd});
      saved++;
    }catch(err){console.error(err);alert(`${roleTitle(item.role)} recording could not be saved: ${err.message}`);}
  }
  CAMERA_ROLES.forEach(r=>{recorders[r]=null;recordingChunks[r]=[];});
  try{ await window.PoseEngine?.endRecording?.(); }catch(err){ console.warn("Pose log save failed",err); }
  loadAnalysisSettings();
  await reload();
  await refreshStorageStatus();
  updateLiveButtons();
  setCameraStatus("good",`LIVE: ${CAMERA_ROLES.filter(r=>liveStreams[r]).length}`);
  $("#cameraSummary").textContent=`Saved ${saved} recording${saved===1?"":"s"} to this session. Live preview is still active.`;
}

CAMERA_ROLES.forEach(role=>{
  const sel=$(`#${role}CameraSelect`);
  sel?.addEventListener("focus",e=>{e.currentTarget.dataset.previousValue=e.currentTarget.value||"";});
  sel?.addEventListener("change",async e=>{
    const next=e.target.value||"",previous=e.target.dataset.previousValue||getAssignment(role)||"";
    if(next&&CAMERA_ROLES.some(r=>r!==role&&$(`#${r}CameraSelect`)?.value===next)){
      e.target.value=previous&&detectedCameras.some(d=>d.deviceId===previous)?previous:"";
      toast("That camera is already assigned to another view. Each live role needs its own device.","warn",4200);return;
    }
    setAssignment(role,next,detectedCameras.find(d=>d.deviceId===next)?.label||"");
    e.target.dataset.previousValue=next;
    if((role==="rear"||role==="overhead") && next){auxViewsExpanded=true;localStorage.setItem("3pm-aux-views","true");}
    updateCameraWorkspace();
    if(isRecording)return;
    try{
      if(!next){if(liveStreams[role])stopRoleLive(role);}
      else if(liveStreams[role]||CAMERA_ROLES.some(r=>!!liveStreams[r]))await startRoleLive(role);
    }catch(err){toast(`${roleTitle(role)} camera could not start: ${err.message}`,"bad",5200);}
    updateLiveButtons();
  });
});

$("#rescanCamerasBtn").onclick=async()=>{await queryCameraPermission();return detectCameras({autoStart:false,requestPermission:cameraPermissionState!=="granted"});};
$("#grantCameraBtn").onclick=()=>startAllLive();
$("#startLiveBtn").onclick=()=>startAllLive();
$("#stopLiveBtn").onclick=()=>stopAllLive();
$("#recordAllBtn").onclick=startRecording;
$("#stopRecordBtn").onclick=stopRecordingAndSave;

if(navigator.mediaDevices?.addEventListener){
  navigator.mediaDevices.addEventListener("devicechange",()=>detectCameras({autoStart:false,requestPermission:false}));
}

// -----------------------------
// V2.2 adaptive display / one-camera focus
// -----------------------------
if($("#auxViewsToggle"))$("#auxViewsToggle").onclick=toggleAuxViews;
$$('[data-focus-role]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setFocusCameraRole(btn.dataset.focusRole);}));
$$('[data-camera-card]').forEach(card=>card.addEventListener('dblclick',e=>{if(e.target.closest('button,select,label,input'))return;setFocusCameraRole(card.dataset.cameraCard);}));
if($("#layoutModeSelect")){
  $("#layoutModeSelect").value=layoutPreference;
  $("#layoutModeSelect").onchange=e=>{layoutPreference=e.target.value;localStorage.setItem("3pm-layout-mode",layoutPreference);resolveAdaptiveLayout();};
}
if($("#cameraQualityMode")){
  $("#cameraQualityMode").value=cameraMode();
  $("#cameraQualityMode").onchange=async e=>{cameraQualityMode=e.target.value;localStorage.setItem("3pm-camera-quality-mode",cameraQualityMode);cameraTuneStableGood.side=cameraTuneStableGood.rear=cameraTuneStableGood.overhead=0;await applyCameraModeProfiles();if(cameraMode()==="auto")await tuneCameras({force:true});updateCameraTuneSummary("mode updated");};
}
$("#exportLocalDataBtn")?.addEventListener("click",exportPortableLocalBackup);
$("#importLocalDataInput")?.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const count=await importPortableLocalBackup(file);toast(`Imported ${count} local analysis records. Reloading…`,"good",2200);setTimeout(()=>location.reload(),650);}catch(err){toast(`Import failed: ${err.message}`,"bad",4800);}finally{e.target.value="";}});
window.addEventListener("resize",scheduleAdaptiveLayout);
window.addEventListener("orientationchange",scheduleAdaptiveLayout);


// -----------------------------
// V3.3 Stable Shot Intelligence · precision target / scoring / round logic
// World Archery geometry is represented in real centimetres; display scale is independent.
// -----------------------------
const IMPACT_STORAGE_VERSION="v33";
function impactStorageKey(sessionId=currentSessionId){return sessionId?`3pm-impact-${IMPACT_STORAGE_VERSION}-session-${sessionId}`:`3pm-impact-${IMPACT_STORAGE_VERSION}-preview`;}
function faceTypeFromSessionTarget(target=''){
  const t=String(target).toLowerCase();
  if(t.includes('3pm')&&t.includes('compound'))return '3pm-single-c';
  if(t.includes('3pm')&&t.includes('single'))return '3pm-single-r';
  if(t.includes('compound')&&t.includes('triangle'))return '40-c-triangle';
  if(t.includes('compound')&&t.includes('triple'))return '40-c-vertical';
  if(t.includes('recurve')&&t.includes('triangle'))return '40-r-triangle';
  if(t.includes('recurve')&&t.includes('triple'))return '40-r-vertical';
  if(t.includes('80')&&t.includes('5-ring'))return '80-5ring';
  if(t.includes('80')&&t.includes('6'))return '80-6ring';
  if(t.includes('40')&&t.includes('6-ring'))return '40-6ring';
  if(t.includes('40')&&t.includes('5-ring'))return '40-5ring';
  if(t.includes('122'))return '122-full';if(t.includes('80'))return '80-full';if(t.includes('60'))return '60-full';if(t.includes('40'))return '40-full';return '80-full';
}
function sessionImpactDefaults(){
  const s=currentSession(),modeText=(s?.mode||'').toLowerCase(),comp=modeText.includes('competition')||modeText.includes('scoring')||modeText.includes('simulation');
  let faceType=faceTypeFromSessionTarget(s?.target_face),discipline=String(athleteFor(s)?.discipline||'').toLowerCase();
  if(discipline.includes('compound')){if(faceType==='40-full')faceType='40-full-c';if(faceType==='60-full')faceType='60-full-c';}
  const target=String(s?.target_face||'').toLowerCase(),defaultArrows=(target.includes('triple')||target.includes('3-spot')||target.includes('single spot'))?3:6;
  return {mode:comp?'competition':'free',faceType,distanceM:Number(s?.distance_m)||18,arrowDiameterMm:5.2,arrowsPerEnd:defaultArrows,endsPerScore:Math.max(1,36/defaultArrows),scoreCount:2};
}
function loadImpactData(sessionId=currentSessionId){try{const raw=localStorage.getItem(impactStorageKey(sessionId)),parsed=raw?JSON.parse(raw):null,base={config:sessionImpactDefaults(),ends:{}};if(!parsed)return base;return {config:{...base.config,...(parsed.config||{})},ends:parsed.ends||{}};}catch(err){console.warn('Impact storage load failed',err);return {config:sessionImpactDefaults(),ends:{}};}}
function saveImpactData(data,sessionId=currentSessionId){localStorage.setItem(impactStorageKey(sessionId),JSON.stringify(data));}
function getImpactConfig(){return loadImpactData().config;}
function setImpactConfig(cfg){const data=loadImpactData();data.config={...data.config,...cfg};saveImpactData(data);}
function targetCanvas(){return $('#impactCanvas');}
function targetFaceSpec(type){
  const full=(diameter,label,xDiameter)=>({type,kind:'full',label,standard:true,physicalFaceDiameterCm:diameter,outerRadiusCm:diameter/2,minScore:1,ringWidthCm:diameter/20,xRadiusCm:(xDiameter??diameter/20)/2,compound:false});
  const trunc=(diameter,minScore,label,standard=false)=>({type,kind:'truncated',label,standard,physicalFaceDiameterCm:diameter,outerRadiusCm:(11-minScore)*(diameter/20),minScore,ringWidthCm:diameter/20,xRadiusCm:diameter/40,compound:false});
  if(type==='122-full')return full(122,'122 cm Full Face',6.1);
  if(type==='80-full')return full(80,'80 cm Full Face',4);
  if(type==='60-full')return full(60,'60 cm Full Face · Recurve/Barebow',3);
  if(type==='60-full-c')return {...full(60,'60 cm Full Face · Compound',3),compoundFull:true,tenRadiusCm:1.5};
  if(type==='40-full')return full(40,'40 cm Full Face · Recurve/Barebow',2);
  if(type==='40-full-c')return {...full(40,'40 cm Full Face · Compound',2),compoundFull:true,tenRadiusCm:1};
  if(type==='80-6ring')return trunc(80,5,'80 cm 6-Ring · 5–10',true);
  if(type==='80-5ring')return trunc(80,6,'80 cm 5-Ring · 6–10 · Club Custom',false);
  if(type==='40-6ring')return trunc(40,5,'40 cm 6-Ring · 5–10 · Club Custom',false);
  if(type==='40-5ring')return trunc(40,6,'40 cm 5-Ring · 6–10 · Club Custom',false);
  if(type==='3pm-single-r')return {type,kind:'single',label:'3PM Single Spot · 20 cm · Recurve 6–10',standard:false,physicalFaceDiameterCm:40,outerRadiusCm:10,minScore:6,ringWidthCm:2,tenRadiusCm:2,compound:false};
  if(type==='3pm-single-c')return {type,kind:'single',label:'3PM Single Spot · 20 cm · Compound 6–10',standard:false,physicalFaceDiameterCm:40,outerRadiusCm:10,minScore:6,ringWidthCm:2,tenRadiusCm:1,compound:true};
  const compound=type.startsWith('40-c-'),triangle=type.endsWith('triangle');
  return {type,kind:'triple',label:`40 cm ${compound?'Compound':'Recurve'} Triple · ${triangle?'Triangle':'Vertical'}`,standard:true,physicalFaceDiameterCm:40,spotOuterRadiusCm:10,minScore:6,ringWidthCm:2,tenRadiusCm:compound?1:2,compound,triangle,centerDistanceCm:22};
}
function targetSpots(spec){if(spec.kind!=='triple')return[{x:0,y:0}];if(!spec.triangle)return[{x:0,y:-22},{x:0,y:0},{x:0,y:22}];const side=22,h=side*Math.sqrt(3)/2;return[{x:0,y:-2*h/3},{x:-side/2,y:h/3},{x:side/2,y:h/3}];}
function targetOuterRadius(spec){return spec.kind==='triple'?spec.spotOuterRadiusCm:spec.outerRadiusCm;}
function faceBounds(spec){
  const spots=targetSpots(spec),r=targetOuterRadius(spec);let maxAbs=0;
  for(const s of spots)maxAbs=Math.max(maxAbs,Math.abs(s.x)+r,Math.abs(s.y)+r);
  return {half:Math.max(r*1.10,maxAbs*1.10)};
}
function ensureImpactEnd(endNo){const data=loadImpactData(),key=String(endNo);if(!data.ends[key])data.ends[key]={arrows:[],conditions:{}};if(!Array.isArray(data.ends[key].arrows))data.ends[key].arrows=[];if(!data.ends[key].conditions)data.ends[key].conditions={};return{data,key,end:data.ends[key]};}
function impactEndConditions(endNo=impactCurrentEnd){return ensureImpactEnd(endNo).end.conditions||{};}
function saveImpactEndConditions(endNo,conditions){const {data,key,end}=ensureImpactEnd(endNo);end.conditions={...(end.conditions||{}),...(conditions||{})};data.ends[key]=end;saveImpactData(data);}
function roundStructure(cfg=getImpactConfig()){
  const arrowsPerEnd=Math.max(1,Math.trunc(Number(cfg.arrowsPerEnd)||6)),endsPerScore=Math.max(1,Math.trunc(Number(cfg.endsPerScore)||6)),scoreCount=Math.max(1,Math.trunc(Number(cfg.scoreCount)||2));
  const ends=endsPerScore*scoreCount,totalArrows=arrowsPerEnd*ends,maxScore=totalArrows*10;
  return{arrowsPerEnd,endsPerScore,scoreCount,ends,totalArrows,maxScore};
}
function totalConfiguredEnds(cfg=getImpactConfig()){const existing=Object.keys(loadImpactData().ends||{}).map(Number).reduce((a,b)=>Math.max(a,b),0);return cfg.mode==='competition'?roundStructure(cfg).ends:Math.max(1,existing,impactCurrentEnd||1);}
function getScoreForEnd(endNo,cfg=getImpactConfig()){const r=roundStructure(cfg);return{scoreIdx:Math.floor((endNo-1)/r.endsPerScore)+1,start:(endNo-1)*r.arrowsPerEnd+1,end:endNo*r.arrowsPerEnd};}
function linkedShotForArrow(endNo,arrowIdx,cfg=getImpactConfig()){return sessionShots()[(endNo-1)*roundStructure(cfg).arrowsPerEnd+arrowIdx]||null;}
function impactArrowsForEnd(endNo){const {data,end}=ensureImpactEnd(endNo),aps=roundStructure(data.config).arrowsPerEnd;return Array.from({length:aps},(_,i)=>end.arrows?.[i]||null);}
function saveImpactArrow(endNo,idx,arrow){const {data,key,end}=ensureImpactEnd(endNo);end.arrows[idx]=arrow;data.ends[key]=end;saveImpactData(data);}
function deleteImpactArrow(endNo,idx){const {data,key,end}=ensureImpactEnd(endNo);if(end.arrows?.[idx])impactUndoStack.push({endNo,arrowIdx:idx,arrow:end.arrows[idx]});end.arrows[idx]=null;data.ends[key]=end;saveImpactData(data);}
function clearImpactEnd(endNo){const {data,key,end}=ensureImpactEnd(endNo);(end.arrows||[]).forEach((a,i)=>{if(a)impactUndoStack.push({endNo,arrowIdx:i,arrow:a});});end.arrows=[];data.ends[key]=end;saveImpactData(data);}
function undoImpactLast(){const item=impactUndoStack.pop();if(!item)return false;saveImpactArrow(item.endNo,item.arrowIdx,item.arrow);impactCurrentEnd=item.endNo;impactSelectedArrow=item.arrowIdx;return true;}
function nearestTargetSpot(spec,x,y){let nearest=null;for(const [i,s] of targetSpots(spec).entries()){const d=Math.hypot(x-s.x,y-s.y);if(!nearest||d<nearest.d)nearest={d,spot:i,center:s};}return nearest;}
function impactRingScore(type,x,y,arrowDiameterMm=Number(getImpactConfig().arrowDiameterMm)||5.2){
  const spec=targetFaceSpec(type),nearest=nearestTargetSpot(spec,x,y),shaftR=Math.max(0,Number(arrowDiameterMm)||0)/20; // mm diameter -> cm radius
  const effective=Math.max(0,nearest.d-shaftR),eps=1e-7; // line-cutter: shaft touching the line scores the higher zone
  const maxR=targetOuterRadius(spec);
  if(effective>maxR+eps)return{score:0,isX:false,spot:nearest.spot,lineCutter:false};
  let score=0;
  if(spec.compoundFull){
    const rw=spec.ringWidthCm;score=effective<=spec.tenRadiusCm+eps?10:effective<=rw*2+eps?9:Math.max(1,8-Math.floor((effective-rw*2-eps)/rw));
  }else if(spec.kind==='triple'||spec.kind==='single'){
    if(spec.compound){score=effective<=1+eps?10:effective<=4+eps?9:effective<=6+eps?8:effective<=8+eps?7:6;}
    else{score=effective<=2+eps?10:effective<=4+eps?9:effective<=6+eps?8:effective<=8+eps?7:6;}
  }else{
    const zone=Math.max(1,Math.ceil(Math.max(0,effective-eps)/spec.ringWidthCm));score=Math.min(10,Math.max(spec.minScore,11-zone));
  }
  const centreScore=impactRingScorePointOnly(spec,nearest.d);
  const lineCutter=score>centreScore;
  const isX=(type==='122-full'||type==='80-full')&&effective<=spec.xRadiusCm+eps;
  return{score,isX,spot:nearest.spot,lineCutter};
}
function impactRingScorePointOnly(spec,d){
  if(d>targetOuterRadius(spec))return 0;
  if(spec.compoundFull){const rw=spec.ringWidthCm;return d<=spec.tenRadiusCm?10:d<=rw*2?9:Math.max(1,8-Math.floor((d-rw*2-1e-7)/rw));}
  if(spec.kind==='triple'||spec.kind==='single'){
    if(spec.compound)return d<=1?10:d<=4?9:d<=6?8:d<=8?7:6;
    return d<=2?10:d<=4?9:d<=6?8:d<=8?7:6;
  }
  const zone=Math.max(1,Math.ceil(Math.max(0,d-1e-7)/spec.ringWidthCm));return Math.min(10,Math.max(spec.minScore,11-zone));
}
function impactBiasLabel(cx,cy){const d=Math.hypot(cx,cy);if(!Number.isFinite(d)||d<1)return'Centered';const a=Math.atan2(cy,cx)*180/Math.PI;if(a>=-22.5&&a<22.5)return'Right';if(a>=22.5&&a<67.5)return'Low-right';if(a>=67.5&&a<112.5)return'Low';if(a>=112.5&&a<157.5)return'Low-left';if(a>=157.5||a<-157.5)return'Left';if(a>=-157.5&&a<-112.5)return'High-left';if(a>=-112.5&&a<-67.5)return'High';return'High-right';}
function normalizedImpactPoint(arrow,spec){if(!arrow)return null;if(spec.kind!=='triple')return{x:arrow.x,y:arrow.y};const spots=targetSpots(spec),spot=spots[Number.isInteger(arrow.spot)?arrow.spot:0]||spots[0];return{x:arrow.x-spot.x,y:arrow.y-spot.y};}
function endGroupStats(endNo){const raw=impactArrowsForEnd(endNo).filter(Boolean);if(!raw.length)return null;const spec=targetFaceSpec(getImpactConfig().faceType),arrows=raw.map(a=>({...a,...normalizedImpactPoint(a,spec)})),xs=arrows.map(a=>a.x),ys=arrows.map(a=>a.y),cx=xs.reduce((s,a)=>s+a,0)/arrows.length,cy=ys.reduce((s,a)=>s+a,0)/arrows.length,score=raw.reduce((s,a)=>s+(Number(a.score)||0),0);
  let sxx=0,syy=0,sxy=0;arrows.forEach(a=>{const dx=a.x-cx,dy=a.y-cy;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;});sxx/=arrows.length;syy/=arrows.length;sxy/=arrows.length;
  const tr=sxx+syy,disc=Math.sqrt(Math.max(0,tr*tr/4-(sxx*syy-sxy*sxy))),l1=tr/2+disc,l2=tr/2-disc,angle=.5*Math.atan2(2*sxy,sxx-syy);
  const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys),distanceM=Math.max(.1,Number(getImpactConfig().distanceM)||18);
  return{count:raw.length,cx,cy,score,avg:score/raw.length,spread:Math.sqrt(tr),major:Math.sqrt(Math.max(l1,0))*2.6,minor:Math.sqrt(Math.max(l2,0))*2.6,angle,bias:impactBiasLabel(cx,cy),width,height,widthMrad:width*10/distanceM,heightMrad:height*10/distanceM,distanceM,normalizedAcrossSpots:spec.kind==='triple'};
}


function impactRunningTotals(){const data=loadImpactData(),cfg=data.config,max=Math.max(totalConfiguredEnds(cfg),Object.keys(data.ends||{}).map(Number).reduce((a,b)=>Math.max(a,b),0));let running=0;return Array.from({length:max},(_,i)=>{const end=i+1,stats=endGroupStats(end),score=stats?.score||0;running+=score;return{end,scoreIdx:getScoreForEnd(end,cfg).scoreIdx,score,stats,running};});}
function scoreColor(score){if(score>=9)return'#f8e71c';if(score>=7)return'#ef3340';if(score>=5)return'#42a5d5';if(score>=3)return'#1a1a1a';return'#f5f5f2';}
function canvasTransform(spec,size){const {half}=faceBounds(spec),margin=size*.055,scale=(size/2-margin)/half;return{cx:size/2,cy:size/2,scale,half};}
function worldToCanvas(spec,size,x,y){const t=canvasTransform(spec,size);return{x:t.cx+x*t.scale,y:t.cy+y*t.scale,scale:t.scale};}
function canvasPointToTarget(ev,type){const c=targetCanvas(),r=c.getBoundingClientRect(),px=(ev.clientX-r.left)*(820/r.width),py=(ev.clientY-r.top)*(820/r.height),spec=targetFaceSpec(type),t=canvasTransform(spec,820);return{x:(px-t.cx)/t.scale,y:(py-t.cy)/t.scale};}
function targetLineWidthPx(scale){return Math.max(.65,Math.min(1.15,.2*scale));}
function drawTargetCircle(ctx,cx,cy,r,fill){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function drawOfficialRingLines(ctx,cx,cy,spec,scale){
  const rw=spec.ringWidthCm,lw=targetLineWidthPx(scale),min=spec.minScore||1;
  ctx.save();ctx.lineWidth=lw;ctx.strokeStyle='#242424';
  for(let boundaryScore=10;boundaryScore>min;boundaryScore--){
    const lower=boundaryScore-1;
    if(spec.compoundFull&&boundaryScore===10)continue;
    if(lower===2||lower===4)continue; // no thin dividing lines between white/black or black/blue
    const radius=(11-boundaryScore)*rw*scale;
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
  }
  ctx.beginPath();ctx.arc(cx,cy,targetOuterRadius(spec)*scale,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawScoreNumbers(ctx,cx,cy,spec,scale){
  if(!(spec.kind==='truncated'||spec.kind==='single'))return;
  ctx.save();ctx.font='600 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let score=10;score>=spec.minScore;score--){const rin=(10-score)*spec.ringWidthCm,rout=(11-score)*spec.ringWidthCm,r=(rin+rout)/2,x=cx+r*scale;ctx.fillStyle=score<=6?'#4b5661':'#252525';ctx.fillText(String(score),x,cy);}
  ctx.restore();
}
function drawCentreCross(ctx,cx,cy,scale){const half=Math.max(1.2,.2*scale),lw=Math.max(.55,Math.min(.9,.1*scale));ctx.save();ctx.strokeStyle='#313131';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(cx-half,cy);ctx.lineTo(cx+half,cy);ctx.moveTo(cx,cy-half);ctx.lineTo(cx,cy+half);ctx.stroke();ctx.restore();}
function drawOneSpot(ctx,spec,cx,cy,scale){
  const min=spec.minScore||1;
  for(let score=min;score<=10;score++){const radius=(11-score)*spec.ringWidthCm*scale;drawTargetCircle(ctx,cx,cy,radius,scoreColor(score));}
  drawOfficialRingLines(ctx,cx,cy,spec,scale);
  if(spec.compoundFull&&spec.tenRadiusCm){ctx.save();ctx.strokeStyle='#343434';ctx.lineWidth=targetLineWidthPx(scale);ctx.beginPath();ctx.arc(cx,cy,spec.tenRadiusCm*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
  // 122/80 inner 10 (X) tie-break ring. For 40/60 the smaller compound 10 is not labelled X here.
  if((spec.type==='122-full'||spec.type==='80-full')&&spec.xRadiusCm){ctx.save();ctx.strokeStyle='#343434';ctx.lineWidth=targetLineWidthPx(scale);ctx.beginPath();ctx.arc(cx,cy,spec.xRadiusCm*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
  drawCentreCross(ctx,cx,cy,scale);drawScoreNumbers(ctx,cx,cy,spec,scale);
}
function drawTargetFace(ctx,spec,size){
  const spots=targetSpots(spec),t=canvasTransform(spec,size);ctx.fillStyle='#f7f7f4';ctx.fillRect(0,0,size,size);
  ctx.save();ctx.fillStyle='#263746';ctx.font='600 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(spec.label,18,16);ctx.fillStyle='#647482';ctx.font='12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';ctx.fillText('Display normalized · geometry in real cm',18,39);ctx.restore();
  for(const spot of spots){const c=worldToCanvas(spec,size,spot.x,spot.y);drawOneSpot(ctx,spec,c.x,c.y,c.scale);}
}
function drawImpactMarker(ctx,spec,size,a,i,selected,shaftDiameterMm){
  const p=worldToCanvas(spec,size,a.x,a.y),scale=p.scale,shaftRadiusPx=Math.max(2.2,(Math.max(1,shaftDiameterMm)/20)*scale);
  ctx.save();ctx.strokeStyle=selected?'#08a657':'rgba(20,28,34,.88)';ctx.lineWidth=selected?1.5:1;ctx.fillStyle=selected?'rgba(8,166,87,.18)':'rgba(255,255,255,.16)';ctx.beginPath();ctx.arc(p.x,p.y,shaftRadiusPx,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=selected?'#087a42':'#141c22';ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill();ctx.font='600 10px sans-serif';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText(String(i+1),p.x+shaftRadiusPx+2,p.y-2);ctx.restore();
}
function drawImpactCanvas(){
  const c=targetCanvas();if(!c)return;const ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,size=820;c.width=Math.round(size*dpr);c.height=Math.round(size*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const cfg=getImpactConfig(),spec=targetFaceSpec(cfg.faceType);drawTargetFace(ctx,spec,size);const t=canvasTransform(spec,size),stats=endGroupStats(impactCurrentEnd);
  if(stats){let base={x:0,y:0};if(spec.kind==='triple'){const selected=impactArrowsForEnd(impactCurrentEnd)[impactSelectedArrow],spots=targetSpots(spec);base=spots[selected&&Number.isInteger(selected.spot)?selected.spot:1]||spots[0];}const p=worldToCanvas(spec,size,base.x+stats.cx,base.y+stats.cy);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(stats.angle);ctx.fillStyle='rgba(75,177,105,.16)';ctx.strokeStyle='rgba(25,145,77,.82)';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,0,Math.max(9,stats.major*t.scale/2),Math.max(6,stats.minor*t.scale/2),0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(18,0);ctx.moveTo(0,-18);ctx.lineTo(0,18);ctx.stroke();ctx.restore();}
  impactArrowsForEnd(impactCurrentEnd).forEach((a,i)=>{if(a)drawImpactMarker(ctx,spec,size,a,i,i===impactSelectedArrow,Number(cfg.arrowDiameterMm)||5.2);});
  if($('#impactFaceSpec')){$('#impactFaceSpec').textContent=`${spec.label} · ${spec.standard?'World Archery geometry':'Club / training custom'} · ${Number(cfg.distanceM||18).toFixed(1)} m · Arrow Ø ${Number(cfg.arrowDiameterMm||5.2).toFixed(1)} mm`;}
}
function renderImpactArrowStrip(){const cfg=getImpactConfig(),arrows=impactArrowsForEnd(impactCurrentEnd),h=$('#impactArrowStrip');if(!h)return;h.innerHTML=arrows.map((a,i)=>{const shot=linkedShotForArrow(impactCurrentEnd,i,cfg),score=a?`${a.score}${a.isX?'X':''}`:'—';return `<button type="button" class="impact-arrow-chip ${i===impactSelectedArrow?'active':''} ${a?'filled':''}" data-arrow-idx="${i}"><span class="score">${score}</span><span>${shot?`Shot #${shot.shot_no}`:`Arrow ${i+1}`}</span><span class="meta">${a?(a.lineCutter?'Line-cutter · ':'')+impactBiasLabel(normalizedImpactPoint(a,targetFaceSpec(cfg.faceType)).x,normalizedImpactPoint(a,targetFaceSpec(cfg.faceType)).y):'Tap target to plot'}</span></button>`;}).join('');$$('#impactArrowStrip .impact-arrow-chip').forEach(b=>b.onclick=()=>{impactSelectedArrow=Number(b.dataset.arrowIdx);renderImpact();});}
function renderImpactAnalysis(){const s=endGroupStats(impactCurrentEnd),h=$('#impactEndAnalysis');if(!h)return;if(!s){h.innerHTML='<div><span>Status</span><b>Waiting</b></div><div><span>Hint</span><b>Plot arrows on the target</b></div>';return;}h.innerHTML=`<div><span>Group Bias</span><b>${s.bias}</b></div><div><span>Group W × H</span><b>${s.width.toFixed(1)} × ${s.height.toFixed(1)} cm</b></div><div><span>Angular W × H</span><b>${s.widthMrad.toFixed(2)} × ${s.heightMrad.toFixed(2)} mrad</b></div><div><span>Center Offset</span><b>${s.cx.toFixed(1)} / ${s.cy.toFixed(1)} cm</b></div><div><span>RMS Spread</span><b>${s.spread.toFixed(1)} cm</b></div><div><span>Ellipse Tilt</span><b>${(s.angle*180/Math.PI).toFixed(0)}°</b></div>${s.normalizedAcrossSpots?'<div class="span2"><span>Triple-face analysis</span><b>Normalized to each spot centre</b></div>':''}`;}
function correlation(xs,ys){if(xs.length<4||ys.length!==xs.length)return null;const ax=xs.reduce((a,b)=>a+b,0)/xs.length,ay=ys.reduce((a,b)=>a+b,0)/ys.length;let n=0,dx=0,dy=0;for(let i=0;i<xs.length;i++){const a=xs[i]-ax,b=ys[i]-ay;n+=a*b;dx+=a*a;dy+=b*b;}return dx>0&&dy>0?n/Math.sqrt(dx*dy):null;}
function impactFormCorrelations(){const cfg=getImpactConfig(),data=loadImpactData(),spec=targetFaceSpec(cfg.faceType),rows=[];for(const [k,e] of Object.entries(data.ends||{})){const endNo=Number(k);(e.arrows||[]).forEach((a,i)=>{if(!a)return;const shot=linkedShotForArrow(endNo,i,cfg),pt=normalizedImpactPoint(a,spec);if(shot)rows.push({a:{...a,...pt},shot});});}if(rows.length<5)return[];const metrics=[['hold_time_s','Hold time'],['draw_elbow_deg','Draw elbow'],['head_movement_mm','Head movement'],['shoulder_line_deg','Shoulder line']];const out=[];for(const [key,label] of metrics){const valid=rows.filter(r=>Number.isFinite(Number(r.shot[key])));if(valid.length<5)continue;const vals=valid.map(r=>Number(r.shot[key])),x=valid.map(r=>r.a.x),y=valid.map(r=>r.a.y),rx=correlation(vals,x),ry=correlation(vals,y),best=Math.abs(rx||0)>=Math.abs(ry||0)?{r:rx,axis:'horizontal'}:{r:ry,axis:'vertical'};if(Number.isFinite(best.r)&&Math.abs(best.r)>=.45)out.push({label,axis:best.axis,r:best.r,n:valid.length});}return out.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));}
function renderImpactScoreSummary(){const host=$('#impactScoreSummary');if(!host)return;const totals=impactRunningTotals(),groups={};totals.forEach(r=>(groups[r.scoreIdx]||(groups[r.scoreIdx]=[])).push(r));host.innerHTML=Object.entries(groups).map(([idx,rows])=>{const total=rows.reduce((a,b)=>a+b.score,0),count=rows.reduce((a,b)=>a+(b.stats?.count||0),0),avg=count?total/count:0,centers=rows.filter(r=>r.stats).map(r=>r.stats);let trend='Need more mapped ends';if(centers.length>=2){const a=centers[0],b=centers.at(-1);trend=`Center drift ${(b.cx-a.cx).toFixed(1)} cm horizontal / ${(b.cy-a.cy).toFixed(1)} cm vertical.`;}return `<div class="score-summary-item"><span>Score ${idx}</span><b>${total}</b><small>${count} mapped arrows · Avg ${count?avg.toFixed(2):'—'}<br>${trend}</small></div>`;}).join('')||'<div class="score-summary-item"><span>No target data</span><b>Start plotting</b></div>';const all=totals.filter(r=>r.stats).map(r=>r.stats),ins=$('#impactCoachInsights');if(!ins)return;if(!all.length){ins.textContent='Map a few ends to see session trend, group drift and form-impact relationships.';return;}let text=`${all.length} mapped end${all.length===1?'':'s'}. Latest group: ${all.at(-1).bias}. `;const corr=impactFormCorrelations();if(corr.length){text+=corr.slice(0,2).map(c=>`${c.label} shows a ${Math.abs(c.r).toFixed(2)} correlation with ${c.axis} impact position across ${c.n} mapped shots`).join('. ')+'. Correlation is evidence to review, not proof of cause.';}else text+='More linked shots are needed before the app reports form-to-impact correlations.';const cond=impactEndConditions(impactCurrentEnd);if(cond.note)text+=` End note: ${cond.note}`;ins.textContent=text;}
function renderImpactHeader(){const s=currentSession();$('#impactSessionPill').textContent=s?`Session: ${s.title}`:'Preview mode · no session';$('#impactModePill').textContent=`Mode: ${getImpactConfig().mode==='competition'?'Competition':'Free Training'}`;const c=$('#impactConditionSummary');if(c)c.textContent=`Session conditions: ${sessionConditionSummary(s)}`;}
function renderImpactRoundSummary(){const cfg=getImpactConfig(),r=roundStructure(cfg),el=$('#impactRoundSummary');if(!el)return;if(cfg.mode==='competition')el.textContent=`Competition round: ${r.totalArrows} arrows · ${r.maxScore} max · ${r.ends} ends (${r.scoreCount} × ${r.endsPerScore})`;else el.textContent=`Free Training · ${r.arrowsPerEnd} arrows/end · no fixed total`;}
function renderImpactSummaryMeta(){const cfg=getImpactConfig(),m=getScoreForEnd(impactCurrentEnd,cfg);$('#impactEndLabel').textContent=`End ${impactCurrentEnd}`;if($('#impactEndJump'))$('#impactEndJump').value=impactCurrentEnd;$('#impactBlockLabel').textContent=`Score ${m.scoreIdx} · Arrows ${m.start}–${m.end}`;const row=impactRunningTotals().find(r=>r.end===impactCurrentEnd);$('#impactEndScore').textContent=row?.stats?String(row.score):'—';$('#impactRunningTotal').textContent=row?String(row.running):'—';$('#impactEndAverage').textContent=row?.stats?row.stats.avg.toFixed(2):'—';const a=impactArrowsForEnd(impactCurrentEnd)[impactSelectedArrow],shot=linkedShotForArrow(impactCurrentEnd,impactSelectedArrow,cfg),linked=$('#impactLinkedShot');if(linked)linked.innerHTML=shot||a?`<b>${shot?`Shot #${shot.shot_no}`:`Arrow ${impactSelectedArrow+1}`}</b><br>${a?`Mapped score ${a.score}${a.isX?'X':''}${a.lineCutter?' · line-cutter':''} · ${impactBiasLabel(normalizedImpactPoint(a,targetFaceSpec(cfg.faceType)).x,normalizedImpactPoint(a,targetFaceSpec(cfg.faceType)).y)}`:'Tap the target to place this arrow.'}${shot?`<br>Hold ${fmtNum(shot.hold_time_s,2)} s · Elbow ${fmtNum(shot.draw_elbow_deg,1)}° · Head ${fmtNum(shot.head_movement_mm,1)} mm`:''}`:'Select an arrow chip to place or review it.';renderImpactEndConditions();}
function syncImpactConfigInputs(){const c=getImpactConfig();$('#impactTrainingMode').value=c.mode||'free';$('#impactFaceType').value=c.faceType||'80-full';$('#impactDistanceM').value=Number(c.distanceM)||18;$('#impactArrowDiameterMm').value=Number(c.arrowDiameterMm)||5.2;$('#impactArrowsPerEnd').value=roundStructure(c).arrowsPerEnd;$('#impactEndsPerScore').value=roundStructure(c).endsPerScore;$('#impactScoreCount').value=roundStructure(c).scoreCount;$('#impactZoomBadge').textContent=`${Math.round(impactZoom*100)}%`;targetCanvas().style.transform=`scale(${impactZoom})`;}
function applyImpactConfigFromInputs(){
  const cfg={
    mode:$('#impactTrainingMode').value,
    faceType:$('#impactFaceType').value,
    distanceM:Math.max(.1,Number($('#impactDistanceM').value)||18),
    arrowDiameterMm:Math.min(12.2,Math.max(1,Number($('#impactArrowDiameterMm').value)||5.2)),
    arrowsPerEnd:Math.min(12,Math.max(1,Math.trunc(Number($('#impactArrowsPerEnd').value)||6))),
    endsPerScore:Math.min(20,Math.max(1,Math.trunc(Number($('#impactEndsPerScore').value)||6))),
    scoreCount:Math.min(12,Math.max(1,Math.trunc(Number($('#impactScoreCount').value)||2)))
  };
  setImpactConfig(cfg);
  impactSelectedArrow=Math.min(impactSelectedArrow,roundStructure(cfg).arrowsPerEnd-1);
  if(cfg.mode==='competition')impactCurrentEnd=Math.min(Math.max(1,impactCurrentEnd),roundStructure(cfg).ends);
}
function renderImpactEndConditions(){const cond=impactEndConditions(impactCurrentEnd);if($('#impactEndWindSpeed'))$('#impactEndWindSpeed').value=cond.wind_speed??'';if($('#impactEndWindRelative'))$('#impactEndWindRelative').value=cond.wind_relative??'';if($('#impactEndSightAdjustment'))$('#impactEndSightAdjustment').value=cond.sight_adjustment??'';if($('#impactEndNote'))$('#impactEndNote').value=cond.note??'';}
function collectImpactEndConditions(){return{wind_speed:$('#impactEndWindSpeed')?.value||'',wind_relative:$('#impactEndWindRelative')?.value||'',sight_adjustment:$('#impactEndSightAdjustment')?.value||'',note:$('#impactEndNote')?.value||''};}
function renderImpact(){if(!$('#view-impact'))return;syncImpactConfigInputs();renderImpactHeader();renderImpactRoundSummary();renderImpactArrowStrip();renderImpactSummaryMeta();renderImpactAnalysis();renderImpactScoreSummary();drawImpactCanvas();}
function impactUseSessionDefaults(){setImpactConfig(sessionImpactDefaults());impactCurrentEnd=1;impactSelectedArrow=0;impactZoom=1;renderImpact();}
function formDataForExistingShot(shot,score,isX){const fd=new FormData(),keys=['status','phase','note','hold_time_s','draw_elbow_deg','bow_arm_deg','shoulder_line_deg','torso_lean_deg','head_movement_mm'];keys.forEach(k=>{if(shot[k]!=null&&shot[k]!=='')fd.set(k,String(shot[k]));});fd.set('score',String(score));fd.set('is_x',isX?'true':'false');fd.set('is_reference',shot.is_reference?'true':'false');fd.set('auto_detected',shot.auto_detected?'true':'false');['release_confidence','pose_confidence','head_offset_pct','execution_label'].forEach(k=>{if(shot[k]!=null&&shot[k]!=='')fd.set(k,String(shot[k]));});return fd;}
async function syncImpactScoreToShot(shot,score,isX){if(!shot)return;try{await api(`/api/shots/${shot.id}`,{method:'PUT',body:formDataForExistingShot(shot,score,isX)});await reload();selectedShotId=shot.id;}catch(err){console.warn('Could not sync target score to Shot List',err);toast('Impact saved, but Shot List score could not be updated.','warn',3200);}}
function impactPointerScore(ev){const cfg=getImpactConfig(),pt=canvasPointToTarget(ev,cfg.faceType),r=impactRingScore(cfg.faceType,pt.x,pt.y,cfg.arrowDiameterMm),el=$('#impactScorePreview');if(el)el.textContent=`Score preview: ${r.score?`${r.score}${r.isX?'X':''}${r.lineCutter?' · line':''}`:'M'}`;}
function recommendedRoundForFace(type){
  const triple=String(type).includes('triple')||String(type).includes('vertical')||String(type).includes('triangle')||String(type).includes('single');
  const arrowsPerEnd=triple?3:6;return{arrowsPerEnd,endsPerScore:36/arrowsPerEnd,scoreCount:2};
}

function initImpactControls(){
  const c=targetCanvas();if(c&&!c.dataset.bound){c.dataset.bound='1';c.addEventListener('pointermove',impactPointerScore);c.addEventListener('pointerleave',()=>{if($('#impactScorePreview'))$('#impactScorePreview').textContent='Score preview: —';});c.addEventListener('click',async ev=>{const cfg=getImpactConfig(),pt=canvasPointToTarget(ev,cfg.faceType),result=impactRingScore(cfg.faceType,pt.x,pt.y,cfg.arrowDiameterMm),shot=linkedShotForArrow(impactCurrentEnd,impactSelectedArrow,cfg),prev=impactArrowsForEnd(impactCurrentEnd)[impactSelectedArrow];if(prev)impactUndoStack.push({endNo:impactCurrentEnd,arrowIdx:impactSelectedArrow,arrow:prev});saveImpactArrow(impactCurrentEnd,impactSelectedArrow,{x:pt.x,y:pt.y,score:result.score,isX:result.isX,lineCutter:result.lineCutter,spot:result.spot,shotId:shot?.id||null,ts:Date.now()});if(shot)await syncImpactScoreToShot(shot,result.score,result.isX);const max=roundStructure(cfg).arrowsPerEnd;if(impactSelectedArrow<max-1)impactSelectedArrow++;renderImpact();});}
  const liveConfig=()=>{applyImpactConfigFromInputs();renderImpact();};
  $('#impactTrainingMode').addEventListener('change',()=>{if($('#impactTrainingMode').value==='competition'){const c=getImpactConfig();if(c.mode!=='competition'){const r=recommendedRoundForFace($('#impactFaceType').value);$('#impactArrowsPerEnd').value=r.arrowsPerEnd;$('#impactEndsPerScore').value=r.endsPerScore;$('#impactScoreCount').value=r.scoreCount;}}liveConfig();});
  $('#impactFaceType').addEventListener('change',liveConfig);
  ['impactDistanceM','impactArrowDiameterMm','impactArrowsPerEnd','impactEndsPerScore','impactScoreCount'].forEach(id=>{
    const el=$('#'+id);
    el.addEventListener('change',liveConfig);
    el.addEventListener('blur',()=>{ if(el.value!=='' && el.validity.valid) liveConfig(); });
    el.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();el.blur();} });
  });
  $('#impactEndJump').addEventListener('change',()=>{const cfg=getImpactConfig(),requested=Math.max(1,Math.trunc(Number($('#impactEndJump').value)||1)),max=cfg.mode==='competition'?roundStructure(cfg).ends:requested;impactCurrentEnd=Math.min(requested,max);impactSelectedArrow=0;renderImpact();});
  $('#impactEndJump').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}});
  $('#impactSaveConfigBtn').onclick=()=>{applyImpactConfigFromInputs();renderImpact();toast(currentSessionId?'Impact setup saved for this session.':'Preview setup saved locally. Create/select a session to link impacts to shots.','good',2600);};
  $('#impactAutoFromSessionBtn').onclick=()=>{impactUseSessionDefaults();toast(currentSessionId?'Loaded target, distance and mode from the selected session.':'Preview defaults loaded.','good',2200);};
  $('#impactPrevEndBtn').onclick=()=>{impactCurrentEnd=Math.max(1,impactCurrentEnd-1);impactSelectedArrow=0;renderImpact();};
  $('#impactNextEndBtn').onclick=()=>{const cfg=getImpactConfig();impactCurrentEnd=cfg.mode==='competition'?Math.min(roundStructure(cfg).ends,impactCurrentEnd+1):impactCurrentEnd+1;impactSelectedArrow=0;renderImpact();};
  $('#impactClearEndBtn').onclick=()=>{if(confirm(`Clear plotted arrows for End ${impactCurrentEnd}?`)){clearImpactEnd(impactCurrentEnd);renderImpact();}};
  $('#impactDeleteArrowBtn').onclick=()=>{deleteImpactArrow(impactCurrentEnd,impactSelectedArrow);renderImpact();};
  $('#impactUndoBtn').onclick=()=>{if(!undoImpactLast())toast('Nothing to undo.','warn',1800);renderImpact();};
  $('#impactZoomInBtn').onclick=()=>{impactZoom=Math.min(1.6,+(impactZoom+.1).toFixed(2));renderImpact();};
  $('#impactZoomOutBtn').onclick=()=>{impactZoom=Math.max(.8,+(impactZoom-.1).toFixed(2));renderImpact();};
  $('#impactSaveEndConditionsBtn').onclick=()=>{saveImpactEndConditions(impactCurrentEnd,collectImpactEndConditions());renderImpactScoreSummary();toast(`End ${impactCurrentEnd} conditions saved.`,'good',1800);};
}

// -----------------------------
// Existing app behavior
// -----------------------------
$$(".nav-btn").forEach(b=>b.onclick=()=>setView(b.dataset.view));
$$(`[data-go-view]`).forEach(b=>b.onclick=()=>setView(b.dataset.goView));
$("#sessionSelect").onchange=e=>{syncGlobalSession(e.target.value);updateLiveButtons();};
if($("#activeAthleteSelect"))$("#activeAthleteSelect").onchange=e=>switchActiveAthlete(e.target.value);
$("#sessionAthlete").onchange=()=>syncSessionEquipment({preferDefault:true});
$("#sessionEnvironment")?.addEventListener("change",updateSessionOutdoorFields);

$("#newAthleteBtn").onclick=resetAthleteEditor;
$("#cancelAthleteEditBtn").onclick=resetAthleteEditor;
$("#athleteForm").onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);fd.delete("athlete_id");
  if(!e.target.elements.archived.checked)fd.set("archived","false");
  try{
    let saved;
    if(editingAthleteId)saved=await api(`/api/athletes/${editingAthleteId}`,{method:"PUT",body:fd});
    else saved=await api("/api/athletes",{method:"POST",body:fd});
    const wasEditing=!!editingAthleteId,msg=wasEditing?"Athlete updated.":"Athlete added.";
    if(!wasEditing&&saved?.id){activeAthleteId=Number(saved.id);localStorage.setItem('3pm-active-athlete',String(activeAthleteId));currentSessionId=null;selectedShotId=null;clearLiveAnalysisUI();}
    resetAthleteEditor();await reload();toast(msg,"good");
  }catch(err){toast(`Athlete save failed: ${err.message}`,"bad",4800);}
};
$("#deleteAthleteBtn").onclick=async()=>{
  const a=STATE.athletes.find(x=>x.id===editingAthleteId);if(!a)return;
  const sessions=STATE.sessions.filter(s=>s.athlete_id===a.id).length;
  const equipment=STATE.equipment.filter(e=>e.athlete_id===a.id).length;
  if(!confirm(`Delete ${a.name}? This also deletes ${sessions} session(s), their shots/key frames, and ${equipment} equipment profile(s).`))return;
  try{await api(`/api/athletes/${a.id}`,{method:"DELETE"});resetAthleteEditor();currentSessionId=null;selectedShotId=null;await reload();toast("Athlete and linked local records deleted.","good");}catch(err){toast(`Delete failed: ${err.message}`,"bad",4800);}
};

$("#newEquipmentBtn").onclick=resetEquipmentEditor;
$("#cancelEquipmentEditBtn").onclick=resetEquipmentEditor;
$("#equipmentForm").onsubmit=async e=>{
  e.preventDefault();
  const form=e.target,supplement=equipmentSupplementFromForm(form),fd=new FormData(form);fd.delete("equipment_id");EQUIPMENT_SUPPLEMENT_FIELDS.forEach(k=>fd.delete(k));
  ["sight","clicker","is_default"].forEach(k=>{if(!form.elements[k].checked)fd.set(k,"false")});
  try{
    const wasEditing=editingEquipmentId;
    const saved=wasEditing?await api(`/api/equipment/${wasEditing}`,{method:"PUT",body:fd}):await api("/api/equipment",{method:"POST",body:fd});
    const savedId=Number(wasEditing||saved?.id);if(savedId)saveEquipmentSupplement(savedId,supplement);
    const msg=wasEditing?"Equipment profile updated.":"Equipment profile added.";
    resetEquipmentEditor();await reload();toast(msg,"good");
  }catch(err){toast(`Equipment save failed: ${err.message}`,"bad",5200);}
};
$("#deleteEquipmentBtn").onclick=async()=>{
  const e=STATE.equipment.find(x=>x.id===editingEquipmentId);if(!e)return;
  if(!confirm(`Delete equipment profile “${e.name}”? Sessions will remain, but this profile will be detached from them.`))return;
  try{await api(`/api/equipment/${e.id}`,{method:"DELETE"});deleteEquipmentSupplement(e.id);resetEquipmentEditor();await reload();toast("Equipment profile deleted.","good");}catch(err){toast(`Delete failed: ${err.message}`,"bad",4800);}
};
WEIGHT_FIELDS.forEach(k=>$("#equipmentForm")?.elements[k]?.addEventListener("input",updateEquipmentTotal));
$("#equipmentWeightUnit")?.addEventListener("change",e=>{const next=e.target.value||"g",prev=e.target.dataset.prevUnit||next;convertEquipmentUnitAwareValues(prev,next);e.target.dataset.prevUnit=next;updateEquipmentWeightUnitLabels();updateEquipmentTotal();});
["riser_in","limb_size"].forEach(k=>$("#equipmentForm")?.elements[k]?.addEventListener(k==="limb_size"?"change":"input",()=>updateBowLengthAuto()));
$("#autoBowLengthToggle")?.addEventListener("change",e=>{if(e.target.checked)updateBowLengthAuto(true);});
$("#equipmentForm")?.elements.bow_length_in?.addEventListener("input",()=>{const f=$("#equipmentForm"),toggle=$("#autoBowLengthToggle"),calc=nominalAmoBowLength(f?.elements.riser_in?.value,f?.elements.limb_size?.value),v=Number(f?.elements.bow_length_in?.value);if(toggle&&Number.isFinite(calc)&&Number.isFinite(v)&&Math.abs(v-calc)>.02)toggle.checked=false;});
["upper_tiller","lower_tiller"].forEach(k=>$("#equipmentForm")?.elements[k]?.addEventListener("input",updateTillerDifference));
$("#equipmentSetupDistanceUnit")?.addEventListener("change",updateTillerDifference);

$("#coachProfileForm")?.addEventListener("submit",e=>{
  e.preventDefault();const f=e.currentTarget,p=saveCoachProfile({name:f.elements.coach_name?.value,organization:f.elements.coach_organization?.value,certification:f.elements.coach_certification?.value,contact:f.elements.coach_contact?.value});renderCoachProfile();
  const status=$("#coachProfileStatus");if(status){status.textContent="Saved locally";status.className="status-pill good";}toast(`Coach profile saved · ${p.name}`,"good",2200);
});
$("#coachHeaderButton")?.addEventListener("click",()=>{setView("settings");requestAnimationFrame(()=>$("#coachProfileCard")?.scrollIntoView({behavior:"smooth",block:"start"}));});

function openSessionDialog(mode="new"){
  if(!STATE.athletes.some(a=>!a.archived)){toast("Create an active athlete first.","warn",4000);setView("athletes");return;}
  const f=$("#sessionForm");editingSessionId=mode==="edit"?Number(currentSessionId):null;f.reset();populateSelectors();
  if(editingSessionId){
    const x=currentSession();if(!x)return;
    Object.entries(x).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??"";});
    applySessionContextToForm(f,loadSessionContext(x.id));
    f.elements.session_id.value=x.id;$("#sessionAthlete").value=String(x.athlete_id);syncSessionEquipment();if(x.equipment_id)$("#sessionEquipment").value=String(x.equipment_id);
    $("#sessionDialogTitle").textContent=`Edit Session · ${x.title}`;$("#saveSessionBtn").textContent="Save Changes";$("#deleteSessionDialogBtn").classList.remove("hidden");
  }else{
    f.elements.session_id.value="";f.elements.title.value="Training Session";f.elements.session_date.value=new Date().toISOString().slice(0,10);if(f.elements.wind_unit)f.elements.wind_unit.value="m/s";
    if(activeAthleteId&&f.elements.athlete_id)f.elements.athlete_id.value=String(activeAthleteId);
    $("#sessionDialogTitle").textContent="New Session";$("#saveSessionBtn").textContent="Create Session";$("#deleteSessionDialogBtn").classList.add("hidden");syncSessionEquipment({preferDefault:true});
  }
  updateSessionOutdoorFields();
  $("#sessionDialog").showModal();
}
$("#newSessionBtn").onclick=()=>openSessionDialog("new");
$("#editSessionBtn").onclick=()=>{if(currentSession())openSessionDialog("edit");else toast("No session selected.","warn")};
$("#deleteSessionBtn").onclick=async()=>{const x=currentSession();if(!x)return;try{if(await deleteSessionPermanently(x))toast("Session permanently deleted.","good");}catch(err){toast(`Delete failed: ${err.message}`,"bad",5200);}};
$("#cancelSession").onclick=()=>$("#sessionDialog").close();
$("#deleteSessionDialogBtn").onclick=async()=>{const x=currentSession();if(!x)return;try{if(await deleteSessionPermanently(x)){$("#sessionDialog").close();toast("Session permanently deleted.","good");}}catch(err){toast(`Delete failed: ${err.message}`,"bad",5200);}};
$("#sessionForm").onsubmit=async e=>{
  e.preventDefault();const form=e.target,ctx=extractSessionContext(form),fd=new FormData(form);fd.delete("session_id");SESSION_CONTEXT_FIELDS.forEach(k=>fd.delete(k));
  const existingCoach=editingSessionId?loadSessionContext(editingSessionId):{},snap=coachSessionSnapshot();
  ["coach_name","coach_organization","coach_certification","coach_contact"].forEach(k=>{ctx[k]=(editingSessionId&&existingCoach[k]!==undefined)?existingCoach[k]:snap[k];});
  try{let r;if(editingSessionId)r=await api(`/api/sessions/${editingSessionId}`,{method:"PUT",body:fd});else r=await api("/api/sessions",{method:"POST",body:fd});saveSessionContext(r.id,ctx);activeAthleteId=Number(form.elements.athlete_id.value)||activeAthleteId;if(activeAthleteId)localStorage.setItem('3pm-active-athlete',String(activeAthleteId));currentSessionId=r.id;selectedShotId=null;clearLiveAnalysisUI();$("#sessionDialog").close();editingSessionId=null;await reload();updateLiveButtons();renderImpact();toast("Session saved.","good");}catch(err){toast(`Session save failed: ${err.message}`,"bad",5000);}
};

$$("input[type='file'][data-camera]").forEach(inp=>inp.onchange=async e=>{
  const f=e.target.files[0]; if(!f || !currentSessionId) return;
  const fd=new FormData();fd.append("file",f);
  const label=e.target.parentElement;label.childNodes[0].textContent="Uploading… ";
  try{await api(`/api/upload/${currentSessionId}/${e.target.dataset.camera}`,{method:"POST",body:fd});await reload();}
  catch(err){alert("Upload failed: "+err.message)}
  label.childNodes[0].textContent="Upload ";
});

function currentShotTimestamp(){
  const v=$("#sideVideo");
  if(v?.srcObject){
    if(isRecording && recordStartedAt)return Math.max(0,(Date.now()-recordStartedAt)/1000);
    return Math.max(0,(Date.now()-liveSessionStartedAt)/1000);
  }
  return Math.max(0,Number(v?.currentTime)||0);
}
function setScorePicker(score,isX=false){
  $$("#scorePicker button").forEach(b=>{
    const val=b.dataset.score;
    b.classList.toggle("active",isX?val==="X":String(score??"")===val);
  });
}
function fillShotFormValues(values={}){
  const f=$("#shotForm");
  ["score","status","phase","note","hold_time_s","draw_elbow_deg","bow_arm_deg","shoulder_line_deg","torso_lean_deg","head_movement_mm"].forEach(k=>{
    if(f.elements[k])f.elements[k].value=values[k]??"";
  });
  if(f.elements.status && !values.status)f.elements.status.value="ok";
  if(f.elements.phase && !values.phase)f.elements.phase.value="Release";
  $("#shotIsX").checked=!!values.is_x;
  $("#shotIsReference").checked=!!values.is_reference;
  setScorePicker(values.score,!!values.is_x);
}
function metricsToFormValues(metrics){
  return {
    hold_time_s:Number.isFinite(metrics?.holdTimeS)?metrics.holdTimeS.toFixed(2):"",
    draw_elbow_deg:Number.isFinite(metrics?.drawElbowDeg)?metrics.drawElbowDeg.toFixed(1):"",
    bow_arm_deg:Number.isFinite(metrics?.bowArmDeg)?metrics.bowArmDeg.toFixed(1):"",
    shoulder_line_deg:Number.isFinite(metrics?.shoulderLineDeg)?metrics.shoulderLineDeg.toFixed(1):"",
    torso_lean_deg:Number.isFinite(metrics?.torsoLeanDeg)?metrics.torsoLeanDeg.toFixed(1):"",
    head_movement_mm:Number.isFinite(metrics?.headMovementMm)?metrics.headMovementMm.toFixed(1):"",
    phase:metrics?.phase||livePhase||"Release",
    status:"ok",note:"",score:"",is_x:false,is_reference:false
  };
}
function openAddShotDialog(){
  if(!currentSessionId){toast("Create or select a session first.","warn");return;}
  shotDialogMode="new";
  const v=$("#sideVideo"),metrics=window.PoseEngine?.getLatestMetrics?.("side"),eventEpochMs=v?.srcObject?Date.now():null;
  const roles=CAMERA_ROLES.filter(role=>!!liveStreams[role]),centerDataUrls={};
  if(eventEpochMs){for(const role of roles){const near=nearestBufferedFrame(eventEpochMs,role);centerDataUrls[role]=near?.dataUrl||captureVideoDataUrl($(`#${role}Video`),720,.84);}}
  pendingShotContext={
    timestamp:currentShotTimestamp(),metrics:metrics?{...metrics}:null,eventEpochMs,
    source:v?.srcObject?"live":"saved",roles,centerDataUrls,views:eventEpochMs?collectMultiViewEvidence(eventEpochMs):{},frameCandidates:[]
  };
  fillShotFormValues(metricsToFormValues(metrics));
  $("#shotDialogTitle").textContent="Add Shot";
  $("#shotDialogTime").textContent=`Session time ${secToClock(pendingShotContext.timestamp)} · enter score now or leave blank`;
  $("#shotDialogAnalysis").textContent=metrics?.detected?`Tracking ${Math.round((metrics.quality||0)*100)}%`:"Manual shot";
  $("#shotDialogAnalysis").className=`analysis-chip ${metrics?.quality>=.7?"stable":metrics?.quality>=.45?"review":"building"}`;
  $("#deleteShotBtn").classList.add("hidden");
  $("#saveShotBtn").textContent="Add Shot";
  $("#shotDialog").showModal();
  if(pendingShotContext.eventEpochMs){
    setTimeout(()=>snapshotPendingLiveFrames(pendingShotContext),1050);
  }
}
function openEditShotDialog(id){
  const x=STATE.shots.find(s=>s.id===Number(id));
  if(!x){toast("Select a shot first.","warn");return;}
  selectedShotId=x.id;shotDialogMode="edit";pendingShotContext=null;
  fillShotFormValues(x);
  $("#shotDialogTitle").textContent=`Edit Shot #${x.shot_no}`;
  $("#shotDialogTime").textContent=`Session time ${secToClock(x.timestamp_s)}${x.auto_detected?" · auto-detected":""}`;
  const analysis=interpretShot(x);
  $("#shotDialogAnalysis").textContent=analysis.label;
  $("#shotDialogAnalysis").className=`analysis-chip ${analysis.css}`;
  $("#deleteShotBtn").classList.remove("hidden");
  $("#saveShotBtn").textContent="Save Changes";
  $("#shotDialog").showModal();
}
$("#markShotBtn").onclick=openAddShotDialog;
$("#editShotBtn").onclick=()=>openEditShotDialog(selectedShotId);
$("#cancelShot").onclick=()=>{$("#shotDialog").close();pendingShotContext=null;};
$$("#scorePicker button").forEach(btn=>btn.onclick=()=>{
  const f=$("#shotForm"),v=btn.dataset.score;
  if(v==="X"){
    f.elements.score.value=10;$("#shotIsX").checked=true;setScorePicker(10,true);
  }else{
    f.elements.score.value=v;$("#shotIsX").checked=false;setScorePicker(Number(v),false);
  }
});
$("#shotForm").elements.score.addEventListener("input",e=>{
  $("#shotIsX").checked=false;setScorePicker(e.target.value,false);
});
$("#shotIsX").addEventListener("change",e=>{
  if(e.target.checked)$("#shotForm").elements.score.value=10;
  setScorePicker($("#shotForm").elements.score.value,e.target.checked);
});
$("#deleteShotBtn").onclick=async()=>{
  const shot=selectedShot();if(!shot)return;
  if(!confirm(`Delete Shot #${shot.shot_no} and all saved Shot evidence?`))return;
  await api(`/api/shots/${shot.id}`,{method:"DELETE"});
  try{await evidenceDbDeleteShot(shot.id,Number(shot.session_id||currentSessionId));}catch(err){console.warn('Could not clear full shot evidence',err);}
  deleteAdvancedShotMetrics(shot.id);
  $("#shotDialog").close();selectedShotId=null;await reload();toast("Shot deleted.","good");
};
$("#shotForm").onsubmit=async e=>{
  e.preventDefault();
  const form=e.target,fd=new FormData(form);
  const scoreRaw=form.elements.score.value.trim();
  if(scoreRaw==="")fd.delete("score");
  if(!form.elements.is_x.checked)fd.set("is_x","false");
  if(!form.elements.is_reference.checked)fd.set("is_reference","false");

  if(shotDialogMode==="new"){
    const ctx=pendingShotContext||{timestamp:currentShotTimestamp(),metrics:null,source:"saved"};
    fd.append("session_id",String(currentSessionId));
    fd.append("timestamp_s",Number(ctx.timestamp||0).toFixed(3));
    fd.append("auto_detected","false");
    if(Number.isFinite(ctx.metrics?.quality))fd.append("pose_confidence",ctx.metrics.quality.toFixed(4));
    if(Number.isFinite(ctx.metrics?.headOffsetPct))fd.append("head_offset_pct",ctx.metrics.headOffsetPct.toFixed(3));
    if(Number.isFinite(ctx.metrics?.releaseConfidence))fd.append("release_confidence",ctx.metrics.releaseConfidence.toFixed(3));
    const r=await api("/api/shots",{method:"POST",body:fd});
    saveAdvancedShotMetrics(r.id,ctx.metrics||{},ctx.views||null);
    await evidenceDbDeleteShot(r.id,currentSessionId).catch(err=>console.warn("Could not prepare clean evidence slot",err));
    $("#shotDialog").close();
    selectedShotId=r.id;
    const savedCtx=ctx; pendingShotContext=null;

    if(savedCtx.source==="live"){
      const centerLabel=savedCtx.metrics?.phase==="Release"?"Release":"Shot Mark";
      for(const role of (savedCtx.roles||[])){const dataUrl=savedCtx.centerDataUrls?.[role];if(!dataUrl)continue;try{await uploadShotFrameData(r.id,dataUrl,0,roleFrameLabel(role,centerLabel),null);}catch(frameErr){console.warn(`${roleTitle(role)} immediate shot frame save failed`,frameErr);}}
    }

    await reload(); selectedShotId=r.id; renderShots();renderShotDetail();renderAnalyze();
    toast(`Shot #${r.shot_no} added${scoreRaw!==""?` · score ${form.elements.is_x.checked?"X":scoreRaw}`:""}.`,"good");

    if(savedCtx.source==="live"){
      if(!savedCtx.frameCandidates?.length)await snapshotPendingLiveFrames(savedCtx);
      await persistPendingLiveFrames(r.id,savedCtx,{skipCenter:true});
      scheduleFullShotEvidence(r.id,currentSessionId,savedCtx.eventEpochMs||Date.now(),savedCtx.roles||CAMERA_ROLES.filter(r=>!!liveStreams[r]),savedCtx.metrics||{});
    }else{
      generateSavedVideoKeyframes(r.id,savedCtx.timestamp);
    }
  }else{
    const shot=selectedShot();if(!shot)return;
    fd.set("auto_detected",shot.auto_detected?"true":"false");
    if(shot.release_confidence!=null)fd.set("release_confidence",shot.release_confidence);
    if(shot.pose_confidence!=null)fd.set("pose_confidence",shot.pose_confidence);
    if(shot.head_offset_pct!=null)fd.set("head_offset_pct",shot.head_offset_pct);
    if(shot.execution_label)fd.set("execution_label",shot.execution_label);
    await api(`/api/shots/${shot.id}`,{method:"PUT",body:fd});
    $("#shotDialog").close();await reload();selectedShotId=shot.id;renderShots();renderShotDetail();toast(`Shot #${shot.shot_no} updated.`,"good");
  }
};

$("#compareBtn").onclick=()=>{const shots=sessionShots();compareShotBId=selectedShotId||shots.at(-1)?.id;compareShotAId=shots.find(x=>x.id!==compareShotBId)?.id||compareShotBId;renderCompare();setView("compare");};


$("#chooseStorageBtn").onclick=chooseStorage;
$("#internalStorageBtn").onclick=useInternalStorage;
$("#openStorageBtn").onclick=openStorage;
$("#archiveSessionBtn")?.addEventListener("click",()=>archiveCurrentSession({removeLocal:false}));
$("#archiveRemoveSessionBtn")?.addEventListener("click",()=>archiveCurrentSession({removeLocal:true}));
$("#importSessionArchiveBtn")?.addEventListener("click",importArchivedSession);
$("#archiveProgressClose")?.addEventListener("click",closeArchiveStatus);


$("#exportPhaseTraceBtn")?.addEventListener("click",exportPhaseTrace);
$("#homeNewSessionBtn").onclick=()=>openSessionDialog("new");
["analyzeSessionSelect","compareSessionSelect","reportSessionSelect"].forEach(id=>$("#"+id).onchange=e=>syncGlobalSession(e.target.value));
$("#analyzeShotSelect").onchange=e=>{selectedShotId=Number(e.target.value);renderAnalyze();renderShotDetail();};
$("#analysisFrameModeBtn").onclick=()=>setAnalysisMediaMode("frame");
$("#analysisVideoModeBtn").onclick=()=>setAnalysisMediaMode("video");
$("#analysisRoleSelect").onchange=e=>{analysisMediaRole=e.target.value;localStorage.setItem("3pm-analysis-media-role",analysisMediaRole);analysisMediaMode="frame";renderAnalyze();};
$("#compareShotA").onchange=e=>{compareShotAId=Number(e.target.value);renderCompare();};
$("#compareShotB").onchange=e=>{compareShotBId=Number(e.target.value);renderCompare();};
$("#toggleReferenceBtn").onclick=async()=>{const shot=STATE.shots.find(x=>x.id===selectedShotId);if(!shot)return;const fd=new FormData();fd.append("is_reference",shot.is_reference?"false":"true");await api(`/api/shots/${shot.id}/reference`,{method:"POST",body:fd});await reload();renderAnalyze();};
$("#exportCsvBtn").onclick=exportEnrichedCsv;
$("#exportJsonBtn").onclick=exportEnrichedJson;
$("#printReportBtn").onclick=()=>window.print();
function loadAnalysisSettings(){
  const auto=localStorage.getItem("3pm-auto-mark-release");
  const phase=localStorage.getItem("3pm-phase-detect");
  const profile=localStorage.getItem("3pm-phase-profile-v34")||"verified";
  $("#autoMarkToggle").checked=auto!=="false";
  $("#phaseDetectToggle").checked=phase!=="false";
  if($("#phaseProfileSelect"))$("#phaseProfileSelect").value=profile;
  renderHome();
}
$("#autoMarkToggle").onchange=e=>{localStorage.setItem("3pm-auto-mark-release",e.target.checked);renderHome();updateShotSaveStatus();};
$("#phaseDetectToggle").onchange=e=>{localStorage.setItem("3pm-phase-detect",e.target.checked);window.PoseEngine?.resetBaseline?.();updateShotSaveStatus();};
if($("#phaseProfileSelect"))$("#phaseProfileSelect").onchange=e=>{
  localStorage.setItem("3pm-phase-profile-v34",e.target.value);
  window.PoseEngine?.resetBaseline?.();
  toast(`Phase detector: ${e.target.options[e.target.selectedIndex].text}`,"good",1800);
};

$$("#reviewRoleTabs .review-role-btn").forEach(btn=>btn.onclick=()=>setReviewRole(btn.dataset.reviewRole));
$("#timelineLiveBtn").onclick=()=>setTimelineMode("live");
$("#timelineShotsBtn").onclick=()=>setTimelineMode("shots");
$("#prevFrameBtn").onclick=()=>stepReviewFrame(-1);
$("#nextFrameBtn").onclick=()=>stepReviewFrame(1);
$("#jumpAnchorBtn")?.addEventListener("click",jumpReplayAnchor);
$("#jumpReleaseBtn").onclick=jumpSelectedShot;
$("#replayPlayBtn")?.addEventListener("click",toggleShotReplay);
$("#replayMinusFrameBtn")?.addEventListener("click",()=>stepReviewFrame(-1));
$("#replayPlusFrameBtn")?.addEventListener("click",()=>stepReviewFrame(1));
$("#shotReplaySlider")?.addEventListener("input",e=>{stopShotReplay();shotReplayState.index=Number(e.target.value)||0;renderShotReplayFrame();});
$("#replaySpeedSelect")?.addEventListener("change",e=>{shotReplayState.speed=Math.max(.1,Number(e.target.value)||.5);if(shotReplayState.playing){if(shotReplayState.timer)clearTimeout(shotReplayState.timer);scheduleReplayTick();}});
$("#replayZoomOutBtn")?.addEventListener("click",()=>setReplayZoom((shotReplayState.zoom||1)-.25));
$("#replayZoomResetBtn")?.addEventListener("click",()=>{shotReplayState.panX=0;shotReplayState.panY=0;setReplayZoom(1);});
$("#replayZoomInBtn")?.addEventListener("click",()=>setReplayZoom((shotReplayState.zoom||1)+.25));
$("#replayPanLeftBtn")?.addEventListener("click",()=>panShotReplay(-1,0));
$("#replayPanUpBtn")?.addEventListener("click",()=>panShotReplay(0,-1));
$("#replayPanDownBtn")?.addEventListener("click",()=>panShotReplay(0,1));
$("#replayPanRightBtn")?.addEventListener("click",()=>panShotReplay(1,0));
$("#shotReplayImage")?.addEventListener("load",applyReplayZoom);
$("#generateFramesBtn").onclick=async()=>{
  const shot=selectedShot();if(!shot)return;
  await generateSavedVideoKeyframes(shot.id,Number(shot.timestamp_s)||0);
  updateReviewControls();
};
$("#closeFrameViewerBtn").onclick=()=>$("#frameViewerDialog").close();
document.addEventListener("keydown",e=>{
  const tag=String(e.target?.tagName||"").toLowerCase();if(["input","textarea","select"].includes(tag)||e.metaKey||e.ctrlKey||e.altKey)return;
  if(!shotReplayState.record?.frames?.length)return;
  if(e.shiftKey&&e.key==="ArrowLeft"){e.preventDefault();panShotReplay(-1,0);}
  else if(e.shiftKey&&e.key==="ArrowRight"){e.preventDefault();panShotReplay(1,0);}
  else if(e.shiftKey&&e.key==="ArrowUp"){e.preventDefault();panShotReplay(0,-1);}
  else if(e.shiftKey&&e.key==="ArrowDown"){e.preventDefault();panShotReplay(0,1);}
  else if(e.key==="ArrowLeft"){e.preventDefault();stepShotReplay(-1);}
  else if(e.key==="ArrowRight"){e.preventDefault();stepShotReplay(1);}
  else if(e.key===" "){e.preventDefault();toggleShotReplay();}
});

new ResizeObserver(drawTimeline).observe($("#timeline"));
if($("#shotReplayStage"))new ResizeObserver(()=>applyReplayZoom()).observe($("#shotReplayStage"));


document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  const ended=CAMERA_ROLES.filter(role=>{const s=liveStreams[role],t=s?.getVideoTracks?.()[0];return s&&(!t||t.readyState==="ended");});
  ended.forEach(role=>stopRoleLive(role));
  if(ended.length){setCameraStatus("warn","Camera: reconnect available");if($("#cameraSummary"))$("#cameraSummary").textContent="A camera stream ended while the app was idle. Click Start Live to reconnect; the app will not auto-open the camera.";}
});

window.addEventListener("beforeunload",()=>{
  CAMERA_ROLES.forEach(role=>{stopNativeEvidencePump(role);clearDenseFrameBuffer(role);liveStreams[role]?.getTracks().forEach(t=>t.stop());});
  if(liveFrameTimer)clearInterval(liveFrameTimer);
});

(async function boot(){
  enforceBuildHandshake();
  const coreCheck=window.CoreEngine?.assertRuntimeContract?.();
  if(!coreCheck?.ok){console.error("3PM Core Runtime contract failed",coreCheck?.errors||["core runtime missing"]);toast("Core runtime self-check failed. Automatic shot capture is disabled for safety.","bad",6000);if($("#autoMarkToggle"))$("#autoMarkToggle").checked=false;}
  resolveAdaptiveLayout();
  renderCoachProfile();
  loadAnalysisSettings();
  await reload();
  await refreshStorageStatus();
  updateLiveButtons();
  // V3.3.2: boot scans passively; camera opens only after explicit Start Live / Enable Cameras.
  await detectCameras({autoStart:false,requestPermission:false});
  resolveAdaptiveLayout();
  updateCameraWorkspace();
  setReviewRole(reviewRole);
  initImpactControls();
  renderImpact();
})();
