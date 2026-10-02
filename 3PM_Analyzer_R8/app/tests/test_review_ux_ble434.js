const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
const css=fs.readFileSync(path.join(root,'static','style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'static','index.html'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(js.includes("const BUILD='x282-ble435-reconnect-recovery'"),'BLE4.3.5 build tag missing');
ok(!js.includes("calcRate();render();}});S.connected=true"),'Browser BLE still performs full UI render per 100 Hz sample');
ok(html.includes('<span>Live Buffer</span>')&&html.includes('rolling 45 s'),'rolling-buffer semantics missing');
ok(js.includes("setText('#ecoPackets',S.samples.length?String(S.samples.length):'—')"),'buffer count does not use bounded ring');
ok(css.includes('.selected-shot-hero>.bow-phase-scores{grid-column:1/-1!important'),'phase score row is still vulnerable to horizontal clipping');
ok(css.includes('#view-ecosystem .eco-tab-panel')&&css.includes('min-width:0;max-width:100%'),'shot rail containment guard missing');
ok(js.includes("cssH=Math.max(190,Math.round(r.height||235))"),'canvas does not match displayed CSS height');
ok(js.includes('installAnalysisViewHint')&&js.includes('Camera views:'),'camera-view availability hint missing');
console.log('BLE4.3.4 Review UX QA: PASS · 100Hz ingest decoupled from UI · bounded buffer display · non-clipping phase row · crisp canvas sizing · camera-view hint');
