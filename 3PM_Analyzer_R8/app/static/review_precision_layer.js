// 3PM BLE4.3.8.8.8 Review Precision / Baseline Semantics layer.
// Integration-only: preserves frozen Dev4 app/core/pose runtime and release arbitration.
(function(){
'use strict';
const VERSION='BLE4.3.8.8.8-review-precision-v1';
const finite=v=>Number.isFinite(Number(v));
function statusLabel(label){
  if(label==='Stable')return 'Within Baseline';
  if(label==='Review')return 'Notable Deviation';
  return label;
}
// Keep the proven thresholds/css intact; change semantics only so consistency is not misread as quality.
try{
  if(typeof interpretShot==='function'){
    const baseInterpret=interpretShot;
    interpretShot=function(shot){
      const r=baseInterpret(shot);if(!r||typeof r!=='object')return r;
      const out={...r,label:statusLabel(r.label)};
      if(r.label==='Stable'&&r.summary==="Measurements are close to this athlete's current baseline.")out.summary="Measurements are within this athlete's current baseline band.";
      return out;
    };
  }
}catch(e){console.warn('ReviewPrecision interpret wrapper unavailable',e);}
function firstFrameAtOrAfter(frames,target,maxDelta=360,predicate=null){
  if(!Array.isArray(frames)||!finite(target))return null;
  let best=null,bestDelta=Infinity;
  frames.forEach((f,i)=>{const o=Number(f?.offsetMs);if(!finite(o)||o<Number(target))return;if(predicate&&!predicate(f))return;const d=o-Number(target);if(d<bestDelta&&d<=maxDelta){best={index:i,delta:d,offset:o};bestDelta=d;}});
  return best;
}
function anchorTagged(f){const tags=[String(f?.evidenceZone||f?.zone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])];return tags.some(z=>z==='anchor-focus'||z==='anchor-pin'||z==='hold-pin'||z==='aim-hold');}
// Anchor shortcut is deliberately forward-biased: never show a pre-confirmation Draw frame as Settled Anchor.
try{
  if(typeof jumpReplayAnchor==='function'){
    jumpReplayAnchor=function(){
      const r=shotReplayState?.record,shot=selectedShot?.();if(!r?.frames?.length||!shot)return false;
      const target=replayAnchorOffsetForShot(shot,r);if(!finite(target)){toast?.('Settled Anchor timing is not available for this shot.','warn',3000);return false;}
      let pick=firstFrameAtOrAfter(r.frames,target,360,anchorTagged)||firstFrameAtOrAfter(r.frames,target,360,null);
      if(!pick){toast?.(`Full Shot Evidence is missing a real frame at/after verified Anchor (target ${Math.round(target)} ms).`,'warn',3600);return false;}
      stopShotReplay?.();shotReplayState.index=pick.index;renderShotReplayFrame?.();return true;
    };
  }
}catch(e){console.warn('ReviewPrecision Anchor shortcut unavailable',e);}
// Make the diagnostic Evidence Contract point to the same verified/forward Anchor truth.
try{
  const C=window.CaptureIntegrityCore;
  if(C?.evidenceContract){
    const original=C.evidenceContract.bind(C);
    C.evidenceContract=function(record,advanced){
      const out=original(record,advanced),frames=Array.isArray(record?.frames)?record.frames:[],target=Number(out?.anchorOffsetMs);
      if(out?.stages?.anchor&&finite(target)){
        const p=firstFrameAtOrAfter(frames,target,360,anchorTagged)||firstFrameAtOrAfter(frames,target,360,null);
        out.stages.anchor={...out.stages.anchor,ok:!!p,index:p?.index??null,deltaMs:p?.delta??null,verifiedForward:true};
        out.missing=Object.entries(out.stages).filter(([,v])=>v.required!==false&&!v.ok).map(([k])=>k);out.complete=out.missing.length===0;
      }
      return out;
    };
  }
}catch(e){console.warn('ReviewPrecision contract wrapper unavailable',e);}
// Report wording follows the same non-evaluative semantics.
try{
  if(typeof renderReport==='function'){
    const baseReport=renderReport;
    renderReport=function(...args){const v=baseReport.apply(this,args);queueMicrotask(()=>{document.querySelectorAll('#reportStats .stat-card span').forEach(el=>{if(el.textContent==='Stable')el.textContent='Within Baseline';else if(el.textContent==='Review / Deviation')el.textContent='Notable / Significant';});});return v;};
  }
}catch(e){console.warn('ReviewPrecision report wrapper unavailable',e);}
window.ReviewPrecisionLayer={VERSION,statusLabel,firstFrameAtOrAfter};
})();
