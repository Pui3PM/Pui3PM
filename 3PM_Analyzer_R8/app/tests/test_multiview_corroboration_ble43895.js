const C=require('../static/multiview_corroboration_core.js');
const ok=(x,m)=>{if(!x)throw new Error(m)};
const side=(phase,t=1000,extra={})=>({detected:true,epochMs:t,phase,primaryPhase:phase,phaseQuality:.82,identityConfidence:.9,shotObservability:.85,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9,...extra});
const over=(phase,t=1000,extra={})=>({detected:true,epochMs:t,phase,primaryPhase:phase,phaseQuality:.78,identityConfidence:.85,shotObservability:.8,phaseDrawWristVisibility:.85,phaseDrawElbowVisibility:.88,...extra});
let s=C.fresh();
let d=C.corroborate(s,side('Draw',1000),null,null,1000);ok(!d.available&&d.supportLevel==='none','missing overhead must be neutral');
d=C.corroborate(s,side('Draw',1100),over('Draw',1100),8,1100);ok(d.supportLevel==='weak','first aux sample cannot strong-confirm');
d=C.corroborate(s,side('Draw',1160),over('Draw',1160),10,1160);ok(d.drawSupport&&d.sustained,'sustained synced draw should corroborate');
d=C.corroborate(s,side('Anchor',1220),over('Anchor',1220),190,1220);ok(!d.fresh&&!d.anchorSupport,'stale/unsynced overhead cannot corroborate');
d=C.corroborate(s,side('Anchor',1280),over('Anchor',1280,{phaseQuality:.1}),5,1280);ok(!d.anchorSupport,'low-quality overhead cannot corroborate');
C.reset(s);d=C.corroborate(s,side('Set',1400),over('Draw',1400),4,1400);ok(!d.compatible&&!d.drawSupport,'overhead cannot promote Set to Draw');
C.reset(s);d=C.corroborate(s,side('Aim / Hold',1500),over('Expansion',1500),4,1500);d=C.corroborate(s,side('Aim / Hold',1560),over('Expansion',1560),5,1560);ok(d.expansionSupport,'overhead may strengthen optional expansion evidence');
C.reset(s);d=C.corroborate(s,side('Aim / Hold',1700),over('Release',1700,{releaseConfirmed:true}),4,1700);d=C.corroborate(s,side('Aim / Hold',1760),over('Release',1760,{releaseConfirmed:true}),4,1760);ok(!d.releaseSupport,'overhead alone cannot originate Release');
C.reset(s);d=C.corroborate(s,side('Aim / Hold',1800,{releaseCandidate:true}),over('Release',1800,{releaseCandidate:true}),4,1800);d=C.corroborate(s,side('Aim / Hold',1860,{releaseCandidate:true}),over('Release',1860,{releaseCandidate:true}),4,1860);ok(d.releaseSupport,'overhead may corroborate an existing Side release candidate');

C.reset(s);d=C.corroborate(s,side('Draw',1900),over('Release',1900,{releaseConfirmed:true}),4,1900);d=C.corroborate(s,side('Draw',1960),over('Release',1960,{releaseConfirmed:true}),4,1960);ok(!d.compatible&&!d.anchorSupport&&!d.holdSupport&&!d.releaseSupport,'overhead phase leap cannot manufacture later-phase evidence');
C.reset(s);d=C.corroborate(s,side('Anchor',2000),over('Aim / Hold',2000),4,2000);d=C.corroborate(s,side('Anchor',2060),over('Aim / Hold',2060),4,2060);ok(d.compatible&&d.anchorSupport&&!d.holdSupport,'one-step overhead lead may corroborate current Side phase but cannot promote next phase');
console.log('BLE4.3.8.9.5.1.1 multi-view corroboration core QA: PASS');
