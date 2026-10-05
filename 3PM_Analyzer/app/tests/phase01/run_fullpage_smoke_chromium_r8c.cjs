'use strict';
// Full-page load smoke in a real browser. Detects the F01-class failure where the app never reaches 'load'
// (event loop starved), and records page errors. On Mac, point it at the real launcher URL.
// Usage: node app/tests/phase01/run_fullpage_smoke_chromium_r8c.cjs <url> [chromiumExecutable]
//   e.g. Linux without backend: (cd app && python3 -m http.server 8762) then url=http://127.0.0.1:8762/static/index.html
// A static-only server has no backend API: /health, /vision/* failures and one HTML "Error response" page error are
// environmental there. Compare against a baseline run under the same server before attributing an error to a change.
const path=require('path');
let chromium;try{({chromium}=require('playwright'));}catch{try{({chromium}=require(path.join(process.env.HOME||'','.npm-global/lib/node_modules/playwright')));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not installed'}));process.exit(2);}}
const url=process.argv[2];if(!url){console.error('url required');process.exit(2);}
(async()=>{
  let b;try{b=await chromium.launch({executablePath:process.argv[3]||process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});}catch(e){console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  let loaded=true;try{await p.goto(url,{waitUntil:'load',timeout:20000});}catch{loaded=false;}
  if(!loaded){await b.close().catch(()=>{});console.log(JSON.stringify({status:'FAIL',reason:'page never reached load in 20 s (event loop starved or blocking script)'}));process.exit(1);}
  await p.waitForTimeout(5000);
  const t0=await p.evaluate(()=>performance.now());await p.waitForTimeout(1000);const t1=await p.evaluate(()=>performance.now());
  const st=await p.evaluate(()=>({temporalCore:!!window.TemporalEvidenceCore,cameraTimeline:!!window.CameraTimelineCore,nativeCapture:!!window.NativeCaptureLayer,evidenceRepair:!!window.EvidenceIntegrityRepairLayer,formAnalyzer:!!window.FormAnalyzer,rail25:document.querySelectorAll('#fixedEvidence25Rail button').length}));
  await b.close();
  const responsive=(t1-t0)<3000;
  console.log(JSON.stringify({status:responsive?'LOADED':'FAIL',responsive,state:st,pageErrors:[...new Set(errs)]},null,1));
  process.exit(responsive?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
