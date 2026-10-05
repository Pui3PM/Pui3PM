const assert=require('assert');
const T=require('../static/temporal_evidence_core.js');
const C=require('../static/capture_integrity_core.js');

// True camera cadence is measured from media-frame timestamps, independent from Pose/UI cadence.
let c=T.cadence(Array.from({length:80},(_,i)=>33.2+(i%3)*.1));
assert(c.fps>29.8&&c.fps<30.2,JSON.stringify(c));
c=T.cadence(Array.from({length:80},()=>16.67));
assert(c.fps>59.5&&c.fps<60.5,JSON.stringify(c));

// Worker evidence replaces low-rate frames only inside the dense release window,
// while preserving pinned beginning-of-shot and recovery evidence.
const rel=1_790_264_500_000;
const blob={size:1};
const existing=[
  {epochMs:rel-5000,offsetMs:-5000,blob,source:'sparse-jpeg',evidenceZone:'draw'},
  {epochMs:rel-2500,offsetMs:-2500,blob,source:'sparse-jpeg',evidenceZone:'anchor-focus'},
  ...[-1200,-1100,-1000,-900,-800,-700,-600,-500,-400,-300,-200,-100,0,100,200,300,400,500,600,700,800,900,1000,1100,1200].map(o=>({epochMs:rel+o,offsetMs:o,blob,source:'native30',evidenceZone:'release-focus'})),
  {epochMs:rel+2800,offsetMs:2800,blob,source:'sparse-jpeg',evidenceZone:'recovery-end'}
];
const worker=[];for(let o=-1250;o<=1350;o+=33)worker.push({epochMs:rel+o,offsetMs:o,blob,source:'native30-worker',evidenceZone:T.releaseZone(o)});
const merged=T.mergeEvidence(existing,worker,rel,{preMs:1250,postMs:1350,replaceDense:true});
assert(merged.some(f=>f.evidenceZone==='draw'));
assert(merged.some(f=>f.evidenceZone==='recovery-end'));
assert(merged.filter(f=>String(f.source).includes('worker')).length>=70);
assert(!merged.some(f=>f.source==='native30'&&f.epochMs>=rel-1250&&f.epochMs<=rel+1350));

assert.equal(T.releaseZone(-400,'draw'),'draw');
assert.equal(T.releaseZone(-300,'anchor'),'anchor-focus');
assert.equal(T.releaseZone(-200,'hold'),'aim-hold');
assert.equal(T.releaseZone(-100,'expansion'),'expansion-pin');
assert.equal(T.releaseZone(900,null),'follow-summary');
assert(T.bundleHealthy({raw_fps:29.7,dense_frame_count:70},30));
assert(!T.bundleHealthy({raw_fps:15.2,dense_frame_count:35},30));

// Semantic timeline must never lose Draw/Anchor because Expansion lasts a long time.
const rows=[
  {phase:'Set',epochMs:rel-9000,role:'side'},
  {phase:'Draw',epochMs:rel-8000,role:'side'},
  {phase:'Anchor',epochMs:rel-6500,role:'side'},
  {phase:'Aim / Hold',epochMs:rel-6000,role:'side'},
];
for(let i=0;i<100;i++)rows.push({phase:'Expansion',epochMs:rel-5000+i*45,role:'side'});
rows.push({phase:'Release',epochMs:rel,role:'side'},{phase:'Follow Through',epochMs:rel+120,role:'side'});
const tl=C.normalizeTimeline(rows,rel);
assert.deepEqual(tl.map(x=>x.phase),['Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through']);

// Contract must be truthful: timeline-only Draw cannot be substituted by an Anchor frame.
const adv={release_epoch_ms:rel,phase_timeline:tl};
const rec={releaseEpochMs:rel,anchorEpochMs:rel-6500,anchorSettledEpochMs:rel-6000,anchorFocusEpochMs:rel-6000,followThroughEndEpochMs:rel+2800,frames:[
  {offsetMs:-6500,blob,evidenceZone:'anchor-focus'},
  {offsetMs:-6000,blob,evidenceZone:'aim-hold'},
  {offsetMs:-5000,blob,evidenceZone:'expansion-pin'},
  {offsetMs:0,blob,evidenceZone:'release-focus'},
  {offsetMs:800,blob,evidenceZone:'follow-summary'},
  {offsetMs:2800,blob,evidenceZone:'recovery-end'},
]};
let contract=C.evidenceContract(rec,adv);
assert.equal(contract.complete,false);
assert(contract.missing.includes('draw'));
rec.frames.unshift({offsetMs:-8000,blob,evidenceZone:'draw'});
contract=C.evidenceContract(rec,adv);
assert.equal(contract.complete,true,JSON.stringify(contract));

console.log('BLE4.3.7.3 temporal evidence core QA PASS');
