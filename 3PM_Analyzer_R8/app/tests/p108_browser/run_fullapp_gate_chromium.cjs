'use strict';
// R8 P1-08 M-03: full-app browser gate (real Chromium, real index.html, real IndexedDB, real Review UI).
// Backend = documented test double (stub_backend.cjs): the shipped Mach-O runtime cannot run on Linux, so this gate
// proves the browser application, NOT the Mac backend/camera. Exit 0 PASS, 1 FAIL, 2 BLOCKED (never PASS when blocked).
// Usage: node app/tests/p108_browser/run_fullapp_gate_chromium.cjs [chromiumPath] [staticDir]
const path=require('path');
let chromium;try{({chromium}=require('playwright'));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not resolvable'}));process.exit(2);}
const S=require('./stub_backend.cjs');
const exe=process.argv[2]||process.env.CHROMIUM_PATH||undefined,staticDir=path.resolve(process.argv[3]||path.join(__dirname,'../../static'));
const checks={},detail={};const ok=(k,v,d)=>{checks[k]=!!v;if(d!==undefined)detail[k]=d;};
(async()=>{
  const srv=await S.start(staticDir);let b;
  try{b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});}catch(e){await srv.close();console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();const pageErrors=[],consoleErrors=[];
  p.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,300)));
  p.on('console',m=>{if(m.type()==='error')consoleErrors.push({text:m.text().slice(0,200),url:m.location()?.url||''});});
  const refused=[];p.on('requestfailed',r=>refused.push(r.url()));
  // Per-observer attribution: a runaway (F01) is a self-triggering microtask loop (>330 callbacks/s); a frame-driven
  // UI refresh is bounded by the animation frame rate. Both are measured per creation site.
  await p.addInitScript(()=>{window.__mo={};const RM=window.MutationObserver;window.MutationObserver=class{constructor(cb){const site=((new Error().stack||'').split('\n')[2]||'').replace(/\?v=[^:]*/,'').replace(/.*\/static\//,'').replace(/:\d+\)?$/,'').trim();window.__moN=(window.__moN||0)+1;const key=site+'#'+window.__moN;this.i=new RM((m,o)=>{window.__mo[key]=(window.__mo[key]||0)+1;cb(m,o);});}observe(...a){return this.i.observe(...a);}disconnect(){return this.i.disconnect();}takeRecords(){return this.i.takeRecords();}};
    window.__urls=new Set();const c=URL.createObjectURL.bind(URL),r=URL.revokeObjectURL.bind(URL);URL.createObjectURL=o=>{const u=c(o);window.__urls.add(u);return u;};URL.revokeObjectURL=u=>{window.__urls.delete(u);return r(u);};});
  const url=`http://127.0.0.1:${srv.port}/static/index.html`;
  try{await p.goto(url,{waitUntil:'load',timeout:30000});}catch(e){ok('reachedLoad',false,String(e.message).split('\n')[0]);}
  if(checks.reachedLoad===undefined)ok('reachedLoad',true);
  await p.waitForTimeout(2500);
  const mods=await p.evaluate(()=>({FrameIdentityCore:!!window.FrameIdentityCore,TemporalEvidenceCore:!!window.TemporalEvidenceCore,EvidenceBudgetCore:!!window.EvidenceBudgetCore,CameraTimelineCore:!!window.CameraTimelineCore,
    NativeCaptureLayer:!!window.NativeCaptureLayer,EvidenceIntegrityRepairLayer:!!window.EvidenceIntegrityRepairLayer,EvidenceBudgetLayer:!!window.EvidenceBudgetLayer,FormAnalyzer:!!window.FormAnalyzer,
    budgetVersion:window.EvidenceBudgetCore?.VERSION,identity:window.FrameIdentityCore?.VERSION}));
  ok('requiredModulesLoaded',Object.entries(mods).filter(([k])=>!/Version|identity/.test(k)).every(([,v])=>v===true),mods);
  ok('p108CoresActive',/P1-08/.test(mods.budgetVersion||'')&&/P1-08/.test(mods.identity||''),{budget:mods.budgetVersion,identity:mods.identity});
  const env=await p.evaluate(()=>({bridge:window.NativeCaptureLayer.browserInfo().native_capture_bridge,storage:document.getElementById('storagePath')?.textContent,
    rail:document.querySelectorAll('#fixedEvidence25Rail button').length,ctrls:['prevFrameBtn','nextFrameBtn','replayPlayBtn','jumpAnchorBtn','consistencyPanel'].map(id=>!!document.getElementById(id))}));
  ok('expectedBackendStateVisible',env.bridge&&env.bridge.available===false&&!!env.bridge.error&&/test double/.test(env.storage||''),{bridge:{available:env.bridge?.available,error:env.bridge?.error},storage:env.storage});
  ok('rail25',env.rail===25,env.rail);ok('keyControlsExist',env.ctrls.every(Boolean),env.ctrls);
  // Anchor single owner (CDP listener count).
  const cdp=await ctx.newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('DOMDebugger.enable').catch(()=>{});
  const listeners=async()=>{const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#jumpAnchorBtn'});if(!nodeId)return -1;const {object}=await cdp.send('DOM.resolveNode',{nodeId});const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId:object.objectId});return listeners.filter(l=>l.type==='click').length;};
  ok('anchorSingleOwnerAtLoad',await listeners()===1);
  // Idle observer must settle (F01 runaway: 100 callbacks in < 300 ms).
  const observe=async(ms)=>{await p.evaluate(()=>{window.__mo={};});await p.waitForTimeout(ms);return p.evaluate(()=>window.__mo);};
  const settle=(by,ms)=>{/* keys are per observer INSTANCE (site#n) */const rail=Object.entries(by).filter(([k])=>/evidence_integrity_repair_layer/.test(k)).reduce((n,[,v])=>n+v,0),maxRate=Math.max(0,...Object.values(by))*1000/ms;return {rail,maxPerSecond:Math.round(maxRate),by};};
  let idle=settle(await observe(2000),2000);ok('idleObserverSettles',idle.rail<=5&&idle.maxPerSecond<=70,idle);
  // Seed evidence through the APP'S OWN writer (frozen evidenceDbMerge -> real IndexedDB).
  const seed=await p.evaluate(async()=>{
    const jpeg=async(i)=>{const c=new OffscreenCanvas(64,48),x=c.getContext('2d');x.fillStyle=`hsl(${i*14},70%,50%)`;x.fillRect(0,0,64,48);return await c.convertToBlob({type:'image/jpeg',quality:.8});};
    const rel=Date.now()-60000,z=['draw','anchor-focus','anchor-focus','aim-hold','release-focus','release-focus','release-focus','follow-summary','follow-summary','recovery-end'],offs=[-3000,-2200,-2000,-1500,-100,0,100,800,1300,2000];
    const side=[];for(let i=0;i<10;i++)side.push({epochMs:rel+offs[i],offsetMs:offs[i],mediaTime:5+offs[i]/1000,blob:await jpeg(i),source:'sparse-jpeg',evidenceZone:z[i]});
    await evidenceDbMerge({sessionId:1,shotId:11,role:'side',releaseEpochMs:rel,followThroughEndEpochMs:rel+2000,frames:side});
    const rear=[];for(let i=0;i<5;i++)rear.push({epochMs:rel-200+i*100,offsetMs:-200+i*100,mediaTime:9+i/10,blob:await jpeg(20+i),source:'sparse-jpeg',evidenceZone:'release-focus'});
    await evidenceDbMerge({sessionId:1,shotId:11,role:'rear',releaseEpochMs:rel,frames:rear});
    // Shot 12: mixed clock domains (native PTS + browser video time); physical order Release < Follow < Recovery.
    const rel2=rel+20000,mixed=[];
    for(let i=0;i<4;i++)mixed.push({epochMs:rel2-60+i*33,offsetMs:-60+i*33,mediaTime:5000+i*0.033,frameSeq:i+10,generation:1,frameUID:`n1/side/1/${i+10}/${rel2-60+i*33}`,blob:await jpeg(40+i),source:'native-avfoundation-standard',evidenceZone:'release-focus'});
    mixed.push({epochMs:rel2+900,offsetMs:900,mediaTime:9.9,blob:await jpeg(50),source:'sparse-jpeg',evidenceZone:'follow-summary'});
    mixed.push({epochMs:rel2+2000,offsetMs:2000,mediaTime:12,blob:await jpeg(51),source:'sparse-jpeg',evidenceZone:'recovery-end'});
    await evidenceDbMerge({sessionId:1,shotId:12,role:'side',releaseEpochMs:rel2,followThroughEndEpochMs:rel2+2000,frames:mixed});
    // H-02 in real IndexedDB: re-merge the readback of shot 11 (structured-clone copies) -> must not grow.
    const back=await evidenceDbGet(11,'side',1);await evidenceDbMerge({sessionId:1,shotId:11,role:'side',releaseEpochMs:rel,frames:back.frames});
    const again=await evidenceDbGet(11,'side',1);return {sideAfterReadbackMerge:again.frames.length,shot12:(await evidenceDbGet(12,'side',1)).frames.map(f=>[f.offsetMs,f.evidenceZone])};});
  ok('idbReadbackMergeNoDuplicates',seed.sideAfterReadbackMerge===10,seed.sideAfterReadbackMerge);
  const s12=seed.shot12;ok('idbMixedClockPhysicalOrder',s12.every((x,i)=>i===0||x[0]>=s12[i-1][0])&&s12.at(-1)[1]==='recovery-end',s12);
  const view=()=>p.evaluate(()=>({sel:selectedShotId,role:shotReplayState?.role,n:shotReplayState?.record?.frames?.length,idx:shotReplayState?.index,playing:!!shotReplayState?.playing,
    real:[...document.querySelectorAll('#fixedEvidence25Rail button.real')].length,missing:[...document.querySelectorAll('#fixedEvidence25Rail button.missing')].length,
    offs:(shotReplayState?.record?.frames||[]).map(f=>Number(f.offsetMs)),anchorDisabled:document.getElementById('jumpAnchorBtn')?.disabled,urls:window.__urls.size}));
  await p.click('.mode-btn[data-mode="review"]');await p.waitForTimeout(500);                 // user switches to Review
  await p.click('.shot-row-v34[data-id="11"]');await p.waitForTimeout(1200);
  let v=await view();ok('shotOpens25Slots',v.sel===11&&v.real===10&&v.missing===15,v);
  ok('reviewChronology',v.offs.every((o,i)=>i===0||o>=v.offs[i-1]),v.offs);
  const i0=v.idx;await p.click('#nextFrameBtn');v=await view();const nextOk=v.idx===i0+1;await p.click('#prevFrameBtn');v=await view();ok('prevNext',nextOk&&v.idx===i0,{i0,after:v.idx});
  await p.click('#replayPlayBtn');await p.waitForTimeout(400);const playing=(await view()).playing;await p.click('#replayPlayBtn');await p.waitForTimeout(150);ok('play',playing===true&&(await view()).playing===false,{playing});
  // Anchor: no settled-anchor timing on this shot -> UI disabled AND handler fails closed (consistent).
  const ah=await p.evaluate(()=>{const before=shotReplayState.index;const r=window.EvidenceIntegrityRepairLayer.correctedAnchorJump();return {r,moved:shotReplayState.index!==before};});
  ok('anchorConsistentNoTarget',v.anchorDisabled===true&&ah.r===false&&ah.moved===false,{disabled:v.anchorDisabled,handler:ah});
  await p.evaluate(()=>document.querySelector('.review-role-btn[data-review-role="rear"]').click());await p.waitForTimeout(1000);v=await view();ok('roleSwitch',v.role==='rear'&&v.real===5&&v.missing===20,v);
  await p.evaluate(()=>document.querySelector('.review-role-btn[data-review-role="side"]').click());await p.waitForTimeout(800);
  await p.evaluate(()=>document.querySelector('.shot-row-v34[data-id="12"]').click());await p.waitForTimeout(1200);v=await view();
  ok('shotSwitchNoStaleFrames',v.sel===12&&v.real===6&&v.missing===19,v);ok('shotSwitchPhysicalOrder',v.offs.every((o,i)=>i===0||o>=v.offs[i-1]),v.offs);
  // Panel rebuild + repeated switching: rail and single Anchor owner survive; object URLs do not accumulate.
  for(let k=0;k<4;k++){for(const id of ['11','12']){await p.evaluate(x=>document.querySelector(`.shot-row-v34[data-id="${x}"]`).click(),id);await p.waitForTimeout(500);}}
  await p.evaluate(()=>{try{window.FormAnalyzer?.refreshShotUI?.();}catch{}});await p.waitForTimeout(900);
  v=await view();ok('panelRebuildRail25',(v.real+v.missing)===25,v);ok('anchorSingleOwnerAfterRebuild',await listeners()===1);
  ok('noObjectUrlLeak',v.urls<=v.n+2,{liveObjectUrls:v.urls,currentFrames:v.n});
  const idle2=settle(await observe(2000),2000);ok('idleObserverSettlesAfterInteraction',idle2.rail<=5&&idle2.maxPerSecond<=70,idle2);
  ok('noPageErrors',pageErrors.length===0,pageErrors);
  ok('noUnhandledBackendRequests',srv.unhandled.length===0,srv.unhandled);
  const unexpected=consoleErrors.filter(e=>!/ERR_CONNECTION_REFUSED/.test(e.text)||!/48735/.test(JSON.stringify(refused)));
  ok('onlyExpectedConsoleErrors',unexpected.length===0&&refused.every(u=>u.startsWith('http://127.0.0.1:48735/')),{unexpected:unexpected.slice(0,5),refusedHosts:[...new Set(refused.map(u=>new URL(u).host))]});
  await b.close();await srv.close();
  const pass=Object.values(checks).every(Boolean);
  console.log(JSON.stringify({status:pass?'PASS':'FAIL',scope:'Linux headless Chromium + backend test double; not Mac backend/camera acceptance',checks,detail},null,1));
  process.exit(pass?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
