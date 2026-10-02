// 3PM BLE4.3.8.9.4.1 High-FPS safety governor.
// CameraPolicy may request 720p60 for a single capable camera. This guard only FALLS BACK to 30 fps
// after repeated overload evidence, never oscillates back up, never changes resolution, and never
// applies constraints during an active shot.
(function(){
'use strict';
const Core=window.CameraFpsGuardCore;if(!Core)return;
const VERSION='BLE4.3.8.9.4.1-camera-fps-guard-layer-v1',roles=['side','rear','overhead'];
const states=Object.fromEntries(roles.map(r=>[r,Core.fresh()]));const tracks=new WeakSet();let timer=null;
function video(role){return document.getElementById(`${role}Video`);}
function activeRoles(){return roles.filter(r=>!!video(r)?.srcObject);}
function shotDiag(){const life=window.CaptureIntegrityLayer?.inputDiag?.()?.sideLifecycle||null,m=window.PoseEngine?.getLatestMetrics?.('side')||{};return{shotActive:life?.shotActive===true||life?.terminal===true,armed:m?.armed===true,candidate:m?.releaseCandidate===true,phase:life?.authorityPhase||m?.phase||'Set'};}
async function down30(role,track,reason){if(!track||track.readyState==='ended')return false;const d=shotDiag();if(d.shotActive||d.armed||d.candidate)return false;const st=track.getSettings?.()||{},w=Number(st.width)||undefined,h=Number(st.height)||undefined;try{await track.applyConstraints({width:w?{ideal:w}:undefined,height:h?{ideal:h}:undefined,frameRate:{ideal:30,max:30}});track._3pmFpsGuard=`30fps fallback · ${reason}`;return true;}catch(err){console.warn('[3PM FPS Guard] fallback could not apply',role,err);return false;}}
async function tick(){
  const active=activeRoles(),d=shotDiag();
  for(const role of active){const track=video(role)?.srcObject?.getVideoTracks?.()[0];if(!track)continue;const st=track.getSettings?.()||{},fps=Number(st.frameRate)||0;if(fps<50)continue;
    const m=window.PoseEngine?.getLatestMetrics?.(role)||{},health=window.PoseEngine?.getRoleHealth?.(role)?.performance||{},td=window.TemporalEvidenceLayer?.diagnostics?.(role)||{};
    const out=Core.update(states[role],{fps,poseHz:Number(m.effectiveInferenceHz??health.hz),costMs:Number(m.inferenceCostMs??health.cost),rawFps:Number(td.rawFps),discarded:Number(td.discardedFrames),jitterMs:Number(td.jitterMs),activeCount:active.length,...d});
    states[role]=out.state;if(out.action==='down30')await down30(role,track,out.reason);
  }
}
function start(){if(timer)return;timer=setInterval(()=>{void tick();},650);setTimeout(()=>void tick(),900);}
window.CameraFpsGuardLayer={version:VERSION,state:(r='side')=>({...states[r]}),tick};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
