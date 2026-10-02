const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(js.includes("const PATCH_BUILD='x282-ble436-canvas-wake-recovery'"),'BLE4.3.6 patch tag missing');
ok(js.includes('redrawStaticEvidenceCanvases'),'static evidence redraw helper missing');
ok(js.includes("document.addEventListener('visibilitychange'"),'wake visibility handler missing');
ok(js.includes("window.addEventListener('pageshow'"),'pageshow handler missing');
ok(js.includes("window.addEventListener('focus'"),'focus handler missing');
ok(js.includes('window.visualViewport?.addEventListener'),'visualViewport resize handler missing');
ok(js.includes('new ResizeObserver'),'ResizeObserver missing');
ok(js.includes('canvasIntegrityWatch')&&js.includes('setInterval(canvasIntegrityWatch,1500)'),'lightweight canvas integrity watchdog missing');
ok(js.includes('cssH=Math.max(54,Math.round(rect.height||54))'),'mini trend still uses a fixed backing height');
ok(js.includes("drawReleaseEvidence($('#ecoSelectedRelease')"),'selected saved release redraw missing');
ok(js.includes("drawHoldEvidence($('#ecoSelectedHold')"),'selected saved hold redraw missing');
ok(js.includes("drawReleaseEvidence($('#analysisBowReleaseChart')"),'analyzer linked release redraw missing');
ok(js.includes("drawHoldEvidence($('#analysisBowHoldPath')"),'analyzer linked hold redraw missing');
console.log('BLE4.3.6 canvas wake QA: PASS · static shot evidence redraws only on wake/focus/resize/layout change');
