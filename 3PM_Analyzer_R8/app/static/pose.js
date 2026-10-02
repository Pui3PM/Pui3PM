import { FilesetResolver, PoseLandmarker } from "/static/vendor/mediapipe/vision_bundle.mjs";

const POSE_BUILD_ID = "x2.3-release-guard";
const CAPTURE_ROLES = ["side", "rear", "overhead"];
const ROLES = ["side", "rear", "overhead", "analysis"];
const MODEL_URL = "/static/models/pose_landmarker_lite.task";
const WASM_ROOT = "/static/vendor/mediapipe/wasm";

const state = {
  enabled: true,
  overlayVisible: localStorage.getItem("3pm-skeleton-overlay") !== "off",
  ready: false,
  error: null,
  fileset: null,
  landmarkers: {side:null, rear:null, overhead:null, analysis:null},
  latest: {side:null, rear:null, overhead:null, analysis:null},
  smoothed: {side:null, rear:null, overhead:null, analysis:null},
  visualPose: {side:null, rear:null, overhead:null, analysis:null},
  renderSmoothed: {side:null, rear:null, overhead:null, analysis:null},
  poseFilters: {side:null, rear:null, overhead:null, analysis:null},
  bodyScale: {side:.14, rear:.14, overhead:.14, analysis:.14},
  inferenceLockedWidth: {side:null, rear:null, overhead:null, analysis:null},
  validation: {side:{}, rear:{}, overhead:{}, analysis:{}},
  baselines: {side:null, rear:null, overhead:null, analysis:null},
  motion: {side:{}, rear:{}, overhead:{}, analysis:{}},
  cycles: {side:null, rear:null, overhead:null, analysis:null},
  shotEngine: window.CoreEngine?.createAthleteShotEngine?.() || null,
  lastInference: {side:0, rear:0, overhead:0, analysis:0},
  lastVideoTime: {side:-1, rear:-1, overhead:-1, analysis:-1},
  running: true,
  recordingSessionId: null,
  recordingStartMs: null,
  logs: {side:[], rear:[], overhead:[]},
  lastLogMs: {side:0, rear:0, overhead:0},
  frameCount: 0,
  visualHealth: {side:null, rear:null, overhead:null, analysis:null},
  perf: {side:{}, rear:{}, overhead:{}, analysis:{}},
  metricHistory: {side:[], rear:[], overhead:[], analysis:[]},
  inferenceSurfaces: {side:null, rear:null, overhead:null, analysis:null},
  inferenceSize: {side:null, rear:null, overhead:null, analysis:null},
  appearanceSurfaces: {side:null, rear:null, overhead:null, analysis:null},
  frameMotion: {side:{}, rear:{}, overhead:{}, analysis:{}},
  athleteLock: {side:null, rear:null, overhead:null, analysis:null},
  lastDetectedAt: {side:0, rear:0, overhead:0, analysis:0},
  identity: {side:null, rear:null, overhead:null, analysis:null},
};

const authorityTracker = window.CoreEngine?.AuthorityTracker ? new window.CoreEngine.AuthorityTracker(.10,650) : null;


// Phase 0 narrow-thaw instrumentation seam.
// Default-off: production behavior must not depend on this hook. A developer-only
// harness may install window.__3PM_PHASE01_POSE_TRACE_CONFIG__ before this module
// loads. The seam identifies the exact object passed to detectForVideo, but it does
// not claim an immutable live raster when that object is an HTMLVideoElement.
const PHASE01_POSE_TRACE_CONFIG = (()=>{
  try{
    const cfg=window.__3PM_PHASE01_POSE_TRACE_CONFIG__;
    return cfg&&cfg.enabled===true&&typeof cfg.emit==="function"?cfg:null;
  }catch(_){return null;}
})();
let phase01PoseTraceSeq=0;
const PHASE01_POSE_TRACE_QUEUE=[];
let phase01PoseTraceFlushScheduled=false;
let phase01PoseTraceDropped=0;
function phase01PoseTraceImmutable(value){
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value;
  if(Array.isArray(value))return Object.freeze(value.map(phase01PoseTraceImmutable));
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=phase01PoseTraceImmutable(v);return Object.freeze(out);}
  return null;
}
function phase01PoseTraceSchedule(type,payload){
  if(!PHASE01_POSE_TRACE_CONFIG)return;
  try{
    if(PHASE01_POSE_TRACE_QUEUE.length>=128){PHASE01_POSE_TRACE_QUEUE.shift();phase01PoseTraceDropped++;}
    PHASE01_POSE_TRACE_QUEUE.push({type,payload:phase01PoseTraceImmutable({...payload,traceDroppedBefore:phase01PoseTraceDropped})});
    if(phase01PoseTraceFlushScheduled)return;phase01PoseTraceFlushScheduled=true;
    queueMicrotask(()=>{
      phase01PoseTraceFlushScheduled=false;
      while(PHASE01_POSE_TRACE_QUEUE.length){const item=PHASE01_POSE_TRACE_QUEUE.shift();try{PHASE01_POSE_TRACE_CONFIG.emit(item.type,item.payload);}catch(_){}}
    });
  }catch(_){/* trace must never change production control flow */}
}
function phase01PoseTraceInputKind(input,video){
  if(input===video)return "video-direct";
  const tag=String(input?.tagName||"").toLowerCase();
  if(tag==="canvas")return "canvas-snapshot";
  if(typeof VideoFrame!=="undefined"&&input instanceof VideoFrame)return "video-frame";
  return tag||input?.constructor?.name||"unknown";
}
function phase01PoseTracePrepare({role,input,video,ts,activeCount,authorityRole,started}){
  const token=`pose-${++phase01PoseTraceSeq}`;
  const inputKind=phase01PoseTraceInputKind(input,video);
  const rasterStableForSynchronousRead=inputKind==="canvas-snapshot"||inputKind==="video-frame";
  return {
    token,role,inputKind,rasterStableForSynchronousRead,
    exactRasterClaim:rasterStableForSynchronousRead?"same-input-object-sync-read-only":"blocked-live-direct-video",
    inferenceTimestamp:ts,
    startedPerformanceMs:started,
    activeCount,authorityRole:authorityRole||null,
    inputWidth:Number(input?.width||input?.videoWidth)||null,
    inputHeight:Number(input?.height||input?.videoHeight)||null,
    videoCurrentTime:Number.isFinite(video?.currentTime)?video.currentTime:null,
    videoReadyState:Number.isFinite(video?.readyState)?video.readyState:null,
    inferenceSize:state.inferenceSize[role]?{...state.inferenceSize[role]}:null
  };
}
function phase01PoseTraceComplete(trace,{result}){
  if(!PHASE01_POSE_TRACE_CONFIG||!trace)return;
  try{
    trace.inferenceResult={
      finishedPerformanceMs:performance.now(),
      landmarkSets:Array.isArray(result?.landmarks)?result.landmarks.length:0,
      worldLandmarkSets:Array.isArray(result?.worldLandmarks)?result.worldLandmarks.length:0
    };
  }catch(_){/* trace must never change production control flow */}
}
function phase01PoseTraceMetrics(trace,role,metrics){
  if(!PHASE01_POSE_TRACE_CONFIG||!trace)return;
  try{
    trace.metricsResult={
      role,phase:metrics?.phase??null,detected:metrics?.detected??null,armed:metrics?.armed??null,
      releaseCandidate:metrics?.releaseCandidate??null,shotComplete:metrics?.shotComplete??null,
      legacyMetricEpochMs:Number.isFinite(metrics?.epochMs)?metrics.epochMs:null
    };
  }catch(_){/* trace must never change production control flow */}
}
function phase01PoseTraceFlush(trace){
  if(!PHASE01_POSE_TRACE_CONFIG||!trace)return;
  const inference=trace.inferenceResult||{};const metrics=trace.metricsResult||null;
  phase01PoseTraceSchedule("pose.inference",{...trace,inferenceResult:undefined,metricsResult:undefined,...inference});
  if(metrics)phase01PoseTraceSchedule("pose.metrics",{token:trace.token,...metrics});
}

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
  [11,12],[11,13],[13,15],[15,17],[17,19],[19,15],[15,21],
  [12,14],[14,16],[16,18],[18,20],[20,16],[16,22],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],[27,31],
  [24,26],[26,28],[28,30],[30,32],[28,32]
];

const LEFT_SET = new Set([1,2,3,7,9,11,13,15,17,19,21,23,25,27,29,31]);
const RIGHT_SET = new Set([4,5,6,8,10,12,14,16,18,20,22,24,26,28,30,32]);

function $(s){ return document.querySelector(s); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function finite(v){ return Number.isFinite(v); }
function visibility(l){ return finite(l?.visibility) ? l.visibility : 1; }

function setEngineUI(kind, text){
  const dot = $("#poseEngineDot"), label = $("#poseEngineText"), header = $("#poseHeaderStatus");
  if(dot) dot.className = `pose-dot ${kind}`;
  if(label) label.textContent = text;
  if(header){header.textContent = kind === "ready" ? "Pose: ready" : kind === "bad" ? "Pose: error" : "Pose: loading…";header.className = `status-pill ${kind === "ready" ? "good" : kind === "bad" ? "bad" : "neutral"}`;}
  const home=$("#homePoseReady");if(home)home.textContent=kind==="ready"?"Ready":kind==="bad"?"Error":"Loading…";
}

function roleVideo(role){ return document.getElementById(`${role}Video`); }
function roleCanvas(role){ return document.getElementById(`${role}Overlay`); }
function videoIsLive(role){const v=roleVideo(role);return !!(v&&v.srcObject);}

function isProcessable(role){
  const v=roleVideo(role);
  return !!(v && v.readyState>=2 && v.videoWidth && v.videoHeight && (v.srcObject || v.currentSrc || v.src));
}

function detectorAuthorityRole(){
  const central=state.shotEngine?.getAuthorityRole?.();
  if(central&&isProcessable(central))return central;
  const metrics={side:state.latest.side,rear:state.latest.rear,overhead:state.latest.overhead};
  const decision=authorityTracker?.update?.(metrics,Date.now())||window.CoreEngine?.selectAuthorityRole?.(metrics);
  if(decision?.role)return decision.role;
  return CAPTURE_ROLES.find(isProcessable)||null;
}
function targetInferenceWidth(role,sourceWidth=1280,activeCount=1,authorityRole=null){
  // Experimental Smooth Core: inference geometry is LOCKED per camera role for the session.
  // Changing model input size while the archer is moving can make the pose solution jump even
  // when the camera image itself is stable.
  const existing=state.inferenceLockedWidth[role];
  if(Number.isFinite(existing))return Math.min(sourceWidth,existing);
  const preferred=role==="analysis"?960:(role==="side"?960:800);
  const locked=Math.max(320,Math.min(sourceWidth,preferred));
  state.inferenceLockedWidth[role]=locked;
  return locked;
}
function inferenceSource(role,video,activeCount=1,authorityRole=null){
  if(!video?.videoWidth||!video?.videoHeight)return video;
  const targetW=Math.max(320,Math.round(targetInferenceWidth(role,video.videoWidth,activeCount,authorityRole)));
  if(video.videoWidth<=targetW+8){state.inferenceSize[role]={width:video.videoWidth,height:video.videoHeight,direct:true,locked:true};return video;}
  const targetH=Math.max(180,Math.round(targetW*video.videoHeight/video.videoWidth));
  let c=state.inferenceSurfaces[role];if(!c){c=document.createElement("canvas");state.inferenceSurfaces[role]=c;}
  if(c.width!==targetW||c.height!==targetH){c.width=targetW;c.height=targetH;}
  const ctx=c.getContext("2d",{alpha:false,desynchronized:true});ctx.drawImage(video,0,0,targetW,targetH);
  state.inferenceSize[role]={width:targetW,height:targetH,direct:false,locked:true};return c;
}

function motionRoi(lm,rightHanded){
  if(!Array.isArray(lm))return null;
  const ids=rightHanded?[12,14,16,0,8]:[11,13,15,0,7];
  const pts=ids.map(i=>lm[i]).filter(p=>p&&visibility(p)>.22&&finite(p.x)&&finite(p.y));
  if(pts.length<3)return null;
  let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
  const padX=Math.max(.055,(maxX-minX)*.28),padY=Math.max(.045,(maxY-minY)*.24);
  minX=clamp(minX-padX,0,1);maxX=clamp(maxX+padX,0,1);minY=clamp(minY-padY,0,1);maxY=clamp(maxY+padY,0,1);
  if(maxX-minX<.06||maxY-minY<.06)return null;
  return {minX,maxX,minY,maxY};
}

function sampleFrameMotion(role,video,now=performance.now(),roi=null){
  const st=state.frameMotion[role]||(state.frameMotion[role]={});
  if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return {mad:null,ratio:null,localMad:null,globalMad:null,localGlobalRatio:null,corroborated:false,baseline:st.localBaseline||1.5};
  try{
    let c=st.canvas;if(!c){c=document.createElement("canvas");c.width=96;c.height=54;st.canvas=c;}
    const ctx=c.getContext("2d",{alpha:false,willReadFrequently:true,desynchronized:true});ctx.drawImage(video,0,0,c.width,c.height);
    const d=ctx.getImageData(0,0,c.width,c.height).data,cur=new Float32Array(c.width*c.height);let k=0;
    for(let i=0;i<d.length;i+=4)cur[k++]=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
    let globalMad=null,localMad=null;
    if(st.prev&&st.prev.length===cur.length){
      let meanDelta=0;for(let i=0;i<cur.length;i++)meanDelta+=cur[i]-st.prev[i];meanDelta/=cur.length;
      let gsum=0;for(let i=0;i<cur.length;i++)gsum+=Math.abs((cur[i]-st.prev[i])-meanDelta);globalMad=gsum/cur.length;
      if(roi){
        const x0=Math.max(0,Math.floor(roi.minX*c.width)),x1=Math.min(c.width-1,Math.ceil(roi.maxX*c.width));
        const y0=Math.max(0,Math.floor(roi.minY*c.height)),y1=Math.min(c.height-1,Math.ceil(roi.maxY*c.height));
        let lsum=0,ln=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*c.width+x;lsum+=Math.abs((cur[i]-st.prev[i])-meanDelta);ln++;}
        if(ln>=24)localMad=lsum/ln;
      }
      const dt=st.lastAt?Math.max(20,Math.min(120,now-st.lastAt)):50,scale=50/dt;
      globalMad*=scale;if(Number.isFinite(localMad))localMad*=scale;
    }
    st.prev=cur;st.lastAt=now;
    if(!Number.isFinite(st.globalBaseline))st.globalBaseline=1.2;if(!Number.isFinite(st.localBaseline))st.localBaseline=1.5;
    const effectiveMad=Number.isFinite(localMad)?localMad:globalMad;
    const ratio=Number.isFinite(effectiveMad)?effectiveMad/Math.max(.65,st.localBaseline):null;
    const localGlobalRatio=Number.isFinite(localMad)&&Number.isFinite(globalMad)?localMad/Math.max(.45,globalMad):null;
    // Require motion in the archer/draw-arm area, not merely somewhere in the frame.
    // A modest local/global excess is enough; tracking-drop and bow-reaction remain independent corroborators.
    const corroborated=Number.isFinite(localMad) && localMad>=2.6 && ratio>=1.45 && (!Number.isFinite(localGlobalRatio)||localGlobalRatio>=1.12);
    st.lastMad=effectiveMad;st.lastRatio=ratio;st.lastLocalMad=localMad;st.lastGlobalMad=globalMad;st.lastLocalGlobalRatio=localGlobalRatio;st.lastCorroborated=corroborated;
    return {mad:effectiveMad,ratio,localMad,globalMad,localGlobalRatio,corroborated,baseline:st.localBaseline};
  }catch(_){return {mad:null,ratio:null,localMad:null,globalMad:null,localGlobalRatio:null,corroborated:false,baseline:st.localBaseline||1.5};}
}
function visualRoi(lm){
  if(!Array.isArray(lm)||!lm.length)return null;const pts=[0,11,12,13,14,15,16,23,24].map(i=>lm[i]).filter(p=>p&&visibility(p)>.25&&finite(p.x)&&finite(p.y));if(pts.length<5)return null;
  let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));const padX=Math.max(.06,(maxX-minX)*.18),padY=Math.max(.05,(maxY-minY)*.12);minX=clamp(minX-padX,0,1);maxX=clamp(maxX+padX,0,1);minY=clamp(minY-padY,0,1);maxY=clamp(maxY+padY,0,1);return{minX,maxX,minY,maxY};
}

function torsoAppearance(role,video,lm){
  // Lightweight identity continuity cue for crowded ranges. This is deliberately
  // NOT face recognition: it samples only coarse torso/clothing chromaticity and
  // is used together with body position/proportions/motion continuity.
  if(!video?.videoWidth||!video?.videoHeight||!Array.isArray(lm))return null;
  const ls=lm[11],rs=lm[12],lh=lm[23],rh=lm[24];
  if(!ls||!rs||Math.min(visibility(ls),visibility(rs))<.28)return null;
  const shoulderY=(ls.y+rs.y)/2,shoulderW=Math.abs(rs.x-ls.x);
  if(!finite(shoulderY)||!finite(shoulderW)||shoulderW<.025)return null;
  const hipsGood=lh&&rh&&Math.min(visibility(lh),visibility(rh))>.22&&finite(lh.y)&&finite(rh.y);
  const hipY=hipsGood?(lh.y+rh.y)/2:shoulderY+Math.max(.18,shoulderW*1.55);
  const cx=(ls.x+rs.x)/2;
  const minX=clamp(cx-shoulderW*.43,0,1),maxX=clamp(cx+shoulderW*.43,0,1);
  const minY=clamp(shoulderY+Math.max(.015,(hipY-shoulderY)*.10),0,1),maxY=clamp(shoulderY+Math.max(.10,(hipY-shoulderY)*.72),0,1);
  if(maxX-minX<.025||maxY-minY<.04)return null;
  try{
    let c=state.appearanceSurfaces[role];if(!c){c=document.createElement("canvas");c.width=12;c.height=12;state.appearanceSurfaces[role]=c;}
    const ctx=c.getContext("2d",{alpha:false,willReadFrequently:true});
    ctx.drawImage(video,minX*video.videoWidth,minY*video.videoHeight,(maxX-minX)*video.videoWidth,(maxY-minY)*video.videoHeight,0,0,c.width,c.height);
    const d=ctx.getImageData(0,0,c.width,c.height).data;let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){const rr=d[i],gg=d[i+1],bb=d[i+2],sum=rr+gg+bb;if(sum<42||sum>735)continue;r+=255*rr/sum;g+=255*gg/sum;b+=255*bb/sum;n++;}
    if(n<20)return null;return{r:r/n,g:g/n,b:b/n};
  }catch(_){return null;}
}
function sampleVisualHealth(role,now=performance.now(),lm=null){
  const prev=state.visualHealth[role];
  if(prev&&now-(prev.sampledAt||0)<850)return prev;
  const video=roleVideo(role);
  if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return prev||{score:0,status:"waiting",issues:["no frame"],sampledAt:now};
  try{
    const roi=visualRoi(lm),sx=roi?roi.minX*video.videoWidth:0,sy=roi?roi.minY*video.videoHeight:0,sw=roi?(roi.maxX-roi.minX)*video.videoWidth:video.videoWidth,sh=roi?(roi.maxY-roi.minY)*video.videoHeight:video.videoHeight;
    const c=document.createElement("canvas"),w=96,h=Math.max(54,Math.round(96*sh/Math.max(1,sw)));c.width=w;c.height=Math.min(80,h);
    const ctx=c.getContext("2d",{alpha:false,willReadFrequently:true});ctx.drawImage(video,sx,sy,sw,sh,0,0,c.width,c.height);
    const d=ctx.getImageData(0,0,c.width,c.height).data;let n=0,sum=0,sum2=0,dark=0,bright=0,grad=0,gN=0;const lum=new Float32Array(c.width*c.height);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,L=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];lum[y*c.width+x]=L;n++;sum+=L;sum2+=L*L;if(L<24)dark++;if(L>238)bright++;}
    for(let y=1;y<c.height;y+=2)for(let x=1;x<c.width;x+=2){const i=y*c.width+x;grad+=Math.abs(lum[i]-lum[i-1])+Math.abs(lum[i]-lum[i-c.width]);gN+=2;}
    const mean=sum/Math.max(1,n),contrast=Math.sqrt(Math.max(0,sum2/Math.max(1,n)-mean*mean)),darkPct=dark/Math.max(1,n),brightPct=bright/Math.max(1,n),sharp=grad/Math.max(1,gN);
    let score=1,issues=[];
    if(mean<38){score-=.28;issues.push("dark");} else if(mean>220){score-=.24;issues.push("overexposed");}
    if(darkPct>.45){score-=.18;if(!issues.includes("dark"))issues.push("deep shadows");}
    if(brightPct>.28){score-=.20;if(!issues.includes("overexposed"))issues.push("glare/highlights");}
    if(contrast<18){score-=.20;issues.push("low contrast");}
    if(sharp<4.0){score-=.22;issues.push("blur risk");}
    score=clamp(score,0,1);const status=score>=.72?"good":score>=.42?"usable":"poor";
    const out={score,status,issues,brightness:mean,contrast,sharpness:sharp,darkPct,brightPct,roi:!!roi,sampledAt:now};state.visualHealth[role]=out;return out;
  }catch(err){return prev||{score:.5,status:"usable",issues:["quality check unavailable"],sampledAt:now};}
}

async function ensureLandmarker(role){
  if(state.landmarkers[role]) return state.landmarkers[role];
  if(!state.fileset) throw new Error("Pose runtime is not ready.");
  const lm = await PoseLandmarker.createFromOptions(state.fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "VIDEO",
    numPoses: role==="analysis"?1:3,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
    outputSegmentationMasks: false,
  });
  state.landmarkers[role] = lm;
  return lm;
}

function smoothLandmarks(role, landmarks, now=performance.now()){
  // Two independent channels:
  //  1) measurement pose: rejects implausible motion but preserves raw visibility;
  //  2) visual pose: follows the raw person naturally and never disappears merely because
  //     one measurement sample was rejected.
  let filter=state.poseFilters[role];
  if(!filter){filter=new window.PoseFilterCore.DualPoseFilter();state.poseFilters[role]=filter;}
  const r=filter.update(landmarks,now);
  state.smoothed[role]=r.measurement;
  state.visualPose[role]=r.visual;
  state.bodyScale[role]=r.bodyScale;
  const vs=state.validation[role]||(state.validation[role]={});vs.rejected=r.rejected||[];vs.bodyScale=r.bodyScale;vs.trust=r.trust||[];
  return r.measurement;
}

function displayLandmarks(role,lm){
  // Presentation is intentionally independent from measurement rejection.
  return state.visualPose[role]||lm;
}

function angle3(a,b,c){
  if(!a||!b||!c) return null;
  const bax=a.x-b.x, bay=a.y-b.y;
  const bcx=c.x-b.x, bcy=c.y-b.y;
  const dot=bax*bcx+bay*bcy;
  const mag=Math.hypot(bax,bay)*Math.hypot(bcx,bcy);
  if(mag<1e-8) return null;
  return Math.acos(clamp(dot/mag,-1,1))*180/Math.PI;
}


function angleXYZ(a,b,c){
  if(!a||!b||!c)return null;
  const ab=[Number(a.x)-Number(b.x),Number(a.y)-Number(b.y),Number(a.z||0)-Number(b.z||0)];
  const cb=[Number(c.x)-Number(b.x),Number(c.y)-Number(b.y),Number(c.z||0)-Number(b.z||0)];
  const dot=ab[0]*cb[0]+ab[1]*cb[1]+ab[2]*cb[2],mag=Math.hypot(...ab)*Math.hypot(...cb);
  if(!Number.isFinite(dot)||mag<1e-8)return null;
  return Math.acos(clamp(dot/mag,-1,1))*180/Math.PI;
}

function faceReference(lm){
  const candidates=[];
  if(lm?.[0]&&visibility(lm[0])>.28)candidates.push({p:lm[0],w:visibility(lm[0])*1.25});
  if(lm?.[7]&&visibility(lm[7])>.28)candidates.push({p:lm[7],w:visibility(lm[7])});
  if(lm?.[8]&&visibility(lm[8])>.28)candidates.push({p:lm[8],w:visibility(lm[8])});
  if(!candidates.length)return null;
  const sw=candidates.reduce((a,c)=>a+c.w,0);
  return {x:candidates.reduce((a,c)=>a+c.p.x*c.w,0)/sw,y:candidates.reduce((a,c)=>a+c.p.y*c.w,0)/sw};
}

function handSpreadPct(lm,rightHanded,normScale){
  if(!Number.isFinite(normScale)||normScale<1e-6)return null;
  const ids=rightHanded?[16,18,20,22]:[15,17,19,21];
  const pts=ids.map(i=>lm?.[i]).filter(p=>p&&visibility(p)>.30);
  if(pts.length<3)return null;
  let max=0;for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)max=Math.max(max,dist2(pts[i],pts[j]));
  return max/normScale*100;
}

function avgPoint(a,b){ return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
function normalizeLineDeg(v){if(!Number.isFinite(v))return null;let x=v;while(x>90)x-=180;while(x<=-90)x+=180;return x;}
function dist2(a,b){return Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));}
function avg3(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z||0)+(b.z||0))/2};}
function dist3(a,b){return Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0),(a?.z??0)-(b?.z??0));}
function worldFaceReference(lm){
  if(!Array.isArray(lm))return null;const pts=[lm[0],lm[7],lm[8]].filter(Boolean);if(!pts.length)return null;
  return {x:pts.reduce((a,p)=>a+(p.x||0),0)/pts.length,y:pts.reduce((a,p)=>a+(p.y||0),0)/pts.length,z:pts.reduce((a,p)=>a+(p.z||0),0)/pts.length};
}
function rel3(p,ref,scale){return p&&ref&&Number.isFinite(scale)&&scale>1e-6?{x:(p.x-ref.x)/scale,y:(p.y-ref.y)/scale,z:((p.z||0)-(ref.z||0))/scale}:null;}


function currentHandedness(){
  const a=window.FormAnalyzer?.getCurrentAthlete?.();
  return (a?.handedness || "Right-handed").toLowerCase();
}

function computeMetrics(role,lm,worldLm,now){
  const leftShoulder=lm[11], rightShoulder=lm[12], leftElbow=lm[13], rightElbow=lm[14],
        leftWrist=lm[15], rightWrist=lm[16], leftHip=lm[23], rightHip=lm[24], nose=lm[0],
        leftEar=lm[7], rightEar=lm[8];

  const rightHanded=currentHandedness().startsWith("right");
  const faceRef=faceReference(lm)||nose;
  const bow=rightHanded
    ? {shoulder:leftShoulder,elbow:leftElbow,wrist:leftWrist}
    : {shoulder:rightShoulder,elbow:rightElbow,wrist:rightWrist};
  const draw=rightHanded
    ? {shoulder:rightShoulder,elbow:rightElbow,wrist:rightWrist}
    : {shoulder:leftShoulder,elbow:leftElbow,wrist:leftWrist};

  const frameMotion=sampleFrameMotion(role,roleVideo(role),now,motionRoi(lm,rightHanded));

  const drawElbow2DDeg=angle3(draw.shoulder,draw.elbow,draw.wrist);
  const bowArm2DDeg=angle3(bow.shoulder,bow.elbow,bow.wrist);
  const worldDraw=worldLm?.length?(rightHanded?{shoulder:worldLm[12],elbow:worldLm[14],wrist:worldLm[16]}:{shoulder:worldLm[11],elbow:worldLm[13],wrist:worldLm[15]}):null;
  const worldBow=worldLm?.length?(rightHanded?{shoulder:worldLm[11],elbow:worldLm[13],wrist:worldLm[15]}:{shoulder:worldLm[12],elbow:worldLm[14],wrist:worldLm[16]}):null;
  const drawElbowWorldDeg=worldDraw?angleXYZ(worldDraw.shoulder,worldDraw.elbow,worldDraw.wrist):null;
  const bowArmWorldDeg=worldBow?angleXYZ(worldBow.shoulder,worldBow.elbow,worldBow.wrist):null;
  // X1.2: posture/phase angles must survive a bad world-landmark depth solution.
  // Keep the raw 2D/world values for evidence, but use a disagreement-safe fused value
  // for the live metric and phase engine.
  const fuseAngle=window.PoseFilterCore?.fusedJointAngle||((a,b)=>Number.isFinite(a)?a:b);
  const drawElbowDeg=fuseAngle(drawElbow2DDeg,drawElbowWorldDeg);
  const bowArmDeg=fuseAngle(bowArm2DDeg,bowArmWorldDeg);
  const shoulderWidth=dist2(rightShoulder,leftShoulder);
  const bodyScale=state.bodyScale[role]||window.PoseFilterCore?.robustBodyScale?.(lm)||Math.max(shoulderWidth,.10);
  const normScale=Math.max(bodyScale,.07);
  const shoulderMid=avgPoint(leftShoulder,rightShoulder);
  const hipsGood=visibility(leftHip)>.45&&visibility(rightHip)>.45;
  const hipMid=hipsGood?avgPoint(leftHip,rightHip):null;

  let shoulderLineDeg=null,torsoLeanDeg=null,headOffsetPct=null,headMovementMm=null,headPitchDeg=null;
  let anchorFaceDistPct=null,headRelX=null,headRelY=null,anchorHandRelX=null,anchorHandRelY=null;
  let faceHandRelX=null,faceHandRelY=null,drawElbowRel=null,bowWristRel=null;

  if(normScale>1e-6){
    headRelX=(faceRef.x-shoulderMid.x)/normScale;
    headRelY=(faceRef.y-shoulderMid.y)/normScale;
    anchorHandRelX=(draw.wrist.x-shoulderMid.x)/normScale;
    anchorHandRelY=(draw.wrist.y-shoulderMid.y)/normScale;
    // Face-relative hand vector is the release guard. Torso/shoulder rotation can move
    // the shoulder reference frame even while the draw hand remains physically at anchor.
    // Comparing wrist to the face prevents that body twist from masquerading as release.
    faceHandRelX=(draw.wrist.x-faceRef.x)/normScale;
    faceHandRelY=(draw.wrist.y-faceRef.y)/normScale;
    drawElbowRel={x:(draw.elbow.x-shoulderMid.x)/normScale,y:(draw.elbow.y-shoulderMid.y)/normScale};
    bowWristRel={x:(bow.wrist.x-shoulderMid.x)/normScale,y:(bow.wrist.y-shoulderMid.y)/normScale};
    anchorFaceDistPct=dist2(draw.wrist,faceRef)/normScale*100;
    shoulderLineDeg=normalizeLineDeg(-Math.atan2(rightShoulder.y-leftShoulder.y,rightShoulder.x-leftShoulder.x)*180/Math.PI);
    if(hipMid){
      torsoLeanDeg=Math.atan2(shoulderMid.x-hipMid.x,hipMid.y-shoulderMid.y)*180/Math.PI;
    }
    const ear=(visibility(leftEar)>=visibility(rightEar)?leftEar:rightEar);
    if(ear&&visibility(ear)>.45&&visibility(nose)>.55){
      const dx=Math.abs(nose.x-ear.x),dy=nose.y-ear.y;
      if(dx>.005)headPitchDeg=-Math.atan2(dy,dx)*180/Math.PI;
    }
    if(!state.baselines[role]&&visibility(nose)>.65&&visibility(leftShoulder)>.65&&visibility(rightShoulder)>.65){
      state.baselines[role]={nose:{x:nose.x,y:nose.y},bodyScale:normScale};
    }
    const base=state.baselines[role];
    if(base?.nose)headOffsetPct=dist2(nose,base.nose)/Math.max(base.bodyScale||normScale,1e-6)*100;
  }

  if(worldLm?.length){
    const wn=worldLm[0],wls=worldLm[11],wrs=worldLm[12];
    if(wn&&wls&&wrs){
      const wsm=avg3(wls,wrs),rel={x:wn.x-wsm.x,y:wn.y-wsm.y,z:(wn.z||0)-(wsm.z||0)};
      const base=state.baselines[role]||(state.baselines[role]={});
      if(!base.worldHeadRel)base.worldHeadRel=rel;
      headMovementMm=dist3(rel,base.worldHeadRel)*1000;
    }
  }

  let worldFaceHandRel=null,worldDrawElbowRel=null,worldBowWristRel=null,worldBodyScale=null;
  if(worldLm?.length){
    worldBodyScale=window.PoseFilterCore?.worldBodyScale?.(worldLm)||null;
    if(Number.isFinite(worldBodyScale)){
      const wls=worldLm[11],wrs=worldLm[12],wFace=worldFaceReference(worldLm);
      const wMid=wls&&wrs?{x:(wls.x+wrs.x)/2,y:(wls.y+wrs.y)/2,z:((wls.z||0)+(wrs.z||0))/2}:null;
      const wDraw=rightHanded?{elbow:worldLm[14],wrist:worldLm[16]}:{elbow:worldLm[13],wrist:worldLm[15]};
      const wBow=rightHanded?worldLm[15]:worldLm[16];
      worldFaceHandRel=rel3(wDraw.wrist,wFace,worldBodyScale);worldDrawElbowRel=rel3(wDraw.elbow,wMid,worldBodyScale);worldBowWristRel=rel3(wBow,wMid,worldBodyScale);
    }
  }

  const headVisibility=Math.max(visibility(lm[0]),visibility(lm[7]),visibility(lm[8]));
  const qualityVis=[headVisibility,11,12,13,14,15,16].map((v,i)=>i===0?v:visibility(lm[v]));
  const quality=qualityVis.reduce((sum,v)=>sum+clamp(v,0,1),0)/qualityVis.length;
  const phaseVis=[headVisibility,visibility(lm[11]),visibility(lm[12]),visibility(lm[rightHanded?14:13]),visibility(lm[rightHanded?16:15]),visibility(lm[rightHanded?13:14])];
  const phaseWeights=[.8,1,1,1.25,1.55,.9];
  const phaseQuality=phaseVis.reduce((sum,v,n)=>sum+clamp(v,0,1)*phaseWeights[n],0)/phaseWeights.reduce((a,b)=>a+b,0);
  const drawIdx=rightHanded?{shoulder:12,elbow:14,wrist:16}:{shoulder:11,elbow:13,wrist:15};
  const bowIdx=rightHanded?{shoulder:11,elbow:13,wrist:15}:{shoulder:12,elbow:14,wrist:16};
  const rejectedSet=new Set((state.validation[role]?.rejected||[]).map(x=>x.i));
  const conf3=(a,b,c)=>Math.min(visibility(lm[a]),visibility(lm[b]),visibility(lm[c]));
  const drawElbowQ=conf3(drawIdx.shoulder,drawIdx.elbow,drawIdx.wrist),bowArmQ=conf3(bowIdx.shoulder,bowIdx.elbow,bowIdx.wrist);
  const shoulderQ=Math.min(visibility(leftShoulder),visibility(rightShoulder));
  const torsoQ=hipsGood?Math.min(shoulderQ,visibility(leftHip),visibility(rightHip)):0;
  const headQ=Math.min(headVisibility,shoulderQ);
  const criticalIndices=[11,12,drawIdx.elbow,drawIdx.wrist];
  const criticalMin=Math.min(headVisibility,...criticalIndices.map(i=>visibility(lm[i]))),criticalRejected=criticalIndices.filter(i=>rejectedSet.has(i)).length+(rejectedSet.has(0)&&rejectedSet.has(7)&&rejectedSet.has(8)?1:0);
  const drawCriticalRejected=rejectedSet.has(drawIdx.elbow)||rejectedSet.has(drawIdx.wrist);
  const shoulderRejected=[11,12].filter(i=>rejectedSet.has(i)).length;
  const visual=sampleVisualHealth(role,now,lm),visualFactor=visual.score<.25?.74:visual.score<.42?.88:1;
  const identity=state.identity[role]||{};
  const identityConfidence=Number.isFinite(identity.confidence)?identity.confidence:1;
  const shotObservability=window.RangeIntelligence?.shotObservability?.(lm,rightHanded,identityConfidence)??phaseQuality;
  // A7 field fix: one support-shoulder rejection must not kill a genuine release when the
  // draw wrist/elbow and body reference are still usable. The draw-side joints remain hard gates.
  const rejectionPenalty=(drawCriticalRejected?.20:0)+shoulderRejected*.055;
  const releaseQuality=clamp((phaseQuality*.42+criticalMin*.30+shotObservability*.28-rejectionPenalty)*visualFactor,0,1);
  const criticalTrackingOK=visibility(draw.wrist)>=.32&&visibility(draw.elbow)>=.34&&headVisibility>=.30&&shoulderQ>=.28&&!drawCriticalRejected&&shoulderRejected<2&&visual.score>=.18&&identityConfidence>=.42&&!identity.ambiguous;
  const metricConfidence={drawElbow:drawElbowQ,bowArm:bowArmQ,shoulderLine:shoulderQ,torsoLean:torsoQ,headMovement:headQ,anchor:Math.min(headQ,visibility(draw.wrist))};
  const armKeys=[11,12,13,14,15,16];
  // X1.1: visual/framing status must follow what the camera currently sees, not a
  // measurement joint that may be intentionally frozen while an outlier is rejected.
  const framingLm=state.visualPose[role]||lm;
  const lowArm=armKeys.some(i=>visibility(framingLm[i])<.42);
  const edgeArm=armKeys.some(i=>{const p=framingLm[i];return p&&finite(p.x)&&finite(p.y)&&(p.x<.012||p.x>.988||p.y<.010||p.y>.990);});
  const rejected=state.validation[role]?.rejected||[];
  const video=roleVideo(role),positioning=window.RangeIntelligence?.positioningGuide?.(framingLm,{sourceWidth:video?.videoWidth||0,sourceHeight:video?.videoHeight||0})||null;
  const view=window.RangeIntelligence?.viewDescriptor?.(worldLm)||{type:"unknown",sideScore:null,frontalScore:null};
  if(view.type==="side-like"){metricConfidence.shoulderLine*=.45;metricConfidence.torsoLean*=.62;}
  else if(view.type==="oblique"){metricConfidence.shoulderLine*=.82;metricConfidence.torsoLean*=.86;}
  let framing=positioning?.detail||"Head → hips framing ready";
  if(phaseQuality<.40)framing="Tracking too low — keep head, shoulders, both elbows and wrists clear";
  else if(edgeArm&&positioning?.level==="good")framing="Capture ready · arm near edge — extra follow-through space recommended";
  else if(lowArm)framing="Arm partly hidden — clear both elbows and wrists";
  else if(!hipsGood&&positioning?.level==="good")framing="Upper body ready · hips not visible (torso/stance analysis limited)";
  if(identity.ambiguous)framing="Multiple people overlap athlete — shot decision paused until identity is clear";
  else if(rejected.length>=2)framing=`Tracking stabilizing · keep natural form`;

  const motion=state.motion[role]||(state.motion[role]={});
  const faceDist=normScale>1e-6?dist2(draw.wrist,faceRef)/normScale:null;
  const dt=motion.lastNow?Math.max(.012,Math.min(.20,(now-motion.lastNow)/1000)):null;
  let rawDrawSpeed=0,rawFaceVelocity=0,rawElbowSpeed=0,rawBowSpeed=0,rawFaceHandSpeed=0,rawWorldFaceHandSpeed=0;
  const faceHandRelNow=Number.isFinite(faceHandRelX)&&Number.isFinite(faceHandRelY)?{x:faceHandRelX,y:faceHandRelY}:null;
  const worldFaceHandRelNow=worldFaceHandRel&&Number.isFinite(worldFaceHandRel.x)&&Number.isFinite(worldFaceHandRel.y)&&Number.isFinite(worldFaceHandRel.z)?{x:worldFaceHandRel.x,y:worldFaceHandRel.y,z:worldFaceHandRel.z}:null;
  if(dt&&motion.drawWrist&&normScale>1e-6){
    rawDrawSpeed=dist2(draw.wrist,motion.drawWrist)/normScale/dt;
    if(Number.isFinite(faceDist)&&Number.isFinite(motion.faceDist))rawFaceVelocity=(faceDist-motion.faceDist)/dt;
    if(motion.drawElbow)rawElbowSpeed=dist2(draw.elbow,motion.drawElbow)/normScale/dt;
    if(motion.bowWrist)rawBowSpeed=dist2(bow.wrist,motion.bowWrist)/normScale/dt;
    if(faceHandRelNow&&motion.faceHandRel)rawFaceHandSpeed=dist2(faceHandRelNow,motion.faceHandRel)/dt;
    if(worldFaceHandRelNow&&motion.worldFaceHandRel)rawWorldFaceHandSpeed=dist3(worldFaceHandRelNow,motion.worldFaceHandRel)/dt;
  }
  motion.drawSpeedSmoothed=Number.isFinite(motion.drawSpeedSmoothed)?motion.drawSpeedSmoothed*.66+rawDrawSpeed*.34:rawDrawSpeed;
  motion.faceVelocitySmoothed=Number.isFinite(motion.faceVelocitySmoothed)?motion.faceVelocitySmoothed*.68+rawFaceVelocity*.32:rawFaceVelocity;
  motion.faceHandSpeedSmoothed=Number.isFinite(motion.faceHandSpeedSmoothed)?motion.faceHandSpeedSmoothed*.64+rawFaceHandSpeed*.36:rawFaceHandSpeed;
  motion.worldFaceHandSpeedSmoothed=Number.isFinite(motion.worldFaceHandSpeedSmoothed)?motion.worldFaceHandSpeedSmoothed*.64+rawWorldFaceHandSpeed*.36:rawWorldFaceHandSpeed;
  motion.elbowSpeedSmoothed=Number.isFinite(motion.elbowSpeedSmoothed)?motion.elbowSpeedSmoothed*.70+rawElbowSpeed*.30:rawElbowSpeed;
  motion.bowSpeedSmoothed=Number.isFinite(motion.bowSpeedSmoothed)?motion.bowSpeedSmoothed*.72+rawBowSpeed*.28:rawBowSpeed;
  const trackingDrop=Math.max(0,(Number.isFinite(motion.prevReleaseQuality)?motion.prevReleaseQuality:releaseQuality)-releaseQuality);
  const visibilityDrop=Math.max(0,(Number.isFinite(motion.prevDrawVisibility)?motion.prevDrawVisibility:visibility(draw.wrist))-visibility(draw.wrist));
  motion.prevReleaseQuality=releaseQuality;motion.prevDrawVisibility=visibility(draw.wrist);
  motion.lastNow=now;motion.drawWrist={x:draw.wrist.x,y:draw.wrist.y};motion.drawElbow={x:draw.elbow.x,y:draw.elbow.y};motion.bowWrist={x:bow.wrist.x,y:bow.wrist.y};motion.faceDist=faceDist;motion.faceHandRel=faceHandRelNow?{...faceHandRelNow}:null;motion.worldFaceHandRel=worldFaceHandRelNow?{...worldFaceHandRelNow}:null;
  const priorPhase=state.latest[role]?.phase||"Setup",fmState=state.frameMotion[role]||(state.frameMotion[role]={});
  if(Number.isFinite(frameMotion.localMad)&&["Anchor","Aim / Hold","Expansion"].includes(priorPhase)&&motion.drawSpeedSmoothed<.035){fmState.localBaseline=Number.isFinite(fmState.localBaseline)?fmState.localBaseline*.94+frameMotion.localMad*.06:frameMotion.localMad;}
  if(Number.isFinite(frameMotion.globalMad)&&["Anchor","Aim / Hold","Expansion"].includes(priorPhase)&&motion.drawSpeedSmoothed<.035){fmState.globalBaseline=Number.isFinite(fmState.globalBaseline)?fmState.globalBaseline*.96+frameMotion.globalMad*.04:frameMotion.globalMad;}
  const visualMotionMad=frameMotion.localMad,visualMotionRatio=Number.isFinite(frameMotion.localMad)?frameMotion.localMad/Math.max(.65,fmState.localBaseline||1.5):null;
  const visualMotionLocalGlobal=frameMotion.localGlobalRatio,visualMotionCorroborated=!!frameMotion.corroborated;

  const drawWristLow=draw.wrist.y>shoulderMid.y+.15;
  const bowWristLow=bow.wrist.y>shoulderMid.y+.18;
  const wristsLow=drawWristLow&&(visibility(bow.wrist)>.35?bowWristLow:bow.elbow.y>shoulderMid.y+.12);
  const bowExtended=Number.isFinite(bowArmDeg)&&bowArmDeg>142;
  const drawArmRaised=draw.elbow.y<shoulderMid.y+.25&&draw.wrist.y<shoulderMid.y+.28;
  const bowSideRaised=bow.elbow.y<shoulderMid.y+.28;
  const shootingPosture=drawArmRaised&&bowSideRaised;
  // X1.3: Set means the bow has been raised into a usable shooting plane.
  // It must not require the draw arm to already look like Draw/Anchor.
  // X1.4: Setup/Set is a posture question, not a precision-measurement question.
  // Use the current VISUAL pose for bow-raise recognition so a deliberately frozen
  // measurement outlier cannot pin the phase at Setup while the skeleton visibly moves.
  const phasePose=state.visualPose[role]||lm;
  const setEvidence=window.PoseFilterCore?.setPostureEvidence?.(phasePose,rightHanded,state.bodyScale[role]||normScale)||null;
  const phaseBow=rightHanded?{shoulder:phasePose?.[11],elbow:phasePose?.[13],wrist:phasePose?.[15]}:{shoulder:phasePose?.[12],elbow:phasePose?.[14],wrist:phasePose?.[16]};
  const phaseDraw=rightHanded?{shoulder:phasePose?.[12],elbow:phasePose?.[14],wrist:phasePose?.[16]}:{shoulder:phasePose?.[11],elbow:phasePose?.[13],wrist:phasePose?.[15]};
  const phaseShoulderMid=phasePose?.[11]&&phasePose?.[12]?avgPoint(phasePose[11],phasePose[12]):shoulderMid;
  const phaseScale=Math.max(window.PoseFilterCore?.robustBodyScale?.(phasePose)||state.bodyScale[role]||normScale,.07);
  const phaseFaceRef=faceReference(phasePose)||phasePose?.[0]||faceRef;
  const phaseBowSideRaised=!!(phaseBow?.elbow&&phaseShoulderMid&&phaseBow.elbow.y<phaseShoulderMid.y+.30);
  const phaseBowWristLow=!!(phaseBow?.wrist&&phaseShoulderMid&&phaseBow.wrist.y>phaseShoulderMid.y+.20);
  const phaseDrawArmRaised=!!(phaseDraw?.elbow&&phaseDraw?.wrist&&phaseShoulderMid&&phaseDraw.elbow.y<phaseShoulderMid.y+.27&&phaseDraw.wrist.y<phaseShoulderMid.y+.30);
  const phaseShootingPosture=phaseDrawArmRaised&&phaseBowSideRaised;
  const phaseFaceDist=phaseDraw?.wrist&&phaseFaceRef?dist2(phaseDraw.wrist,phaseFaceRef)/phaseScale:null;
  const phaseBow2DDeg=phaseBow?.shoulder&&phaseBow?.elbow&&phaseBow?.wrist?angle3(phaseBow.shoulder,phaseBow.elbow,phaseBow.wrist):null;
  const phaseBowExtended=Number.isFinite(phaseBow2DDeg)&&phaseBow2DDeg>136;
  const setReady=!!(setEvidence?.ready || (phaseBowSideRaised && visibility(phaseBow?.wrist)>.30 && !phaseBowWristLow));

  const epochMs=Date.now();
  let cycle={phase:"Setup",holdTimeS:null,didRelease:false,shotComplete:false,releaseConfirmed:false,followThroughConfirmed:false,releaseConfidence:null,releaseEpochMs:null};
  const phaseEnabled=window.FormAnalyzer?.isPhaseDetectionEnabled?.()!==false;
  if(phaseEnabled&&CAPTURE_ROLES.includes(role)&&state.shotEngine){
    const profileName=window.FormAnalyzer?.getPhaseProfile?.()||"verified";
    cycle=state.shotEngine.update(role,{
      now,epochMs,phaseQuality:clamp(phaseQuality*.72+shotObservability*.28,0,1),releaseQuality,criticalTrackingOK,faceDist,drawSpeed:motion.drawSpeedSmoothed,faceVelocity:motion.faceVelocitySmoothed,faceHandSpeed:motion.faceHandSpeedSmoothed,worldFaceHandSpeed:motion.worldFaceHandSpeedSmoothed,elbowSpeed:motion.elbowSpeedSmoothed,bowSpeed:motion.bowSpeedSmoothed,trackingDrop,visibilityDrop,visualMotionMad,visualMotionRatio,visualMotionLocalGlobal,visualMotionCorroborated,
      bowArmDeg,drawElbowDeg,bowExtended,setReady,shootingPosture,wristsLow,drawWristVisibility:visibility(draw.wrist),drawElbowVisibility:visibility(draw.elbow),viewType:view.type,measurementTrustScore:1-Math.min(1,criticalRejected/Math.max(1,criticalIndices.length)),
      phaseFaceDist,phaseShootingPosture,phaseBowExtended,phaseDrawWristVisibility:visibility(phaseDraw?.wrist),phaseDrawElbowVisibility:visibility(phaseDraw?.elbow),
      anchorHandRel:Number.isFinite(anchorHandRelX)&&Number.isFinite(anchorHandRelY)?{x:anchorHandRelX,y:anchorHandRelY}:null,
      handSpreadPct:handSpreadPct(lm,rightHanded,normScale),
      faceHandRel:Number.isFinite(faceHandRelX)&&Number.isFinite(faceHandRelY)?{x:faceHandRelX,y:faceHandRelY}:null,
      drawElbowRel,headRel:Number.isFinite(headRelX)&&Number.isFinite(headRelY)?{x:headRelX,y:headRelY}:null,bowWristRel,headPitchDeg,
      worldFaceHandRel,worldDrawElbowRel,worldBowWristRel,worldBodyScale
    },profileName);
  }

  return{
    detected:true,role,epochMs,quality,phaseQuality,drawElbowDeg,bowArmDeg,drawElbow2DDeg,bowArm2DDeg,drawElbowWorldDeg,bowArmWorldDeg,shoulderLineDeg,torsoLeanDeg,headOffsetPct,headMovementMm,headPitchDeg,
    anchorFaceDistPct,headTowardDrawPct:cycle.headTowardDrawPct,anchorHandDriftPct:cycle.anchorHandDriftPct,
    headRelX,headRelY,anchorHandRelX,anchorHandRelY,faceHandRelX,faceHandRelY,drawElbowRelX:drawElbowRel?.x,drawElbowRelY:drawElbowRel?.y,bowWristRelX:bowWristRel?.x,bowWristRelY:bowWristRel?.y,
    framing,handedness:rightHanded?"Right-handed":"Left-handed",phase:cycle.phase||"Setup",primaryPhase:cycle.primaryPhase||cycle.phase||"Setup",shotActivity:cycle.activity||null,holdTimeS:cycle.holdTimeS,
    releaseConfidence:cycle.releaseConfidence,releaseEpochMs:cycle.releaseEpochMs,drawSpeed:motion.drawSpeedSmoothed,faceHandSpeed:motion.faceHandSpeedSmoothed,worldFaceHandSpeed:motion.worldFaceHandSpeedSmoothed,elbowSpeed:motion.elbowSpeedSmoothed,bowSpeed:motion.bowSpeedSmoothed,trackingDrop,visibilityDrop,visualMotionMad,visualMotionRatio,visualMotionLocalGlobal,visualMotionCorroborated,bodyScale,
    debugPhaseFaceDist:phaseFaceDist,debugMeasurementFaceDist:faceDist,debugSetReady:setReady,debugPhaseShootingPosture:phaseShootingPosture,debugPhaseBowExtended:phaseBowExtended,debugWristsLow:wristsLow,debugMeasurementTrust:1-Math.min(1,criticalRejected/Math.max(1,criticalIndices.length)),
    didRelease:!!cycle.didRelease,letDown:!!cycle.letDown,shotEvent:cycle.shotEvent||null,expansionActive:!!cycle.expansionActive,expansionEpisodeCount:cycle.expansionEpisodeCount||0,expansionTotalS:cycle.expansionTotalS,shotComplete:!!cycle.shotComplete,releaseConfirmed:!!cycle.releaseConfirmed,releaseInvalidated:!!cycle.releaseInvalidated,invalidatedReleaseEventId:cycle.invalidatedReleaseEventId||0,followThroughConfirmed:!!cycle.followThroughConfirmed,followThroughEnded:!!cycle.followThroughEnded,followThroughEndEpochMs:cycle.followThroughEndEpochMs||null,postReleaseEvidence:!!cycle.postReleaseEvidence,releaseEventId:cycle.releaseEventId||0,shotCompleteEventId:cycle.shotCompleteEventId||0,armed:!!cycle.armed,releaseCandidate:!!cycle.releaseCandidate,shotBlocker:cycle.blocker||null,recoveredSequence:!!cycle.recoveredSequence,sequenceQualified:!!cycle.sequenceQualified,evidenceRoles:Array.isArray(cycle.evidenceRoles)?cycle.evidenceRoles.slice():[role],phaseTimeline:Array.isArray(cycle.phaseTimeline)?cycle.phaseTimeline.map(x=>({...x})):[],
    releaseRearStep:cycle.releaseRearStep,releaseFaceRearStep:cycle.releaseFaceRearStep,releaseElbowRearStep:cycle.releaseElbowRearStep,releaseRearThreshold:cycle.releaseRearThreshold,releaseSpeedThreshold:cycle.releaseSpeedThreshold,releaseFrameSpeed:cycle.releaseFrameSpeed,letDownDirectional:!!cycle.letDownDirectional,releaseDirectionalSteps:cycle.releaseDirectionalSteps,releaseRearAccum:cycle.releaseRearAccum,releaseElbowRearAccum:cycle.releaseElbowRearAccum,releasePostIndependent:!!cycle.releasePostIndependent,releasePostBlurSupported:!!cycle.releasePostBlurSupported,releasePostLetDown:!!cycle.releasePostLetDown,
    rejectedJoints:rejected.length,releaseQuality,criticalTrackingOK,metricConfidence,identityConfidence,peopleCount:identity.peopleCount||1,identityAmbiguous:!!identity.ambiguous,shotObservability,positioning,viewType:view.type,viewSideScore:view.sideScore,viewFrontalScore:view.frontalScore,handSpreadPct:handSpreadPct(lm,rightHanded,normScale),
    visualQuality:visual.score,visualStatus:visual.status,visualIssues:visual.issues||[],visualBrightness:visual.brightness,visualContrast:visual.contrast,visualSharpness:visual.sharpness,
    effectiveInferenceHz:state.perf[role]?.hz||null,inferenceCostMs:state.perf[role]?.cost||null,
    anchorSampleCount:cycle.anchorSampleCount,anchorHandRmsPct:cycle.anchorHandRmsPct,anchorFaceRmsPct:cycle.anchorFaceRmsPct,anchorHeadRmsPct:cycle.anchorHeadRmsPct,
    anchorSettleTimeS:cycle.anchorSettleTimeS,anchorReferenceHandX:cycle.anchorReferenceHandX,anchorReferenceHandY:cycle.anchorReferenceHandY,
    anchorReferenceHeadX:cycle.anchorReferenceHeadX,anchorReferenceHeadY:cycle.anchorReferenceHeadY,anchorReferenceFacePct:cycle.anchorReferenceFacePct,
    anchorReferenceHeadPitch:cycle.anchorReferenceHeadPitch,releaseRearPct:cycle.releaseRearPct,releaseOffAxisPct:cycle.releaseOffAxisPct,
    releaseRearTravelPct:cycle.releaseRearTravelPct,releaseOffAxisTravelPct:cycle.releaseOffAxisTravelPct,releaseElbowTravelPct:cycle.releaseElbowTravelPct,
    releaseFaceRelativeTravelPct:cycle.releaseFaceRelativeTravelPct,handOpeningDeltaPct:cycle.handOpeningDeltaPct,setToDrawS:cycle.setToDrawS,drawToAnchorS:cycle.drawToAnchorS,anchorToArmS:cycle.anchorToArmS,drawSpeedMean:cycle.drawSpeedMean,drawSpeedCv:cycle.drawSpeedCv,drawAccelerationPeak:cycle.drawAccelerationPeak,drawJerkPeak:cycle.drawJerkPeak,drawMotionSamples:cycle.drawMotionSamples,followBowArmDeltaDeg:cycle.followBowArmDeltaDeg,followHeadMovePct:cycle.followHeadMovePct,releasePathConfidence:cycle.releasePathConfidence
  };
}

function displayRect(video, canvas){
  const cw=canvas.clientWidth, ch=canvas.clientHeight;
  const vw=video.videoWidth||cw, vh=video.videoHeight||ch;
  const scale=Math.min(cw/vw,ch/vh);
  const dw=vw*scale, dh=vh*scale;
  return {x:(cw-dw)/2,y:(ch-dh)/2,w:dw,h:dh};
}

function pointToCanvas(p,rect){ return {x:rect.x+p.x*rect.w,y:rect.y+p.y*rect.h}; }

function connectorColor(a,b){
  if(LEFT_SET.has(a)&&LEFT_SET.has(b)) return "#45e09a";
  if(RIGHT_SET.has(a)&&RIGHT_SET.has(b)) return "#ff6d68";
  return "#ffd84d";
}

function clearOverlay(role){
  const c=roleCanvas(role);
  if(!c) return;
  const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
}

function drawPose(role,lm,metrics){
  const video=roleVideo(role), canvas=roleCanvas(role);
  if(!video||!canvas) return;
  const dpr=window.devicePixelRatio||1;
  const cw=Math.max(1,canvas.clientWidth), ch=Math.max(1,canvas.clientHeight);
  const bw=Math.round(cw*dpr), bh=Math.round(ch*dpr);
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  if(!state.overlayVisible) return;
  const rect=displayRect(video,canvas);

  ctx.lineCap="round";ctx.lineJoin="round";
  for(const [a,b] of CONNECTIONS){
    const pa=lm[a],pb=lm[b];
    if(!pa||!pb||visibility(pa)<.44||visibility(pb)<.44) continue;
    const A=pointToCanvas(pa,rect),B=pointToCanvas(pb,rect);
    ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);
    ctx.strokeStyle=connectorColor(a,b);
    ctx.globalAlpha=clamp(Math.min(visibility(pa),visibility(pb)),.3,1);
    ctx.lineWidth=role==="side"?3:2;
    ctx.stroke();
  }
  ctx.globalAlpha=1;
  lm.forEach((p,i)=>{
    if(visibility(p)<.48) return;
    if(i>24 && role!=="side") return; // reduce clutter on compact views
    const P=pointToCanvas(p,rect);
    ctx.beginPath();
    ctx.arc(P.x,P.y,role==="side"?4:3,0,Math.PI*2);
    ctx.fillStyle=LEFT_SET.has(i)?"#58efac":RIGHT_SET.has(i)?"#ff7772":"#ffe769";
    ctx.fill();
    ctx.strokeStyle="#07101a";ctx.lineWidth=1.2;ctx.stroke();
  });

  if(role==="side" && metrics){
    const rightHanded=currentHandedness().startsWith("right");
    const leftShoulder=lm[11],rightShoulder=lm[12],nose=lm[0];
    const bowShoulder=lm[rightHanded?11:12],bowElbow=lm[rightHanded?13:14],bowWrist=lm[rightHanded?15:16];
    const drawShoulder=lm[rightHanded?12:11],drawElbow=lm[rightHanded?14:13],drawWrist=lm[rightHanded?16:15];

    // Archery-specific guide geometry. These are visual references derived from
    // validated pose landmarks, not claims about invisible forces/back tension.
    if(leftShoulder&&rightShoulder&&visibility(leftShoulder)>.45&&visibility(rightShoulder)>.45){
      const L=pointToCanvas(leftShoulder,rect),R=pointToCanvas(rightShoulder,rect);
      const vx=R.x-L.x,vy=R.y-L.y;
      ctx.save();ctx.setLineDash([7,6]);ctx.strokeStyle="#59b7ff";ctx.globalAlpha=.78;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(L.x-vx*.18,L.y-vy*.18);ctx.lineTo(R.x+vx*.18,R.y+vy*.18);ctx.stroke();ctx.restore();
      ctx.fillStyle="#79c8ff";ctx.font="600 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";ctx.fillText("Shoulder axis",L.x-4,L.y-10);
    }
    if(bowShoulder&&bowWrist&&visibility(bowShoulder)>.45&&visibility(bowWrist)>.45){
      const S=pointToCanvas(bowShoulder,rect),W=pointToCanvas(bowWrist,rect),vx=W.x-S.x,vy=W.y-S.y,len=Math.max(1,Math.hypot(vx,vy)),ux=vx/len,uy=vy/len;
      const ex=W.x+ux*26,ey=W.y+uy*26;
      ctx.save();ctx.strokeStyle="#57efad";ctx.globalAlpha=.72;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(S.x,S.y);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-ux*11-uy*6,ey-uy*11+ux*6);ctx.moveTo(ex,ey);ctx.lineTo(ex-ux*11+uy*6,ey-uy*11-ux*6);ctx.stroke();ctx.restore();
    }
    if(drawWrist&&nose&&visibility(drawWrist)>.4&&visibility(nose)>.4){
      const W=pointToCanvas(drawWrist,rect),N=pointToCanvas(nose,rect);
      const shoulderPx=(leftShoulder&&rightShoulder)?Math.hypot(pointToCanvas(leftShoulder,rect).x-pointToCanvas(rightShoulder,rect).x,pointToCanvas(leftShoulder,rect).y-pointToCanvas(rightShoulder,rect).y):80;
      ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle="#d7b4ff";ctx.globalAlpha=.78;ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(N.x,N.y);ctx.lineTo(W.x,W.y);ctx.stroke();
      ctx.beginPath();ctx.arc(W.x,W.y,Math.max(11,shoulderPx*.075),0,Math.PI*2);ctx.stroke();ctx.restore();
      if(["Anchor","Aim / Hold","Expansion"].includes(metrics.phase)){
        ctx.fillStyle="#e5caff";ctx.font="600 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";ctx.fillText("Anchor ref",W.x+12,W.y-10);
      }
    }

    ctx.font="600 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textBaseline="bottom";
    const labels=[
      [drawElbow, finite(metrics.drawElbowDeg)?`Draw ${metrics.drawElbowDeg.toFixed(1)}°`:null, "#ff8b86"],
      [bowElbow, finite(metrics.bowArmDeg)?`Bow ${metrics.bowArmDeg.toFixed(1)}°`:null, "#77efbd"],
    ];
    labels.forEach(([p,label,color])=>{
      if(!p||!label||visibility(p)<.4) return;
      const P=pointToCanvas(p,rect);
      const width=ctx.measureText(label).width+12;
      ctx.fillStyle="#07101add";ctx.fillRect(P.x+9,P.y-24,width,20);
      ctx.fillStyle=color;ctx.fillText(label,P.x+15,P.y-8);
    });
  }
}

function round(v,n=3){ return finite(v)?Number(v.toFixed(n)):null; }
function recordMetricHistory(role,metrics){const arr=state.metricHistory[role]||(state.metricHistory[role]=[]),epoch=Number(metrics?.epochMs)||Date.now();arr.push({epochMs:epoch,metrics:{...metrics}});while(arr.length>160||arr[0]?.epochMs<epoch-6500)arr.shift();}
function getMetricsNearEpoch(role="side",epochMs=Date.now(),toleranceMs=420){const arr=state.metricHistory[role]||[];let best=null,delta=Infinity;for(const item of arr){const d=Math.abs(Number(item.epochMs)-Number(epochMs));if(d<delta){delta=d;best=item;}}return best&&delta<=toleranceMs?{metrics:{...best.metrics},deltaMs:delta}:null;}
function getMetricsWindow(role="side",startEpochMs=0,endEpochMs=Date.now()){return (state.metricHistory[role]||[]).filter(x=>x.epochMs>=startEpochMs&&x.epochMs<=endEpochMs).map(x=>({epochMs:x.epochMs,metrics:{...x.metrics}}));}

function maybeLog(role,lm,metrics,now){
  if(role==="analysis"||!state.recordingSessionId||!state.recordingStartMs)return;if(now-state.lastLogMs[role]<200)return;state.lastLogMs[role]=now;
  state.logs[role].push({t:round((now-state.recordingStartMs)/1000,3),phase:metrics.phase,metrics:{quality:round(metrics.quality,4),draw_elbow_deg:round(metrics.drawElbowDeg,3),bow_arm_deg:round(metrics.bowArmDeg,3),shoulder_line_deg:round(metrics.shoulderLineDeg,3),torso_lean_deg:round(metrics.torsoLeanDeg,3),head_movement_mm:round(metrics.headMovementMm,3),head_offset_pct:round(metrics.headOffsetPct,3),head_pitch_deg:round(metrics.headPitchDeg,3),anchor_face_pct:round(metrics.anchorFaceDistPct,3),head_toward_draw_pct:round(metrics.headTowardDrawPct,3),anchor_hand_drift_pct:round(metrics.anchorHandDriftPct,3),hold_time_s:round(metrics.holdTimeS,3)},landmarks:lm.map(p=>[round(p.x,5),round(p.y,5),round(p.z??0,5),round(visibility(p),4)])});
}

function updatePositionGuide(role,metrics){
  const el=document.getElementById(`${role}PositionGuide`),guide=document.getElementById(role==="side"?"framingGuide":`${role}FramingGuide`);
  const g=metrics?.positioning,live=videoIsLive(role);
  // A5: the dashed box is a persistent framing safe-area, never a detection boundary.
  // It must not blink in/out as landmark confidence changes because that made the
  // athlete perceive the camera view itself as moving. Hide it only when no live stream exists.
  if(guide){guide.classList.toggle("hidden",!live);guide.classList.toggle("good",!!live&&g?.level==="good");guide.classList.toggle("warn",!!live&&g?.level==="warn");guide.classList.toggle("bad",!!live&&g?.level==="bad");}
  if(!el)return;
  if(!metrics?.detected||!g){el.textContent=live?"Position: finding athlete · safe-area guide stays fixed":"Position: waiting for athlete";el.className="position-guide waiting";return;}
  el.textContent=`${g.message}${g.detail?` · ${g.detail}`:""}`;
  el.className=`position-guide ${g.level||"waiting"}`;
}
function updateRoleFooter(role,metrics){
  const el=document.getElementById(`${role}Pose`);
  updatePositionGuide(role,metrics);
  if(!el) return;
  const people=Number(metrics?.peopleCount)||0,view=metrics?.viewType&&metrics.viewType!=="unknown"?` · ${metrics.viewType}`:"",authority=!!state.perf[role]?.authority;
  el.textContent=metrics?.detected ? `POSE ${Math.round(metrics.quality*100)}%${metrics.effectiveInferenceHz?` · ${metrics.effectiveInferenceHz.toFixed(0)}Hz`:""}${authority?" · AUTH":""}${people>1?` · ${people} people`:""}${view}` : "POSE —";
  el.style.color=metrics?.identityAmbiguous?"#ff9c72":metrics?.quality>.7?"#77e5b1":metrics?.quality>.45?"#f2c94c":"#ff7772";
}

function setLiveMetric(id,value,suffix="",qualityClass=false){
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=finite(value)?`${value.toFixed(1)}${suffix}`:"—";
  if(qualityClass){
    el.className=value>=.72?"pose-good":value>=.48?"pose-warn":"pose-bad";
  }
}

function updateSideMetrics(metrics){
  if(!metrics?.detected)return;
  const phaseQ=metrics.phaseQuality??metrics.quality??0,metricQ=metrics.metricConfidence||{},ok=(k,min=.45)=>Number.isFinite(Number(metricQ[k]))?Number(metricQ[k])>=min:phaseQ>=min;
  setLiveMetric("mElbow",ok("drawElbow",.45)?metrics.drawElbowDeg:null);
  setLiveMetric("mBowArm",ok("bowArm",.45)?metrics.bowArmDeg:null);
  setLiveMetric("mShoulder",ok("shoulderLine",.48)?metrics.shoulderLineDeg:null);
  setLiveMetric("mTorso",ok("torsoLean",.50)?metrics.torsoLeanDeg:null);
  setLiveMetric("mHeadMm",ok("headMovement",.50)?metrics.headMovementMm:null);
  setLiveMetric("mHeadPitch",ok("headMovement",.52)?metrics.headPitchDeg:null,"°");
  setLiveMetric("mAnchorFace",ok("anchor",.50)?metrics.anchorFaceDistPct:null,"%");
  setLiveMetric("mHeadTowardDraw",ok("anchor",.50)?metrics.headTowardDrawPct:null,"%");
  setLiveMetric("mAnchorDrift",ok("anchor",.50)?metrics.anchorHandDriftPct:null,"%");
  setLiveMetric("mAnchorStability",ok("anchor",.50)?metrics.anchorHandRmsPct:null,"%");
  const releasePath=document.getElementById("mReleasePath");
  if(releasePath)releasePath.textContent=metrics.didRelease&&finite(metrics.releaseRearPct)&&finite(metrics.releaseOffAxisPct)?`${metrics.releaseRearPct.toFixed(0)} / ${metrics.releaseOffAxisPct.toFixed(0)}%`:"—";
  setLiveMetric("mHold",metrics.holdTimeS);
  const q=$("#mPoseQuality");if(q){q.textContent=`${Math.round(metrics.quality*100)}%`;q.className=metrics.quality>=.72?"pose-good":metrics.quality>=.48?"pose-warn":"pose-bad";}
  document.querySelectorAll(".pose-metrics .metric").forEach(x=>x.classList.add("live-metric"));
  window.FormAnalyzer?.updateLivePhase?.(metrics.phase,metrics);
}

function updateDiagnostic(role,metrics){
  // The caller supplies the strongest currently observable camera evidence.
  // Do not pin diagnostics to a UI role: Rear/Overhead may be the best live view.
  const detected=$("#poseDetectedText"), quality=$("#poseQualityText"), framing=$("#poseFramingText");
  if(!metrics?.detected){
    const uncertain=!!metrics?.identityAmbiguous;
    if(detected) detected.textContent=uncertain?`Athlete: identity uncertain · ${metrics.peopleCount||1} visible person${(metrics.peopleCount||1)===1?"":"s"}`:"Person: not detected";
    if(quality) quality.textContent=uncertain?"Tracking quality: paused to prevent identity swap":"Tracking quality: —";
    const cameraQuality=$("#cameraQualityText");if(cameraQuality)cameraQuality.textContent=uncertain?"Camera quality: athlete lock preserved while view is ambiguous":"Camera quality: waiting for stable person tracking";
    const geometry=$("#cameraGeometryText");if(geometry)geometry.textContent="Observed view geometry: —";
    if(framing) framing.textContent=uncertain?"Framing: wait for a clear athlete view":"Framing: move into view";
    const range=document.getElementById("rangeReadinessText");if(range)range.textContent=uncertain?"Position: athlete identity uncertain · shot decision paused":"Position: move athlete into view";
    return;
  }
  if(detected) detected.textContent=`Athlete: ${metrics.identityAmbiguous?"identity uncertain":"locked"} · ${metrics.peopleCount||1} person${(metrics.peopleCount||1)===1?"":"s"} · ${metrics.handedness}`;
  if(quality) quality.textContent=`Tracking quality: ${Math.round(metrics.quality*100)}% · release integrity ${Math.round((metrics.releaseQuality??metrics.phaseQuality??metrics.quality)*100)}%${metrics.effectiveInferenceHz?` · ${metrics.effectiveInferenceHz.toFixed(0)} Hz`:""}`;
  const cameraQuality=$("#cameraQualityText");if(cameraQuality){const issues=(metrics.visualIssues||[]).slice(0,2).join(", ");cameraQuality.textContent=`Camera quality: ${metrics.visualStatus||"—"}${Number.isFinite(metrics.visualQuality)?` ${Math.round(metrics.visualQuality*100)}%`:""}${issues?` · ${issues}`:""}`;}
  const geometry=$("#cameraGeometryText");if(geometry){const side=Number(metrics.viewSideScore),front=Number(metrics.viewFrontalScore);const fit=metrics.viewType==="side-like"?side:metrics.viewType==="front/rear-like"?front:Math.max(Number.isFinite(side)?side:0,Number.isFinite(front)?front:0);geometry.textContent=`Observed view geometry: ${metrics.viewType||"unknown"}${Number.isFinite(fit)?` · suitability ${Math.round(fit*100)}%`:""} · projected angles unless calibrated`;}
  if(framing) framing.textContent=`Framing: ${metrics.positioning?.message||metrics.framing} · ${metrics.viewType||"view unknown"}${metrics.rejectedJoints?` · rejected ${metrics.rejectedJoints}`:""}`;
  const range=document.getElementById("rangeReadinessText");if(range){const g=metrics.positioning;range.textContent=g?`Position: ${g.message}${g.fineReleaseReady?" · fine release detail ready":""}`:"Position: —";}
}

function bestCaptureMetrics(){
  const core=window.CoreEngine?.selectAuthorityRole?.({side:state.latest.side,rear:state.latest.rear,overhead:state.latest.overhead});
  if(core?.role&&state.latest[core.role]?.detected)return {role:core.role,m:state.latest[core.role],score:core.score};
  const ranked=CAPTURE_ROLES.map(role=>({role,m:state.latest[role]})).filter(x=>x.m?.detected).map(x=>({...x,score:(Number(x.m.shotObservability)||0)*.40+(Number(x.m.releaseQuality)||0)*.25+(Number(x.m.identityConfidence)||0)*.20+(Number(x.m.quality)||0)*.15})).sort((a,b)=>b.score-a.score);
  return ranked[0]||null;
}

async function processRole(role,now){
  if(!state.enabled || !isProcessable(role)){clearOverlay(role);updateRoleFooter(role,null);return;}
  const video=roleVideo(role);const activeCount=CAPTURE_ROLES.filter(isProcessable).length||1;
  // V4 A4 authority-first scheduler: priority follows current shot evidence, not Side/Rear labels.
  const perf=state.perf[role]||(state.perf[role]={}),authorityRole=detectorAuthorityRole();
  const current=state.latest[role]||{};
  const policy=window.CoreEngine?.schedulerPolicy?.({role,authorityRole,activeCount,costMs:perf.cost,phase:current.phase||"Setup",armed:!!current.armed,releaseCandidate:!!current.releaseCandidate})||{intervalMs:role===authorityRole?52:88,authority:role===authorityRole};
  const interval=policy.intervalMs;
  perf.authority=!!policy.authority;perf.targetMinHz=policy.targetMinHz||null;perf.authorityRole=authorityRole;
  if(now-state.lastInference[role]<interval)return;const since=state.lastInference[role]?now-state.lastInference[role]:0;state.lastInference[role]=now;
  if(since>0){const hz=1000/since;perf.hz=Number.isFinite(perf.hz)?perf.hz*.78+hz*.22:hz;}
  const started=performance.now();
  try{
    const landmarker=await ensureLandmarker(role);const ts=Math.max(performance.now(),(state.lastVideoTime[role]||0)+.01);state.lastVideoTime[role]=ts;const input=inferenceSource(role,video,activeCount,authorityRole);const phase01Trace=PHASE01_POSE_TRACE_CONFIG?phase01PoseTracePrepare({role,input,video,ts,activeCount,authorityRole,started}):null;const result=landmarker.detectForVideo(input,ts);if(PHASE01_POSE_TRACE_CONFIG)phase01PoseTraceComplete(phase01Trace,{result});
    if(!result?.landmarks?.length){
      const lostFor=state.lastDetectedAt[role]?now-state.lastDetectedAt[role]:Infinity;
      state.latest[role]={detected:false,role,occluded:lostFor<950,identityConfidence:state.identity[role]?.confidence||0};clearOverlay(role);updateRoleFooter(role,null);window.FormAnalyzer?.onPoseMetrics?.(role,state.latest[role]);
      if(lostFor>2300){state.cycles[role]=null;state.motion[role]={};state.renderSmoothed[role]=null;}
      const bestLost=bestCaptureMetrics();if(bestLost){updateDiagnostic(bestLost.role,bestLost.m);updateSideMetrics(bestLost.m);}else updateDiagnostic(role,state.latest[role]);phase01PoseTraceFlush(phase01Trace);return;
    }
    const needAppearance=result.landmarks.length>1||!!state.athleteLock[role]?.appearance;
    const appearances=needAppearance?result.landmarks.map(candidate=>torsoAppearance(role,video,candidate)):[];
    const picked=window.RangeIntelligence?.selectAthletePose?.(result.landmarks,state.athleteLock[role],Date.now(),appearances)||{index:0,landmarks:result.landmarks[0],lock:state.athleteLock[role],identityConfidence:1,ambiguous:false,peopleCount:result.landmarks.length};
    if(picked.index<0||!picked.landmarks){
      const lostFor=state.lastDetectedAt[role]?now-state.lastDetectedAt[role]:Infinity;
      state.identity[role]={confidence:picked.identityConfidence||0,ambiguous:true,appearanceConflict:!!picked.appearanceConflict,peopleCount:picked.peopleCount||result.landmarks.length};
      state.latest[role]={detected:false,role,occluded:lostFor<950,identityAmbiguous:true,identityConfidence:picked.identityConfidence||0,appearanceConflict:!!picked.appearanceConflict,peopleCount:picked.peopleCount||result.landmarks.length};
      clearOverlay(role);updateRoleFooter(role,null);window.FormAnalyzer?.onPoseMetrics?.(role,state.latest[role]);
      if(lostFor>2300){state.cycles[role]=null;state.motion[role]={};state.renderSmoothed[role]=null;}
      const bestAmbiguous=bestCaptureMetrics();if(bestAmbiguous){updateDiagnostic(bestAmbiguous.role,bestAmbiguous.m);updateSideMetrics(bestAmbiguous.m);}else updateDiagnostic(role,state.latest[role]);phase01PoseTraceFlush(phase01Trace);
      return;
    }
    state.athleteLock[role]=picked.lock;state.lastDetectedAt[role]=now;state.identity[role]={confidence:picked.identityConfidence,ambiguous:picked.ambiguous,appearanceConflict:!!picked.appearanceConflict,peopleCount:picked.peopleCount};
    const lm=smoothLandmarks(role,picked.landmarks,now);const world=result.worldLandmarks?.[picked.index]||null;const metrics=computeMetrics(role,lm,world,now);if(PHASE01_POSE_TRACE_CONFIG)phase01PoseTraceMetrics(phase01Trace,role,metrics);perf.cost=Number.isFinite(perf.cost)?perf.cost*.82+(performance.now()-started)*.18:(performance.now()-started);metrics.effectiveInferenceHz=perf.hz||metrics.effectiveInferenceHz;metrics.inferenceCostMs=perf.cost;recordMetricHistory(role,metrics);state.latest[role]=metrics;drawPose(role,displayLandmarks(role,lm),metrics);updateRoleFooter(role,metrics);window.FormAnalyzer?.onPoseMetrics?.(role,metrics);
    const bestNow=bestCaptureMetrics();if(bestNow){updateDiagnostic(bestNow.role,bestNow.m);updateSideMetrics(bestNow.m);}
    if(metrics.shotComplete&&videoIsLive(role))window.FormAnalyzer?.onShotEvidence?.(metrics);
    maybeLog(role,lm,metrics,now);phase01PoseTraceFlush(phase01Trace);
  }catch(err){console.error(`Pose ${role} error`,err);state.latest[role]={detected:false,role,error:String(err)};updateRoleFooter(role,null);}
}

async function loop(now){
  if(!state.running) return;
  if(state.ready && state.enabled){
    // A4 field fix: process the current shot-evidence authority first. Auxiliary
    // cameras are still sampled, but may no longer consume the best timing slot.
    const auth=detectorAuthorityRole();
    const ordered=[auth,...CAPTURE_ROLES.filter(r=>r!==auth),"analysis"].filter((r,i,a)=>r&&a.indexOf(r)===i);
    for(const role of ordered){
      await processRole(role,performance.now());
    }
  }else{
    ROLES.forEach(clearOverlay);
  }
  requestAnimationFrame(loop);
}

function resetBaseline(){
  authorityTracker?.reset?.();
  state.shotEngine?.reset?.();
  state.baselines={side:null,rear:null,overhead:null,analysis:null};
  state.motion={side:{},rear:{},overhead:{},analysis:{}};
  state.cycles={side:null,rear:null,overhead:null,analysis:null};
  state.validation={side:{},rear:{},overhead:{},analysis:{}};
  state.smoothed={side:null,rear:null,overhead:null,analysis:null};state.visualPose={side:null,rear:null,overhead:null,analysis:null};state.poseFilters={side:null,rear:null,overhead:null,analysis:null};state.bodyScale={side:.14,rear:.14,overhead:.14,analysis:.14};state.inferenceLockedWidth={side:null,rear:null,overhead:null,analysis:null};state.frameMotion={side:{},rear:{},overhead:{},analysis:{}};
  state.renderSmoothed={side:null,rear:null,overhead:null,analysis:null};
  state.athleteLock={side:null,rear:null,overhead:null,analysis:null};state.identity={side:null,rear:null,overhead:null,analysis:null};
  const framing=$("#poseFramingText");if(framing)framing.textContent="Framing: baseline reset — hold normal shooting posture";
}

function setEnabled(enabled){
  state.enabled=!!enabled;
  const btn=$("#poseToggleBtn");
  if(btn){
    btn.textContent=state.enabled?"Pose: ON":"Pose: OFF";
    btn.classList.toggle("off",!state.enabled);
  }
  if(!state.enabled){
    ROLES.forEach(r=>{clearOverlay(r);updateRoleFooter(r,null);});
    const detected=$("#poseDetectedText"); if(detected) detected.textContent="Person: pose disabled";
  }
}

function setOverlayVisible(visible){
  state.overlayVisible=!!visible;
  localStorage.setItem("3pm-skeleton-overlay",state.overlayVisible?"on":"off");
  const setting=$("#skeletonOverlayToggle");
  if(setting) setting.checked=state.overlayVisible;
  if(!state.overlayVisible) ROLES.forEach(clearOverlay);
}

function getLatestMetrics(role="side"){
  return state.latest[role] ? {...state.latest[role]} : null;
}

function beginRecording(sessionId){state.recordingSessionId=sessionId;state.recordingStartMs=performance.now();state.logs={side:[],rear:[],overhead:[]};state.lastLogMs={side:0,rear:0,overhead:0};}

async function endRecording(){
  const sessionId=state.recordingSessionId;if(!sessionId)return[];const payloads=[];
  for(const role of CAPTURE_ROLES){const samples=state.logs[role];if(!samples?.length)continue;const payload={format:"3PM Form Analyzer Pose Log",version:"5.0.0-dev4-x2.8.2-unified-review-consistency",session_id:sessionId,camera_role:role,model:"MediaPipe Pose Landmarker Lite",sample_rate_target_hz:5,landmark_format:"[x_normalized,y_normalized,z,visibility]",created_at:new Date().toISOString(),athlete:window.FormAnalyzer?.getCurrentAthlete?.()||null,samples};try{const r=await fetch(`/api/pose-log/${sessionId}/${role}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(!r.ok)throw new Error(await r.text());payloads.push(await r.json());}catch(err){console.warn(`Could not save ${role} pose log`,err);}}
  state.recordingSessionId=null;state.recordingStartMs=null;state.logs={side:[],rear:[],overhead:[]};return payloads;
}

async function init(){
  const toggle=$("#poseToggleBtn"), reset=$("#resetPoseBaselineBtn"), overlayToggle=$("#skeletonOverlayToggle");
  if(toggle) toggle.addEventListener("click",()=>setEnabled(!state.enabled));
  if(reset) reset.addEventListener("click",resetBaseline);
  if(overlayToggle){overlayToggle.checked=state.overlayVisible;overlayToggle.addEventListener("change",()=>setOverlayVisible(overlayToggle.checked));}
  setEngineUI("loading","Loading markerless pose engine…");
  try{
    state.fileset=await FilesetResolver.forVisionTasks(WASM_ROOT);
    state.ready=true;
    state.error=null;
    setEngineUI("ready","Markerless pose engine ready · live and recorded video supported");
    if(toggle){toggle.disabled=false;toggle.textContent="Pose: ON";}
    if(reset) reset.disabled=false;
    requestAnimationFrame(loop);
  }catch(err){
    state.error=err;
    state.ready=false;
    console.error("Pose engine failed to load",err);
    setEngineUI("bad","Pose engine could not load from the local runtime — restart the app or reinstall this build");
    if(toggle){toggle.disabled=true;toggle.textContent="Pose: Error";}
  }
}

window.PoseEngine={
  BUILD_ID:POSE_BUILD_ID,
  getLatestMetrics,
  getMetricsNearEpoch,
  getMetricsWindow,
  getAuthorityRole:()=>authorityTracker?.getRole?.()||detectorAuthorityRole(),
  getRoleHealth:(role="side")=>({visual:state.visualHealth[role]?{...state.visualHealth[role]}:null,performance:state.perf[role]?{...state.perf[role]}:null,inferenceSize:state.inferenceSize[role]?{...state.inferenceSize[role]}:null,latest:state.latest[role]?{...state.latest[role]}:null}),
  beginRecording,
  endRecording,
  resetBaseline,
  setEnabled,
  setOverlayVisible,
  getState:()=>({ready:state.ready,enabled:state.enabled,overlayVisible:state.overlayVisible,error:state.error?String(state.error):null}),
  _testValidate:(role,landmarks,now)=>smoothLandmarks(role,landmarks,now),
  _testValidationState:(role)=>state.validation[role],
  _testComputeMetrics:(role,lm,worldLm,now)=>computeMetrics(role,lm,worldLm,now),
  _testResetMotion:(role="side")=>{state.motion[role]={};state.cycles[role]=null;state.baselines[role]=null;state.smoothed[role]=null;state.visualPose[role]=null;state.poseFilters[role]=null;state.validation[role]={};},
  resetShotCycle:(role="side")=>{state.motion[role]={};state.cycles[role]=null;state.baselines[role]=null;state.athleteLock[role]=null;state.identity[role]=null;}
};
window.FormAnalyzer?.registerPoseBuild?.(POSE_BUILD_ID);

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
