// 3PM BLE4.3.8.9.2 Shot List UX
// Chronological End/Shot order with stable review scroll.  New captures follow the latest shot only
// when the app selected that new shot; reviewing an older shot never gets yanked to the bottom.
(function(){
'use strict';
const VERSION='BLE4.3.8.9.2-shot-list-ux-v1';
const REPAIR='R8-Post-P108-analysis-end-v1';
// Dedicated analysis timeline policy. Scoring keeps its own roundStructure/arrowsPerEnd.
const ANALYSIS_SHOTS_PER_END=6;
if(typeof shotEndSize==='function')shotEndSize=()=>ANALYSIS_SHOTS_PER_END;
let host=null,observer=null,busy=false,queued=false,lastMaxShot=0,lastScrollTop=0;
const shotNo=row=>{const m=String(row?.querySelector?.('.shot-num')?.textContent||'').match(/#\s*(\d+)/);return m?Number(m[1]):0;};
const endNo=g=>Number(g?.dataset?.end)||0;
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;normalize();});}
function normalize(){
  if(!host||busy)return;busy=true;
  try{
    const beforeScroll=Number.isFinite(lastScrollTop)?lastScrollTop:host.scrollTop;
    const groups=[...host.querySelectorAll(':scope > .shot-end-group')];
    const ordered=[...groups].sort((a,b)=>endNo(a)-endNo(b));
    let changed=groups.some((g,i)=>g!==ordered[i]);
    if(changed)ordered.forEach(g=>host.appendChild(g));
    for(const g of ordered){
      const body=g.querySelector('.shot-end-body');if(!body)continue;
      const rows=[...body.querySelectorAll(':scope > .shot-row-v34')],sorted=[...rows].sort((a,b)=>shotNo(a)-shotNo(b));
      if(rows.some((r,i)=>r!==sorted[i])){changed=true;sorted.forEach(r=>body.appendChild(r));}
    }
    const rows=[...host.querySelectorAll('.shot-row-v34')],maxShot=rows.reduce((m,r)=>Math.max(m,shotNo(r)),0),selected=host.querySelector('.shot-row-v34.selected'),selectedNo=shotNo(selected),newShot=maxShot>lastMaxShot;
    const followLatest=newShot&&maxShot>0&&selectedNo===maxShot;
    if(followLatest){
      requestAnimationFrame(()=>{const latest=[...host.querySelectorAll('.shot-row-v34')].sort((a,b)=>shotNo(a)-shotNo(b)).at(-1);latest?.scrollIntoView?.({block:'nearest',inline:'nearest'});lastScrollTop=host.scrollTop;});
    }else if(changed){host.scrollTop=beforeScroll;}
    lastMaxShot=Math.max(lastMaxShot,maxShot);
    host.dataset.shotListOrder='chronological';
  }finally{busy=false;}
}
function install(){
  host=document.getElementById('shotCards');if(!host)return false;
  host.addEventListener('scroll',()=>{if(!busy)lastScrollTop=host.scrollTop;},{passive:true});
  observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true});
  normalize();document.body.dataset.shotListUx='chronological-stable';return true;
}
function boot(){if(install())return;let n=0;const t=setInterval(()=>{if(install()||++n>80)clearInterval(t);},50);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ShotListUXLayer={version:VERSION,normalize:()=>normalize()};
})();
