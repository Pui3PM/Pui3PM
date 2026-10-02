const assert=require('assert');
const C=require('../static/activity_classifier_core.js');
const W=320,H=180;
function baseImage(){
  const d=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4,n=((x*13+y*7)%17)-8,v=150+n;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;
  }
  return{data:d,width:W,height:H};
}
function pix(im,x,y,v=12){x=Math.round(x);y=Math.round(y);if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;}
function line(im,x0,y0,x1,y1,w=1){const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)));for(let i=0;i<=n;i++){const t=i/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;for(let dx=-w;dx<=w;dx++)for(let dy=-w;dy<=w;dy++)pix(im,x+dx,y+dy);}}
function pose(){const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.95}));lm[11]={x:.46,y:.48,visibility:.95};lm[12]={x:.56,y:.48,visibility:.95};lm[13]={x:.35,y:.48,visibility:.95};lm[15]={x:.24,y:.48,visibility:.95};lm[14]={x:.64,y:.43,visibility:.95};lm[16]={x:.72,y:.35,visibility:.95};return lm;}
const lm=pose();
const blank=baseImage();
const bow=baseImage();line(bow,.24*W,.05*H,.24*W,.95*H,1);
const elastic=baseImage();line(elastic,.24*W,.48*H,.72*W,.35*H,1);
const thinString=baseImage();line(thinString,.24*W,.48*H,.72*W,.35*H,0);
const door=baseImage();line(door,.05*W,.02*H,.05*W,.98*H,2);
const vb=C.extractVisualEvidence(bow,lm,{rightHanded:true});
const ve=C.extractVisualEvidence(elastic,lm,{rightHanded:true});
const vd=C.extractVisualEvidence(door,lm,{rightHanded:true});
const vt=C.extractVisualEvidence(thinString,lm,{rightHanded:true});
assert(vb.usable&&vb.bowStructure>.70,'long bilateral structure through bow wrist should be strong Real Bow evidence');
assert(ve.usable&&ve.elasticLine>.70&&ve.bowStructure<.40,'taut line between hands without limb structure should be Elastic evidence');
assert(vd.usable&&vd.bowStructure<.30,'unrelated background vertical line must not become a bow');
assert(vt.elasticLine<.56,'thin arrow/string-like line alone must not be confidently labeled Elastic');
function classify(v,count=15){let s=C.fresh(),out;for(let i=0;i<count;i++)out=C.update(s,{now:i*250,metrics:{phase:i<2?'Set':i<4?'Draw':'Anchor',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseDrawWristVisibility:.95,debugPhaseDrawElbowVisibility:.95},visual:v,sensor:{connected:false}});return out;}
assert.equal(classify(vb).label,'real_bow','multi-frame bow evidence should classify Real Bow');
assert.equal(classify(ve).label,'elastic','multi-frame tension-line evidence should classify Elastic');
const hand=classify({...vd,bowStructure:.08,elasticLine:.07},18);assert.equal(hand.label,'hand_only','clear draw geometry with persistent absence of equipment should classify Hand-only');assert.equal(hand.captureClassified,false,'Hand-only must never unlock automatic capture');
const low=classify({usable:false,quality:.08,bowStructure:0,elasticLine:0,reason:'low visual quality'},20);assert.equal(low.label,'unknown','poor visual evidence must abstain as Unknown');
let ss=C.fresh();const sensor=C.update(ss,{now:100,metrics:{phase:'Set'},sensor:{connected:true,deviceId:'3PM-BOW-TEST',dataMode:'REAL_IMU',lastPacketAgeMs:20}});assert.equal(sensor.label,'real_bow');assert(sensor.confidence>.99&&sensor.captureClassified,'live real Bow Sensor must strongly corroborate Real Bow');
console.log('BLE4.3.8.5 automatic activity classifier QA PASS',{bow:vb.bowStructure.toFixed(2),elastic:ve.elasticLine.toFixed(2),backgroundBow:vd.bowStructure.toFixed(2)});
