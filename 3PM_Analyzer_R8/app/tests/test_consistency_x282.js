const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','static','app.js'),'utf8');
function extractFunction(name){
  const marker=`function ${name}`; const start=src.indexOf(marker); if(start<0)throw new Error(`Missing ${name}`);
  let paren=0,inHeadStr=null,headEsc=false,brace=-1;
  for(let i=start;i<src.length;i++){const c=src[i];if(inHeadStr){if(headEsc){headEsc=false;continue;}if(c==='\\'){headEsc=true;continue;}if(c===inHeadStr)inHeadStr=null;continue;}if(c==='"'||c==="'"||c==='`'){inHeadStr=c;continue;}if(c==='(')paren++;else if(c===')')paren--;else if(c==='{'&&paren===0){brace=i;break;}}
  if(brace<0)throw new Error(`Missing body ${name}`);let depth=0,inStr=null,esc=false;
  for(let i=brace;i<src.length;i++){const c=src[i];if(inStr){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===inStr)inStr=null;continue;}if(c==='"'||c==="'"||c==='`'){inStr=c;continue;}if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)return src.slice(start,i+1);}}
  throw new Error(`Unclosed ${name}`);
}
function assert(c,m){if(!c)throw new Error(m);}
const adv={
  1:{anchor_ref_hand_x:.10,anchor_ref_hand_y:.20,release_offaxis_pct:10},
  2:{anchor_ref_hand_x:.11,anchor_ref_hand_y:.19,release_offaxis_pct:11},
  3:{anchor_ref_hand_x:.09,anchor_ref_hand_y:.21,release_offaxis_pct:9},
  4:{anchor_ref_hand_x:.16,anchor_ref_hand_y:.25,release_offaxis_pct:20},
  5:{anchor_ref_hand_x:.17,anchor_ref_hand_y:.24,release_offaxis_pct:21},
  6:{anchor_ref_hand_x:.15,anchor_ref_hand_y:.26,release_offaxis_pct:19},
};
function loadAdvancedShotMetrics(id){return adv[id]||null;}
eval([extractFunction('median'),extractFunction('mad'),extractFunction('consistencyScalarValues'),extractFunction('consistencyVectorSpread'),extractFunction('consistencyMetricStats'),extractFunction('consistencyComparison'),extractFunction('formatConsistencySpread')].join('\n'));
const ref=[{id:1},{id:2},{id:3}],cur=[{id:4},{id:5},{id:6}];
const vec={advanced:true,vector:['anchor_ref_hand_x','anchor_ref_hand_y'],digits:1,unit:'% shoulder-width'};
const rs=consistencyMetricStats(ref,vec),cs=consistencyMetricStats(cur,vec);
assert(rs.n===3&&cs.n===3,'vector sample counts');
assert(Number.isFinite(rs.spread)&&Number.isFinite(cs.spread),'vector spread missing');
const rel=consistencyComparison(cs,rs); assert(['tight','similar','wide'].includes(rel.cls),'comparison missing');
const scalar={advanced:true,key:'release_offaxis_pct',digits:1,unit:'%'};
const r2=consistencyMetricStats(ref,scalar),c2=consistencyMetricStats(cur,scalar);
assert(r2.spread===1&&c2.spread===1,'scalar MAD wrong');
assert(consistencyComparison(c2,r2).cls==='similar','equal spreads should be similar');
assert(formatConsistencySpread(c2,scalar)==='1.0%','spread formatting');
assert(consistencyComparison({spread:1,n:2},{spread:1,n:3}).cls==='building','requires 3 current samples');
console.log('X2.8.2 consistency QA: PASS',{reference_anchor_spread:rs.spread,current_anchor_spread:cs.spread,release_spread:c2.spread});
