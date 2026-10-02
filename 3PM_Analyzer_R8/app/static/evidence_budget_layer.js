(function(){
'use strict';
const B=window.EvidenceBudgetCore;if(!B)return;
const DB='3pm-form-analyzer-shot-evidence-v1',STORE='shotEvidence';
const originalPut=IDBObjectStore.prototype.put,originalAdd=IDBObjectStore.prototype.add;
function normalizeInPlace(value){
  if(!value||!Array.isArray(value.frames))return value;
  const n=B.normalizeRecord(value,B.TARGET);
  for(const k of Object.keys(value))if(!(k in n))delete value[k];
  Object.assign(value,n);return value;
}
function wrap(original){return function(value,key){try{if(this?.name===STORE)normalizeInPlace(value);}catch(err){console.warn('3PM fixed-25 evidence normalization failed',err);}return arguments.length>1?original.call(this,value,key):original.call(this,value);};}
IDBObjectStore.prototype.put=wrap(originalPut);
IDBObjectStore.prototype.add=wrap(originalAdd);

async function dbExists(){
  if(typeof indexedDB.databases!=='function')return false;
  try{return (await indexedDB.databases()).some(x=>x?.name===DB);}catch{return false;}
}
async function migrateExisting(){
  if(!(await dbExists()))return {updated:0};
  return await new Promise(resolve=>{
    const req=indexedDB.open(DB);req.onerror=()=>resolve({updated:0,error:String(req.error||'open failed')});
    req.onsuccess=()=>{
      const db=req.result;if(!db.objectStoreNames.contains(STORE)){db.close();resolve({updated:0});return;}
      const tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE),get=st.getAll();let updated=0;
      get.onerror=()=>resolve({updated:0,error:String(get.error||'read failed')});
      get.onsuccess=()=>{for(const rec of get.result||[]){if(!Array.isArray(rec?.frames))continue;const before=rec.frames.length,was=rec.evidenceBudget?.version;normalizeInPlace(rec);if(before!==rec.frames.length||was!==B.VERSION){st.put(rec);updated++;}}};
      tx.oncomplete=()=>{db.close();resolve({updated});};tx.onerror=()=>{db.close();resolve({updated,error:String(tx.error||'write failed')});};
    };
  });
}
function ensureStatus(){
  let el=document.getElementById('evidenceFixed25Status');if(el)return el;
  const meta=document.getElementById('shotReplayMeta');if(!meta)return null;
  el=document.createElement('span');el.id='evidenceFixed25Status';el.className='muted';el.style.marginLeft='8px';el.style.fontSize='11px';meta.insertAdjacentElement('afterend',el);return el;
}
async function renderStatus(){
  const el=ensureStatus();if(!el)return;
  const shotId=Number(document.querySelector('.shot-row-v34.selected')?.dataset?.id),sid=Number(window.FormAnalyzer?.getCurrentSessionId?.()),role=document.querySelector('.review-role-btn.active')?.dataset?.reviewRole||'side';
  if(!shotId||!sid){el.textContent='Fixed Review · 25 slots';return;}
  try{
    const db=await new Promise((res,rej)=>{const r=indexedDB.open(DB);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    if(!db.objectStoreNames.contains(STORE)){db.close();el.textContent='Fixed Review · 25 slots';return;}
    const rows=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly'),idx=tx.objectStore(STORE).index('sessionId'),r=idx.getAll(sid);r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});db.close();
    const rr=(role==='multi'?'side':role),rec=rows.filter(x=>Number(x.shotId)===shotId&&x.role===rr).sort((a,b)=>String(b.key||'').split(':').length-String(a.key||'').split(':').length)[0];
    const n=Number(rec?.evidenceBudget?.actualFrames??rec?.frames?.length??0),missing=Math.max(0,B.TARGET-n);el.textContent=missing?`Fixed Review · ${n}/${B.TARGET} real frames · ${missing} Missing`:`Fixed Review · ${B.TARGET}/${B.TARGET} real frames`;
  }catch{el.textContent='Fixed Review · 25 slots';}
}
window.EvidenceBudgetLayer={version:B.VERSION,target:B.TARGET,migrateExisting,normalizeRecord:B.normalizeRecord,renderStatus};
const boot=()=>{setTimeout(()=>migrateExisting().then(()=>{window.FormAnalyzer?.refreshShotUI?.();renderStatus();}),1200);setInterval(renderStatus,900);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
