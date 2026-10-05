// 3PM BLE4.3.7.1 Selected-Shot Isolation + Layout Stability
// Presentation-only. Never changes Pose input, camera stream, Shot Engine, or evidence capture.
(function(){
'use strict';
const U=window.UIStabilityCore;if(!U)return;
const METRIC_IDS=['mHold','mElbow','mBowArm','mShoulder','mTorso','mHeadMm','mHeadPitch','mAnchorFace','mHeadTowardDraw','mAnchorDrift','mAnchorStability','mReleasePath','mPoseQuality'];
const $=s=>document.querySelector(s);
let lockedShotId=null,shotObserver=null,matrixObserver=null,refreshQueued=false,matrixQueued=false,pendingShotId=null;

function selectedShotIdFromUi(){
  const card=$('.shot-row-v34.selected');
  if(card?.dataset?.id)return Number(card.dataset.id)||null;
  const sel=$('#analyzeShotSelect');
  if(sel&&$('#view-analyze')?.classList.contains('active'))return Number(sel.value)||null;
  return null;
}
function metricValues(){
  const out={};for(const id of METRIC_IDS){const el=document.getElementById(id);out[id]=el?.textContent?.trim()||'—';}return U.stableMetricSnapshot(out);
}
function ensureSnapshotBanner(){
  let b=$('#selectedShotSnapshotBanner');if(b)return b;
  const grid=$('.pose-metrics');if(!grid)return null;
  b=document.createElement('div');b.id='selectedShotSnapshotBanner';b.className='selected-shot-snapshot-banner hidden';
  grid.insertAdjacentElement('beforebegin',b);return b;
}
function unlockSelectedMetrics(){
  lockedShotId=null;document.body.classList.remove('selected-shot-metrics-locked');
  for(const id of METRIC_IDS){const el=document.getElementById(id);if(!el)continue;delete el.dataset.shotValue;delete el.dataset.shotTone;el.removeAttribute('aria-label');el.removeAttribute('title');}
  const b=ensureSnapshotBanner();if(b)b.classList.add('hidden');
}
function captureSelectedMetrics(id){
  id=Number(id)||null;if(!id){unlockSelectedMetrics();return;}
  const values=metricValues();
  for(const metricId of METRIC_IDS){
    const el=document.getElementById(metricId);if(!el)continue;
    el.dataset.shotValue=values[metricId]||'—';el.setAttribute('aria-label',`Selected shot value ${values[metricId]||'—'}`);el.title=`Selected shot snapshot: ${values[metricId]||'—'}`;
    el.dataset.shotTone=el.classList.contains('pose-good')?'good':el.classList.contains('pose-warn')?'warn':el.classList.contains('pose-bad')?'bad':'neutral';
  }
  lockedShotId=id;document.body.classList.add('selected-shot-metrics-locked');
  const b=ensureSnapshotBanner();if(b){const shown=$('.shot-row-v34.selected .shot-num')?.textContent?.trim()||`ID ${id}`;b.textContent=`SELECTED SHOT ${shown} · Snapshot metrics locked · Live Pose continues independently`;b.classList.remove('hidden');}
}
function queueSelectedRefresh(explicitId=null){
  if(Number(explicitId))pendingShotId=Number(explicitId);
  if(refreshQueued)return;refreshQueued=true;
  queueMicrotask(()=>{refreshQueued=false;const id=pendingShotId||selectedShotIdFromUi();pendingShotId=null;captureSelectedMetrics(id);});
}

function installSelectedShotIsolation(){
  ensureSnapshotBanner();
  const cards=$('#shotCards');if(cards){
    shotObserver=new MutationObserver(()=>queueSelectedRefresh());
    shotObserver.observe(cards,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    cards.addEventListener('click',e=>{const row=e.target.closest?.('.shot-row-v34');if(row)queueSelectedRefresh(Number(row.dataset.id));});
  }
  $('#analyzeShotSelect')?.addEventListener('change',e=>queueSelectedRefresh(Number(e.target.value)));
  // Workspace changes can expose/hide the selected-shot panel, but must never change its owner.
  $('#workspaceMode')?.addEventListener('click',()=>queueSelectedRefresh());
  queueSelectedRefresh();
}

function phaseEntriesFromMatrix(host){
  const line=host.querySelector('.biomatrix-phase-line');if(!line)return[];
  return [...line.querySelectorAll('span')].map(span=>({phase:span.querySelector('b')?.textContent||span.textContent}));
}
function transformBiomechanicsMatrix(){
  const host=$('#biomechanicsMatrix');if(!host||host.dataset.coachViewTransform==='1')return;
  const phaseLine=host.querySelector('.biomatrix-phase-line');
  const tableWrap=host.querySelector('.biomatrix-table-wrap');
  if(!phaseLine&&!tableWrap)return;
  const summary=U.coachPhaseSummary(phaseEntriesFromMatrix(host));
  if(phaseLine){
    const compact=document.createElement('div');compact.className='ci-coach-process-line';
    compact.innerHTML=summary.length?summary.map((x,i)=>`${i?'<i>→</i>':''}<span>${x.phase}</span>`).join(''):'<span>Process evidence unavailable</span>';
    phaseLine.replaceWith(compact);
  }
  if(tableWrap){
    const details=document.createElement('details');details.className='ci-engineering-details';
    const summaryEl=document.createElement('summary');summaryEl.textContent='Detailed measurement evidence';
    tableWrap.replaceWith(details);details.append(summaryEl,tableWrap);
  }
  host.dataset.coachViewTransform='1';
  const card=host.closest('.biomechanics-matrix-card');
  const title=card?.querySelector('.section-head h2');if(title)title.textContent='Process Evidence Timeline';
  const badge=card?.querySelector('.section-head .badge');if(badge)badge.textContent='Coach View';
}
function queueMatrixTransform(){
  const host=$('#biomechanicsMatrix');if(!host||matrixQueued)return;matrixQueued=true;
  queueMicrotask(()=>{matrixQueued=false;delete host.dataset.coachViewTransform;transformBiomechanicsMatrix();});
}
function installMatrixCoachView(){
  const host=$('#biomechanicsMatrix');if(!host)return;
  matrixObserver=new MutationObserver(()=>{
    // App rerenders by replacing host.innerHTML while the host data attribute survives.
    // Re-transform only when a fresh raw matrix appears; ignore our own transformed mutations.
    const fresh=!!host.querySelector('.biomatrix-phase-line')||!!(host.querySelector('.biomatrix-table-wrap')&&!host.querySelector('.ci-engineering-details'));
    if(!fresh)return;
    host.dataset.coachViewTransform='0';queueMatrixTransform();
  });
  matrixObserver.observe(host,{childList:true,subtree:true});
  transformBiomechanicsMatrix();
}
function install(){
  document.body.classList.add('ble4371-ui-stability');
  installSelectedShotIsolation();installMatrixCoachView();
}
window.UIStabilityLayer={version:'BLE4.3.7.1',install,captureSelectedMetrics,unlockSelectedMetrics,getLockedShotId:()=>lockedShotId,transformBiomechanicsMatrix};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
