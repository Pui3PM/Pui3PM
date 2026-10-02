// R7: the visible filmstrip reads the same persisted real frames as Replay and the evidence contract.
// No best-effort thumbnail uploads, role-dependent counts, or separate 15-frame display authority.
(function(){
'use strict';
const B=window.EvidenceBudgetCore;if(!B||typeof renderFilmstrip!=='function')return;
const original=renderFilmstrip;let generation=0,urls=[],refreshQueued=false;
function clearUrls(){for(const u of urls)URL.revokeObjectURL(u);urls=[];}
function slots(record){const r=record?B.normalizeRecord(record,25):null;return Array.from({length:25},(_,i)=>({index:i,frame:r?.frames?.[i]||null}));}
async function render(shot){
  const ticket=++generation;clearUrls();original(shot);
  if(!shot||reviewRole==='multi')return;
  const role=reviewRole,sid=Number(shot.session_id),release=Number(loadAdvancedShotMetrics(shot.id)?.release_epoch_ms);
  const strip=document.getElementById('filmstrip'),status=document.getElementById('filmstripStatus');if(!strip)return;
  strip.replaceChildren();if(status)status.textContent=`Shot #${shot.shot_no} · ${role} · Loading 25 evidence slots…`;
  let rec=null,error=null;
  try{rec=await evidenceDbGet(shot.id,role,sid);}catch(e){error=e;}
  if(ticket!==generation||reviewRole!==role)return;
  // Never show a reused backend shot id from another session/release.
  if(rec&&(Number(rec.sessionId)!==sid||(Number.isFinite(release)&&release>0&&Number(rec.releaseEpochMs)!==release)))rec=null;
  const rows=slots(rec),count=rows.filter(x=>x.frame).length;
  for(const row of rows){
    const btn=document.createElement('button');btn.type='button';btn.className='frame-thumb';btn.dataset.evidenceSlot=String(row.index+1);
    const caption=document.createElement('span');caption.className='frame-caption';
    if(row.frame){
      const f=row.frame,u=URL.createObjectURL(f.blob);urls.push(u);
      const img=document.createElement('img');img.src=u;img.alt=`Evidence ${row.index+1}`;img.loading='lazy';btn.appendChild(img);
      caption.textContent=`${row.index+1}/25 · ${Math.round(Number(f.offsetMs))} ms`;
      btn.onclick=()=>{
        const viewer=document.getElementById('frameViewerImage');if(viewer)viewer.src=u;
        const title=document.getElementById('frameViewerTitle');if(title)title.textContent=`Shot #${shot.shot_no} · ${role} · Evidence ${row.index+1}/25`;
        const time=document.getElementById('frameViewerTime');if(time)time.textContent=`${Math.round(Number(f.offsetMs))} ms from Release`;
        document.getElementById('frameViewerDialog')?.showModal();
        if(typeof shotReplayState!=='undefined'&&Number(shotReplayState.record?.shotId)===Number(shot.id)&&shotReplayState.record?.role===role){
          const i=shotReplayState.record.frames.findIndex(x=>Number(x.epochMs)===Number(f.epochMs));
          if(i>=0){stopShotReplay();shotReplayState.index=i;renderShotReplayFrame();}
        }
      };
    }else{btn.disabled=true;caption.textContent=`${row.index+1}/25 · Missing`;}
    btn.appendChild(caption);strip.appendChild(btn);
  }
  if(status)status.textContent=`Shot #${shot.shot_no} · ${role} · ${count}/25 real frames${count<25?` · ${25-count} Missing`:''}${error?' · Evidence read failed':''}`;
}
renderFilmstrip=function(shot){void render(shot);};
function refresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;if(typeof selectedShot==='function')void render(selectedShot());});}
window.addEventListener('3pm-evidence-persisted',refresh);
window.addEventListener('3pm-temporal-evidence-updated',refresh);
window.addEventListener('beforeunload',clearUrls);
window.CoachKeyframe25BackfillLayer={version:'R7-canonical-filmstrip-25',slots,render,refresh};
})();
