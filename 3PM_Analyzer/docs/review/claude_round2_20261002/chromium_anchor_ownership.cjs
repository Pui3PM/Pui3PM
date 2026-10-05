'use strict';
// Real-Chromium check of Anchor button handler ownership on the full app page (needs a page that reaches load).
// Uses CDP DOMDebugger.getEventListeners on #jumpAnchorBtn after boot and after 3 s idle.
// Usage: node chromium_anchor_ownership.cjs <indexUrl> [chromium]
const path=require('path');let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.HOME||'','.npm-global/lib/node_modules/playwright')));}
(async()=>{const b=await chromium.launch({executablePath:process.argv[3]||process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const p=await b.newPage();let loaded=true;try{await p.goto(process.argv[2],{waitUntil:'load',timeout:20000});}catch{loaded=false;}
 if(!loaded){console.log(JSON.stringify({status:'FAIL',reason:'page never reached load (F01-class hang); ownership cannot be inspected'}));await b.close();process.exit(1);}
 const cdp=await p.context().newCDPSession(p);
 async function inspect(){const {result}=await cdp.send('Runtime.evaluate',{expression:"document.getElementById('jumpAnchorBtn')"});if(!result.objectId)return {present:false};
  const {listeners}=await cdp.send('DOMDebugger.getEventListeners',{objectId:result.objectId});const clicks=listeners.filter(l=>l.type==='click');
  const ds=await p.evaluate(()=>({hv2Bound:document.getElementById('jumpAnchorBtn')?.dataset.hv2Bound||null,onclickProp:typeof document.getElementById('jumpAnchorBtn')?.onclick}));
  return {present:true,clickListeners:clicks.length,listenerScripts:clicks.map(l=>(l.scriptId?'script#'+l.scriptId:'?')+':'+l.lineNumber),...ds};}
 const atLoad=await inspect();await p.waitForTimeout(3000);const after=await inspect();await b.close();
 const single=after.present&&after.clickListeners===1&&after.hv2Bound==='1';
 console.log(JSON.stringify({status:single?'SINGLE_OWNER':'AMBIGUOUS_OWNER',atLoad,after3s:after},null,1));process.exit(single?0:1);})().catch(e=>{console.error(e);process.exit(2);});
