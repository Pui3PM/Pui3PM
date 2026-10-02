// 3PM HV2 Evidence Integrity Repair Layer
// Integration-only: preserves frozen app.js / pose.js / core_runtime.js.
(function(){
'use strict';
const VERSION='HV2-evidence-integrity-v1',TARGET=25;
const finite=v=>Number.isFinite(Number(v));

// The frozen app asks coachEvidencePlan() for the live summary. Promote that plan to 25
// real-frame requests without changing frozen capture/shot logic.
try{
  if(typeof coachEvidencePlan==='function'&&window.CoachKeyframePlanCore?.build25){
    const legacy=coachEvidencePlan;
    coachEvidencePlan=function(metrics,eventEpochMs){
      const p=window.CoachKeyframePlanCore?.build25?.(metrics?.phaseTimeline||[],eventEpochMs);
      if(p?.requests?.length)return {...p,targetCount:TARGET};
      const old=legacy(metrics,eventEpochMs);return {...old,targetCount:TARGET};
    };
  }
}catch(e){console.warn('[3PM HV2] 25-frame live plan patch unavailable',e);}

function correctedAnchorJump(){
  const r=typeof shotReplayState!=='undefined'?shotReplayState.record:null,shot=typeof selectedShot==='function'?selectedShot():null;
  if(!r?.frames?.length||!shot)return false;
  const target=typeof replayAnchorOffsetForShot==='function'?replayAnchorOffsetForShot(shot,r):null;
  if(!finite(target)){window.toast?.('Settled Anchor timing is not available for this shot.','warn',3000);return false;}
  const tagged=f=>{const a=[String(f?.evidenceZone||f?.zone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])];return a.some(x=>['anchor-focus','anchor-pin','hold-pin','aim-hold'].includes(x));};
  let pick=null,best=Infinity;
  // Forward-biased: a Settled Anchor shortcut must never jump to a pre-confirmation Draw frame.
  r.frames.forEach((f,i)=>{const o=Number(f?.offsetMs);if(!finite(o)||o<Number(target)||!tagged(f))return;const d=o-Number(target);if(d<best&&d<=420){best=d;pick=i;}});
  if(pick===null)r.frames.forEach((f,i)=>{const o=Number(f?.offsetMs);if(!finite(o)||o<Number(target))return;const d=o-Number(target);if(d<best&&d<=420){best=d;pick=i;}});
  if(pick===null){window.toast?.(`Full Shot Evidence is missing a real frame at/after verified Anchor (target ${Math.round(Number(target))} ms).`,'warn',3600);return false;}
  if(typeof stopShotReplay==='function')stopShotReplay();
  shotReplayState.index=pick;if(typeof renderShotReplayFrame==='function')renderShotReplayFrame();return true;
}
function rebindAnchor(){
  const old=document.getElementById('jumpAnchorBtn');if(!old||old.dataset.hv2Bound==='1')return;
  const b=old.cloneNode(true);b.dataset.hv2Bound='1';old.replaceWith(b);b.addEventListener('click',correctedAnchorJump);
}

function ensureRail(){
  let rail=document.getElementById('fixedEvidence25Rail');if(rail)return rail;
  const meta=document.getElementById('shotReplayMeta');if(!meta)return null;
  rail=document.createElement('div');rail.id='fixedEvidence25Rail';rail.className='fixed-evidence-25-rail';rail.setAttribute('aria-label','Fixed 25 evidence slots');meta.insertAdjacentElement('afterend',rail);return rail;
}
function renderRail(){
  const rail=ensureRail();if(!rail)return;
  const r=typeof shotReplayState!=='undefined'?shotReplayState.record:null,frames=Array.isArray(r?.frames)?r.frames:[];
  rail.innerHTML='';
  for(let i=0;i<TARGET;i++){
    const b=document.createElement('button'),f=frames[i];b.type='button';b.className=`fixed-slot ${f?'real':'missing'}${f&&Number(shotReplayState.index)===i?' active':''}`;b.textContent=f?String(i+1):'—';b.title=f?`Evidence slot ${i+1} · ${Math.round(Number(f.offsetMs)||0)} ms`:`Evidence slot ${i+1} · Missing real frame`;b.disabled=!f;
    if(f)b.addEventListener('click',()=>{if(typeof stopShotReplay==='function')stopShotReplay();shotReplayState.index=i;if(typeof renderShotReplayFrame==='function')renderShotReplayFrame();});
    rail.appendChild(b);
  }
  rail.dataset.actual=String(frames.length);rail.dataset.target=String(TARGET);
}
function annotateMeta(){
  const meta=document.getElementById('shotReplayMeta'),r=typeof shotReplayState!=='undefined'?shotReplayState.record:null;if(!meta||!r)return;
  const n=Array.isArray(r.frames)?r.frames.length:0;if(/^Frame\s+\d+\/\d+/.test(meta.textContent||''))meta.textContent=(meta.textContent||'').replace(/^Frame\s+(\d+)\/\d+/,`Slot $1/${TARGET} · real ${n}/${TARGET}`);
}
let scheduled=false;function refresh(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;rebindAnchor();renderRail();annotateMeta();});}
const boot=()=>{rebindAnchor();refresh();const host=document.getElementById('shotReplayPanel')||document.body;new MutationObserver(refresh).observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','class']});setInterval(refresh,700);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.EvidenceIntegrityRepairLayer={VERSION,TARGET,correctedAnchorJump,refresh};
})();
