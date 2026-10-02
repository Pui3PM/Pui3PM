const C=require('../static/multiview_corroboration_core.js');
function mk(p,t,q=.8,x={}){return{detected:true,epochMs:t,phase:p,primaryPhase:p,phaseQuality:q,identityConfidence:.85,shotObservability:.82,phaseDrawWristVisibility:.85,phaseDrawElbowVisibility:.86,...x}}
let s=C.fresh();
// 2000 Side-only frames: absence must always be neutral, never negative or supportive.
for(let i=0;i<2000;i++){const d=C.corroborate(s,mk(i%7?'Set':'Draw',i*16.67),null,null,i*16.67);if(d.negativeEvidence||d.supportLevel!=='none'||d.releaseSupport)throw Error('side-only contamination')}
// Unsynced/low-quality auxiliary cannot support.
C.reset(s);for(let i=0;i<500;i++){const t=40000+i*16.67,d=C.corroborate(s,mk('Draw',t),mk('Draw',t,.9),150+(i%80),t);if(d.drawSupport)throw Error('unsynced support')}
C.reset(s);for(let i=0;i<500;i++){const t=50000+i*33.33,d=C.corroborate(s,mk('Anchor',t),mk('Anchor',t,.08),5,t);if(d.anchorSupport)throw Error('low quality support')}
// Overhead release hallucination while Side Hold can never originate release.
C.reset(s);for(let i=0;i<300;i++){const t=70000+i*16.67,d=C.corroborate(s,mk('Aim / Hold',t),mk('Release',t,.9,{releaseConfirmed:true}),4,t);if(d.releaseSupport)throw Error('aux release originated release')}
// Side candidate + synchronized overhead candidate may corroborate after persistence.
C.reset(s);let supported=false;for(let i=0;i<8;i++){const t=90000+i*16.67,d=C.corroborate(s,mk('Aim / Hold',t,.85,{releaseCandidate:true}),mk('Release',t,.88,{releaseCandidate:true}),3,t);supported ||= d.releaseSupport;}if(!supported)throw Error('valid release corroboration missing');
console.log('BLE4.3.8.9.5.1 multi-view corroboration stress QA: PASS');
