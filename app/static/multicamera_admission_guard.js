// 3PM BLE4.3.8.2 Multi-Camera Admission Guard
// Integration layer only. Does not alter X2.8.2 Dev4 frozen analysis core.
// Policy: Side is the automatic-shot admission view. Rear/Overhead remain synchronized evidence views.
(function(){
  'use strict';
  const FA=window.FormAnalyzer;
  if(!FA) return;
  const originalPose=FA.onPoseMetrics;
  const originalEvidence=FA.onShotEvidence;
  const originalLivePhase=FA.updateLivePhase;
  const state={last:{side:null,rear:null,overhead:null},caller:null,invalid:[],lastNotice:''};
  const badBlockers=new Set(['waiting_set','waiting_draw','waiting_anchor','tracking_low','recovering_anchor']);
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  function releaseEpoch(m){return n(m?.releaseEpochMs)||n(m?.releaseAlignedEpochMs)||0;}
  function purge(){const now=Date.now();state.invalid=state.invalid.filter(x=>now-x.at<5000);}
  function markInvalid(m,reason){const epoch=releaseEpoch(m); if(!epoch)return; purge(); if(!state.invalid.some(x=>Math.abs(x.epoch-epoch)<180))state.invalid.push({epoch,reason,at:Date.now()});}
  function invalidReason(m){purge();const epoch=releaseEpoch(m);const x=state.invalid.find(x=>epoch&&Math.abs(x.epoch-epoch)<520);return x?.reason||null;}
  function hipsVisible(m){const v=m?.torsoLeanDeg;return !!m?.detected && v!==null && v!==undefined && v!=='' && Number.isFinite(Number(v));}
  function sideMetric(){return state.last.side||window.PoseEngine?.getLatestMetrics?.('side')||null;}
  function setReadiness(text,cls='warn'){
    const el=document.getElementById('shotReadiness'); if(el){el.textContent=text;el.className=`readiness-chip ${cls}`;}
    const ov=document.getElementById('shotReadinessOverlay'); if(ov){ov.textContent=text;ov.className=`readiness-chip ${cls}`;}
  }
  function notice(text){if(state.lastNotice===text)return;state.lastNotice=text;console.warn('[3PM admission guard]',text);}
  function decorateAux(role,m){
    if(role!=='rear'&&role!=='overhead')return;
    const pos=document.getElementById(`${role}PositionGuide`);
    if(pos&&m?.detected){
      pos.textContent=role==='rear'
        ? 'Rear evidence view · keep head, shoulders and draw elbow visible · hand/forearm overlap is acceptable'
        : 'Overhead evidence view · keep head, shoulders and upper arms visible';
      pos.className='position-guide good';
    }
    const foot=document.getElementById(`${role}Pose`);
    if(foot&&m?.detected){
      foot.textContent=foot.textContent.replace(/\s·\sAUTH/g,'')+' · AUX EVIDENCE';
    }
  }
  function sideAdmission(m){
    if(!FA.isRoleLive?.('side')) return {ok:false,reason:'Side view is required for automatic shot capture; Rear/Overhead are evidence views'};
    const side=sideMetric();
    if(!side?.detected) return {ok:false,reason:'Side athlete tracking is not ready'};
    if(!hipsVisible(side)) return {ok:false,reason:'Side tracking incomplete — keep torso reference and both arms visible'};
    const inv=invalidReason(m); if(inv)return {ok:false,reason:inv};
    return {ok:true};
  }
  FA.onPoseMetrics=function(role,m){
    state.last[role]=m||null;
    if(m?.shotComplete)state.caller={role,epoch:releaseEpoch(m),at:performance.now()};
    if(m?.releaseConfirmed && badBlockers.has(m?.shotBlocker||m?.blocker)){
      markInvalid(m,`Release vetoed: sequence was still ${m?.shotBlocker||m?.blocker}`);
    }
    const out=originalPose?.(role,m);
    decorateAux(role,m);
    if(role==='side'&&m?.detected&&!hipsVisible(m))setReadiness('Side: tracking incomplete · keep torso reference and both arms visible','warn');
    return out;
  };
  FA.updateLivePhase=function(phase,m){
    const blocker=m?.shotBlocker||m?.blocker||null;
    let shown=phase;
    if(m?.releaseConfirmed&&badBlockers.has(blocker)){
      shown=blocker==='waiting_set'?'Setup':blocker==='waiting_draw'?'Set':'Draw';
    }
    const out=originalLivePhase?.(shown,m);
    const side=sideMetric();
    if(FA.isRoleLive?.('side')&&side?.detected&&!hipsVisible(side)){
      setReadiness('Side: tracking incomplete · keep torso reference and both arms visible','warn');
    }else if(m?.releaseConfirmed&&badBlockers.has(blocker)){
      setReadiness(`Release vetoed · sequence still ${blocker}`,'warn');
    }
    return out;
  };
  FA.onShotEvidence=function(m){
    const epoch=releaseEpoch(m),c=state.caller;
    const caller=(c&&performance.now()-c.at<180&&(!epoch||!c.epoch||Math.abs(c.epoch-epoch)<520))?c.role:null;
    if(caller&&caller!=='side'){
      const reason=`${caller==='rear'?'Rear':'Overhead'} is synchronized evidence only; waiting for Side shot confirmation`;
      notice(reason);setReadiness(reason,'warn');return;
    }
    const gate=sideAdmission(m);
    if(!gate.ok){notice(gate.reason);setReadiness(gate.reason,'warn');return;}
    return originalEvidence?.(m);
  };
  window.MultiCameraAdmissionGuard={version:'BLE4.3.8.2',state,hipsVisible,sideAdmission,invalidReason};
})();
