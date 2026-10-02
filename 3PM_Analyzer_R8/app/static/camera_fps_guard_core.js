// 3PM BLE4.3.8.9.4.1 Camera FPS Guard Core (pure/testable)
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CameraFpsGuardCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.4.1-camera-fps-guard-core-v1';
function fresh(){return{overloadStrikes:0,rawStrikes:0,multiStrikes:0,downgraded:false,lastReason:'healthy'};}
function update(state,input={}){
  const s=state||fresh();
  const fps=Number(input.fps),poseHz=Number(input.poseHz),costMs=Number(input.costMs),rawFps=Number(input.rawFps),discarded=Number(input.discarded)||0,jitter=Number(input.jitterMs);
  const high=Number.isFinite(fps)&&fps>=50;
  if(!high||s.downgraded){s.overloadStrikes=0;s.rawStrikes=0;s.multiStrikes=0;return{state:s,action:'hold',reason:s.downgraded?'already-fallback':'not-high-fps'};}
  const unsafe=input.shotActive===true||input.armed===true||input.candidate===true||['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through','Recovery'].includes(String(input.phase||''));
  const multi=(Number(input.activeCount)||1)>1;
  const overloaded=(Number.isFinite(poseHz)&&poseHz<11.5)||(Number.isFinite(costMs)&&costMs>82);
  const rawWeak=(Number.isFinite(rawFps)&&rawFps<45)||(discarded>=3)||(Number.isFinite(jitter)&&jitter>28);
  s.multiStrikes=multi?s.multiStrikes+1:0;s.overloadStrikes=overloaded?s.overloadStrikes+1:0;s.rawStrikes=rawWeak?s.rawStrikes+1:0;
  let reason='healthy';if(s.multiStrikes>=2)reason='multi-camera-bandwidth';else if(s.overloadStrikes>=3)reason='pose-overload';else if(s.rawStrikes>=3)reason='raw-evidence-instability';
  s.lastReason=reason;
  if(reason!=='healthy'){if(unsafe)return{state:s,action:'pending-down',reason};s.downgraded=true;return{state:s,action:'down30',reason};}
  return{state:s,action:'hold',reason:'healthy'};
}
return{VERSION,fresh,update};
});
