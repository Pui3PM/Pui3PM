const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'ble_bridge','3PMBLEBridge.swift'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(js.includes("const BUILD='x282-ble435-reconnect-recovery'"),'BLE4.3.5 build tag missing');
ok(js.includes("async function autoBrowser(){if(S.transport==='native')return;"),'Browser BLE can still race native reconnect');
ok(js.includes('now()-S.connectedStableSince<1500'),'Context sync is not delayed for stable connection');
ok(js.includes('now()-S.lastContextAttempt<3000'),'Context retry backoff missing');
ok(js.includes('setTimeout(()=>syncAnalyzerContext(true),1600)'),'Browser context delay missing');
ok(sw.includes('didUpdateNotificationStateFor characteristic'),'Native bridge does not wait for notification readiness');
ok(sw.includes('setState("subscribing"'),'Native bridge marks connected too early');
ok(sw.includes('.now() + 0.012'),'Context frame pacing missing');
console.log('BLE4.3.4 Analyzer connection-stability QA: PASS · native/browser reconnect arbitration · notification readiness · paced context writes');
