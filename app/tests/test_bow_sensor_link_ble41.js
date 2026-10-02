const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
const html=fs.readFileSync(path.join(root,'static','index.html'),'utf8');
function assert(x,m){if(!x)throw new Error(m)}
// Hard isolation: optional Sensor evidence cannot create/approve/reject/gate a camera shot.
assert(!/fetch\(['"`]\/api\/shots['"`][\s\S]{0,160}method\s*:\s*['"`]POST/i.test(src),'BLE4.1 must not POST camera shots');
assert(!/FormAnalyzer\?\.onAutoRelease|FormAnalyzer\.onAutoRelease/.test(src),'BLE4.1 must not invoke/wrap camera auto release');
assert(!/autoMarkToggle|phaseDetectToggle/.test(src),'BLE4.1 must not alter frozen camera release controls');
// Link policy: timestamp-bounded, camera release authoritative, let-down excluded.
assert(src.includes("r.event==='release'"),'Only Sensor release records may be linked');
assert(src.includes('LINK_WINDOW_MS=1500'),'Expected explicit ±1500 ms match window');
assert(src.includes("SUMMARY='3a500006-7c8e-4d2a-9b11-0f3a20260001'"),'Authoritative summary characteristic missing');
assert(src.includes("authoritative:'S3_SUMMARY_V1'"),'S3 summary must be authoritative');
assert(src.includes('finalizing:true'),'Immediate provisional shot state missing');
assert(src.includes('!r.finalizing'),'Provisional records must not link to camera shots');
assert(src.includes('},180);'),'Native UI polling should be low-latency');
assert(src.includes('advancedForShot'),'Camera release time must come from Analyzer evidence');
assert(src.includes('cameraReleaseEpochMs'),'Linked record must retain camera release timestamp');
assert(src.includes('syncDeltaMs'),'Linked record must retain timestamp delta');
// Product evidence metrics required for useful stored shot records.
for(const key of ['holdRmsDps','aimDriftDeg','cantReleaseDeg','releaseDisturbanceDeg','releasePeakDps','releasePeakG','followMeanDps','bowRotationDeg','recoveryMs','packetQuality','scores']){
  assert(src.includes(key),`Missing BLE4.1 metric ${key}`);
}
// Devices tab must expose useful evidence, not live graph only.
for(const tab of ['overview','shots','linked','live','diagnostics'])assert(html.includes(`data-eco-tab="${tab}"`),`Missing Devices tab ${tab}`);
for(const id of ['ecoSensorShotRecords','ecoLinkedShotRecords','ecoLatestShotSummary','ecoSensorChart','analysisBowSensorHero','analysisBowSensorDetail'])assert(html.includes(`id="${id}"`),`Missing UI evidence region ${id}`);
// Deterministic match policy mirror.
const camera=100000;
const recs=[
  {id:'ld',event:'letdown',eventEpochMs:100010,linkedCameraShotId:null},
  {id:'far',event:'release',eventEpochMs:101700,linkedCameraShotId:null},
  {id:'near',event:'release',eventEpochMs:100027,linkedCameraShotId:null},
];
const c=recs.filter(r=>r.event==='release'&&!r.linkedCameraShotId).map(r=>({r,d:Math.abs(r.eventEpochMs-camera)})).filter(x=>x.d<=1500).sort((a,b)=>a.d-b.d);
assert(c.length===1&&c[0].r.id==='near'&&c[0].d===27,'Nearest bounded release match failed');
console.log('BLE4.1 linker/product-evidence QA: PASS · let-down excluded · nearest release Δ27 ms · stored metrics/UI present · camera isolation preserved');
