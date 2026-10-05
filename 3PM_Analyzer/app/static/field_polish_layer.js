// 3PM BLE4.3.8.2 Field Polish
// Presentation-only layer. It never feeds Shot Process, Pose measurements or Capture decisions.
(function(){
'use strict';
const VERSION='BLE4.3.8.2';
const ROLES=['side','rear','overhead'];
function guideFor(role){return document.getElementById(role==='side'?'framingGuide':`${role}FramingGuide`);}
function positionFor(role){return document.getElementById(`${role}PositionGuide`);}
function cleanText(s){return String(s||'').replace(/^Position:\s*/i,'').replace(/\s*·\s*safe-area guide stays fixed\s*/ig,'').trim();}
function syncRole(role){
  const pos=positionFor(role),guide=guideFor(role),label=guide?.querySelector('span');
  if(!pos||!guide||!label)return;
  const live=!guide.classList.contains('hidden');
  if(!live){guide.classList.remove('framing-ready','framing-waiting');return;}
  const good=pos.classList.contains('good'),waiting=pos.classList.contains('waiting');
  guide.classList.toggle('framing-ready',good);
  guide.classList.toggle('framing-waiting',waiting);
  if(good){label.textContent='FRAMING READY';label.title='Framing is ready. Shoot naturally; this dashed box is guidance only.';return;}
  const msg=cleanText(pos.textContent);
  if(waiting){label.textContent=msg&&msg.toLowerCase().includes('finding')?'Finding athlete…':'Framing…';label.title='Waiting for a clear athlete view.';return;}
  label.textContent=msg||'Adjust framing';label.title='Framing guidance only; it does not define the shot detection boundary.';
}
function install(){
  for(const role of ROLES){
    const pos=positionFor(role);if(!pos)continue;
    new MutationObserver(()=>syncRole(role)).observe(pos,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    syncRole(role);
  }
  document.body.classList.add('ble4382-field-polish');
}
window.FieldPolishLayer={version:VERSION,syncRole};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
