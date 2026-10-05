const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'static','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'static','style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'static','bow_sensor_ble.js'),'utf8');
function ok(x,m){if(!x)throw new Error(m)}
const hero=html.indexOf('analysis-hero-grid v21-analysis-grid'), sensor=html.indexOf('analysisBowSensorHero'), detail=html.indexOf('analysisBowSensorDetail'), support=html.indexOf('analysis-support-grid');
ok(hero>=0&&sensor>hero&&detail>sensor&&support>detail,'Analyze visual hierarchy is not Video+Sensor → Sensor Detail → Support');
ok(css.includes('grid-template-areas:"video sensor"'),'desktop Analyze hero is not two-column Video + Sensor');
ok(css.includes('.bow-phase-spark'),'metric spark bars missing');
ok(css.includes('grid-template-columns:minmax(0,1.78fr) minmax(330px,.78fr)'),'Release/Aim visual ratio missing');
ok(css.includes('.bow-key-grid.cockpit-keys'),'Key Numbers strip styling missing');
ok(js.includes("scoreBar('Hold Stability',m.scores?.hold,'hold','#3db9ff')"),'Hold history spark not wired');
ok(js.includes('analysisPageTitle'),'Shot header sync missing');
console.log('BLE4.3.4 Analyzer visual-match regression QA: PASS · Video+Sensor cockpit · release/aim charts · real-history spark bars · key strip');
