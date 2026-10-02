// 3PM BLE4.3.8.9.4.1 Coach 25 background enrichment core (pure/testable)
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CoachKeyframe25BackfillCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.5.3-kf25-backfill-core-v2';
const finite=v=>Number.isFinite(Number(v));
function targetCount(activeRoles=1){void activeRoles;return 25;}
function nearAny(v,a,tol){return a.some(x=>Math.abs(Number(x)-Number(v))<=tol);}
function fallbackLabel(o){if(Math.abs(o)<=45)return 'Release T0 Detail';if(o<0)return 'Pre-Release Detail';if(o<=420)return 'Post-Release Detail';return 'Follow-through Detail';}
function selectAdditional(frames=[],existingOffsets=[],planRequests=[],target=25){
  const rows=(frames||[]).filter(f=>finite(f?.offsetMs)&&f?.blob&&Number(f.offsetMs)<=850).sort((a,b)=>Number(a.offsetMs)-Number(b.offsetMs));
  const occupied=(existingOffsets||[]).filter(finite).map(Number),selected=[],used=new Set();
  const choose=(targetOffset,tolerance,label)=>{let best=null,delta=Infinity;for(const f of rows){const off=Number(f.offsetMs),epoch=Number(f.epochMs);if(used.has(epoch)||nearAny(off,[...occupied,...selected.map(x=>x.offset)],24))continue;const d=Math.abs(off-Number(targetOffset));if(d<delta){best=f;delta=d;}}if(!best||delta>tolerance)return false;used.add(Number(best.epochMs));selected.push({frame:best,offset:Math.round(Number(best.offsetMs)),label:label||fallbackLabel(Number(best.offsetMs))});return true;};
  for(const req of planRequests||[]){if(occupied.length+selected.length>=target)break;const o=Number(req?.offset);if(!finite(o)||nearAny(o,occupied,24))continue;const tol=Math.abs(o)<=450?48:Math.abs(o)<=1600?180:420;choose(o,tol,req?.label);}
  // If plan targets collide at 30 fps, use real frames to maximize temporal evidence without
  // inventing interpolation. Release +/-500 ms receives priority, then meaningful follow-through.
  const ranked=rows.map(f=>{const o=Number(f.offsetMs);const focus=Math.abs(o)<=500?1000-Math.abs(o):o>=0&&o<=850?400-(o-500)*.2:80;const gap=[...occupied,...selected.map(x=>x.offset)].length?Math.min(...[...occupied,...selected.map(x=>x.offset)].map(x=>Math.abs(x-o))):999;return{f,score:focus+gap};}).sort((a,b)=>b.score-a.score);
  for(const r of ranked){if(occupied.length+selected.length>=target)break;const f=r.f,o=Number(f.offsetMs),epoch=Number(f.epochMs);if(used.has(epoch)||nearAny(o,[...occupied,...selected.map(x=>x.offset)],24))continue;used.add(epoch);selected.push({frame:f,offset:Math.round(o),label:fallbackLabel(o)});}
  return selected.sort((a,b)=>a.offset-b.offset);
}
return{VERSION,targetCount,selectAdditional};
});
