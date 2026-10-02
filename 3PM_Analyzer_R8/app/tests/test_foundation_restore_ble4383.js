const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'static','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'static','style.css'),'utf8');
const ci=fs.readFileSync(path.join(root,'static','capture_integrity_layer.js'),'utf8');
const fg=fs.readFileSync(path.join(root,'static','foundation_guard_layer.js'),'utf8');
// Regression guard: never lose the mature X2.8.2 review controls again.
for(const id of ['jumpAnchorBtn','jumpReleaseBtn','prevFrameBtn','nextFrameBtn','replayPlayBtn','shotReplaySlider','replayMinusFrameBtn','replayPlusFrameBtn'])assert(html.includes(`id="${id}"`),`missing review control ${id}`);
// Regression guard: never lose the Bow Sensor / 3PM Ecosystem workspace again.
for(const id of ['view-devices','ecoSensorPill','ecoSensorChart','ecoSensorShotRecords','ecoLinkedShotRecords','analysisBowSensorHero'])assert(html.includes(`id="${id}"`),`missing ecosystem UI ${id}`);
assert(html.includes('/static/bow_sensor_ble.js'),'Bow Sensor runtime script missing');
// BLE4386: no visible equipment guess on Live. Classifier may remain loaded only as hidden diagnostics.
assert(!html.includes('id="activityDetectionPill"'),'activity guess must not be visible on Live');
assert(!html.includes('Activity · Checking…'),'activity guess text must not be visible on Live');
assert(!html.includes('data-activity-mode="real_bow"')&&!html.includes('data-activity-mode="elastic"')&&!html.includes('data-activity-mode="hand_only"'),'user-facing activity mode buttons must stay removed');
assert(html.includes('/static/activity_classifier_core.js')&&html.includes('/static/activity_classifier_layer.js'),'diagnostic classifier runtime should remain available for traces/research');
assert(fg.includes("CAPTURE_PROFILE='verified_shot'")&&fg.includes('diagnostic-only-hidden-never-gates-capture'),'Foundation live capture must use classifier-independent verified-shot profile');
assert(ci.includes("activity_detection:'diagnostic-only-hidden-never-gates-capture'"),'capture trace must record diagnostic-only activity policy');
// Set admission must require draw-side visibility and bow extension; classifier cannot loosen it.
assert(ci.includes('native&&q>=.25&&drawSideVisible'),'native Set gate does not require draw-side visibility');
assert(ci.includes("drawGuardActive=currentPhase==='Set'&&requiresBowExtension&&!visualBowExtended"),'false-Draw bow-extension guard missing');
// Live detector progress and post-release persisted evidence truth must both be visible.
assert(html.includes('id="phaseButtons"')&&html.includes('Live Shot Phase'),'Live Shot Phase strip missing');
assert(html.includes('id="liveEvidencePanel"')&&html.includes('Capture Evidence'),'Capture Evidence strip missing');
for(const stage of ['draw','anchor','hold','release','post','follow','recovery'])assert(html.includes(`data-evidence-stage="${stage}"`),`missing evidence stage ${stage}`);
assert(css.includes('.phase-pill.phase-live-current')&&css.includes('.phase-pill.phase-complete')&&css.includes('.phase-pill.phase-upcoming'),'current/passed/upcoming phase UI missing');
assert(css.includes('.live-evidence-stage.saved')&&css.includes('.live-evidence-stage.missing'),'persisted evidence truth colors missing');
assert(css.includes('.shot-replay-scrub-row{position:relative;z-index:3'),'scrubber visibility protection missing');
console.log('BLE4.3.8.6 mature UI + Capture Truth regression QA PASS');
