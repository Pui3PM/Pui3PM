(()=>{
'use strict';
const VERSION='BLE4.3.8.9.5.3-capture-session-guard-v1';
function sessionId(){return Number(window.FormAnalyzer?.getCurrentSessionId?.())||null;}
function setGuardUi(blocked){
  const save=document.getElementById('shotSaveStatus');
  if(save&&blocked){save.textContent='Shot Save: SESSION REQUIRED';save.className='status-pill warn compact-status';}
  const start=document.getElementById('startLiveBtn');
  if(start)start.dataset.captureSessionGuard=blocked?'blocked':'ready';
}
function promptSession(){
  setGuardUi(true);
  const btn=document.getElementById('newSessionBtn');
  if(btn){btn.click();return;}
  window.alert?.('Create or select a Session before starting Live Capture.');
}
function install(){
  const start=document.getElementById('startLiveBtn');if(!start||start.dataset.captureSessionGuardInstalled==='1')return;
  start.dataset.captureSessionGuardInstalled='1';
  // Capture phase runs before the frozen app onclick. A confirmed Release may be
  // detected without a Session, but it cannot be persisted/replayed. Never let
  // the user enter that misleading state.
  start.addEventListener('click',ev=>{
    if(sessionId()){setGuardUi(false);return;}
    ev.preventDefault();ev.stopImmediatePropagation();promptSession();
  },true);
  setGuardUi(!sessionId());
  window.addEventListener('3pm-athlete-changed',()=>setTimeout(()=>setGuardUi(!sessionId()),0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.CaptureSessionGuardLayer={version:VERSION,sessionId};
})();
