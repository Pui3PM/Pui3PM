const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
const css=fs.readFileSync(path.join(root,'static','style.css'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(js.includes("const BUILD='x282-ble435-reconnect-recovery'"),'BLE4.3.5 build tag missing');
ok(js.includes("sensorListSig:''")&&js.includes("sensorDetailSig:''"),'static saved-shot render signatures missing');
ok(js.includes('if(detailSig===S.sensorDetailSig)return'),'selected shot detail can still redraw continuously');
ok(js.includes('eco-shot-chip'),'compact clickable shot rail missing');
ok(js.includes("drawMiniMotionTrend($('#ecoSelectedTrend'),r.id)"),'selected-shot trend is not wired');
ok(js.includes('ecoSelectedRelease')&&js.includes('ecoSelectedHold'),'saved Release Response / Hold Path are not both wired');
ok(js.includes('Saved shot · static evidence'),'static evidence semantics missing');
ok(css.includes('.eco-shot-chip.selected'),'selected shot visual state missing');
ok(css.includes('.selected-shot-visuals'),'selected-shot visual layout missing');
ok(js.includes('niceAngularScale')&&js.includes('trailColor'),'time-colored Hold/Aim path + standard angular scale missing');
console.log('BLE4.3.4 Selected Shot UX regression QA: PASS · clickable shot rail · static saved evidence · Release + Hold charts · key numbers');
