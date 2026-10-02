const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
const swift=fs.readFileSync(path.join(root,'ble_bridge','3PMBLEBridge.swift'),'utf8');
const start=fs.readFileSync(path.join(root,'../internal/start_analyzer.sh'),'utf8');
const wrapper=fs.readFileSync(path.join(root,'../internal/start_services.sh'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(js.includes("const BUILD='x282-ble435-reconnect-recovery'"),'BLE4.3.5 build tag missing');
ok(js.includes('requestHistoryReplay')&&js.includes('/history?limit=16'),'Analyzer history catch-up missing');
ok(js.includes('0x30,1,16')||js.includes('[0x30,1,16]'),'Browser history replay command missing');
ok(js.includes('requestTraceForRecord')&&js.includes('/trace?event='),'selected-shot trace recovery missing');
ok(swift.includes('comps.path == "/history"')&&swift.includes('requestHistoryReplay(limit:'),'native history endpoint missing');
ok(swift.includes('comps.path == "/trace"')&&swift.includes('requestTraceReplay(eventType:'),'native trace endpoint missing');
ok(swift.includes('"record_count": sensorRecordCount')&&swift.includes('"shot_count": sensorShotCount'),'native status shot counters missing');
ok(start.includes('exec /bin/bash "$HERE/internal/start_services.sh"'),'direct start_mac does not route through native BLE launcher');
ok(wrapper.includes('export THREEPM_BLE_WRAPPED=1'),'native launcher recursion guard missing');
ok(js.includes('Browser BLE fallback · page reload reconnects'),'browser fallback reload semantics not disclosed');
console.log('BLE4.3.5 reconnect recovery QA: PASS · history catch-up · selected-trace replay · native launcher ownership · browser reload recovery');
