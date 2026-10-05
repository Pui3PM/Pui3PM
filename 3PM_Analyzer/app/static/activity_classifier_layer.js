// 3PM BLE4.3.8.6 Experimental Activity Classifier Layer
// Hidden diagnostic only. It does NOT auto-run in normal Live use and never gates Capture.
// Developers can opt in with localStorage['3pm-experimental-activity-detection']='1'.
import { FilesetResolver, PoseLandmarker } from '/static/vendor/mediapipe/vision_bundle.mjs';

const C=window.ActivityClassifierCore;
if(C){
  const MODEL_URL='/static/models/pose_landmarker_lite.task';
  const WASM_ROOT='/static/vendor/mediapipe/wasm';
  const W=320;
  const AUTO_DIAGNOSTIC=(()=>{try{return localStorage.getItem('3pm-experimental-activity-detection')==='1';}catch{return false;}})();
  let state=C.fresh(),fileset=null,landmarker=null,running=AUTO_DIAGNOSTIC,busy=false,lastTs=0,lastDetectedAt=0,lastSnap=C.snapshot(state),lastVisual=null,error=null;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=180;
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true,desynchronized:true});
  const $=s=>document.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function sideVideo(){return $('#sideVideo');}
  function mainMetrics(){return window.PoseEngine?.getLatestMetrics?.('side')||null;}
  function realSensorState(){
    try{const s=window.ThreePMBowSensor?.getState?.()||{};return{connected:!!s.connected,deviceId:s.deviceId||null,dataMode:s.dataMode||null,lastPacketAgeMs:s.lastPacketMs?Math.max(0,Date.now()-Number(s.lastPacketMs)):Infinity};}
    catch{return{connected:false,deviceId:null,dataMode:null,lastPacketAgeMs:Infinity};}
  }
  function rightHanded(m){return !String(m?.handedness||window.FormAnalyzer?.getCurrentAthlete?.()?.handedness||'Right-handed').toLowerCase().startsWith('left');}
  function choosePose(list){
    if(!Array.isArray(list)||!list.length)return null;let best=null,bestScore=-1;
    for(const lm of list){const a=lm?.[11],b=lm?.[12];if(!a||!b)continue;const span=Math.hypot((a.x-b.x)||0,(a.y-b.y)||0),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,vis=Math.min(Number(a.visibility??1),Number(b.visibility??1));const centre=1-clamp(Math.hypot(cx-.5,(cy-.46)*.8)/.75,0,1),score=span*2.8+vis*.45+centre*.25;if(score>bestScore){bestScore=score;best=lm;}}
    return best||list[0];
  }
  async function ensureModel(){
    if(landmarker)return landmarker;
    fileset=fileset||await FilesetResolver.forVisionTasks(WASM_ROOT);
    landmarker=await PoseLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:MODEL_URL},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45,outputSegmentationMasks:false});
    return landmarker;
  }
  function confidenceText(v){return `${Math.round(clamp(Number(v)||0,0,1)*100)}%`;}
  function render(snap=lastSnap){
    const pill=$('#activityDetectionPill')||$('#activityModePill'),help=$('#activityDetectionHelp')||$('#activityModeHelp');
    if(pill){
      if(error){pill.textContent='Activity · Detector unavailable';pill.className='status-pill bad activity-mode-pill';pill.title=String(error);}
      else if(snap.label==='unknown'||((snap.label==='real_bow'||snap.label==='elastic')&&snap.freshEvidence===false)){pill.textContent='Activity · Checking…';pill.className='status-pill neutral activity-mode-pill';pill.title='Automatic equipment classification · waiting for fresh eligible evidence';}
      else{pill.textContent=`Detected · ${snap.labelText} ${confidenceText(snap.confidence)}`;pill.className=`status-pill ${snap.confidence>=.78?'good':'warn'} activity-mode-pill`;pill.title=`Automatic detection from ${snap.source==='bow_sensor'?'Bow Sensor':'eligible multi-frame camera evidence'}`;}
    }
    if(help)help.textContent=error?'Automatic activity detector unavailable · Auto Capture stays paused for safety':snap.reason;
    document.body.dataset.detectedActivity=snap.label||'unknown';
  }
  function publish(snap){lastSnap=snap;render(snap);window.dispatchEvent(new CustomEvent('3pm:activity-detected',{detail:snap}));}
  function reset(reason='Waiting for Side camera'){state=C.fresh();state.reason=reason;lastVisual=null;publish(C.snapshot(state));}
  function sampleInterval(){
    const m=mainMetrics(),perf=window.PoseEngine?.getRoleHealth?.('side')?.performance||{},active=['side','rear','overhead'].filter(r=>{const v=document.getElementById(`${r}Video`);return !!(v?.srcObject&&v.readyState>=2)}).length;
    if(lastSnap.label!=='unknown'&&lastSnap.confidence>=.80)return active>1?1050:850;
    if(Number(perf.cost)>28||active>1)return 620;
    if(m?.phase==='Draw'||m?.phase==='Anchor'||m?.phase==='Aim / Hold')return 300;
    return 420;
  }
  async function sample(){
    if(!running||busy)return;busy=true;
    try{
      const sensor=realSensorState(),m=mainMetrics();
      if(sensor.connected&&sensor.deviceId&&!String(sensor.dataMode||'').includes('SYNTHETIC')&&sensor.lastPacketAgeMs<1800){
        const snap=C.update(state,{now:Date.now(),metrics:m||{},sensor});publish(snap);return;
      }
      const video=sideVideo();
      if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight){if(Date.now()-lastDetectedAt>1600)reset('Activity unknown · waiting for Side camera');return;}
      if(!m?.detected){if(Date.now()-lastDetectedAt>1800)reset('Activity unknown · waiting for a clearly tracked athlete');return;}
      lastDetectedAt=Date.now();
      const ratio=video.videoHeight/Math.max(1,video.videoWidth);canvas.width=W;canvas.height=Math.max(120,Math.min(240,Math.round(W*ratio)));ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const lmkr=await ensureModel(),ts=Math.max(performance.now(),lastTs+.1);lastTs=ts;const result=lmkr.detectForVideo(canvas,ts),lm=choosePose(result?.landmarks);
      const img=ctx.getImageData(0,0,canvas.width,canvas.height);lastVisual=C.extractVisualEvidence(img,lm,{rightHanded:rightHanded(m)});
      const snap=C.update(state,{now:Date.now(),metrics:m,sensor,visual:lastVisual});publish(snap);
    }catch(err){error=err?.message||String(err);console.warn('[3PM activity classifier]',err);render();}
    finally{busy=false;}
  }
  async function loop(){if(!running)return;await sample();setTimeout(loop,sampleInterval());}
  function getState(){return{...lastSnap,error:error||null,visual:lastVisual?{...lastVisual}:null};}
  window.ActivityClassifierLayer={version:C.VERSION,getState,reset,forceSample:sample,stop:()=>{running=false;},start:()=>{if(!running){running=true;loop();}},autoDiagnostic:AUTO_DIAGNOSTIC};
  const boot=()=>{render();if(AUTO_DIAGNOSTIC)setTimeout(loop,650);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
