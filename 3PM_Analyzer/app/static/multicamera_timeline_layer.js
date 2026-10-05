// 3PM HV3 Multi-Camera Foundation Layer
// Observability/capability facade only. It does not drive phase, release, let-down, capture, or scoring.
(function(){
'use strict';
const C=window.CameraTimelineCore;if(!C)return;
const activeRoles=()=>{
  const d=window.TemporalEvidenceLayer?.diagnostics?.()||{};
  return C.ROLES.filter(r=>!!d?.[r]?.active);
};
function snapshot(){
  const diagnostics=window.TemporalEvidenceLayer?.diagnostics?.()||{};
  const roles={};
  for(const r of C.ROLES){const d=diagnostics?.[r]||{};roles[r]={role:r,active:!!d.active,backend:d.backend||'none',rawFps:Number(d.rawFps)||null,captureFps:Number(d.captureFps)||null,reportedFps:Number(d.reportedFps)||null,jitterMs:Number(d.jitterMs)||null,bufferFrames:Number(d.bufferFrames)||0,bufferDurationMs:Number(d.bufferDurationMs)||null,lastFrameSeq:Number(d.lastFrameSeq)||null,clockDomain:d.clockDomain||null,error:d.error||null};}
  return{version:'HV3-multicamera-foundation-v1',roles,capabilities:C.capabilities(activeRoles()),authority:'side-preferred',secondaryBlocking:false,platformIndependentCore:true};
}
function alignAt(targetMs,framesByRole){return C.alignAt(targetMs,framesByRole,snapshot().roles);}
function alignSlots(slots,framesByRole){return C.logicalSlotAlignment(slots,framesByRole,snapshot().roles);}
window.MultiCameraTimeline={version:'HV3-multicamera-foundation-v1',roles:[...C.ROLES],snapshot,alignAt,alignSlots,capabilities:()=>C.capabilities(activeRoles())};
window.dispatchEvent(new CustomEvent('3pm-multicamera-foundation-ready',{detail:snapshot()}));
})();
