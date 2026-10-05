'use strict';
// R8C F01 browser acceptance: real Chromium, real MutationObserver/timers. Not part of the Node-only runner.
// Usage: node app/tests/phase01/run_f01_chromium_r8c.cjs [chromiumExecutable]
// Requires the 'playwright' package. If no browser is available, report BLOCKED - never PASS.
const path=require('path');
let chromium;try{({chromium}=require('playwright'));}catch{try{({chromium}=require(path.join(process.env.HOME||'','.npm-global/lib/node_modules/playwright')));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not installed'}));process.exit(2);}}
const exe=process.argv[2]||process.env.CHROMIUM_PATH||undefined;
(async()=>{
  let b;try{b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});}catch(e){console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  let loaded=true;try{await p.goto('file://'+path.join(__dirname,'f01_fix_harness.html'),{timeout:10000});}catch{loaded=false;}
  if(!loaded){await b.close().catch(()=>{});console.log(JSON.stringify({status:'FAIL',reason:'page never finished loading: event loop starved (observer/render microtask loop)'}));process.exit(1);}
  let done=false;try{await p.waitForFunction(()=>document.documentElement.dataset.done==='1',null,{timeout:15000});done=true;}catch{}
  const out=done?JSON.parse(await p.textContent('#result')):null;await b.close();
  const checks=done?{
    rail25:out.initialSlots===25&&out.slotsAfterRebuild===25,
    realCountMatchesFrames:out.initialReal===3&&out.realAfterNewRecord===5,
    noIdleLoop:out.idleCallbacks1500ms<=2&&out.idleAfterStep<=2&&out.idleAfterRebuild<=2,
    activeFollowsReplay:out.activeAfterStep===2,
    slotClickWorks:out.indexAfterSlotClick===1,
    anchorPicksTaggedFrameAtOrAfterTarget:out.indexAfterAnchor===2,
    anchorReboundAfterPanelRebuild:out.anchorRebound===true,
    noPageErrors:errors.length===0
  }:{harnessCompleted:false};
  const pass=done&&Object.values(checks).every(Boolean);
  console.log(JSON.stringify({status:pass?'PASS':'FAIL',harnessCompleted:done,checks,observed:out,errors},null,1));
  process.exit(pass?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
