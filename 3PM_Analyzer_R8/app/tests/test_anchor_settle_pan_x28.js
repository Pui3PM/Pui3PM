const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','static','app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','static','index.html'),'utf8');
function extractFunction(name){
  const marker=`function ${name}`; const start=src.indexOf(marker); if(start<0)throw new Error(`Missing ${name}`);
  let paren=0,inHeadStr=null,headEsc=false,brace=-1;
  for(let i=start;i<src.length;i++){const c=src[i];if(inHeadStr){if(headEsc){headEsc=false;continue;}if(c==='\\'){headEsc=true;continue;}if(c===inHeadStr)inHeadStr=null;continue;}if(c==='"'||c==="'"||c==='`'){inHeadStr=c;continue;}if(c==='(')paren++;else if(c===')')paren--;else if(c==='{'&&paren===0){brace=i;break;}}
  if(brace<0)throw new Error(`Missing body ${name}`);let depth=0,inStr=null,esc=false;
  for(let i=brace;i<src.length;i++){const c=src[i];if(inStr){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===inStr)inStr=null;continue;}if(c==='"'||c==="'"||c==='`'){inStr=c;continue;}if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)return src.slice(start,i+1);}}
  throw new Error(`Unclosed ${name}`);
}
function extractConst(name){const m=src.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`));if(!m)throw new Error(`Missing const ${name}`);return `const ${name}=${m[1]};`;}
function assert(c,m){if(!c)throw new Error(m);}
const code=[
  extractConst('REPLAY_RELEASE_FOCUS_PRE_MS'),extractConst('REPLAY_RELEASE_FOCUS_POST_MS'),extractConst('REPLAY_ANCHOR_FOCUS_PRE_MS'),extractConst('REPLAY_ANCHOR_FOCUS_POST_MS'),
  extractFunction('shotEvidenceCycle'),extractFunction('shotEvidenceStartEpoch'),extractFunction('evidenceUniqueByEpoch'),extractFunction('sampleEvidenceByGap'),extractFunction('nearestEvidenceFromList'),extractFunction('replayEvidenceFramePlan')
].join('\n');
eval(code);
const release=100000;
const metrics={phaseTimeline:[
  {phase:'Set',epochMs:12000},{phase:'Draw',epochMs:12500},{phase:'Anchor',epochMs:13200},{phase:'Aim / Hold',epochMs:13900},
  {phase:'Set',epochMs:97233},{phase:'Draw',epochMs:97619},{phase:'Anchor',epochMs:98584},{phase:'Aim / Hold',epochMs:99120}
]};
const cycle=shotEvidenceCycle(metrics,release);
assert(cycle.startEpochMs===97053,`cycle start ${cycle.startEpochMs}`);
assert(cycle.anchorAt===98584,`anchor acquisition ${cycle.anchorAt}`);
assert(cycle.holdAt===99120,`settled anchor ${cycle.holdAt}`);
assert(cycle.anchorFocusAt===99120,`anchor focus ${cycle.anchorFocusAt}`);
function mkSparse(a,b,step){const out=[];for(let t=a;t<=b;t+=step)out.push({epochMs:t,blob:{},source:'sparse-jpeg'});return out;}
function mkDense(a,b,step){const out=[];for(let t=a;t<=b;t+=step)out.push({epochMs:t,bitmap:{width:10,height:10},source:'native30'});return out;}
const end=102703,sparse=mkSparse(cycle.startEpochMs,end,65),dense=mkDense(99000,end,33);
const plan=replayEvidenceFramePlan(sparse,dense,cycle.startEpochMs,end,release,{finalIsRecovery:true,anchorEpochMs:cycle.anchorFocusAt});
const zones=plan.reduce((m,f)=>(m[f.evidenceZone]=(m[f.evidenceZone]||0)+1,m),{});
assert((zones['anchor-focus']||0)>=10,`anchor settle focus too sparse ${zones['anchor-focus']||0}`);
assert((zones['release-focus']||0)>=36,`release focus too sparse ${zones['release-focus']||0}`);
assert((zones['release-focus']||0)>(zones['anchor-focus']||0),'release must remain densest');
const anchorFrames=plan.filter(f=>f.evidenceZone==='anchor-focus');
const nearest=Math.min(...anchorFrames.map(f=>Math.abs(f.epochMs-cycle.anchorFocusAt)));
assert(nearest<=70,`no frame close to settled anchor: ${nearest} ms`);
assert(plan[0].epochMs>90000,'stale old attempt leaked into current cycle');
assert(plan.filter(f=>f.epochMs>release+650).length<=7,'late follow-through dominates replay');
const dense15=mkDense(99000,end,66);
const plan15=replayEvidenceFramePlan(sparse,dense15,cycle.startEpochMs,end,release,{finalIsRecovery:true,anchorEpochMs:cycle.anchorFocusAt});
const z15=plan15.reduce((m,f)=>(m[f.evidenceZone]=(m[f.evidenceZone]||0)+1,m),{});
assert((z15['release-focus']||0)>=18,`15fps release focus ${z15['release-focus']||0}`);
assert((z15['anchor-focus']||0)>=10,`15fps settled anchor focus ${z15['anchor-focus']||0}`);
assert((z15['release-focus']||0)>=(z15['anchor-focus']||0),'15fps release density regressed below Anchor');
// Old X2.7 record fallback must prefer Aim / Hold from advanced metrics over stored acquisition Anchor.
const shotReplayState={record:null};
function loadAdvancedShotMetrics(){return {release_epoch_ms:release,phase_timeline:metrics.phaseTimeline,anchor_settle_s:.536};}
const replayFn=extractFunction('replayAnchorEpochForShot');
eval(replayFn);
assert(replayAnchorEpochForShot({id:1},{releaseEpochMs:release,anchorEpochMs:98584})===99120,'Anchor button still targets acquisition instead of settled Anchor');
assert(replayAnchorEpochForShot({id:1},{releaseEpochMs:release,anchorEpochMs:98584,anchorFocusEpochMs:99140})===99140,'stored Anchor Focus not preferred');
for(const id of ['prevFrameBtn','nextFrameBtn','replayPanLeftBtn','replayPanUpBtn','replayPanDownBtn','replayPanRightBtn','jumpAnchorBtn','jumpReleaseBtn'])assert(html.includes(`id="${id}"`),`${id} missing`);
for(const marker of ['function panShotReplay','translate3d(','shiftKey&&e.key==="ArrowUp"'])assert(src.includes(marker),`missing ${marker}`);
console.log('X2.8 settled Anchor + Replay pan QA: PASS',{cycle,zones,total:plan.length,zones15:z15,total15:plan15.length,nearest_settled_anchor_ms:nearest});
