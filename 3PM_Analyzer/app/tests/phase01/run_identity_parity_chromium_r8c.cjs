'use strict';
// FrameUID Node vs real-Chromium WebCrypto parity, positive AND negative vectors (M06).
// Usage: node app/tests/phase01/run_identity_parity_chromium_r8c.cjs [chromiumExecutable]
const path=require('path'),fs=require('fs');
let chromium;try{({chromium}=require('playwright'));}catch{try{({chromium}=require(path.join(process.env.HOME||'','.npm-global/lib/node_modules/playwright')));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not installed'}));process.exit(2);}}
const {frameUID}=require('../../shadow/contracts/identity');
const shadow=path.join(__dirname,'../../shadow/contracts');
const vectors=[
 {name:'golden',v:{runId:'run-1',sourceId:'cam-side',streamGeneration:'g1',frameSeq:'42'}},
 {name:'u64max',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'18446744073709551615'}},
 {name:'utf8',v:{runId:'รอบ-1',sourceId:'กล้อง',streamGeneration:'g',frameSeq:'0'}},
 {name:'overflow',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'18446744073709551616'}},
 {name:'negative',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'-1'}},
 {name:'leadingZero',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'01'}},
 {name:'numberSeq',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:1}},
 {name:'boolSeq',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:true}},
 {name:'nullSeq',v:{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:null}},
 {name:'emptyRun',v:{runId:'',sourceId:'s',streamGeneration:'g',frameSeq:'1'}},
 {name:'missingGen',v:{runId:'r',sourceId:'s',frameSeq:'1'}}
];
const node=vectors.map(x=>{try{return {name:x.name,uid:frameUID(x.v)};}catch(e){return {name:x.name,rejected:true};}});
(async()=>{
  let b;try{b=await chromium.launch({executablePath:process.argv[2]||process.env.CHROMIUM_PATH,args:['--no-sandbox']});}catch(e){console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  // file:// is a secure context in Chromium, so WebCrypto subtle is available without a server.
  const blank=path.join(require('os').tmpdir(),'r8c_identity_parity_blank.html');fs.writeFileSync(blank,'<!doctype html><meta charset=utf-8><p>parity</p>');
  const p=await b.newPage();await p.goto('file://'+blank,{timeout:10000});
  await p.addScriptTag({content:fs.readFileSync(path.join(shadow,'identity_material.js'),'utf8')});
  await p.addScriptTag({content:fs.readFileSync(path.join(shadow,'identity_browser.js'),'utf8')});
  const browser=await p.evaluate(async vs=>{const out=[];for(const x of vs){try{out.push({name:x.name,uid:await window.ShadowIdentityBrowser.frameUID(x.v)});}catch(e){out.push({name:x.name,rejected:true});}}return {out,secure:window.isSecureContext,ua:navigator.userAgent};},vectors);
  await b.close();
  const diffs=node.filter((n,i)=>JSON.stringify(n)!==JSON.stringify(browser.out[i])).map(n=>n.name);
  const expectReject=['overflow','negative','leadingZero','numberSeq','boolSeq','nullSeq','emptyRun','missingGen'];
  const rejectOk=expectReject.every(k=>node.find(x=>x.name===k).rejected&&browser.out.find(x=>x.name===k).rejected);
  const pass=diffs.length===0&&rejectOk&&!node.find(x=>x.name==='golden').rejected;
  console.log(JSON.stringify({status:pass?'PASS':'FAIL',vectors:vectors.length,diffs,rejectOk,browserUA:browser.ua,node,browser:browser.out},null,1));
  process.exit(pass?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
