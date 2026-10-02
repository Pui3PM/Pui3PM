const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const U=require('../static/ui_stability_core.js');
function cls(init=[]){const s=new Set(init);return{add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x),toggle(x,on){if(on===undefined){if(s.has(x))s.delete(x);else s.add(x);}else if(on)s.add(x);else s.delete(x);},has:x=>s.has(x)};}
const metrics={};for(const [id,val] of Object.entries({mHold:'1.49',mElbow:'42.0',mBowArm:'175.0',mShoulder:'6.0',mTorso:'2.0',mHeadMm:'27.4',mHeadPitch:'-10.4°',mAnchorFace:'3.2%',mHeadTowardDraw:'1.0%',mAnchorDrift:'0.8%',mAnchorStability:'0.4%',mReleasePath:'82 / 18%',mPoseQuality:'55%'}))metrics[id]={id,textContent:val,dataset:{},classList:cls(id==='mPoseQuality'?['pose-warn']:[]),setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}};
const body={classList:cls()};
const banner={id:'selectedShotSnapshotBanner',textContent:'',className:'selected-shot-snapshot-banner hidden',classList:cls(['hidden'])};
const grid={insertAdjacentElement(where,el){assert.equal(where,'beforebegin');Object.assign(banner,el);banner.classList=cls(['hidden']);}};
const row={dataset:{id:'17'}};const shotNum={textContent:'#4'};
const document={readyState:'loading',body,addEventListener(){},getElementById(id){return metrics[id]||null},querySelector(sel){if(sel==='.pose-metrics')return grid;if(sel==='#selectedShotSnapshotBanner')return banner;if(sel==='.shot-row-v34.selected')return row;if(sel==='.shot-row-v34.selected .shot-num')return shotNum;return null},createElement(tag){return{id:'',textContent:'',className:'',classList:cls(),dataset:{}}}};
const window={UIStabilityCore:U};
const sandbox={window,document,globalThis:window,console,MutationObserver:function(){this.observe=()=>{};},setTimeout(){return 1},clearTimeout(){},queueMicrotask(fn){fn();},Number,String,Object,Array,Map,Set,Date,Math};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/ui_stability_layer.js'),'utf8'),sandbox);
window.UIStabilityLayer.captureSelectedMetrics(17);
assert(body.classList.has('selected-shot-metrics-locked'));
assert.equal(metrics.mHold.dataset.shotValue,'1.49');
assert.equal(metrics.mPoseQuality.dataset.shotTone,'warn');
assert(banner.textContent.includes('SELECTED SHOT #4'));
metrics.mHold.textContent='99.9'; // simulate Live Pose DOM ownership trying to overwrite the hidden source text
assert.equal(metrics.mHold.dataset.shotValue,'1.49','visible selected-shot snapshot must stay immutable while Live Pose changes');
window.UIStabilityLayer.unlockSelectedMetrics();
assert(!body.classList.has('selected-shot-metrics-locked'));
assert.equal(metrics.mHold.dataset.shotValue,undefined);
console.log('BLE4.3.7.1 selected-shot isolation integration QA PASS');
