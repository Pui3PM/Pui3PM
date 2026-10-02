// 3PM Native Vision Shadow Layer v1
// Passive A/B telemetry only. Production MediaPipe + frozen shot logic remain authoritative.
(function(){
'use strict';
const Core=window.NativeVisionShadowCore;if(!Core)return;
const BASE='http://127.0.0.1:48735',ROLES=['side'];
const states=Object.fromEntries(ROLES.map(r=>[r,{role:r,production:null,native:null,stats:Core.fresh(),lastHintKey:'',lastHintAt:0,lastPollAt:0,error:null,available:false}]));
let installed=false,enabled=true,pollTimer=null,enableSent=false;
const now=()=>Date.now();
async function fetchJSON(path,options={},timeout=650){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(`${BASE}${path}`,{cache:'no-store',mode:'cors',targetAddressSpace:'loopback',...options,signal:ctl.signal});const data=await r.json().catch(()=>({}));return{ok:r.ok,status:r.status,data};}finally{clearTimeout(tm);}}
async function post(path,obj){return fetchJSON(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj||{})},650);}
function productionMetric(role,metrics){
  const s=states[role];if(!s||!enabled||!metrics)return;
  s.production=metrics;
  const phase=String(metrics.phase||metrics.primaryPhase||'Setup'),handedness=String(metrics.handedness||'Right-handed');
  const key=`${phase}|${handedness}`;
  if(key!==s.lastHintKey||now()-s.lastHintAt>900){s.lastHintKey=key;s.lastHintAt=now();post('/vision/hint',{role,phase,handedness}).catch(()=>{});}
}
async function pollRole(role){
  const s=states[role];if(!s||!enabled)return;
  try{
    const r=await fetchJSON(`/vision/latest?role=${encodeURIComponent(role)}`);
    if(!r.ok){if(r.status===404){s.available=false;s.error='Native helper does not expose Vision shadow';}return;}
    s.available=!!r.data?.available;s.error=null;s.native=r.data||null;
    if(s.available&&s.production){const cmp=Core.compare(s.production,s.native);s.stats=Core.update(s.stats,cmp);if(cmp)window.dispatchEvent(new CustomEvent('3pm-native-vision-shadow',{detail:{role,comparison:cmp,summary:Core.summary(s.stats)}}));}
  }catch(err){s.error=String(err?.message||err);s.available=false;}
}
async function poll(){if(!enabled)return;for(const r of ROLES)await pollRole(r);}
function install(){
  if(installed||!window.FormAnalyzer?.onPoseMetrics)return false;
  const original=window.FormAnalyzer.onPoseMetrics;
  if(original.__3pmNativeVisionShadowWrapped){installed=true;return true;}
  function wrapped(role,metrics){const out=original.apply(this,arguments);try{productionMetric(role,metrics);}catch{}return out;}
  wrapped.__3pmNativeVisionShadowWrapped=true;wrapped.__3pmOriginal=original;
  window.FormAnalyzer.onPoseMetrics=wrapped;installed=true;
  post('/vision/enable',{enabled:true}).then(r=>{enableSent=!!r.ok;}).catch(()=>{});pollTimer=setInterval(poll,260);void poll();return true;
}
async function deviceCapabilities(){try{const r=await fetchJSON('/devices',{},900);return r.ok?(r.data?.devices||[]):[];}catch{return[];}}
function diagnostics(role='side'){const s=states[role];return s?{role,enabled,installed,enableSent,available:s.available,error:s.error,native:s.native?{epoch_ms:s.native.epoch_ms,latency_ms:s.native.latency_ms,body_quality:s.native.body_quality,hand_pose_active:s.native.hand_pose_active,phase_hint:s.native.phase_hint}:null,summary:Core.summary(s.stats)}:null;}
function setEnabled(v){enabled=!!v;post('/vision/enable',{enabled}).catch(()=>{});if(!enabled&&pollTimer){clearInterval(pollTimer);pollTimer=null;}else if(enabled&&!pollTimer){pollTimer=setInterval(poll,260);void poll();}}
window.NativeVisionShadow={version:'3PM-native-vision-shadow-layer-v1',diagnostics,deviceCapabilities,setEnabled,get enabled(){return enabled;},get installed(){return installed;}};
if(!install()){const t=setInterval(()=>{if(install())clearInterval(t);},100);setTimeout(()=>clearInterval(t),10000);}
})();
