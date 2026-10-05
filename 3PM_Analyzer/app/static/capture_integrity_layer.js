// 3PM BLE4.3.8.9.4 Shot Continuity + Persistent Release Pending + T0 Review Policy
// External integration layer. Frozen X2.8.2 Dev4 files remain byte-identical.
(function(){
'use strict';
const C=window.CaptureIntegrityCore;if(!C)return;
const SideLife=window.SideLifecycleCore;
const MultiView=window.MultiViewCorroborationCore;let multiViewState=MultiView?.fresh?.()||null;
const AnchorBridge=window.RealBowAnchorBridgeCore;
const ROLES=['side','rear','overhead'];
const VERSION='BLE4.3.8.2';
const BUILD_VERSION='BLE4.3.8.9.5.4';
const nowIso=()=>new Date().toISOString();
const $=s=>document.querySelector(s);
function activityClassifierSnapshot(){try{return window.ActivityClassifierLayer?.getState?.()||window.FoundationGuardLayer?.traceState?.()?.activityClassifier||null;}catch{return null;}}
function currentActivityMode(){try{const x=activityClassifierSnapshot()?.label||window.FoundationGuardLayer?.getActivityMode?.();return ['real_bow','elastic','hand_only','unknown'].includes(x)?x:'unknown';}catch{return 'unknown';}}
const registry=Object.fromEntries(ROLES.map(role=>[role,{role,generation:0,active:false,stream:null,track:null,startedAt:null,endedAt:null,reportedFps:null,width:null,height:null,intervals:[],actualFps:null,jitterMs:null,lastFrameAt:null,frameCount:0,settingsChanges:0,quality:null,callbackId:null,callbackGeneration:0,lastSettingsKey:null,medianIntervalMs:null,p95IntervalMs:null,longGapRate:null}]));
let run={id:null,startedAt:null,endedAt:null,sessionId:null,trace:[],events:[],cycles:[],diagnosticClips:[],currentCycle:null,cameraSnapshots:[],lastActiveCameraSnapshot:null};
let lastAnyActive=false,lastSessionId=null,lastSideMetrics=null,lastSideInputDiag=null,layoutFrozen=false,layoutFreezeViewport=null,wrappedFA=false;
let rearmRequired=false,rearmNeutralSince=null,rearmReason=null,rearmNeutralSamples=0;
let continuityNeutralSince=null,forceEngineReset=false,lastCapturedReleaseEpoch=null,lastCapturedCycleId=null;const capturedCycleIds=new Set();
const ShotIntent=window.ShotIntentCore;let shotIntent=ShotIntent?.fresh?.()||null;
let sideLife=SideLife?.fresh?.()||null,pendingLifecycleEvent=null;
let anchorBridge=AnchorBridge?.fresh?.()||null;
const originalCore={};
function uid(){return `run-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
function cameraVideo(role){return document.getElementById(`${role}Video`);}
function liveTrack(role){const v=cameraVideo(role),s=v?.srcObject;if(!s?.getVideoTracks)return null;return s.getVideoTracks().find(t=>t.readyState==='live'&&t.enabled!==false)||null;}
function settingsKey(x){return `${x?.width||0}x${x?.height||0}@${x?.frameRate||0}`;}
function currentSessionId(){return Number(window.FormAnalyzer?.getCurrentSessionId?.())||null;}
function startRun(reason='camera-active'){
  run={id:uid(),startedAt:Date.now(),endedAt:null,sessionId:currentSessionId(),trace:[],events:[],cycles:[],diagnosticClips:[],currentCycle:null,cameraSnapshots:[],lastActiveCameraSnapshot:null};
  capturedCycleIds.clear();lastCapturedReleaseEpoch=null;lastCapturedCycleId=null;
  lastSessionId=run.sessionId;pinEvent('run_start',{reason});
}
function endRun(reason='all-cameras-closed'){if(!run.id)return;run.endedAt=Date.now();pinEvent('run_end',{reason});releaseViewportGeometry();}
function ensureRun(reason='activity'){if(!run.id||run.endedAt)startRun(reason);}
function pinEvent(type,data={}){if(!run.id&&type!=='run_start')ensureRun(type);run.events.push({t:Date.now(),type,...data});if(run.events.length>480)run.events.shift();}
function trace(role,m){
  if(!run.id)return;const r=registry[role];if(!r?.active)return;const d=role==='side'?(lastSideInputDiag||{}):{};
  const rec={t:C.num(m?.epochMs)||C.num(d?.epochMs)||Date.now(),role,run_id:run.id,camera_generation:r?.generation||0,camera_active:!!r?.active,phase:m?.phase||null,primaryPhase:m?.primaryPhase||null,blocker:m?.shotBlocker||m?.blocker||null,detected:!!m?.detected,armed:!!m?.armed,releaseCandidate:!!m?.releaseCandidate,releaseConfirmed:!!m?.releaseConfirmed,releaseInvalidated:!!m?.releaseInvalidated,shotComplete:!!m?.shotComplete,postReleaseEvidence:!!m?.postReleaseEvidence,sequenceQualified:m?.sequenceQualified===undefined?null:!!m?.sequenceQualified,followThroughConfirmed:!!m?.followThroughConfirmed,followThroughEnded:!!m?.followThroughEnded,shotObservability:C.num(m?.shotObservability),identityConfidence:C.num(m?.identityConfidence),letDown:!!m?.letDown,holdTimeS:C.num(m?.holdTimeS),phaseQuality:C.num(m?.phaseQuality),releaseQuality:C.num(m?.releaseQuality),releaseEpochMs:C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs),releaseCandidateStartedEpochMs:C.num(m?.releaseCandidateStartedEpochMs),releaseCandidateGrowth:C.num(m?.releaseCandidateGrowth),releaseCandidateGrowthSteps:C.num(m?.releaseCandidateGrowthSteps),releaseRearStep:C.num(m?.releaseRearStep),releaseFaceRearStep:C.num(m?.releaseFaceRearStep),releaseElbowRearStep:C.num(m?.releaseElbowRearStep),releaseRearThreshold:C.num(m?.releaseRearThreshold),releaseSpeedThreshold:C.num(m?.releaseSpeedThreshold),releaseFrameSpeed:C.num(m?.releaseFrameSpeed),releaseDirectionalSteps:C.num(m?.releaseDirectionalSteps),releaseRearAccum:C.num(m?.releaseRearAccum),releaseElbowRearAccum:C.num(m?.releaseElbowRearAccum),releasePostIndependent:!!m?.releasePostIndependent,releasePostBlurSupported:!!m?.releasePostBlurSupported,releasePostLetDown:!!m?.releasePostLetDown,adaptiveReleaseProof:!!m?.adaptiveReleaseProof,adaptiveReleaseSource:m?.adaptiveReleaseSource||null,letDownDirectional:!!m?.letDownDirectional,drawSpeed:C.num(m?.drawSpeed),faceHandSpeed:C.num(m?.faceHandSpeed),elbowSpeed:C.num(m?.elbowSpeed),bowSpeed:C.num(m?.bowSpeed),visualMotionRatio:C.num(m?.visualMotionRatio),visualMotionLocalGlobal:C.num(m?.visualMotionLocalGlobal),visualMotionCorroborated:!!m?.visualMotionCorroborated,trackingDrop:C.num(m?.trackingDrop),visibilityDrop:C.num(m?.visibilityDrop),measurementTrust:C.num(m?.debugMeasurementTrust),anchorSamples:C.num(m?.anchorSampleCount),nativeSetReady:d.nativeSetReady??null,setAdmissionReady:d.setAdmissionReady??null,setAdmissionSource:d.setAdmissionSource||null,phaseShootingPosture:d.phaseShootingPosture??null,phaseBowExtended:d.phaseBowExtended??null,phaseFaceDist:C.num(d.phaseFaceDist),phaseDrawWristVisibility:C.num(d.phaseDrawWristVisibility),phaseDrawElbowVisibility:C.num(d.phaseDrawElbowVisibility),bowArmDeg:C.num(d.bowArmDeg),bowPlaneReady:d.bowPlaneReady??null,bowPlaneStable:d.bowPlaneStable??null,bowWristRelX:C.num(d.bowWristRelX),bowWristRelY:C.num(d.bowWristRelY),rearmRequired:d.rearmRequired??rearmRequired,activityMode:d.activityMode||currentActivityMode(),activityClassifier:activityClassifierSnapshot(),bothHandsReady:d.bothHandsReady??null,drawSideVisible:d.drawSideVisible??null,drawGuardActive:d.drawGuardActive??null,foundationGuard:window.FoundationGuardLayer?.traceState?.()||null,shotIntent:ShotIntent?.snapshot?.(shotIntent)||null,sideLifecycle:d.sideLifecycle?{...d.sideLifecycle}:null,anchorBridge:d.anchorBridge?{...d.anchorBridge}:null,adaptiveReleaseDecision:d.adaptiveReleaseDecision||null,nativePostValidation:d.nativePostValidation?{...d.nativePostValidation}:null,holdReleaseWatch:d.holdReleaseWatch?{...d.holdReleaseWatch}:null,multiViewCorroboration:d.multiViewCorroboration?{...d.multiViewCorroboration}:null};
  if(role==='side'){rec.displayPhase=SideLife?.displayPhase?.(rec.phase)||rec.phase;rec.displayPrimaryPhase=SideLife?.displayPhase?.(rec.primaryPhase)||rec.primaryPhase;rec.lifecycleAuthorityPhase=SideLife?.authorityPhase?.(d.sideLifecycle||sideLife?.lastSnapshot,m)||rec.displayPhase;}
  run.trace.push(rec);
  if(role==='side'&&run.currentCycle?.active){const a=run.currentCycle.diagnostics||(run.currentCycle.diagnostics=[]);a.push(rec);if(a.length>3600){const keepHead=a.slice(0,40),keepTail=a.slice(-1400),middle=a.slice(40,-1400).filter((_,i)=>i%4===0);run.currentCycle.diagnostics=[...keepHead,...middle,...keepTail].slice(-2400);}}
  const cutoff=rec.t-90000;while(run.trace.length&&run.trace[0].t<cutoff)run.trace.shift();
}
function pinCycleDiagnostics(c,reason,endedAt=Date.now()){
  if(!c)return;const rows=Array.isArray(c.diagnostics)?c.diagnostics:[];
  const clip={cycle_id:c.id,reason,started_at:c.startedAt,ended_at:endedAt,side_generation:c.sideGeneration,release_epoch_ms:c.releaseEpochMs||null,samples:rows.slice()};
  run.diagnosticClips.push(clip);if(run.diagnosticClips.length>48)run.diagnosticClips.shift();delete c.diagnostics;
}
function stopFrameProbe(role){const r=registry[role],v=cameraVideo(role);r.callbackGeneration++;try{if(r.callbackId!==null&&v?.cancelVideoFrameCallback)v.cancelVideoFrameCallback(r.callbackId);}catch{}r.callbackId=null;}
function startFrameProbe(role){
  const r=registry[role],v=cameraVideo(role);stopFrameProbe(role);if(!r.active||!v?.requestVideoFrameCallback)return;
  const gen=++r.callbackGeneration;r.intervals=[];r.frameCount=0;r.lastFrameAt=null;
  const loop=(ts,meta)=>{if(gen!==r.callbackGeneration||!r.active||cameraVideo(role)?.srcObject!==r.stream)return;r.callbackId=v.requestVideoFrameCallback(loop);const t=Number(meta?.expectedDisplayTime)||Number(ts);if(r.lastFrameAt){const dt=t-r.lastFrameAt;if(dt>1&&dt<250){r.intervals.push(dt);if(r.intervals.length>180)r.intervals.shift();}}r.lastFrameAt=t;r.frameCount++;const js=C.jitterStats(r.intervals);r.actualFps=C.actualFps(r.intervals);r.jitterMs=js.p95_deviation_ms;r.medianIntervalMs=js.median_ms;r.p95IntervalMs=js.p95_interval_ms;const med=Number(js.median_ms);r.longGapRate=med>0&&r.intervals.length?r.intervals.filter(x=>x>med*1.5).length/r.intervals.length:null;};
  r.callbackId=v.requestVideoFrameCallback(loop);
}
function cameraSnapshot(){return Object.fromEntries(ROLES.map(role=>{const r=registry[role],te=window.TemporalEvidenceLayer?.diagnostics?.(role)||{},poseHz=C.num(window.PoseEngine?.getRoleHealth?.(role)?.performance?.hz);return[role,{active:r.active,generation:r.generation,label:r.track?.label||null,width:r.width,height:r.height,reported_fps:r.reportedFps,display_callback_fps:r.actualFps,raw_worker_fps:C.num(te.rawFps),native_capture_fps:C.num(te.captureFps),pose_analysis_fps:poseHz,median_interval_ms:r.medianIntervalMs,p95_interval_ms:r.p95IntervalMs,jitter_p95_ms:r.jitterMs,long_gap_rate:r.longGapRate,temporal_mode:te.mode||null,temporal_backend:te.backend||null,temporal_error:te.error||null,temporal_attempts:Array.isArray(te.attempts)?te.attempts:[],temporal_median_interval_ms:C.num(te.medianMs),temporal_p95_interval_ms:C.num(te.p95Ms),temporal_jitter_p95_ms:C.num(te.jitterMs),temporal_discarded_frames:C.num(te.discardedFrames),temporal_buffer_frames:C.num(te.bufferFrames),temporal_last_bundle:te.lastBundle||null,quality:r.quality?.mode||null,quality_level:r.quality?.level||null,settings_changes:r.settingsChanges}];}));}
function refreshRole(role){
  const r=registry[role],v=cameraVideo(role),track=liveTrack(role),stream=v?.srcObject||null,active=!!track;
  if(active!==r.active||stream!==r.stream||track!==r.track){
    const tePrev=window.TemporalEvidenceLayer?.diagnostics?.(role)||{};
    const previous=r.active?{role,generation:r.generation,label:r.track?.label||null,width:r.width,height:r.height,reported_fps:r.reportedFps,display_callback_fps:r.actualFps,raw_worker_fps:C.num(tePrev.rawFps),native_capture_fps:C.num(tePrev.captureFps),pose_analysis_fps:C.num(window.PoseEngine?.getRoleHealth?.(role)?.performance?.hz),median_interval_ms:r.medianIntervalMs,p95_interval_ms:r.p95IntervalMs,jitter_p95_ms:r.jitterMs,long_gap_rate:r.longGapRate,temporal_mode:tePrev.mode||null,temporal_backend:tePrev.backend||null,temporal_error:tePrev.error||null,temporal_attempts:Array.isArray(tePrev.attempts)?tePrev.attempts:[],temporal_median_interval_ms:C.num(tePrev.medianMs),temporal_p95_interval_ms:C.num(tePrev.p95Ms),temporal_jitter_p95_ms:C.num(tePrev.jitterMs),temporal_discarded_frames:C.num(tePrev.discardedFrames),temporal_last_bundle:tePrev.lastBundle||null,quality:r.quality?.mode||null,quality_level:r.quality?.level||null,settings_changes:r.settingsChanges}:null;
    stopFrameProbe(role);window.TemporalEvidenceLayer?.closeRole?.(role);r.generation++;r.active=active;r.stream=active?stream:null;r.track=active?track:null;r.intervals=[];r.actualFps=null;r.jitterMs=null;r.medianIntervalMs=null;r.p95IntervalMs=null;r.longGapRate=null;r.frameCount=0;r.lastFrameAt=null;r.settingsChanges=0;r.lastSettingsKey=null;
    if(active){r.startedAt=Date.now();r.endedAt=null;ensureRun(`${role}-opened`);pinEvent('camera_open',{role,generation:r.generation,label:track.label||null});startFrameProbe(role);window.TemporalEvidenceLayer?.openRole?.(role,track,r.generation);}else{r.endedAt=Date.now();if(previous){run.lastActiveCameraSnapshot={...(run.lastActiveCameraSnapshot||{}),[role]:previous};pinEvent('camera_close',{role,generation:r.generation,previous_profile:previous});}else pinEvent('camera_close',{role,generation:r.generation});}
  }
  if(active){const s=track.getSettings?.()||{},key=settingsKey(s);if(r.lastSettingsKey&&key!==r.lastSettingsKey){r.settingsChanges++;pinEvent('camera_settings_change',{role,generation:r.generation,from:r.lastSettingsKey,to:key,shot_active:!!run.currentCycle?.active});}r.lastSettingsKey=key;r.width=C.num(s.width);r.height=C.num(s.height);r.reportedFps=C.num(s.frameRate);const poseHz=C.num(window.PoseEngine?.getRoleHealth?.(role)?.performance?.hz),te=window.TemporalEvidenceLayer?.diagnostics?.(role)||{},raw=C.num(te.rawFps);r.quality=C.cameraQuality({width:r.width,height:r.height,reportedFps:r.reportedFps,actualFps:raw??r.actualFps,jitterMs:C.num(te.jitterMs)??r.jitterMs,poseHz,active:true});}
  else r.quality=C.cameraQuality({active:false});
}
function refreshRegistry(){
  ROLES.forEach(refreshRole);const any=ROLES.some(role=>registry[role].active),sid=currentSessionId();
  if(any&&!lastAnyActive&&(!run.id||run.endedAt))startRun('first-camera-opened');
  if(any&&run.id&&sid!==lastSessionId){endRun('session-changed');startRun('session-changed');}
  if(!any&&lastAnyActive)endRun('all-cameras-closed');lastAnyActive=any;lastSessionId=sid;updateCameraUI();
}
function fmtFps(v){return C.finite(v)?`${Number(v).toFixed(Number(v)>=50?0:1)}fps`:'—fps';}
function updateCameraUI(){
  for(const role of ROLES){const r=registry[role],v=cameraVideo(role);if(!v?.parentElement)continue;let chip=document.getElementById(`${role}CaptureIntegrity`);if(!chip){chip=document.createElement('div');chip.id=`${role}CaptureIntegrity`;chip.className='capture-integrity-camera-chip';v.parentElement.appendChild(chip);}if(!r.active){chip.textContent='CLOSED';chip.className='capture-integrity-camera-chip off';continue;}const te=window.TemporalEvidenceLayer?.diagnostics?.(role)||{},raw=C.num(te.rawFps),cap=C.num(te.captureFps),pose=C.num(window.PoseEngine?.getRoleHealth?.(role)?.performance?.hz);chip.textContent=`${r.width||'?'}×${r.height||'?'}${cap!==null?` · CAP ${fmtFps(cap)}`:''} · RAW ${fmtFps(raw??r.actualFps??r.reportedFps)} · Pose ${fmtFps(pose)} · ${r.quality?.mode||'PROFILING'}`;chip.className=`capture-integrity-camera-chip ${r.quality?.level||'neutral'}`;}
  const side=registry.side,summary=$('#cameraTuneSummary');if(summary){const active=ROLES.filter(x=>registry[x].active).map(x=>{const te=window.TemporalEvidenceLayer?.diagnostics?.(x)||{},cap=C.num(te.captureFps);return `${x[0].toUpperCase()}${cap!==null?` CAP ${fmtFps(cap)} ·`:''} RAW ${fmtFps(C.num(te.rawFps)??registry[x].actualFps??registry[x].reportedFps)}`;}).join(' · ');summary.textContent=active?`Capture Integrity: ${active} · Side authority${side.active?' ready':' unavailable'}`:'Capture Integrity: no live camera';}
  let badge=$('#captureIntegrityBadge');if(!badge){const host=$('.camera-toolbar-actions');if(host){badge=document.createElement('span');badge.id='captureIntegrityBadge';host.insertBefore(badge,$('#shotSaveStatus')||host.firstChild);}}
  if(badge){
    const te=window.TemporalEvidenceLayer?.diagnostics?.('side')||{},backend=String(te.backend||'none');
    const native=backend==='native-avfoundation',fallback=backend.includes('track-processor')||backend.includes('browser')||backend==='independent-video-pump';
    const mode=native?'NATIVE CAPTURE':fallback?'BROWSER FALLBACK':side.active?'CAP STARTING':'CAP WAIT';
    badge.textContent=side.active?`${BUILD_VERSION} · ${mode} · Side G${side.generation}`:`${BUILD_VERSION} · CAP WAIT · Side closed`;
    badge.className=`status-pill ${native?'good':side.active?'warn':'warn'} compact-status`;
  }
}
function freezeViewportGeometry(){if(layoutFrozen)return;const sizes=[];document.querySelectorAll('[data-camera-card] .video-wrap').forEach(el=>{const rect=el.getBoundingClientRect();if(rect.width>10&&rect.height>10){el.dataset.ciPrevHeight=el.style.height||'';el.dataset.ciPrevMinHeight=el.style.minHeight||'';el.dataset.ciPrevMaxHeight=el.style.maxHeight||'';el.style.height=`${Math.round(rect.height)}px`;el.style.minHeight=`${Math.round(rect.height)}px`;el.style.maxHeight=`${Math.round(rect.height)}px`;sizes.push([el,rect.width,rect.height]);}});layoutFrozen=true;layoutFreezeViewport={w:innerWidth,h:innerHeight,t:Date.now()};document.body.classList.add('capture-geometry-frozen');pinEvent('display_geometry_frozen',{cards:sizes.length});}
function releaseViewportGeometry(){if(!layoutFrozen)return;document.querySelectorAll('[data-camera-card] .video-wrap').forEach(el=>{el.style.height=el.dataset.ciPrevHeight||'';el.style.minHeight=el.dataset.ciPrevMinHeight||'';el.style.maxHeight=el.dataset.ciPrevMaxHeight||'';delete el.dataset.ciPrevHeight;delete el.dataset.ciPrevMinHeight;delete el.dataset.ciPrevMaxHeight;});layoutFrozen=false;layoutFreezeViewport=null;document.body.classList.remove('capture-geometry-frozen');pinEvent('display_geometry_released');}
function resetContinuityGuard(){continuityNeutralSince=null;}
const LIVE_EVIDENCE_STAGES=['draw','anchor','hold','release','post','follow','recovery'];
const LIVE_EVIDENCE_LABELS={draw:'Draw',anchor:'Anchor',hold:'Hold',release:'Release',post:'Post-release',follow:'Follow-through',recovery:'Recovery'};
let liveEvidence={releaseEpoch:null,releaseEventId:0,shotId:null,pollToken:0,record:null,contract:null,status:'idle'};
function liveEvidencePanel(){return $('#liveEvidencePanel');}
function liveEvidenceStatus(){return $('#liveEvidenceStatus');}
function liveEvidenceStage(name){return document.querySelector(`#liveEvidenceButtons [data-evidence-stage="${name}"]`);}
function setEvidenceStage(name,state,label=null){const el=liveEvidenceStage(name);if(!el)return;el.classList.remove('waiting','collecting','saved','missing');el.classList.add(state);const base=label||LIVE_EVIDENCE_LABELS[name]||name;el.textContent=state==='saved'?`✓ ${base}`:state==='missing'?`! ${base}`:state==='collecting'?`● ${base}`:base;}
function setEvidenceStatus(text,cls='muted'){const el=liveEvidenceStatus();if(!el)return;el.textContent=text;el.className=cls;}
function resetLiveEvidence({hide=true}={}){liveEvidence.pollToken++;liveEvidence={releaseEpoch:null,releaseEventId:0,shotId:null,pollToken:liveEvidence.pollToken,record:null,contract:null,status:'idle'};LIVE_EVIDENCE_STAGES.forEach(x=>setEvidenceStage(x,'waiting'));setEvidenceStatus('Waiting for a confirmed Release.','muted');const p=liveEvidencePanel();if(p)p.classList.toggle('hidden',hide);}
function beginLiveEvidence(m){const release=C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs)||Date.now();if(liveEvidence.releaseEpoch&&Math.abs(liveEvidence.releaseEpoch-release)<500)return;const token=liveEvidence.pollToken+1;liveEvidence={releaseEpoch:release,releaseEventId:Number(m?.releaseEventId)||0,shotId:null,pollToken:token,record:null,contract:null,status:'collecting'};const p=liveEvidencePanel();if(p)p.classList.remove('hidden');const fg=window.FoundationGuardLayer?.traceState?.()||{};const conf=fg.confirmed||{};for(const k of ['draw','anchor','hold'])setEvidenceStage(k,conf[k==='hold'?'Aim / Hold':k[0].toUpperCase()+k.slice(1)]?'collecting':'waiting');setEvidenceStage('release','collecting');setEvidenceStage('post',m?.postReleaseEvidence?'collecting':'waiting');setEvidenceStage('follow',m?.phase==='Follow Through'||m?.followThroughConfirmed?'collecting':'waiting');setEvidenceStage('recovery',m?.followThroughEnded?'collecting':'waiting');setEvidenceStatus('Release confirmed · collecting real-frame evidence…','warn');}
function recordPostReleaseFrame(record){const frames=Array.isArray(record?.frames)?record.frames:[];return frames.some(f=>{const o=C.num(f?.offsetMs);return o!==null&&o>=80&&o<=680;});}
function renderLiveEvidenceRecord(record){if(!record||!liveEvidence.releaseEpoch)return false;const rel=C.num(record.releaseEpochMs);if(rel===null||Math.abs(rel-liveEvidence.releaseEpoch)>450)return false;const adv=advancedForShot(record.shotId),contract=C.evidenceContract(record,adv),finalKnown=C.finite(record.followThroughEndEpochMs),map={draw:!!contract.stages.draw?.ok,anchor:!!contract.stages.anchor?.ok,hold:!!contract.stages.hold?.ok,release:!!contract.stages.release?.ok,post:recordPostReleaseFrame(record),follow:!!contract.stages.follow?.ok,recovery:!!contract.stages.recovery?.ok};liveEvidence.shotId=Number(record.shotId)||null;liveEvidence.record=record;liveEvidence.contract=contract;LIVE_EVIDENCE_STAGES.forEach(k=>{if(k==='recovery'&&!map[k]&&contract.stages.recovery?.required!==true)setEvidenceStage(k,'waiting','Recovery · optional');else setEvidenceStage(k,map[k]?'saved':finalKnown?'missing':'collecting');});const required=['draw','anchor','hold','release','post','follow'],missing=[...new Set([...required.filter(k=>!map[k]),...(contract.missing||[])])];const frames=Array.isArray(record.frames)?record.frames.length:0;if(!missing.length){liveEvidence.status='complete';setEvidenceStatus(`Evidence Complete ✓ · ${frames} real frames${map.recovery?' · Recovery saved':' · Recovery optional'}`,'good');}else if(finalKnown){liveEvidence.status='incomplete';setEvidenceStatus(`Incomplete Evidence · missing ${missing.map(k=>LIVE_EVIDENCE_LABELS[k]).join(', ')} · ${frames} real frames`,'bad');}else{liveEvidence.status='persisting';setEvidenceStatus(`Evidence saved · ${frames} real frames · waiting for required Follow-through evidence…`,'warn');}return true;}
async function pollLiveEvidence(releaseEpoch,token,attempt=0){if(token!==liveEvidence.pollToken||!C.finite(releaseEpoch))return;const sid=currentSessionId();if(!sid)return;const rows=await evidenceRowsForSession(sid).catch(()=>[]),rec=rows.filter(r=>r.role==='side'&&C.finite(r.releaseEpochMs)&&Math.abs(Number(r.releaseEpochMs)-Number(releaseEpoch))<=450).sort((a,b)=>Math.abs(Number(a.releaseEpochMs)-Number(releaseEpoch))-Math.abs(Number(b.releaseEpochMs)-Number(releaseEpoch)))[0]||null;if(rec){renderLiveEvidenceRecord(rec);if(liveEvidence.status==='complete'||liveEvidence.status==='incomplete')return;}if(attempt>=48){if(!rec){liveEvidence.status='unverified';setEvidenceStatus('Evidence not verified in local storage · export Capture Trace for diagnosis.','bad');LIVE_EVIDENCE_STAGES.forEach(k=>{const el=liveEvidenceStage(k);if(el&&!el.classList.contains('saved'))setEvidenceStage(k,'missing');});}return;}setTimeout(()=>pollLiveEvidence(releaseEpoch,token,attempt+1),250);}
function updateLiveEvidenceFromMetrics(m){if(!m)return;if(m?.letDown&&!m?.releaseConfirmed){resetLiveEvidence();return;}if(m?.releaseConfirmed||m?.phase==='Release'||m?.phase==='Follow Through'||m?.shotComplete){beginLiveEvidence(m);if(m?.releaseConfirmed)setEvidenceStage('release','collecting');if(m?.postReleaseEvidence||m?.shotComplete)setEvidenceStage('post','collecting');if(m?.phase==='Follow Through'||m?.followThroughConfirmed||m?.shotComplete)setEvidenceStage('follow','collecting');if(m?.followThroughEnded)setEvidenceStage('recovery','collecting');if(m?.shotComplete&&liveEvidence.releaseEpoch){const token=liveEvidence.pollToken;setEvidenceStatus('Shot accepted · saving Full Shot Evidence…','warn');void pollLiveEvidence(liveEvidence.releaseEpoch,token,0);}}}
function startCycle(m,proof=null){resetLiveEvidence();resetContinuityGuard();window.FoundationGuardLayer?.beginShotCycle?.();ensureRun('side-cycle');const eventEpoch=C.num(m?.epochMs)||Date.now(),started=C.num(proof?.shotStartEpoch)||C.num(proof?.drawEpoch)||eventEpoch;let seed=[];if(proof?.verified&&C.num(proof?.drawEpoch))seed=[{phase:'Draw',epochMs:Number(proof.drawEpoch),role:'side',confidence:C.num(m?.phaseQuality)}];else seed=[{phase:'Setup',epochMs:started,role:'side',confidence:C.num(m?.phaseQuality)}];run.currentCycle={id:`cycle-${Math.round(started)}`,active:true,startedAt:started,sideGeneration:registry.side.generation,timeline:seed,releaseEpochMs:null,followEnd:null,captureCommitted:false,intentProof:proof?{...proof}:null,diagnostics:run.trace.filter(x=>x.role==='side'&&x.t>=started-1200).slice(-100)};pinEvent('cycle_start',{cycle_id:run.currentCycle.id,side_generation:registry.side.generation,intent_source:proof?.source||null,late_start:!!proof?.lateStart,early_context:!proof?.verified});window.TemporalEvidenceLayer?.beginCycle?.(run.currentCycle.id);window.TemporalEvidenceLayer?.phase?.('side','Setup',started);if(proof?.verified)ShotIntent?.consumeDraw?.(shotIntent);}
function retrospectiveShotProof(m){
  const release=C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs)||Date.now(),gen=registry.side.generation;
  if(m?.releaseConfirmed!==true||m?.shotComplete!==true||m?.postReleaseEvidence!==true||m?.sequenceQualified!==true||m?.armed!==true)return null;
  const rows=run.trace.filter(r=>r?.role==='side'&&r.camera_generation===gen&&r.t>=release-15000&&r.t<=release+650);
  if(!rows.length)return null;
  let boundary=-1;
  for(let i=0;i<rows.length;i++){
    const r=rows[i],fg=r.foundationGuard||{},conf=fg.confirmed||{};
    const neutralSetup=r.phase==='Setup'&&r.armed!==true&&r.releaseConfirmed!==true&&conf.Draw!==true&&(r.bowPlaneReady===false||r.setAdmissionReady===false);
    if(r.letDown===true||r.followThroughEnded===true||neutralSetup)boundary=i;
  }
  const seq=rows.slice(boundary+1).filter(r=>r.t<=release+220);
  // Recovery is evaluated from the frozen Core trace itself. Do not require Foundation's
  // same-frame Draw bit here: CaptureIntegrity traces before Foundation consumes that frame, so
  // its UI snapshot can legitimately lag one frame. The explicit Core Draw + verified shot plane
  // + admission/posture/visibility is the authoritative forward evidence.
  const goodDraw=r=>r.phase==='Draw'&&r.phaseShootingPosture===true&&r.drawSideVisible!==false&&(r.bowPlaneReady===true||(r.phaseBowExtended===true&&r.sideLifecycle?.shotActive===true&&(r.sideLifecycle?.drawIntent===true||r.sideLifecycle?.preloadIntent===true)))&&(C.num(r.phaseQuality)===null||C.num(r.phaseQuality)>=.55);
  const drawIndex=seq.findIndex(goodDraw);if(drawIndex<0)return null;
  const draw=seq[drawIndex];
  const anchorRel=seq.slice(drawIndex+1).findIndex(r=>r.phase==='Anchor'||(r.foundationGuard?.confirmed||{}).Anchor===true);if(anchorRel<0)return null;
  const anchorIndex=drawIndex+1+anchorRel,anchor=seq[anchorIndex];
  const holdRel=seq.slice(anchorIndex+1).findIndex(r=>r.phase==='Aim / Hold'||(r.foundationGuard?.confirmed||{})['Aim / Hold']===true);if(holdRel<0)return null;
  const holdIndex=anchorIndex+1+holdRel,hold=seq[holdIndex];
  if(seq.slice(drawIndex).some(r=>r.t<release&&r.letDown===true))return null;
  if(release-draw.t>12000||anchor.t<draw.t||hold.t<anchor.t)return null;
  let tl=[];for(const r of seq.slice(drawIndex)){
    const ph=String(r.phase||'');if(!['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'].includes(ph))continue;
    tl=C.mergePhaseEvent(tl,ph,C.num(r.releaseEpochMs)||r.t,C.num(r.phaseQuality));
  }
  if(!tl.some(e=>e.phase==='Draw')||!tl.some(e=>e.phase==='Anchor')||!tl.some(e=>e.phase==='Aim / Hold'))return null;
  const proof={verified:true,bowPlaneReady:draw.bowPlaneReady===true,continuityVerified:draw.bowPlaneReady!==true,source:draw.bowPlaneReady===true?'trace-transaction-recovery':'trace-continuity-recovery',drawEpoch:draw.t,planeEpoch:draw.bowPlaneReady===true?draw.t:null,neutralEpoch:boundary>=0?rows[boundary].t:null,lateStart:true,recovered:true};
  return{release,proof,timeline:tl,startedAt:draw.t,diagnostics:seq.slice(Math.max(0,drawIndex-12))};
}
function recoverOrRepairCycleFromTrace(m,candidate=null){
  const rec=retrospectiveShotProof(m);if(!rec)return candidate;
  if(candidate?.active){
    candidate.intentProof={...(candidate.intentProof||{}),...rec.proof};
    for(const e of rec.timeline)candidate.timeline=C.mergePhaseEvent(candidate.timeline||[],e.phase,e.epochMs,e.confidence);
    pinEvent('cycle_repaired_from_trace',{cycle_id:candidate.id,release:rec.release,source:rec.proof.source});
    return candidate;
  }
  ensureRun('recovered-side-cycle');
  const id=`cycle-${Math.round(rec.startedAt)}`;
  run.currentCycle={id,active:true,startedAt:rec.startedAt,sideGeneration:registry.side.generation,timeline:rec.timeline,releaseEpochMs:null,followEnd:null,captureCommitted:false,intentProof:{...rec.proof},diagnostics:rec.diagnostics.slice(-180)};
  pinEvent('cycle_recovered_from_trace',{cycle_id:id,side_generation:registry.side.generation,release:rec.release,source:rec.proof.source});
  window.TemporalEvidenceLayer?.beginCycle?.(id);
  return run.currentCycle;
}
function cycleIntentVerified(c){
  const phases=(c?.timeline||[]).map(e=>String(e?.phase||''));
  return !!(c?.active&&c?.intentProof?.verified&&(c?.intentProof?.bowPlaneReady||c?.intentProof?.continuityVerified)&&phases.includes('Draw')&&phases.includes('Anchor')&&phases.includes('Aim / Hold'));
}
function requireRearm(reason){rearmRequired=true;rearmNeutralSince=null;rearmNeutralSamples=0;rearmReason=reason||'cycle-ended';pinEvent('rearm_required',{reason:rearmReason});}
function completeSuccessfulRearm(epoch=Date.now()){rearmRequired=false;rearmNeutralSince=null;rearmNeutralSamples=0;rearmReason=null;forceEngineReset=true;ShotIntent?.reset?.(shotIntent,{neutralAt:epoch});pinEvent('rearm_ready',{reason:'recovery',mode:'capture-complete'});window.FoundationGuardLayer?.markRecoveryReady?.(epoch);}
function diagNeutralReady(diag=lastSideInputDiag||{}){
  const trust=(diag.phaseQuality??0)>=.20||(diag.phaseDrawWristVisibility??0)>=.20||(diag.phaseDrawElbowVisibility??0)>=.20;
  const armLow=C.finite(diag.bowArmDeg)&&Number(diag.bowArmDeg)<125;
  return !!(trust&&(diag.wristsLow===true||diag.phaseShootingPosture===false&&diag.phaseBowExtended===false||armLow&&diag.phaseBowExtended===false));
}
function finishLetDownCycle(reason='let-down-neutral',epoch=Date.now()){
  const c=run.currentCycle;if(!c?.active||c.releaseEpochMs)return false;
  c.letDown=true;c.continuityReset=reason!=='native-let-down-neutral';c.continuityReason=reason;c.active=false;c.endedAt=epoch;pinCycleDiagnostics(c,'let-down',epoch);
  run.cycles.push({...c,timeline:[...c.timeline]});if(run.cycles.length>80)run.cycles.shift();
  pinEvent('cycle_let_down_ready',{cycle_id:c.id,reason,epoch});if(reason!=='native-let-down-neutral'&&reason!=='lifecycle-let-down-neutral')pinEvent('cycle_continuity_reset',{cycle_id:c.id,reason,epoch});window.TemporalEvidenceLayer?.endCycle?.('let-down');
  rearmRequired=false;rearmNeutralSince=null;rearmNeutralSamples=0;rearmReason=null;ShotIntent?.reset?.(shotIntent,{neutralAt:epoch});resetContinuityGuard();resetLiveEvidence();forceEngineReset=true;
  window.FoundationGuardLayer?.markLetDownReady?.(epoch,reason);setTimeout(releaseViewportGeometry,80);return true;
}
function abortActiveCycleForContinuity(reason,epoch=Date.now()){
  return finishLetDownCycle(reason,epoch);
}
function continuityResetEvidence(input){
  const c=run.currentCycle;if(!c?.active||c.releaseEpochMs){resetContinuityGuard();return false;}
  const phases=(c.timeline||[]).map(e=>String(e.phase||''));const late=phases.includes('Aim / Hold')||phases.includes('Expansion');
  if(!late){resetContinuityGuard();return false;}
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const bowExtended=input?.phaseBowExtended===true||input?.bowExtended===true||(C.finite(input?.bowArmDeg)&&Number(input.bowArmDeg)>=136);
  const setReady=input?.setReady===true;
  const trust=input?.criticalTrackingOK!==false||(C.num(input?.measurementTrustScore)||0)>=.42;
  const low=input?.wristsLow===true&&!setReady;
  const armReset=C.finite(input?.bowArmDeg)&&Number(input.bowArmDeg)<122&&!setReady;
  const postureReset=trust&&!posture&&!bowExtended&&!setReady;
  const neutral=low||armReset||postureReset;
  if(!neutral){resetContinuityGuard();return false;}
  const t=C.num(input?.epochMs)||Date.now();if(continuityNeutralSince===null)continuityNeutralSince=t;
  if(t-continuityNeutralSince>=360)return abortActiveCycleForContinuity(low?'wrists-low-after-hold':armReset?'bow-arm-reset-after-hold':'posture-reset-after-hold',t);
  return false;
}
function addSidePhase(m){
  const phase=String(m?.phase||''),epoch=C.num(m?.epochMs)||Date.now(),diag=lastSideInputDiag||{};
  // BLE43893: discard a stale early Set/Setup context without turning it into a fake shot/let-down.
  // A verified Draw cycle is never discarded by this path.
  if(pendingLifecycleEvent?.type==='shot-abort'){
    const e=pendingLifecycleEvent,c=run.currentCycle;
    if(c?.active&&!c?.intentProof?.verified&&!c?.releaseEpochMs){pinCycleDiagnostics(c,'pre-shot-abort',epoch);pinEvent('cycle_early_context_discarded',{cycle_id:c.id,reason:e.reason||'pre-draw-abort',epoch});window.TemporalEvidenceLayer?.endCycle?.('pre-shot-abort');run.currentCycle=null;resetContinuityGuard();resetLiveEvidence();releaseViewportGeometry();}
  }
  if(pendingLifecycleEvent?.type==='shot-start'&&pendingLifecycleEvent?.verifiedStart===true&&!run.currentCycle?.active&&!rearmRequired){const e=pendingLifecycleEvent;startCycle(m,{verified:false,shotStartEpoch:e.epochMs,source:e.source||'side-lifecycle-verified-start',bowPlaneReady:e.bowPlaneReady===true,earlyContext:true});}
  if(pendingLifecycleEvent?.type==='let-down'&&run.currentCycle?.active&&!run.currentCycle?.releaseEpochMs){finishLetDownCycle('lifecycle-let-down-neutral',pendingLifecycleEvent.epochMs||epoch);}
  pendingLifecycleEvent=null;
  if(ShotIntent&&shotIntent){
    ShotIntent.observePhase(shotIntent,phase,epoch,diag);
    const proof=ShotIntent.startProof(shotIntent,phase,epoch);
    if(proof){
      if(!run.currentCycle?.active&&!rearmRequired)startCycle(m,proof);
      else if(run.currentCycle?.active&&!run.currentCycle?.intentProof?.verified){run.currentCycle.intentProof={...(run.currentCycle.intentProof||{}),...proof,verified:true};run.currentCycle.timeline=C.mergePhaseEvent(run.currentCycle.timeline||[],'Draw',proof.drawEpoch||epoch,C.num(m?.phaseQuality));pinEvent('cycle_intent_verified',{cycle_id:run.currentCycle.id,source:proof.source,draw_epoch:proof.drawEpoch,shot_start_epoch:run.currentCycle.startedAt});ShotIntent?.consumeDraw?.(shotIntent);}
    }
  }
  // BLE43894 continuity fallback: bow-plane geometry is strong evidence, but not a universal hard
  // gate for preload/draw-first technique. If the lifecycle has stayed in one physical shot and the
  // frozen detector has matured through Anchor/Hold with visible shooting posture, certify that
  // same cycle without inventing a new shot. This is never Anchor-only: native Draw must already
  // exist in the cycle/native timeline.
  const early=run.currentCycle,life=lastSideInputDiag?.sideLifecycle||null;
  if(early?.active&&!early?.intentProof?.verified&&life?.shotActive===true&&(life.drawIntent===true||life.preloadIntent===true)){
    const nativeRows=C.normalizeTimeline(m?.phaseTimeline||[],null),hasDraw=(early.timeline||[]).some(e=>e.phase==='Draw')||nativeRows.some(e=>e.phase==='Draw');
    const mature=['Anchor','Aim / Hold','Expansion'].includes(phase)||nativeRows.some(e=>['Anchor','Aim / Hold'].includes(e.phase));
    const lateral=C.num(lastSideInputDiag?.bowWristRelX),arm=C.num(lastSideInputDiag?.bowArmDeg),extended=lastSideInputDiag?.phaseBowExtended===true;
    const plausiblePlane=extended||(lateral!==null&&Math.abs(lateral)>=.30)||(arm!==null&&arm>=132&&life.raiseIntent===true);
    const visible=lastSideInputDiag?.phaseShootingPosture===true&&lastSideInputDiag?.drawSideVisible!==false&&(C.num(lastSideInputDiag?.phaseQuality)||0)>=.55;
    if(hasDraw&&mature&&visible&&plausiblePlane&&epoch-Number(early.startedAt||epoch)<=12000){early.intentProof={...(early.intentProof||{}),verified:true,continuityVerified:true,bowPlaneReady:lastSideInputDiag?.bowPlaneReady===true,source:'lifecycle+native-mature-continuity',drawEpoch:(early.timeline||[]).find(e=>e.phase==='Draw')?.epochMs||nativeRows.find(e=>e.phase==='Draw')?.epochMs||epoch,planeEpoch:lastSideInputDiag?.bowPlaneReady===true?epoch:null,lateStart:true};pinEvent('cycle_intent_verified',{cycle_id:early.id,source:early.intentProof.source,draw_epoch:early.intentProof.drawEpoch,shot_start_epoch:early.startedAt});ShotIntent?.consumeDraw?.(shotIntent);}
  }
  updateLiveEvidenceFromMetrics(m);const c=run.currentCycle;if(!c?.active)return;
  if(registry.side.generation!==c.sideGeneration)c.generationMismatch=true;
  // BLE43887 terminal truth: tentative native Release must not be banked into the cycle timeline.
  // The frozen core is allowed to validate/contradict internally; only an atomic transaction
  // (Release + post-release evidence + shotComplete) may advance the public/captured timeline.
  const terminalProven=m?.releaseConfirmed===true&&m?.postReleaseEvidence===true&&m?.shotComplete===true;
  const provided=C.normalizeTimeline(m?.phaseTimeline||[],C.num(m?.releaseEpochMs)).filter(e=>e.epochMs>=c.startedAt-220&&(terminalProven||!['Release','Follow Through'].includes(String(e?.phase||''))));for(const e of provided)c.timeline=C.mergePhaseEvent(c.timeline,e.phase,e.epochMs,e.confidence);
  if(terminalProven||!['Release','Follow Through'].includes(phase)){c.timeline=C.mergePhaseEvent(c.timeline,phase,epoch,C.num(m?.phaseQuality));window.TemporalEvidenceLayer?.phase?.('side',phase,epoch);}
  if(terminalProven){c.releaseEpochMs=C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs)||epoch;c.timeline=C.mergePhaseEvent(c.timeline,'Release',c.releaseEpochMs,C.num(m?.releaseQuality));if(phase==='Follow Through'||m?.followThroughConfirmed)c.timeline=C.mergePhaseEvent(c.timeline,'Follow Through',epoch,C.num(m?.phaseQuality));}
  if(m?.followThroughEnded){c.followEnd=C.num(m?.followThroughEndEpochMs)||epoch;c.active=false;pinCycleDiagnostics(c,'recovery',c.followEnd);run.cycles.push({...c,timeline:[...c.timeline]});if(run.cycles.length>80)run.cycles.shift();pinEvent('cycle_recovery',{cycle_id:c.id,end:c.followEnd});window.TemporalEvidenceLayer?.endCycle?.('recovery');resetContinuityGuard();if(c.captureCommitted)completeSuccessfulRearm(c.followEnd);else{ShotIntent?.reset?.(shotIntent,{neutralAt:c.followEnd});requireRearm('uncaptured-recovery');}setTimeout(releaseViewportGeometry,120);}
  if(m?.letDown&&!c.releaseEpochMs){
    if(diagNeutralReady()){finishLetDownCycle('native-let-down-neutral',epoch);return;}
    if(!c.letDownPendingAt||epoch-c.letDownPendingAt>500){c.letDownPendingAt=epoch;pinEvent('cycle_let_down_pending',{cycle_id:c.id,epoch,phase});}
  }
  if(c.active&&c.releaseEpochMs&&['Setup','Set'].includes(phase)&&epoch-c.releaseEpochMs>450){c.incompleteRecovery=true;c.active=false;c.endedAt=epoch;pinCycleDiagnostics(c,'incomplete-recovery',epoch);run.cycles.push({...c,timeline:[...c.timeline]});if(run.cycles.length>80)run.cycles.shift();pinEvent('cycle_closed_without_recovery',{cycle_id:c.id});window.TemporalEvidenceLayer?.endCycle?.('incomplete-recovery');resetContinuityGuard();ShotIntent?.reset?.(shotIntent,{neutralAt:epoch});requireRearm('incomplete-recovery');setTimeout(releaseViewportGeometry,80);}
  if(c.active&&['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'].includes(phase))freezeViewportGeometry();
}
function prepareSideInput(input,previousResult=null){
  const q=C.num(input?.phaseQuality)||0;
  const wrist=C.num(input?.phaseDrawWristVisibility??input?.drawWristVisibility)||0;
  const elbow=C.num(input?.phaseDrawElbowVisibility??input?.drawElbowVisibility)||0;
  const native=input?.setReady===true;
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const visualBowExtended=input?.phaseBowExtended===true||input?.bowExtended===true||(C.finite(input?.bowArmDeg)&&Number(input.bowArmDeg)>=136);
  const mode=currentActivityMode(),requiresBowExtension=true;
  // BLE43895: Overhead is a positive-only, timestamp-matched observer. It never gates Side,
  // never supplies negative evidence, and never originates a phase/Release/Capture.
  let multiViewCorroboration=null;
  if(MultiView&&multiViewState&&registry.overhead.active){
    const epoch=C.num(input?.epochMs)||Date.now();
    const near=window.PoseEngine?.getMetricsNearEpoch?.('overhead',epoch,180)||null;
    multiViewCorroboration=MultiView.corroborate(multiViewState,input,near?.metrics||null,near?.deltaMs,epoch);
  }else if(MultiView&&multiViewState){
    multiViewCorroboration=MultiView.corroborate(multiViewState,input,null,null,C.num(input?.epochMs)||Date.now());
  }
  // BLE438941 trust-first ordering: ShotIntent evaluates real shot-plane geometry BEFORE the
  // lifecycle observer. Ordinary arm/face movement may be internally provisional, but it cannot
  // promote athlete-facing Setup/Draw without these geometry/admission diagnostics.
  const intent=ShotIntent&&shotIntent?ShotIntent.admission(shotIntent,input,C.num(input?.epochMs)||Date.now()):null;
  const drawSideVisible=intent?.drawSideVisible??(wrist>=.30&&elbow>=.28);
  const nativeReady=intent?.nativeReady??(native&&q>=.25&&drawSideVisible);
  const fallback=intent?.visualFallback??false;
  let ready=intent?.ready??nativeReady,source=intent?.source||(nativeReady?'native+shot-plane':'none');
  const lifeInput={...(input||{}),setAdmissionReady:ready,shotIntentReady:ready,bowPlaneReady:intent?.bowPlaneReady===true,bowPlaneStable:intent?.bowPlaneStable===true,neutralEvidence:intent?.neutralEvidence===true,drawSideVisible};
  if(SideLife&&sideLife){const lr=SideLife.update(sideLife,lifeInput,previousResult,C.num(input?.epochMs)||Date.now());sideLife=lr.state;if(lr.event)pendingLifecycleEvent=lr.event;}
  continuityResetEvidence(input);
  if(rearmRequired){
    const trust=input?.criticalTrackingOK!==false&&(q>=.20||wrist>=.20||elbow>=.20);
    const neutral=trust&&(!posture||!visualBowExtended||(C.finite(input?.bowArmDeg)&&Number(input.bowArmDeg)<125));
    if(neutral){
      const t=C.num(input?.epochMs)||Date.now();if(rearmNeutralSince===null){rearmNeutralSince=t;rearmNeutralSamples=1;}else rearmNeutralSamples++;
      if(rearmNeutralSamples>=3&&t-rearmNeutralSince>=100){const reason=rearmReason;rearmRequired=false;rearmNeutralSince=null;rearmNeutralSamples=0;rearmReason=null;forceEngineReset=true;ShotIntent?.reset?.(shotIntent,{neutralAt:t});pinEvent('rearm_ready',{reason,mode:'verified-neutral-edge'});window.FoundationGuardLayer?.markRecoveryReady?.(t);}
    }else{rearmNeutralSince=null;rearmNeutralSamples=0;}
    if(rearmRequired){ready=false;source='rearm-wait-neutral-edge';}
  }

  let prepared=ready===native?input:{...input,setReady:ready};
  const shotIntentVerified=!!(run.currentCycle?.active&&run.currentCycle?.intentProof?.verified&&(run.currentCycle?.intentProof?.bowPlaneReady||run.currentCycle?.intentProof?.continuityVerified));
  prepared={...prepared,physicalSetReady:native,shotIntentVerified,debugShotIntentVerified:shotIntentVerified,multiViewCorroboration};
  // BLE4.3.8.6 false-Draw guard: capture proof is classifier-independent. A normal bow-side raise
  // may enter Set, but pre-draw motion is never banked until the visual bow-side arm is extended.
  // This preserves the mature X2.8.2 core while preventing activity guesses from loosening Draw.
  const currentPhase=previousResult?.phase||'Setup';
  const lifeSnap=sideLife?.lastSnapshot||null;
  const flexibleDrawIntent=!!(lifeSnap?.shotActive&&(lifeSnap?.drawIntent||lifeSnap?.mode==='draw-building'||lifeSnap?.mode==='setup-draw-overlap'));
  const drawGuardActive=currentPhase==='Set'&&requiresBowExtension&&!visualBowExtended&&!flexibleDrawIntent;
  if(drawGuardActive){
    prepared={...prepared,shootingPosture:false,phaseShootingPosture:false,faceVelocity:0,drawSpeed:0,faceHandSpeed:0,worldFaceHandSpeed:0};
    source=`${source}+draw-locked-bow-not-extended`;
  }
  lastSideInputDiag={epochMs:C.num(input?.epochMs),nativeSetReady:native,nativeReady,setAdmissionReady:ready,setAdmissionSource:source,rearmRequired,activityMode:mode,bothHandsReady:ready,drawSideVisible,drawGuardActive,phaseQuality:q,phaseShootingPosture:posture,phaseBowExtended:visualBowExtended,bowPlaneReady:intent?.bowPlaneReady??null,bowPlaneStable:intent?.bowPlaneStable??null,neutralEvidence:intent?.neutralEvidence??null,bowWristRelX:intent?.bowWristRelX??C.num(input?.bowWristRel?.x),bowWristRelY:intent?.bowWristRelY??C.num(input?.bowWristRel?.y),shotIntentVerified,phaseFaceDist:C.num(input?.phaseFaceDist),phaseDrawWristVisibility:wrist,phaseDrawElbowVisibility:elbow,bowArmDeg:C.num(input?.bowArmDeg),wristsLow:input?.wristsLow===true,sideLifecycle:lifeSnap?{...lifeSnap}:null,multiViewCorroboration:multiViewCorroboration?{...multiViewCorroboration}:null};
  return prepared;
}
function displayTimeline(events,releaseEpoch=null){return C.normalizeTimeline(events||[],releaseEpoch).map(e=>({...e,phase:SideLife?.displayPhase?.(e.phase)||e.phase,internalPhase:e.phase}));}
function cleanShotMetrics(m){const c=run.currentCycle;const release=C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs)||Date.now();let tl=C.normalizeTimeline(c?.timeline||m?.phaseTimeline||[],release);if(!tl.some(e=>e.phase==='Release'))tl=C.mergePhaseEvent(tl,'Release',release,C.num(m?.releaseQuality));return{...m,role:'side',phaseTimeline:tl,evidenceRoles:ROLES.filter(role=>registry[role].active),captureRunId:run.id,cameraGeneration:registry.side.generation};}
function installCoreAuthority(){
  const CE=window.CoreEngine;if(!CE||CE.__ciAuthorityWrapped)return;CE.__ciAuthorityWrapped=true;
  originalCore.factory=CE.createAthleteShotEngine;originalCore.tracker=CE.AuthorityTracker;originalCore.select=CE.selectAuthorityRole;
  if(typeof originalCore.factory==='function')CE.createAthleteShotEngine=function(...args){
    const inner=originalCore.factory(...args);let sideResult=null,sideSeen=false;
    const A=window.AdaptiveReleaseCore,adaptive=A?.fresh?.()||null;
    return{update(role,input){
      if(role==='side'){
        sideSeen=true;
        const previousSideResult=sideResult;
        // BLE43891 lifecycle authority: consume the frozen-engine reset BEFORE the current camera
        // frame is evaluated. The lifecycle observer then receives the previous terminal/let-down
        // result plus this current frame, so the first post-rearm Set frame is not thrown away.
        if(forceEngineReset){forceEngineReset=false;sideResult=null;inner.reset?.();A?.reset?.(adaptive);SideLife?.reset?.(sideLife);AnchorBridge?.reset?.(anchorBridge);pendingLifecycleEvent=null;}
        const prepared=prepareSideInput(input||{},previousSideResult);
        // A continuity-abort can be discovered while preparing THIS frame. Preserve the mature
        // same-frame reset behavior for that exceptional path; normal recovery/let-down rearm was
        // already consumed above, so its first fresh Set frame remains available to SideLifecycle.
        if(forceEngineReset){forceEngineReset=false;sideResult=null;inner.reset?.();A?.reset?.(adaptive);SideLife?.reset?.(sideLife);AnchorBridge?.reset?.(anchorBridge);pendingLifecycleEvent=null;}
        const br=AnchorBridge&&anchorBridge?AnchorBridge.update(anchorBridge,prepared,previousSideResult,lastSideInputDiag||{},prepared?.epochMs||prepared?.now||Date.now()):null;
        if(br?.state)anchorBridge=br.state;if(lastSideInputDiag&&br?.snapshot)lastSideInputDiag.anchorBridge={...br.snapshot};
        const engineInput=br?.engineInput||prepared;
        const nativeResult=inner.update(role,engineInput);sideResult=nativeResult;
        // Adaptive Release must always see untouched camera geometry. The Anchor Bridge is phase admission only.
        if(A&&adaptive){const r=A.update(adaptive,nativeResult,prepared,prepared?.epochMs||prepared?.now||Date.now(),inner.latestResults?.side);if(lastSideInputDiag){lastSideInputDiag.adaptiveReleaseDecision=adaptive?.lastDecision||null;lastSideInputDiag.nativePostValidation=adaptive?.nativePostWitness?{...adaptive.nativePostWitness}:null;const hw=adaptive?.holdWatchCandidate;lastSideInputDiag.holdReleaseWatch=hw?{seenAt:hw.seenAt,epochMs:hw.epochMs,score:hw.score,channels:hw.channels,rearPositive:hw.rearPositive,facePositive:hw.facePositive,speedSupport:hw.speedSupport,elbowSupport:hw.elbowSupport,directionalFrames:hw.directionalFrames,maxPostFaceDelta:hw.maxPostFaceDelta,minPostFaceDelta:hw.minPostFaceDelta,maxBow:hw.maxBow}:null;}if(r?.override&&r.patch)sideResult={...nativeResult,...r.patch};}
        // Same-frame lifecycle reconciliation removes the old one-pose-frame Live Phase lag without
        // re-running motion classification. Adaptive pending Release remains Aim/Hold, so this cannot
        // expose an unverified Release merely because the frozen detector flickered terminal.
        if(SideLife&&sideLife){const rr=SideLife.reconcileResult?.(sideLife,sideResult,prepared?.epochMs||prepared?.now||Date.now());if(rr?.state)sideLife=rr.state;if(lastSideInputDiag&&rr?.snapshot)lastSideInputDiag.sideLifecycle={...rr.snapshot};
          // BLE438954 PhaseTruthGuard: expose only lifecycle-authorized non-terminal phases.
          // The frozen classifier may hypothesize Anchor/Hold early, but Review/Capture evidence
          // must not inherit a phase that the physical lifecycle has not yet verified.
          const auth=rr?.snapshot?.authorityPhase||sideLife?.authorityPhase||null;
          const rank=['Set','Setup','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through','Recovery'];
          const ar=rank.indexOf(String(auth||'')),pr=rank.indexOf(String(sideResult?.phase||sideResult?.primaryPhase||''));
          if(sideResult?.releaseConfirmed!==true&&sideResult?.shotComplete!==true&&ar>=2&&pr>ar){
            sideResult={...sideResult,phase:auth,primaryPhase:auth,phaseTimeline:(Array.isArray(sideResult?.phaseTimeline)?sideResult.phaseTimeline:[]).filter(e=>rank.indexOf(String(e?.phase||''))<=ar)};
          }
        }
        return sideResult;
      }
      const x=sideResult||{};return{...x,phase:x.phase||'Setup',primaryPhase:x.primaryPhase||x.phase||'Setup',holdTimeS:x.holdTimeS??null,armed:false,didRelease:false,releaseConfirmed:false,releaseCandidate:false,shotComplete:false,followThroughEnded:false,letDown:false,releaseEventId:0,shotCompleteEventId:0,phaseTimeline:Array.isArray(x.phaseTimeline)?x.phaseTimeline.map(e=>({...e,role:'side'})):[]};
    },reset(){sideResult=null;sideSeen=false;A?.reset?.(adaptive);SideLife?.reset?.(sideLife);AnchorBridge?.reset?.(anchorBridge);pendingLifecycleEvent=null;return inner.reset?.();},getAuthorityRole(){return sideSeen?'side':null;}};
  };
  if(typeof originalCore.tracker==='function')CE.AuthorityTracker=class{constructor(){this.role=null;}update(metrics){const live=!!document.getElementById('sideVideo')?.srcObject;if(live&&metrics?.side?.detected){this.role='side';return{role:'side',score:1,reason:'Side Shot Process Authority'};}this.role=null;return{role:null,score:0,reason:'Side authority unavailable'};}getRole(){return this.role;}reset(){this.role=null;}};
  CE.selectAuthorityRole=function(metrics){const s=metrics?.side,live=!!document.getElementById('sideVideo')?.srcObject;if(live&&s?.detected)return{role:'side',score:typeof CE.evidenceScore==='function'?CE.evidenceScore(s):1,reason:'Side Shot Process Authority'};return{role:null,score:0,reason:'Side authority unavailable'};};
}
function restoreReadiness(){const side=lastSideMetrics,el=$('#shotReadiness'),ov=$('#shotReadinessOverlay');if(!el&&!ov)return;if(!registry.side.active){const t='Side camera required for Auto Capture · Rear/Overhead are evidence only';if(el){el.textContent=t;el.className='readiness-chip warn';}if(ov){ov.textContent=t;ov.className='readiness-overlay warn';}return;}if(!side?.detected)return;}
function wrapFormAnalyzer(){
  const FA=window.FormAnalyzer;if(!FA||wrappedFA)return false;wrappedFA=true;
  const original={onPoseMetrics:FA.onPoseMetrics,updateLivePhase:FA.updateLivePhase,onShotEvidence:FA.onShotEvidence};
  FA.onPoseMetrics=function(role,m){trace(role,m);if(role==='side'){lastSideMetrics=m||null;if(registry.side.active)addSidePhase(m);updateLiveEvidenceFromMetrics(m);}const out=original.onPoseMetrics?.(role,m);if(role!=='side')queueMicrotask(restoreReadiness);return out;};
  FA.updateLivePhase=function(phase,m){if((m?.role||'side')!=='side')return;return original.updateLivePhase?.(phase,m);};
  FA.onShotEvidence=function(m){
    if((m?.role||'side')==='side')updateLiveEvidenceFromMetrics(m);
    if((m?.role||'side')!=='side'){pinEvent('aux_shot_veto',{role:m?.role||null,release:C.num(m?.releaseEpochMs)});restoreReadiness();return;}
    if(!registry.side.active){pinEvent('shot_veto',{reason:'side_closed'});restoreReadiness();return;}
    let c=run.currentCycle;
    if(!cycleIntentVerified(c))c=recoverOrRepairCycleFromTrace(m,c);
    if(c?.generationMismatch||(c&&c.sideGeneration!==registry.side.generation)){pinEvent('shot_veto',{reason:'side_generation_changed',cycle_generation:c?.sideGeneration,current_generation:registry.side.generation});const t='Capture vetoed · Side camera changed during shot';const el=$('#shotReadiness');if(el){el.textContent=t;el.className='readiness-chip warn';}window.FoundationGuardLayer?.lockRejectedRelease?.('side-generation',m);return;}
    const release=C.num(m?.releaseEpochMs||m?.releaseAlignedEpochMs)||Date.now(),cycleId=c?.id||null;
    const phases=(c?.timeline||[]).map(e=>String(e?.phase||''));
    const intentOK=cycleIntentVerified(c);
    if(!intentOK){pinEvent('shot_veto',{reason:'shot_intent_not_verified',cycle_id:cycleId,release,phases});const t='Capture blocked · verified Draw→Anchor→Hold shot transaction not found';const el=$('#shotReadiness');if(el){el.textContent=t;el.className='readiness-chip warn';}window.FoundationGuardLayer?.lockRejectedRelease?.('shot-intent',m);return;}
    if((cycleId&&capturedCycleIds.has(cycleId))||(lastCapturedReleaseEpoch!==null&&Math.abs(release-lastCapturedReleaseEpoch)<900&&(!cycleId||cycleId===lastCapturedCycleId))){pinEvent('shot_veto',{reason:'duplicate_release_same_cycle',cycle_id:cycleId,release});restoreReadiness();return;}
    if(cycleId){capturedCycleIds.add(cycleId);if(capturedCycleIds.size>120){const keep=[...capturedCycleIds].slice(-60);capturedCycleIds.clear();keep.forEach(x=>capturedCycleIds.add(x));}c.captureCommitted=true;c.captureReleaseEpoch=release;}
    lastCapturedReleaseEpoch=release;lastCapturedCycleId=cycleId;pinEvent('capture_committed',{cycle_id:cycleId,release});
    window.TemporalEvidenceLayer?.release?.(m,cycleId);
    const out=original.onShotEvidence?.(cleanShotMetrics(m));
    queueMicrotask(()=>window.FoundationGuardLayer?.markCaptureComplete?.(release));
    return out;
  };
  window.CaptureIntegrityLayer.originalFormAnalyzer=original;return true;
}
function openEvidenceDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('3pm-form-analyzer-shot-evidence-v1',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function evidenceRowsForSession(sessionId){if(!sessionId)return[];try{const db=await openEvidenceDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('shotEvidence','readonly'),st=tx.objectStore('shotEvidence'),idx=st.index('sessionId'),req=idx.getAll(Number(sessionId));req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return[];}}
async function evidenceRecord(shotId,role,sessionId){const rows=await evidenceRowsForSession(sessionId),matching=rows.filter(r=>Number(r.shotId)===Number(shotId)&&r.role===role);return matching.sort((a,b)=>String(b.key||'').split(':').length-String(a.key||'').split(':').length)[0]||null;}
function advancedForShot(id){for(const k of [`3pm-advanced-v500d3-shot-${id}`,`3pm-advanced-v500d2-shot-${id}`,`3pm-advanced-v500d1-shot-${id}`]){try{const raw=localStorage.getItem(k);if(raw)return JSON.parse(raw);}catch{}}return null;}
function selectedShotId(){return Number(document.querySelector('.shot-row-v34.selected')?.dataset?.id)||null;}
function reviewRole(){return document.querySelector('.review-role-btn.active')?.dataset?.reviewRole||'side';}
function setReplayIndex(i){const s=$('#shotReplaySlider');if(!s||s.disabled||!Number.isFinite(Number(i)))return;s.value=String(i);s.dispatchEvent(new Event('input',{bubbles:true}));}
function ensureContractPanel(){let p=$('#captureEvidenceContract');if(p)return p;const bar=$('.review-control-bar');if(!bar)return null;p=document.createElement('div');p.id='captureEvidenceContract';p.className='capture-evidence-contract';bar.insertAdjacentElement('afterend',p);return p;}
async function renderContract(){
  const p=ensureContractPanel(),id=selectedShotId();if(!p)return;if(!id){p.innerHTML='<span class="muted">Evidence Contract · select a shot</span>';return;}const role=reviewRole()==='multi'?'side':reviewRole(),sid=currentSessionId(),rec=await evidenceRecord(id,role,sid),adv=advancedForShot(id);if(!rec){p.innerHTML=`<b>Evidence Contract</b><span class="ci-contract-missing">${role.toUpperCase()} · no persisted Full Shot Evidence</span>`;return;}const c=C.evidenceContract(rec,adv),labels={draw:'Draw',anchor:'Anchor',hold:'Hold',expansion:'Expansion',release:'Release T0',follow:'Follow-through',recovery:'Recovery'};
  const optionalText=(k,v)=>!v.optional?'':k==='expansion'?' · not visually resolved':k==='recovery'?' · optional / not observed':' · optional / not observed';
  const buttons=Object.entries(c.stages).map(([k,v])=>`<button type="button" class="ci-phase ${v.ok?'ok':v.optional?'optional':'missing'}" ${v.index===null?'disabled':''} data-ci-index="${v.index??''}">${v.ok?'✓':v.optional?'—':'✕'} ${labels[k]}${optionalText(k,v)}</button>`).join('');
  const notObserved=(c.notObserved||[]).map(x=>x==='expansion'?'Expansion not visually resolved':x==='recovery'?'Recovery not observed (optional)':`${labels[x]||x} not observed`).join(' · ');
  p.innerHTML=`<div class="ci-contract-head"><b>Shot Evidence Contract · ${role.toUpperCase()}</b><span class="${c.complete?'good':'warn'}">${c.complete?'COMPLETE':`INCOMPLETE · ${c.missing.join(', ')}`}${notObserved?` · ${notObserved}`:''}${C.finite(c.releaseDeltaMs)?` · T0 Δ${Math.round(c.releaseDeltaMs)}ms`:''}</span></div><div class="ci-phase-row">${buttons}</div>`;
  p.querySelectorAll('[data-ci-index]').forEach(b=>b.addEventListener('click',()=>setReplayIndex(Number(b.dataset.ciIndex))));
}
async function evidenceManifestCurrentRun(){
  const rows=await evidenceRowsForSession(run.sessionId),start=Number(run.startedAt)||0,end=Number(run.endedAt)||Date.now();return rows.filter(r=>{const t=Date.parse(r.createdAt||'');return Number.isFinite(t)&&t>=start-2500&&t<=end+2500;}).map(r=>{const frames=Array.isArray(r.frames)?r.frames:[],release=C.num(r.releaseEpochMs),zones={};frames.forEach(f=>{const z=String(f.evidenceZone||'legacy');zones[z]=(zones[z]||0)+1;});const offsets=frames.map(f=>Math.round(Number(f.offsetMs))).filter(Number.isFinite),nearest=offsets.length?offsets.reduce((a,b)=>Math.abs(b)<Math.abs(a)?b:a):null;return{shot_id:Number(r.shotId)||null,role:r.role||null,frame_count:frames.length,start_offset_ms:offsets.length?Math.min(...offsets):null,end_offset_ms:offsets.length?Math.max(...offsets):null,nearest_release_offset_ms:nearest,anchor_offset_ms:C.safeOffset(r.anchorFocusEpochMs||r.anchorSettledEpochMs||r.anchorEpochMs,release),anchor_acquisition_offset_ms:C.safeOffset(r.anchorEpochMs,release),anchor_settled_offset_ms:C.safeOffset(r.anchorSettledEpochMs,release),anchor_focus_offset_ms:C.safeOffset(r.anchorFocusEpochMs,release),follow_through_end_epoch_ms:C.num(r.followThroughEndEpochMs),capture_kind:r.captureKind||null,zones,offsets_ms:offsets,frame_manifest:frames.map(f=>({epoch_ms:C.num(f.epochMs),offset_ms:C.num(f.offsetMs),zone:f.evidenceZone||null,tags:f.evidenceTags||[],source:f.source||null})),contract:C.evidenceContract(r,advancedForShot(r.shotId))};}).sort((a,b)=>(a.shot_id||0)-(b.shot_id||0)||String(a.role).localeCompare(String(b.role)));
}
function downloadJson(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function exportCleanTrace(){if(!run.id){window.alert?.('No camera run is available yet. Start Live and test at least one run before exporting.');return;}const evidence_records=await evidenceManifestCurrentRun();const payload={format:'3PM Archery Form Analyzer Capture Integrity Trace',integration_version:BUILD_VERSION,package_id:'3PM_Analyzer_Mac_20260930_R7_TransactionRepair',release_arbitration_version:window.AdaptiveReleaseCore?.VERSION||null,generated_at:nowIso(),run_id:run.id,run_started_at:new Date(run.startedAt).toISOString(),run_ended_at:run.endedAt?new Date(run.endedAt).toISOString():null,session_id:run.sessionId,athlete:window.FormAnalyzer?.getCurrentAthlete?.()||null,environment:window.TemporalEvidenceLayer?.browserInfo?.()||{user_agent:navigator.userAgent||null},policy:{shot_process_authority:'side',auxiliary_roles:['rear','overhead'],display_geometry_freeze:'active-shot-only',camera_quality_gates_capture:false,selected_shot_metrics:'snapshot-isolated-from-live-pose',ui_layout:'fixed-diagnostic-footprint',temporal_evidence:'native-avfoundation-primary-browser-fallback',cycle_rearm:'provisional motion stays Set; verified Setup may abort to Set; verified Draw+ is monotonic; terminal lock + neutral-confirmed let-down -> Set/Ready',phase_semantics:'phase/timeline are frozen internal names; displayPhase/display_timeline are athlete-facing Set -> Setup -> Draw semantics; lifecycleAuthorityPhase is terminal-safe diagnostic authority',activity_detection:'diagnostic-only-hidden-never-gates-capture',activity_mode:currentActivityMode(),activity_classifier:activityClassifierSnapshot(),foundation_capture_gate:'camera-only full path; false-start provisional gate + shot-plane OR sustained mature shot continuity + Draw/Anchor/Hold; persistent multi-channel Release pending; Expansion optional/no minimum visible travel; neutral-confirmed let-down remains 0 Capture'},foundation_guard:window.FoundationGuardLayer?.traceState?.()||null,camera_registry:cameraSnapshot(),camera_registry_current:cameraSnapshot(),camera_registry_last_active:run.lastActiveCameraSnapshot||null,camera_events:run.events,shot_cycles:run.cycles.map(c=>{const timeline=C.normalizeTimeline(c.timeline,c.releaseEpochMs);return{...c,diagnostics:undefined,timeline,display_timeline:displayTimeline(timeline,c.releaseEpochMs)};}),pinned_diagnostics:run.diagnosticClips,evidence_records,trace:run.trace};downloadJson(`3PM_capture_integrity_trace_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,payload);}
function replaceExportButton(){const old=$('#exportPhaseTraceBtn');if(!old||old.dataset.ciReplaced)return;const b=old.cloneNode(true);b.dataset.ciReplaced='1';b.textContent='Export Capture Trace';old.replaceWith(b);b.addEventListener('click',exportCleanTrace);}
function installUI(){document.body.classList.add('capture-integrity-stable');replaceExportButton();ensureContractPanel();updateCameraUI();}
window.CaptureIntegrityLayer={recordGateOutcome:(stage,gate,m)=>pinEvent(stage==='recovery-storage'?'evidence_save_failed':'shot_veto',{stage,reason:gate?.reason||'rejected',missing:gate?.missing||[],cycle_id:run.currentCycle?.id||null,release:C.num(m?.releaseEpochMs)}),version:VERSION,buildVersion:BUILD_VERSION,registry,run:()=>run,isRearmRequired:()=>rearmRequired,inputDiag:()=>lastSideInputDiag?{...lastSideInputDiag}:null,cameraSnapshot,evidenceContract:(...args)=>C.evidenceContract(...args),liveEvidenceState:()=>({...liveEvidence}),exportCleanTrace,freezeViewportGeometry,releaseViewportGeometry,installFormAnalyzer:wrapFormAnalyzer};
installCoreAuthority();
// App and admission guard are normal scripts; poll briefly so the final wrapped FormAnalyzer
// is installed before the deferred pose module starts producing frames.
const fastWrap=setInterval(()=>{if(wrapFormAnalyzer())clearInterval(fastWrap);},10);setTimeout(()=>clearInterval(fastWrap),2500);
for(const eventName of ['3pm-temporal-evidence-updated','3pm-evidence-persisted'])window.addEventListener?.(eventName,e=>{const rel=C.num(e?.detail?.releaseEpochMs);if(rel!==null&&liveEvidence.releaseEpoch&&Math.abs(rel-liveEvidence.releaseEpoch)<=450){const token=liveEvidence.pollToken;void pollLiveEvidence(liveEvidence.releaseEpoch,token,0);}});
const boot=()=>{installUI();resetLiveEvidence();wrapFormAnalyzer();refreshRegistry();setInterval(refreshRegistry,220);setInterval(()=>{wrapFormAnalyzer();renderContract();},700);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50),{once:true});else setTimeout(boot,50);
})();
