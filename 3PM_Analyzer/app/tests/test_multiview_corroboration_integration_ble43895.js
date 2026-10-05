const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=path.resolve(__dirname,'..');
const ci=fs.readFileSync(path.join(root,'static/capture_integrity_layer.js'),'utf8'),html=fs.readFileSync(path.join(root,'static/index.html'),'utf8');
for(const x of ['multiview_corroboration_core.js?v=ble438951','MultiViewCorroborationCore'])if(!(html+ci).includes(x))throw new Error(x);
for(const x of ["getMetricsNearEpoch?.('overhead',epoch,180)",'multiViewCorroboration','positive-only, timestamp-matched observer'])if(!ci.includes(x))throw new Error(x);
if(/ready\s*=\s*.*multiViewCorroboration/.test(ci))throw new Error('Overhead must not gate/promote Side readiness');
const expected={'static/core_runtime.js':'89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf','static/pose.js':'22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d','static/app.js':'ed23976568e7f25b5fb370c516ba766f272548e13d8398be5f506029d769f378'};
for(const [f,h] of Object.entries(expected)){const got=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');if(got!==h)throw new Error(`Frozen changed ${f}`)}
console.log('BLE4.3.8.9.5.1 multi-view corroboration integration QA: PASS');
