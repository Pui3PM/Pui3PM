import { FilesetResolver, PoseLandmarker } from "/static/vendor/mediapipe/vision_bundle.mjs";

// BLE4.3.6.2 presentation-only auxiliary skeleton fallback.
// IMPORTANT: this does NOT feed Form Analyzer measurements, shot phases, release
// classification, authority selection, or saved evidence.  The frozen X2.8.2
// pose/analysis core stays authoritative.  This layer exists only so a live
// Rear/Overhead camera can still show a diagnostic skeleton when the core
// intentionally withholds a measurement candidate (identity/quality gating).

const ROLES = ["rear", "overhead"];
const MODEL_URL = "/static/models/pose_landmarker_lite.task";
const WASM_ROOT = "/static/vendor/mediapipe/wasm";
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
  [11,12],[11,13],[13,15],[15,17],[17,19],[19,15],[15,21],
  [12,14],[14,16],[16,18],[18,20],[20,16],[16,22],
  [11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[27,31],
  [24,26],[26,28],[28,30],[30,32],[28,32]
];
const LEFT = new Set([1,2,3,7,9,11,13,15,17,19,21,23,25,27,29,31]);
const RIGHT = new Set([4,5,6,8,10,12,14,16,18,20,22,24,26,28,30,32]);
const state = {
  fileset:null,
  landmarker:null,
  loading:null,
  lastRun:{rear:0,overhead:0},
  lastVideoTime:{rear:-1,overhead:-1},
  smooth:{rear:null,overhead:null},
  previousCenter:{rear:null,overhead:null},
  turn:0,
  running:true,
  error:null,
};

function visibility(p){ return Number.isFinite(p?.visibility) ? p.visibility : 1; }
function overlayEnabled(){
  const core=window.PoseEngine?.getState?.();
  if(core && core.enabled===false) return false;
  if(core && core.overlayVisible===false) return false;
  return localStorage.getItem("3pm-skeleton-overlay") !== "off";
}
function video(role){ return document.getElementById(`${role}Video`); }
function processable(role){
  const v=video(role);
  return !!(v && v.readyState>=2 && v.videoWidth>0 && v.videoHeight>0 && (v.srcObject || v.currentSrc || v.src));
}
function coreOwnsVisual(role){
  const m=window.PoseEngine?.getLatestMetrics?.(role);
  return !!m?.detected;
}
function ensureSurface(role){
  const v=video(role); const wrap=v?.parentElement;
  if(!wrap) return null;
  let c=document.getElementById(`${role}VisualFallbackOverlay`);
  if(!c){
    c=document.createElement("canvas");
    c.id=`${role}VisualFallbackOverlay`;
    c.className="pose-visual-fallback-overlay";
    c.setAttribute("aria-hidden","true");
    wrap.appendChild(c);
  }
  let badge=document.getElementById(`${role}VisualFallbackBadge`);
  if(!badge){
    badge=document.createElement("div");
    badge.id=`${role}VisualFallbackBadge`;
    badge.className="pose-visual-fallback-badge hidden";
    badge.textContent="VISUAL SKELETON · measurement gated";
    wrap.appendChild(badge);
  }
  return {canvas:c,badge};
}
function clear(role){
  const s=ensureSurface(role); if(!s) return;
  const c=s.canvas, ctx=c.getContext("2d");
  if(ctx) ctx.clearRect(0,0,c.width,c.height);
  s.badge.classList.add("hidden");
  state.smooth[role]=null;
}
function displayRect(v,c){
  const cw=c.clientWidth||1,ch=c.clientHeight||1;
  const vw=v.videoWidth||cw,vh=v.videoHeight||ch;
  const scale=Math.min(cw/vw,ch/vh),w=vw*scale,h=vh*scale;
  return {x:(cw-w)/2,y:(ch-h)/2,w,h};
}
function pt(p,r){ return {x:r.x+p.x*r.w,y:r.y+p.y*r.h}; }
function color(a,b){
  if(LEFT.has(a)&&LEFT.has(b))return "#45e09a";
  if(RIGHT.has(a)&&RIGHT.has(b))return "#ff6d68";
  return "#ffd84d";
}
function candidateCenter(lm){
  const ids=[11,12,23,24], pts=ids.map(i=>lm?.[i]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!pts.length)return null;
  return {x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
}
function candidateScore(role,lm){
  const ids=[0,11,12,13,14,15,16,23,24];
  const q=ids.reduce((s,i)=>s+Math.max(0,Math.min(1,visibility(lm?.[i]))),0)/ids.length;
  const c=candidateCenter(lm); if(!c)return q-.5;
  const centered=1-Math.min(1,Math.hypot(c.x-.5,c.y-.52)/.72);
  const prev=state.previousCenter[role];
  const continuity=prev?1-Math.min(1,Math.hypot(c.x-prev.x,c.y-prev.y)/.38):.5;
  return q*.66+centered*.14+continuity*.20;
}
function choose(role,list){
  if(!Array.isArray(list)||!list.length)return null;
  let best=list[0],score=-Infinity;
  for(const lm of list){const s=candidateScore(role,lm);if(s>score){score=s;best=lm;}}
  state.previousCenter[role]=candidateCenter(best)||state.previousCenter[role];
  return best;
}
function smooth(role,lm){
  const prev=state.smooth[role];
  if(!prev||prev.length!==lm.length){state.smooth[role]=lm.map(p=>({...p}));return state.smooth[role];}
  const a=.58;
  state.smooth[role]=lm.map((p,i)=>{
    const q=prev[i]||p;
    return {...p,x:q.x+(p.x-q.x)*a,y:q.y+(p.y-q.y)*a,z:(q.z??p.z??0)+((p.z??0)-(q.z??p.z??0))*a};
  });
  return state.smooth[role];
}
function draw(role,lm){
  const s=ensureSurface(role),v=video(role); if(!s||!v)return;
  const c=s.canvas,dpr=window.devicePixelRatio||1,cw=Math.max(1,c.clientWidth),ch=Math.max(1,c.clientHeight);
  const bw=Math.round(cw*dpr),bh=Math.round(ch*dpr);
  if(c.width!==bw||c.height!==bh){c.width=bw;c.height=bh;}
  const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
  const r=displayRect(v,c);ctx.lineCap="round";ctx.lineJoin="round";
  for(const [a,b] of CONNECTIONS){
    const pa=lm[a],pb=lm[b]; if(!pa||!pb||visibility(pa)<.36||visibility(pb)<.36)continue;
    const A=pt(pa,r),B=pt(pb,r);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);
    ctx.strokeStyle=color(a,b);ctx.globalAlpha=Math.max(.30,Math.min(1,Math.min(visibility(pa),visibility(pb))));ctx.lineWidth=2.4;ctx.stroke();
  }
  ctx.globalAlpha=1;
  lm.forEach((p,i)=>{
    if(visibility(p)<.40)return;
    if(i>24)return; // upper body is the useful diagnostic region for auxiliary views
    const P=pt(p,r);ctx.beginPath();ctx.arc(P.x,P.y,3.2,0,Math.PI*2);
    ctx.fillStyle=LEFT.has(i)?"#58efac":RIGHT.has(i)?"#ff7772":"#ffe769";ctx.fill();ctx.strokeStyle="#07101a";ctx.lineWidth=1.1;ctx.stroke();
  });
  s.badge.classList.remove("hidden");
}
async function ensureLandmarker(){
  if(state.landmarker)return state.landmarker;
  if(state.loading)return state.loading;
  state.loading=(async()=>{
    state.fileset=await FilesetResolver.forVisionTasks(WASM_ROOT);
    state.landmarker=await PoseLandmarker.createFromOptions(state.fileset,{
      baseOptions:{modelAssetPath:MODEL_URL},runningMode:"VIDEO",numPoses:3,
      minPoseDetectionConfidence:.40,minPosePresenceConfidence:.40,minTrackingConfidence:.40,
      outputSegmentationMasks:false,
    });
    return state.landmarker;
  })();
  try{return await state.loading;}finally{state.loading=null;}
}
async function process(role,now){
  if(!overlayEnabled()||!processable(role)||coreOwnsVisual(role)){clear(role);return;}
  if(now-state.lastRun[role]<125)return;
  state.lastRun[role]=now;
  try{
    const lmkr=await ensureLandmarker();
    const v=video(role),ts=Math.max(performance.now(),(state.lastVideoTime[role]||0)+.01);state.lastVideoTime[role]=ts;
    const result=lmkr.detectForVideo(v,ts),picked=choose(role,result?.landmarks||[]);
    if(!picked){clear(role);return;}
    draw(role,smooth(role,picked));state.error=null;
  }catch(err){
    state.error=String(err);clear(role);console.warn(`Visual skeleton fallback ${role} unavailable`,err);
  }
}
async function tick(now){
  if(!state.running)return;
  // Round-robin keeps this presentation-only fallback bounded.  It only spends
  // inference time on roles for which the frozen core is not already drawing.
  const first=ROLES[state.turn++%ROLES.length],second=ROLES[(state.turn)%ROLES.length];
  await process(first,now);
  if(!coreOwnsVisual(second) && processable(second) && now-state.lastRun[second]>=125) await process(second,performance.now());
  requestAnimationFrame(tick);
}
function start(){
  ROLES.forEach(ensureSurface);
  requestAnimationFrame(tick);
}
window.addEventListener("pagehide",()=>{state.running=false;});
window.addEventListener("pageshow",()=>{if(!state.running){state.running=true;requestAnimationFrame(tick);}});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
