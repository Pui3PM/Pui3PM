'use strict';
// EL19 equipment form gate in a real browser (real index.html, real equipment layer, stub backend test double).
// Proves the merged owner list is usable without redundancy: one selector entry per product, owner rows labelled
// unverified and never auto-filling a mass/weight, limb core chosen once, EL18-era saved names restoring, no page errors.
// Exit 0 PASS, 1 FAIL, 2 BLOCKED (never PASS when blocked).
// Usage: node app/tests/p108_browser/run_equipment_form_el19_chromium.cjs [chromiumPath] [staticDir]
const path=require('path');
let chromium;try{({chromium}=require('playwright'));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not resolvable'}));process.exit(2);}
const S=require('./stub_backend.cjs');
const exe=process.argv[2]||process.env.CHROMIUM_PATH||undefined,staticDir=path.resolve(process.argv[3]||path.join(__dirname,'../../static'));
const checks={},detail={};const ok=(k,v,d)=>{checks[k]=!!v;if(d!==undefined)detail[k]=d;};
(async()=>{
  const srv=await S.start(staticDir);let b;
  try{b=await chromium.launch({executablePath:exe,args:['--no-sandbox']});}catch(e){await srv.close();console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();const pageErrors=[];p.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,300)));
  await p.goto(`http://127.0.0.1:${srv.port}/static/index.html`,{waitUntil:'load',timeout:30000});
  await p.click('[data-view="athletes"]');await p.waitForFunction(()=>document.querySelectorAll('#currentRiserBrand option').length>5,null,{timeout:15000});
  const opts=sel=>p.$$eval(`${sel} option`,os=>os.map(o=>({v:o.value,t:o.textContent})));
  const pick=async(sel,v)=>{await p.selectOption(sel,v);await p.waitForTimeout(60);};
  const val=sel=>p.$eval(sel,e=>e.value);

  // honest catalog label
  const label=await p.textContent('#equipmentCatalogVersion');ok('version_label_honest',/674 verified records \+ 205 owner-list records \(unverified\)/.test(label),label);

  // one entry per product (EL18 duplicates folded/renamed)
  await pick('#currentRiserBrand','WIAWIS / Win&Win');const riserModels=(await opts('#currentRiserModel')).map(o=>o.v);
  ok('riser_meta_dx_once',riserModels.filter(m=>/^meta dx$/i.test(m)).length===1&&riserModels.includes('META DX'),riserModels.filter(m=>/meta/i.test(m)));
  await pick('#currentLongRodBrand','Shibuya');const lr=(await opts('#currentLongRodModel')).map(o=>o.v);ok('long_rod_vanquish_once',lr.filter(m=>/^vanquish$/i.test(m)).length===1&&lr.filter(m=>/^vanquish long rod$/i.test(m)).length===0,lr);
  await pick('#currentLimbBrand','WIAWIS / Win&Win');const lm=(await opts('#currentLimbModel')).map(o=>o.v);
  ok('limb_models_no_core_duplicates',['MXT-XT','NS-G2','CX7'].every(m=>lm.filter(x=>x.toUpperCase().startsWith(m.toUpperCase()+' ')||x.toUpperCase()===m.toUpperCase()).length===1),lm.filter(m=>/MXT-XT|NS-G2|CX7/i.test(m)));

  // limb core chosen once per variant, editable when several; verified single option locks
  await pick('#currentLimbBrand','Fivics');await pick('#currentLimbModel','Vellator V3');
  const lc=await p.evaluate(()=>{const c=document.querySelector('[data-eqlab-key="limb_construction"]'),dl=document.getElementById(c.getAttribute('list')||'');return{ro:c.readOnly,val:c.value,ph:c.placeholder,opts:dl?[...dl.options].map(o=>o.value):[]}});
  ok('limb_core_choice_once',!lc.ro&&lc.val===''&&JSON.stringify(lc.opts)===JSON.stringify(['Carbon/Foam','Carbon/Wood']),lc);
  const sizes=(await opts('#currentLimbSize')).map(o=>o.v);ok('limb_size_separate',sizes.includes('custom')&&sizes.length>2,sizes);

  // owner-only products: labelled unverified, nothing auto-filled, reported value shown as text
  const ownerInfo=await p.evaluate(()=>{const C=window.EquipmentCatalog,own=C.records.filter(r=>!C.isVerified(r));const brandOnly=cat=>[...new Set(C.records.filter(r=>r.category===cat).map(r=>r.brand))].find(b=>C.records.filter(r=>r.category===cat&&r.brand===b).every(r=>!C.isVerified(r)));
    const lrRec=own.find(r=>r.category==='long_rod'),dm=own.find(r=>r.category==='damper'),pt=own.find(r=>r.category==='point');
    return{riserBrand:brandOnly('riser'),lr:lrRec&&{b:lrRec.brand,m:lrRec.model},dm:dm&&{b:dm.brand,m:dm.model},pt:pt&&pt.id}});
  detail.owner_samples=ownerInfo;
  const rb=(await opts('#currentRiserBrand')).find(o=>o.v===ownerInfo.riserBrand);ok('owner_brand_labelled',rb&&/· unverified$/.test(rb.t),rb);
  await pick('#currentRiserBrand',ownerInfo.riserBrand);const rm=(await opts('#currentRiserModel')).filter(o=>o.v&&o.v!=='custom'&&o.v!=='Other / Custom');ok('owner_models_labelled',rm.length>0&&rm.every(o=>/· unverified$/.test(o.t)),rm.slice(0,3));
  await pick('#currentRiserModel',rm[0].v);const rst=await p.textContent('#eqlabRiserCatalogStatus');ok('owner_riser_status_text',/Owner list · unverified/.test(rst),rst);
  await p.fill('[name="long_rod_self_weight"]','');await pick('#currentLongRodBrand',ownerInfo.lr.b);await pick('#currentLongRodModel',ownerInfo.lr.m);
  const lens=(await opts('#currentLongRodLength')).filter(o=>o.v&&o.v!=='custom');if(lens.length)await pick('#currentLongRodLength',lens[0].v);
  ok('owner_long_rod_no_mass',(await val('[name="long_rod_self_weight"]'))==='',{lengths:lens.length,mass:await val('[name="long_rod_self_weight"]')});
  await p.fill('[name="damper_weight"]','');await pick('#eqlabDamperBrand',ownerInfo.dm.b);await pick('#eqlabDamperModel',ownerInfo.dm.m);
  ok('owner_damper_no_mass',(await val('[name="damper_weight"]'))===''&&/Owner list · unverified/.test(await p.textContent('#eqlabDamperMassStatus')),await p.textContent('#eqlabDamperMassStatus'));
  await p.fill('[name="point_weight_gr"]','');await pick('#eqlabPointCatalog',ownerInfo.pt);
  ok('owner_point_no_weight',(await val('[name="point_weight_gr"]'))===''&&(await val('#eqlabPointReference'))==='',{actual:await val('[name="point_weight_gr"]'),ref:await val('#eqlabPointReference')});
  const ptText=(await opts('#eqlabPointCatalog')).find(o=>o.v===ownerInfo.pt);ok('owner_point_labelled',ptText&&/\[unverified\]$/.test(ptText.t),ptText);

  // owner nock/vane in the component pickers: grouped as unverified, weight left for the coach, reported value as text
  for(const type of ['vane','nock']){const r=await p.evaluate(t=>{const C=window.EquipmentCatalog,el=document.querySelector(`[data-component-picker="${t}"]`);const own=C.records.find(x=>x.category===t&&!C.isVerified(x));if(!el||!own)return{missing:true};
      const grp=[...el.querySelectorAll('optgroup')].find(g=>g.querySelector(`option[value="catalog:${own.id}"]`));el.value=`catalog:${own.id}`;el.dispatchEvent(new Event('change',{bubbles:true}));
      const key={nock:'nock_weight_gr',vane:'vane_weight_gr'}[t],inp=document.querySelector(`[data-eqlab-key="${key}"]`),src=document.querySelector(`[data-component-source="${t}"]`);
      return{id:own.id,group:grp?.label,value:inp.value,disabled:inp.disabled,src:src?.textContent||''}},type);
    ok(`owner_${type}_picker_no_weight`,!r.missing&&/^Owner list · unverified/.test(r.group||'')&&r.value===''&&r.disabled===false&&/^Owner list · unverified/.test(r.src),r);}

  // verified product still auto-fills (no regression): a verified damper with one catalog mass
  const vd=await p.evaluate(()=>{const C=window.EquipmentCatalog;const g=C.records.filter(r=>r.category==='damper'&&C.isVerified(r)&&Number.isFinite(Number(r.mass_g??NaN)));const r=g[0];return r&&{b:r.brand,m:r.model}});
  if(vd){await p.fill('[name="damper_weight"]','');await pick('#eqlabDamperBrand',vd.b);await pick('#eqlabDamperModel',vd.m);ok('verified_damper_still_fills',(await val('[name="damper_weight"]'))!=='',{rec:vd,mass:await val('[name="damper_weight"]')});}
  else ok('verified_damper_still_fills',false,'no verified damper with mass_g in catalog');

  // setup saved before EL19 restores to the renamed/folded products
  const restored=await p.evaluate(()=>{const f=document.querySelector('#equipmentForm');localStorage.setItem('3pm-equipment-lab-v1',JSON.stringify({el19gate:{long_rod_model:'Shibuya Vanquish Long Rod'}}));
    const idEl=document.querySelector('#equipmentId');idEl.value='el19gate';f.elements.riser_model.value='WIAWIS / Win&Win Meta DX';f.elements.limb_model.value='WIAWIS / Win&Win NS-G2 Wood';window.EquipmentLab.fill();
    return{riserBrand:document.querySelector('#currentRiserBrand').value,riser:document.querySelector('#currentRiserModel').value,limb:document.querySelector('#currentLimbModel').value,core:document.querySelector('[data-eqlab-key="limb_construction"]').value,longRod:document.querySelector('#currentLongRodModel').value}});
  ok('restore_el18_saved_names',restored.riserBrand==='WIAWIS / Win&Win'&&restored.riser==='META DX'&&restored.limb==='NS-G2'&&restored.core==='Wood Core'&&/^vanquish$/i.test(restored.longRod),restored);

  ok('no_page_errors',pageErrors.length===0,pageErrors);
  await b.close();await srv.close();
  const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',passed:Object.keys(checks).length-failed.length,total:Object.keys(checks).length,failed,detail},null,1));
  process.exit(failed.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
