'use strict';
// EL19 form behaviour (2026-10-05): renamed/folded EL18 products restore from setups saved before the merge; owner-supplied
// (unverified) records never auto-fill a mass/weight; a folded Foam/Wood limb model offers each core once and only locks the
// construction field for a single verified option.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..','..');
const layer=fs.readFileSync(path.join(__dirname,'../static/equipment_lab_layer.js'),'utf8');
const catalogCode=fs.readFileSync(path.join(__dirname,'../static/equipment_catalog.js'),'utf8');
const audit=JSON.parse(fs.readFileSync(path.join(root,'internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json'),'utf8'));

// minimal DOM: only the limb construction input and its datalist are needed by applyLimbConstruction
const els=new Map();
const mkEl=(attrs={})=>({value:'',readOnly:true,placeholder:'',innerHTML:'',dataset:{},attrs:{},listeners:{},...attrs,
  setAttribute(k,v){this.attrs[k]=v},addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f)},
  insertAdjacentElement(_,el){els.set('#'+el.id,el)}});
const construction=mkEl();els.set('[data-eqlab-key="limb_construction"]',construction);
const doc={readyState:'loading',querySelector:s=>els.get(s)||null,querySelectorAll:()=>[],addEventListener:()=>{},createElement:()=>mkEl()};
const ctx={window:{},document:doc,console,Event:function(){},MutationObserver:function(){this.observe=()=>{}}};vm.createContext(ctx);
vm.runInContext(catalogCode,ctx);
const hook="window.__EL19Test={findCatalogRecord,catalogMassGr,exactWeightGr,reportedText,recordDisplay,isVerifiedRecord,limbCoreOf,limbCoreOptions,applyLimbConstruction};if(document.readyState==='loading')";
assert.strictEqual(layer.split("if(document.readyState==='loading')").length,2,'single install hook expected');
vm.runInContext(layer.replace("if(document.readyState==='loading')",hook),ctx);
const t=ctx.window.__EL19Test,C=ctx.window.EquipmentCatalog;
const id=(cat,raw)=>t.findCatalogRecord(cat,raw)?.id||null;

// 1) every folded EL18 record restores to the kept record from its id, "<brand> <model>" (what the form saved) and bare model
for(const f of audit.folds){const o=f.removed_record;
  for(const raw of [o.id,`${o.brand} ${o.model}`,o.model])assert.strictEqual(id(o.category,raw),f.kept_id,`folded ${o.id} via "${raw}"`);}
// 2) every renamed record restores from the old spelling; variant-split renames resolve to the exact core variant
for(const x of audit.renames){const now=C.byId(x.id);assert(now,x.id);
  for(const raw of [x.id,`${now.brand} ${x.from.model}`,x.from.model])assert.strictEqual(id(now.category,raw),x.id,`renamed ${x.id} via "${raw}"`);
  assert.strictEqual(id(now.category,`${now.brand} ${x.to.model}${x.to.variant?` · ${x.to.variant}`:''}`),x.id,`new display name ${x.id}`);}
assert.strictEqual(id('riser','WIAWIS / Win&Win Meta DX'),'wiawis_win_win_meta_dx_riser');
assert.strictEqual(id('limbs','WIAWIS / Win&Win NS-G2 Wood'),'wiawis_win_win_ns_g2_wood_limbs','old NS-G2 Wood setup must not restore as Foam');

// 3) owner-supplied records: never a catalog mass/weight, reported value only as text, marked unverified in the selector text
const owner=C.records.filter(r=>r.source_type==='owner_supplied_unverified');assert.strictEqual(owner.length,205);
for(const r of owner){assert.strictEqual(t.isVerifiedRecord(r),false);assert.strictEqual(t.catalogMassGr(r),null,r.id);assert.strictEqual(t.exactWeightGr(r),null,r.id);
  assert(/\[unverified\]$/.test(t.recordDisplay(r)),r.id);assert(/^Owner list · unverified/.test(t.reportedText(r))&&/confirm with manufacturer or measure$/.test(t.reportedText(r)),r.id);}
const ownerWithText=owner.find(r=>r.category==='point'&&(r.reported_weight_options_gr||r.reported_weight_gr!=null||r.reported_weight_range_gr));assert(ownerWithText,'an owner point with a reported weight exists');
assert(/ gr/.test(t.reportedText(ownerWithText)),'reported point weight is shown as text');
// a doubtful owner value carries its warning into the status text (e.g. a mass repeated across several risers)
const flagged=owner.find(r=>r.category==='riser'&&(r.anomaly_flags||[]).some(f=>/possible placeholder/.test(f)));assert(flagged,'a placeholder-mass riser is flagged');
assert(/ · ⚠ .*possible placeholder value.* — confirm with manufacturer or measure$/.test(t.reportedText(flagged)),t.reportedText(flagged));
for(const r of owner.filter(r=>!(r.anomaly_flags||[]).length))assert(!/⚠/.test(t.reportedText(r)),r.id);
// an owner variant that mentions a grain value in free text still must not become an exact weight
assert.strictEqual(t.exactWeightGr({source_type:'owner_supplied_unverified',variant:'110 gr'}),null);
// function-level guard, independent of the catalog builder: even if an owner record ever carried a mass it must not be used
assert.strictEqual(t.catalogMassGr({source_type:'owner_supplied_unverified',mass_g:1300}),null);assert.strictEqual(t.catalogMassGr({source_type:'owner_supplied_unverified',mass_oz:4}),null);assert.strictEqual(t.exactWeightGr({source_type:'owner_supplied_unverified',weight_gr:100}),null);
// verified records are unchanged
const arcos=C.byId('hoyt_arcos_25');assert.strictEqual(t.catalogMassGr(arcos),1225);assert.strictEqual(t.reportedText(arcos),'');assert(!/unverified/.test(t.recordDisplay(arcos)));
assert.strictEqual(t.exactWeightGr({weight_gr:100}),100);

// 4) limb construction: one value per variant, no duplicate material+variant strings
const grp=(b,m)=>C.records.filter(r=>r.category==='limbs'&&r.brand===b&&r.model===m);
assert.deepStrictEqual([...t.limbCoreOptions(grp('WIAWIS / Win&Win','MXT-XT'))],['Foam Core','Wood Core']);
assert.deepStrictEqual([...t.limbCoreOptions(grp('Fivics','Vellator V3'))],['Carbon/Foam','Carbon/Wood']);
for(const r of C.records.filter(r=>r.category==='limbs')){const g=grp(r.brand,r.model),o=t.limbCoreOptions(g);assert(o.length<=g.length,`more core choices than variants for ${r.brand} ${r.model}: ${o.join(' / ')}`)}
// multiple options → editable with a choice list; a stale catalog auto value is cleared, a user value is kept
construction.value='Carbon/Foam';construction.dataset.catalogAuto='1';t.applyLimbConstruction(grp('Fivics','Vellator V3'));
assert.strictEqual(construction.readOnly,false);assert.strictEqual(construction.value,'');assert(/^Choose once: Carbon\/Foam \/ Carbon\/Wood$/.test(construction.placeholder));
const dl=els.get('#eqlabLimbConstructionOptions');assert(dl&&construction.attrs.list==='eqlabLimbConstructionOptions');assert.strictEqual((dl.innerHTML.match(/<option /g)||[]).length,2);
construction.listeners.input[0]();construction.value='Carbon/Wood';t.applyLimbConstruction(grp('Fivics','Vellator V3'));assert.strictEqual(construction.value,'Carbon/Wood','user choice is kept');
// single verified option → filled and locked
delete construction.dataset.userOverride;construction.value='';const single=C.records.filter(r=>r.category==='limbs'&&r.source_type!=='owner_supplied_unverified').map(r=>grp(r.brand,r.model)).find(g=>t.limbCoreOptions(g).length===1);
assert(single,'a verified single-construction limb exists');t.applyLimbConstruction(single);assert.strictEqual(construction.readOnly,true);assert.strictEqual(construction.value,t.limbCoreOptions(single)[0]);
// single unverified option (owner MXT-10 "Graphene Foam or Wood") → suggestion only, never locked or auto-filled
construction.value='';delete construction.dataset.catalogAuto;const mxt10=grp('WIAWIS / Win&Win','MXT-10');assert.strictEqual(mxt10.length,1);
t.applyLimbConstruction(mxt10);assert.strictEqual(construction.readOnly,false);assert.strictEqual(construction.value,'');assert(/Graphene Foam or Wood/.test(construction.placeholder));
// a browser holding the EL18 scripts in cache would keep showing the old duplicates: both changed files carry a new cache key
const html=fs.readFileSync(path.join(__dirname,'../static/index.html'),'utf8');
for(const f of ['equipment_catalog.js','equipment_lab_layer.js'])assert(new RegExp(`/static/${f.replace('.','\\.')}\\?v=el19-`).test(html),`${f} cache key must be bumped for EL19`);
console.log(`PASS Equipment Form EL19: ${audit.folds.length} folds + ${audit.renames.length} renames restore from saved EL18 names; ${owner.length} owner records never auto-fill; limb core offered once per variant`);
