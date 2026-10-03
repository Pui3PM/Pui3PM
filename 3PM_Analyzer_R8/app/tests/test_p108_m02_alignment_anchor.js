'use strict';
// R8 P1-08 M-02: unknown alignment / Anchor targets fail closed. null/undefined/''/boolean -> no match/Missing;
// a valid numeric 0 is still valid. Usage: node app/tests/test_p108_m02_alignment_anchor.js [path-to-app/static]
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const C=require(path.join(root,'camera_timeline_core.js'));
const failures=[];const check=(n,f)=>{try{f();}catch(e){failures.push(`${n}: ${e.message}`);}};
const UNKNOWN=[null,undefined,'','  ',true,false];
check('nearestFrame: unknown target never matches a frame at time 0',()=>{
  const frames=[{masterTimeMs:0,frameSeq:1},{masterTimeMs:33,frameSeq:2}];
  for(const t of UNKNOWN)assert.strictEqual(C.nearestFrame(frames,t),null,`target ${JSON.stringify(t)}`);
  assert.strictEqual(C.nearestFrame(frames,0)?.frame.frameSeq,1,'valid zero still matches');
});
check('logicalSlotAlignment: null master clock falls back to epoch, unknown stays unknown',()=>{
  assert.strictEqual(C.logicalSlotAlignment([{masterTimeMs:null,epochMs:1000}],{})[0].targetMs,1000);
  assert.strictEqual(C.logicalSlotAlignment([{masterTimeMs:0,epochMs:1000}],{})[0].targetMs,0,'valid zero master time wins');
  for(const u of UNKNOWN){const r=C.logicalSlotAlignment([{masterTimeMs:u,epochMs:u}],{framesByRole:{}})[0];assert.strictEqual(r.targetMs,null);assert(Object.values(r.views).every(v=>v===null));}
});
function anchorRun(target){
  const messages=[];
  const ctx={console,window:{toast:(...a)=>messages.push(a)},document:{readyState:'loading',addEventListener(){}},
    shotReplayState:{index:0,record:{frames:[{offsetMs:-500,evidenceZone:'draw'},{offsetMs:0,evidenceZone:'release-focus'},{offsetMs:-200,evidenceZone:'anchor-focus'}]}},
    selectedShot:()=>({id:1}),replayAnchorOffsetForShot:()=>target,stopShotReplay(){},renderShotReplayFrame(){},setInterval(){}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'evidence_integrity_repair_layer.js'),'utf8'),ctx);
  const jumped=ctx.window.EvidenceIntegrityRepairLayer.correctedAnchorJump();
  return {jumped,index:ctx.shotReplayState.index,messages};
}
check('Anchor handler: unknown target -> no jump, explicit Missing message (Astra unknownAnchorTarget)',()=>{
  for(const t of UNKNOWN){const r=anchorRun(t);assert.strictEqual(r.jumped,false,`target ${JSON.stringify(t)} jumped`);assert.strictEqual(r.index,0);assert(r.messages.length===1,'user told why');}
});
check('Anchor handler: valid numeric targets still jump forward to a tagged frame',()=>{
  const r=anchorRun(-250);assert.strictEqual(r.jumped,true);assert.strictEqual(r.index,2,'anchor-focus at -200 ms');
  const z=anchorRun(0);assert.strictEqual(z.jumped,true,'valid zero target is honoured');assert.strictEqual(z.index,1,'frame at/after 0 ms (designed fallback when no Anchor tag follows)');
});
if(failures.length){console.error('P1-08 M-02 alignment/Anchor FAIL\n - '+failures.join('\n - '));process.exit(1);}
console.log('P1-08 M-02 alignment/Anchor PASS: unknown targets fail closed, numeric zero valid');
