// 3PM BLE4.3.8.9.4 Foundation Guard UI · monotonic Shot State Arbiter + real-bow Release readiness
// Activity classification remains available only as hidden diagnostics; it never gates Capture.
(function(){
'use strict';
const G=window.FoundationGuardCore;if(!G)return;
const CAPTURE_PROFILE='verified_shot';
let detectedActivity='unknown',activitySnapshot={label:'unknown',confidence:0,captureClassified:false,reason:'Diagnostic classifier idle'};
let state=G.fresh(CAPTURE_PROFILE),lastEpoch=0,wrapped=false,lastVeto='',originalShotEvidence=null,postCaptureReady=false,postCaptureReleaseEpoch=null,postCaptureRecoveryReady=false,terminalLock=false,terminalLockReason='',terminalReleaseEpoch=null;
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const LAYER_VERSION='BLE4.3.8.9.4.1-shot-state-arbiter-v2';
const DISPLAY_PHASE={Setup:'Set',Set:'Setup',Draw:'Draw',Anchor:'Anchor','Aim / Hold':'Aim / Hold',Expansion:'Expansion',Release:'Release','Follow Through':'Follow Through'};
function displayPhase(p){return DISPLAY_PHASE[p]||p||'—';}
function displayReason(reason){
  const t=String(reason||'');
  if(!t)return '';
  if(t.startsWith('Setup'))return `Set${t.slice(5)}`;
  if(t.startsWith('Set confirmed'))return `Setup confirmed${t.slice('Set confirmed'.length)}`;
  if(t.startsWith('Set reconstructed'))return `Setup reconstructed${t.slice('Set reconstructed'.length)}`;
  if(t.startsWith('Set ·'))return `Setup${t.slice(3)}`;
  return t.replace('Aim / Hold confirmed · waiting for Expansion / Release','Aim / Hold confirmed · Release Watch active · Expansion optional').replace('return to neutral Setup','return to neutral Set');
}
function normalizeActivity(name){return ['real_bow','elastic','hand_only','unknown'].includes(name)?name:'unknown';}
function applyActivity(snap,{testOverride=false}={}){
  const next=normalizeActivity(snap?.label||snap);
  activitySnapshot=typeof snap==='object'?{...activitySnapshot,...snap,label:next}:{...activitySnapshot,label:next,confidence:testOverride?1:activitySnapshot.confidence,captureClassified:testOverride&&(next==='real_bow'||next==='elastic')};
  detectedActivity=next;
  // Diagnostic only. Do not reset, retune, arm or veto the camera shot engine from this label.
}
function getActivityMode(){return detectedActivity;}
function captureDiag(){try{return window.CaptureIntegrityLayer?.inputDiag?.()||null;}catch{return null;}}
function lifecycleAuthority(metrics,snap){
  const life=captureDiag()?.sideLifecycle;if(postCaptureReady)return 'Set';
  if(!life)return null;
  // BLE43894: SideLifecycle is the monotonic athlete-facing authority. Raw pose/Foundation
  // classification may flicker, but the public Live Phase must not walk backwards inside a shot.
  try{
    const p=window.SideLifecycleCore?.authorityPhase?.(life,metrics||{});
    if(p)return p;
  }catch{}
  if(life.terminal===true)return metrics?.followThroughEnded===true||life.mode==='recovery'?'Recovery':'Follow Through';
  if(life.shotActive===true&&life.authorityPhase)return life.authorityPhase;
  if(life.shotActive!==true&&life.mode==='set')return 'Set';
  return null;
}
function guardedMetrics(metrics={}){
  const d=captureDiag();if(!d)return metrics||{};
  // The capture-intent layer owns shot-plane admission. Explicit false values are deliberate
  // vetoes and must override the legacy straight-elbow/posture fallbacks in the phase guard.
  // BLE43892: when the real-bow Anchor Bridge is actively supplying the frozen core with a
  // temporary phase-only face-distance proxy, Foundation must evaluate the SAME admission
  // geometry. Raw camera geometry remains exported separately and Release never uses this proxy.
  const bridge=d.anchorBridge||null;
  const phaseFace=bridge?.active===true&&Number.isFinite(Number(bridge?.engineFaceDist))?Number(bridge.engineFaceDist):(Number.isFinite(Number(d.phaseFaceDist))?Number(d.phaseFaceDist):metrics?.debugPhaseFaceDist);
  return {...(metrics||{}),
    debugSetReady:d.setAdmissionReady===true,
    debugPhaseShootingPosture:d.phaseShootingPosture===true&&d.bowPlaneReady===true,
    debugPhaseBowExtended:d.bowPlaneReady===true,
    debugPhaseFaceDist:phaseFace,
    debugAnchorBridgeActive:bridge?.active===true
  };
}
function hardSetReset(reason='Shot captured ✓ · Set for the next shot'){
  state=G.fresh(CAPTURE_PROFILE);state.neutralSeen=true;state.reason=reason;state.currentPhase='Setup';lastEpoch=0;
}
function clearTerminalLock(){terminalLock=false;terminalLockReason='';terminalReleaseEpoch=null;}
function markCaptureComplete(releaseEpoch=null){
  clearTerminalLock();postCaptureReady=true;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=Number.isFinite(Number(releaseEpoch))?Number(releaseEpoch):Date.now();
  hardSetReset('Shot captured ✓ · Set for the next shot');render(null);
}
function markRecoveryReady(){clearTerminalLock();postCaptureRecoveryReady=true;hardSetReset('Recovery complete · Set — Ready');render(null);}
function markLetDownReady(epoch=null,reason='Let-down complete'){
  clearTerminalLock();postCaptureReady=false;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=null;
  hardSetReset(`${reason} · Set — Ready`);render(null);
}
function clearPostCaptureReady(){clearTerminalLock();postCaptureReady=false;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=null;hardSetReset('Set · ready for the next shot');render(null);}
function beginShotCycle(){clearTerminalLock();postCaptureReady=false;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=null;}
function lockRejectedRelease(reason='shot-truth',metrics={}){
  postCaptureReady=false;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=null;
  terminalLock=true;terminalLockReason=reason;terminalReleaseEpoch=Number(metrics?.releaseEpochMs||metrics?.releaseAlignedEpochMs)||Date.now();
  lastVeto=`Capture rejected · ${reason}`;
  state.confirmed.Setup=true;state.confirmed.Set=true;state.confirmed.Draw=true;state.confirmed.Anchor=true;state.confirmed['Aim / Hold']=true;state.confirmed.Release=true;state.armedEver=true;
  const follow=metrics?.phase==='Follow Through'||metrics?.followThroughConfirmed===true||metrics?.shotComplete===true;
  if(follow)state.confirmed['Follow Through']=true;
  state.currentPhase=follow?'Follow Through':'Release';state.reason=`Capture rejected · ${reason} · finishing this shot before Set`;
  render(metrics);return G.snapshot(state,guardedMetrics(metrics||{}));
}
function rejectFalseRelease(reason='shot-truth',metrics={}){return lockRejectedRelease(reason,metrics);}
function update(metrics){
  const gm=guardedMetrics(metrics||{}),ep=Number(gm?.epochMs)||Date.now(),d=captureDiag();
  // A confirmed terminal shot may be rejected by the capture transaction, but it must never be
  // reinterpreted as a brand-new Draw while the old core is still in Follow-through/Recovery.
  if(terminalLock){
    const recovered=gm?.followThroughEnded===true||(String(gm?.phase||gm?.primaryPhase||'')==='Setup'&&gm?.releaseConfirmed!==true&&terminalReleaseEpoch&&ep-terminalReleaseEpoch>120);
    if(recovered){clearTerminalLock();hardSetReset('Shot ended · Set for the next shot');render(null);return G.snapshot(state,gm);}
    const follow=gm?.phase==='Follow Through'||gm?.followThroughConfirmed===true||gm?.shotComplete===true;
    state.confirmed.Release=true;state.armedEver=true;if(follow)state.confirmed['Follow Through']=true;
    state.currentPhase=follow?'Follow Through':'Release';state.reason=`Capture rejected · ${terminalLockReason} · finishing this shot before Set`;
    return G.snapshot(state,gm);
  }
  // After a successful Capture, stale Release/Follow-through metrics are display-inert. The UI
  // remains on Set until recovery is finished and a NEW verified shot-plane admission appears.
  if(postCaptureReady){
    const rawPhase=String(gm?.phase||gm?.primaryPhase||''),life=d?.sideLifecycle||null;
    const freshStartPhase=['Set','Draw','Anchor','Aim / Hold'].includes(rawPhase)&&gm?.releaseConfirmed!==true&&gm?.followThroughConfirmed!==true;
    const strictFresh=d?.setAdmissionReady===true&&d?.bowPlaneReady===true;
    const continuityFresh=life?.shotActive===true&&life?.verifiedDraw===true&&['Draw','Anchor','Aim / Hold'].includes(String(life?.authorityPhase||''));
    if(!(postCaptureRecoveryReady&&freshStartPhase&&(strictFresh||continuityFresh)&&!window.CaptureIntegrityLayer?.isRearmRequired?.()))return G.snapshot(state,gm);
    postCaptureReady=false;postCaptureRecoveryReady=false;postCaptureReleaseEpoch=null;hardSetReset('Setup detected · starting a fresh shot');
  }
  if(ep===lastEpoch&&gm?.detected)return G.snapshot(state,gm);
  lastEpoch=ep;return G.update(state,gm,CAPTURE_PROFILE,ep);
}
function setReadiness(text,cls='warn'){
  const a=$('#shotReadiness'),b=$('#shotReadinessOverlay');
  if(a){a.textContent=text;a.className=`readiness-chip ${cls}`;}
  if(b){b.textContent=text;b.className=`readiness-overlay ${cls}`;}
}
function render(metrics){
  const liveMetrics=metrics||window.PoseEngine?.getLatestMetrics?.('side')||{};
  const snap=G.snapshot(state,liveMetrics);
  const firstPhaseConfirmed=!!snap.confirmed.Setup;
  const displayReady=postCaptureReady===true;
  const authority=lifecycleAuthority(liveMetrics,snap);
  const reasonText=displayReady?'Shot captured ✓ · Set — Ready':authority==='Set'?'Set — Ready':authority==='Recovery'?'Recovery · returning to Set':authority==='Follow Through'?'Follow Through · terminal lock':displayReason(snap.reason);
  const reason=$('#phaseGuardReason');if(reason)reason.textContent=reasonText;
  const phaseText=displayReady?'Set':(authority||(firstPhaseConfirmed?displayPhase(snap.currentPhase):(liveMetrics?.detected?'Ready':'—')));
  const phaseEl=$('#livePhaseBadge');if(phaseEl){
    phaseEl.textContent=`Phase: ${phaseText}${!displayReady&&!['Set','Recovery'].includes(authority)&&Number.isFinite(Number(liveMetrics?.holdTimeS))?` · Hold ${Number(liveMetrics.holdTimeS).toFixed(2)} s`:''}`;
  }
  const authorityInternal={Set:'Setup',Setup:'Set',Draw:'Draw',Anchor:'Anchor','Aim / Hold':'Aim / Hold',Expansion:'Expansion',Release:'Release','Follow Through':'Follow Through'}[authority]||null;
  $$('#phaseButtons [data-phase]').forEach(el=>{
    const p=el.dataset.phase,ok=!displayReady&&!!snap.confirmed[p],cur=displayReady?p==='Setup':authority==='Recovery'?false:authorityInternal?p===authorityInternal:(firstPhaseConfirmed&&p===snap.currentPhase);
    el.classList.remove('live-active','phase-confirmed','phase-pending','phase-current','phase-live-current','phase-complete','phase-upcoming');
    if(cur)el.classList.add('phase-live-current');
    else if(ok)el.classList.add('phase-complete');
    else el.classList.add('phase-upcoming');
    const base=displayPhase(p);
    el.textContent=cur?`● ${base}`:ok?`✓ ${base}`:base;
    el.title=displayReady?(cur?'Shot completed · ready for the next Setup':'Waiting for the next shot'):cur?`Current detector position · ${reasonText}`:(ok?'Passed in this shot sequence':'Not reached yet');
  });
  if(metrics?.detected){
    const cls=snap.confirmed['Aim / Hold']?'good':'warn';
    setReadiness(reasonText,displayReady?'good':cls);
  }
  document.body.dataset.captureProfile=CAPTURE_PROFILE;
  return snap;
}
function gateFor(m){
  const gate=G.captureGate(state,m,CAPTURE_PROFILE);
  state.lastGate=gate;return gate;
}
function wrapFormAnalyzer(){
  const FA=window.FormAnalyzer;if(!FA||wrapped)return false;wrapped=true;
  const original={updateLivePhase:FA.updateLivePhase,onPoseMetrics:FA.onPoseMetrics,onShotEvidence:FA.onShotEvidence,isAutoMarkEnabled:FA.isAutoMarkEnabled};
  originalShotEvidence=original.onShotEvidence;
  FA.getActivityMode=()=>detectedActivity; // diagnostics/backward compatibility only
  FA.getCaptureProfile=()=>CAPTURE_PROFILE;
  FA.updateLivePhase=function(phase,m){
    if((m?.role||'side')==='side'){update(m);const out=original.updateLivePhase?.(state.currentPhase,m);render(m);return out;}
    return original.updateLivePhase?.(phase,m);
  };
  FA.onPoseMetrics=function(role,m){
    if(role==='side'&&(Number(m?.epochMs)||0)!==lastEpoch)update(m);
    const out=original.onPoseMetrics?.(role,m);
    if(role==='side')render(m);
    return out;
  };
  FA.onShotEvidence=function(m){
    if((m?.role||'side')==='side'){
      update(m);const gate=gateFor(m);
      if(!gate.accepted){
        lastVeto=gate.reason;
        window.CaptureIntegrityLayer?.recordGateOutcome?.('foundation',gate,m);
        // Foundation can be the outermost FormAnalyzer wrapper in the real index.html load order.
        // If it rejects a confirmed terminal release, it must own the same terminal phase lock as
        // CaptureIntegrity; otherwise the still-running old-shot Follow Through can be re-read as
        // a fresh Draw and the Live row visibly jumps backwards.
        if(m?.releaseConfirmed===true||m?.shotComplete===true)lockRejectedRelease('foundation-gate',m);
        console.warn('[3PM verified shot guard]',gate.reason,m);setReadiness(gate.reason,'warn');render(m);return;
      }
      lastVeto='';setReadiness('Verified shot proof · Capture accepted','good');
    }
    return original.onShotEvidence?.(m);
  };
  FA.isAutoMarkEnabled=()=>original.isAutoMarkEnabled?.()??true;
  window.FoundationGuardLayer.originalFormAnalyzer=original;
  return true;
}
function traceState(){
  const m=guardedMetrics(window.PoseEngine?.getLatestMetrics?.('side')||{}),s=G.snapshot(state,m);
  return {...s,captureProfile:CAPTURE_PROFILE,detectedActivity,activityClassifier:{...activitySnapshot},activityClassifierPolicy:'diagnostic-only-hidden-never-gates-capture',lastGate:state.lastGate||null,lastVeto:lastVeto||null,terminalLock,terminalLockReason:terminalLockReason||null,postCaptureReady};
}
window.FoundationGuardLayer={version:G.VERSION,buildVersion:LAYER_VERSION,getActivityMode,getCaptureProfile:()=>CAPTURE_PROFILE,state:()=>state,traceState,render,installFormAnalyzer:wrapFormAnalyzer,markCaptureComplete,markRecoveryReady,markLetDownReady,clearPostCaptureReady,beginShotCycle,lockRejectedRelease,rejectFalseRelease,
  // Test-only classifier compatibility hook; it cannot change the live capture profile.
  setActivityMode:(name)=>applyActivity({label:normalizeActivity(name),confidence:1,captureClassified:['real_bow','elastic'].includes(name),reason:'Test diagnostic override'},{testOverride:true})};
window.addEventListener?.('3pm:activity-detected',e=>applyActivity(e.detail||{label:'unknown'}));
const boot=()=>{wrapFormAnalyzer();const t=setInterval(()=>{if(wrapFormAnalyzer())clearInterval(t);},20);setTimeout(()=>clearInterval(t),3000);render(null);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
