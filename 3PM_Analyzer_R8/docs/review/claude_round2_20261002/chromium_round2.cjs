'use strict';
// Real-Chromium checks for the ClaudeRepair tree:
//  B1 shadow_runtime_bundle.js executes in a real browser page and produces byte-identical canonical results to Node
//     (FrameUID golden + negative vectors, full logical25 projection, archive manifestDigest).
//  B2 base64/archive large-blob limit inside the browser.
//  B3 F01 full-page load of app/static/index.html via a static server URL (pass URL as argv[3]).
// Usage: node chromium_round2.cjs <tree>/app <indexUrlOrNone> [chromium]
const path=require('path'),fs=require('fs'),os=require('os');const APP=path.resolve(process.argv[2]);const URL_=process.argv[3];const EXE=process.argv[4]||process.env.CHROMIUM_PATH;
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(process.env.HOME||'','.npm-global/lib/node_modules/playwright')));}
const {canonicalize}=require(path.join(APP,'shadow/contracts/canonical_json'));const F=require(path.join(APP,'tests/phase01/_shadow_fixture.js'));
const {frameUID}=require(path.join(APP,'shadow/contracts/identity'));const {project25}=require(path.join(APP,'shadow/projector/logical25'));const AR=require(path.join(APP,'shadow/archive/shadow_archive'));
const TL={masterClockId:'m',draw:{status:'verified',start:0,end:200000,refs:['d']},anchor:{status:'verified',start:250000,end:600000,refs:['a']},hold:{status:'verified',start:600000,end:900000,refs:['h']}};
const cands=[];for(let i=0;i<40;i++)cands.push(F.candidate(100+i,i*33333,{}));
const pargs={runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,releaseTime:1000000,candidates:cands,roleBindings:[F.binding({startMasterTime:0,endMasterTime:2000000,capturePeriodUs:33333,jitterUs:0})],projectionId:'chrome',configDigest:'cfg'};
const vectors=[{runId:'run-1',sourceId:'cam-side',streamGeneration:'g1',frameSeq:'42'},{runId:'รอบ',sourceId:'กล้อง',streamGeneration:'g',frameSeq:'18446744073709551615'},{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'18446744073709551616'},{runId:'run\uD800',sourceId:'s',streamGeneration:'g',frameSeq:'1'},{runId:'',sourceId:'s',streamGeneration:'g',frameSeq:'1'},{runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:1}];
const nodeUIDs=vectors.map(v=>{try{return frameUID(v);}catch{return 'REJECT';}});
const nodeProj=canonicalize(project25(pargs));
const fr=F.frame(7,{mappedMasterTime:30000,payloadRef:'blobs/7.jpg',contentDigest:require('crypto').createHash('sha256').update('img').digest('hex'),decodeValid:true});
const archIn={archiveId:'chrome-arc',baselineDigest:'a'.repeat(64),records:{frames:[fr],candidates:[],events:[],projections:[]}};
const nodeArc=AR.buildArchive({...archIn,files:{'blobs/7.jpg':new TextEncoder().encode('img')}}).manifest.manifestDigest;
(async()=>{
 const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});const res={browser:null};
 const blank=path.join(os.tmpdir(),'r2_blank.html');fs.writeFileSync(blank,'<!doctype html><meta charset=utf-8><p>x</p>');
 const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e.message)));await p.goto('file://'+blank);res.browser=await p.evaluate(()=>navigator.userAgent);
 await p.addScriptTag({content:fs.readFileSync(path.join(APP,'shadow/browser/shadow_runtime_bundle.js'),'utf8')});
 const r=await p.evaluate(({vectors,pargs,archIn})=>{const S=globalThis.ThreePMShadow;const hasNodeGlobals={require:typeof require,Buffer:typeof Buffer,process:typeof process};
   const uids=vectors.map(v=>{try{return S.identity.frameUID(v);}catch{return 'REJECT';}});const proj=S.projector.project25(pargs);
   const arc=S.archive.buildArchive({...archIn,files:{'blobs/7.jpg':new TextEncoder().encode('img')}}).manifest.manifestDigest;
   let limit=null;const tryN=n=>{try{S.archive.buildArchive({archiveId:'big',baselineDigest:'a'.repeat(64),records:{frames:[],candidates:[],events:[],projections:[]},files:{'b.bin':new Uint8Array(n)}});return true;}catch(e){return e instanceof RangeError?false:'other:'+e.message;}};
   const at1=tryN(1*1024*1024),at4=tryN(4*1024*1024),at16=tryN(16*1024*1024);
   return {hasNodeGlobals,uids,proj:JSON.parse(JSON.stringify(proj)),arc,archive1MB:at1,archive4MB:at4,archive16MB:at16};},{vectors,pargs,archIn});
 res.B1={bundleRanWithoutNodeGlobals:r.hasNodeGlobals,uidParity:JSON.stringify(r.uids)===JSON.stringify(nodeUIDs),uids:r.uids.map(x=>x==='REJECT'?x:x.slice(0,12)),projectionCanonicalParity:canonicalize(r.proj)===nodeProj,projectionReal:r.proj.uniqueRealCount,archiveDigestParity:r.arc===nodeArc,pageErrors:errs};
 res.B2={archive1MB:r.archive1MB,archive4MB:r.archive4MB,archive16MB:r.archive16MB,meaning:'false = RangeError (stack overflow in base64 validation)'};
 if(URL_&&URL_!=='none'){const q=await b.newPage();let loaded=true;try{await q.goto(URL_,{waitUntil:'load',timeout:20000});}catch{loaded=false;}res.B3={url:URL_,reachedLoad:loaded};}
 await b.close();console.log(JSON.stringify(res,null,1));
})().catch(e=>{console.error(e);process.exit(1);});
