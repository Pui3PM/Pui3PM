'use strict';
// EL19 (2026-10-05): owner-supplied equipment list merged into the EL18 verified catalog.
// Proves: every EL18 record kept (by id, or folded with its id in merged_ids); verified data never overwritten; documented
// renames/folds only; owner rows added only as owner_supplied_unverified with reported_* values (no auto-fill fields);
// every owner row has exactly one decision; no duplicate model names in one category+brand selector.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..','..');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/equipment_catalog.js'),'utf8'),ctx);const C=ctx.window.EquipmentCatalog;
const el18=JSON.parse(fs.readFileSync(path.join(root,'internal/3PM_Equipment_Catalog_CANONICAL_EL18_FORM_UX_2026_09_30_R1.json'),'utf8'));
const el19=JSON.parse(fs.readFileSync(path.join(root,'internal/3PM_Equipment_Catalog_CANONICAL_EL19_OWNER_LIST_2026_10_05_R1.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(root,'internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json'),'utf8'));
const csvText=fs.readFileSync(path.join(root,'internal/equipment_inputs/OWNER_EQUIPMENT_LIST_20261005.csv'),'utf8');

assert.strictEqual(C.version,'EL19-OWNER-LIST-2026-10-05-R1');assert.strictEqual(el19.catalog_version,C.version);
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.records)),el19.records,'runtime catalog must equal the canonical EL19 JSON');
assert.strictEqual(C.recordCount,C.records.length);assert.strictEqual(C.records.length,879);
const owner=C.records.filter(r=>r.source_type==='owner_supplied_unverified');
assert.strictEqual(C.verifiedRecordCount,674);assert.strictEqual(C.ownerUnverifiedRecordCount,owner.length);assert.strictEqual(owner.length,205);
assert(el19.previous_catalog_versions.includes('EL18-FORM-UX-2026-09-30-R1'));

// ---- monotonic: every EL18 record survives (id) or is folded (merged_ids); only documented fields change
const plain=JSON.parse(JSON.stringify(C.records)); // VM-realm arrays -> this realm, so deepStrictEqual compares values not prototypes
const byId=new Map(plain.map(r=>[r.id,r]));
const renamed=new Map(audit.renames.map(x=>[x.id,x])),folded=new Map(audit.folds.map(x=>[x.removed_id,x]));
const allowedNew=new Set(['model_aliases','merged_ids','additional_sources']);
for(const old of el18.records){
  if(folded.has(old.id)){const f=folded.get(old.id),k=byId.get(f.kept_id);assert(k,'fold target missing '+f.kept_id);assert(k.merged_ids.includes(old.id));assert(k.model_aliases.includes(old.model),'folded model name must stay findable: '+old.model);assert(k.additional_sources.some(s=>s.source===old.source),'folded source kept');assert.deepStrictEqual(f.removed_record,old,'audit keeps the full folded record');assert.strictEqual(C.byId(old.id).id,f.kept_id,'byId resolves a folded id');continue}
  const now=byId.get(old.id);assert(now,'EL18 record lost: '+old.id);
  for(const [k,v] of Object.entries(old)){
    if(renamed.has(old.id)&&(k==='model'||k==='variant'))continue;
    assert.deepStrictEqual(now[k],v,`EL18 field changed: ${old.id}.${k}`);
  }
  for(const k of Object.keys(now))if(!(k in old))assert(allowedNew.has(k)||(renamed.has(old.id)&&k==='variant'),`unexpected new field ${old.id}.${k}`);
  if(renamed.has(old.id)){const x=renamed.get(old.id);assert.strictEqual(now.model,x.to.model);if(old.model!==now.model)assert(now.model_aliases.includes(old.model),'old spelling kept as alias: '+old.id)}
}
assert.strictEqual(audit.folds.length,9);assert.strictEqual(audit.renames.length,13);

// ---- one selector entry per product: no case variants and no brand-prefix/category-suffix duplicates
const suffix=/\b(long rod|side rod|side bar|long bar|riser|limbs?|tab|finger tab|v-bar|vanes?|nock|points?|extender|damper|weight)\b/gi;
const core=r=>{let m=r.model.toLowerCase();m=m.replace(r.brand.toLowerCase().split(' / ')[0],' ');return m.replace(suffix,' ').replace(/[^a-z0-9]+/g,' ').trim();};
const groups=new Map();for(const r of plain){const k=[r.category,r.brand,core(r)].join('|');if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(r.model)}
for(const [k,v] of groups)assert.strictEqual(v.size,1,`duplicate selector entries for one product ${k}: ${[...v].join(' / ')}`);

// ---- owner rows: one decision each; added rows are clearly unverified and carry no auto-fill/lock fields
const lines=csvText.trim().split('\n').slice(1);assert.strictEqual(lines.length,303);
assert.strictEqual(audit.owner_rows.length,303);assert.deepStrictEqual(audit.owner_rows.map(e=>e.line),Array.from({length:303},(_,i)=>i+2));
assert.deepStrictEqual(audit.owner_row_decisions,{add:201,match:90,hold:12});
const forbidden=['mass_g','mass_oz','gpi','inside_diameter_mm','outside_diameter_mm','weight_gr','mass_gr','spine','shaft_weight_gr','recommended_point_weight_gr','point_weight_gr'];
for(const r of owner){
  assert.strictEqual(r.status,'unverified');assert.strictEqual(r.confidence,'low');assert(/^Owner-supplied equipment list 2026-10-05/.test(r.source));
  assert(Number.isInteger(r.owner_row)&&r.owner_values&&r.owner_values.Model,'owner provenance kept');
  for(const k of forbidden)assert(!(k in r),`owner row must not carry auto-fill field ${k}: ${r.id}`);
  assert.strictEqual(C.isVerified(r),false);
}
for(const e of audit.owner_rows){
  if(e.decision==='match'){assert(e.matched_ids.length>0);for(const id of e.matched_ids)assert(C.isVerified(byId.get(id)),'match targets are verified records')}
  if(e.decision==='hold')assert(!C.records.some(r=>r.owner_row===e.line),'held row must not be added');
  if(e.decision==='add')assert(e.added_ids.length>=1&&e.added_ids.every(id=>byId.get(id)?.owner_row===e.line));
}
// doubtful owner values are flagged, never silently trusted: combined multi-model rows and repeated placeholder masses
for(const r of owner.filter(r=>/ \/ /.test(r.owner_values.Model)))assert((r.anomaly_flags||[]).some(f=>/several model names in one row/.test(f)),'combined row flagged: '+r.id);
assert.strictEqual(audit.anomalies.length,32);assert.strictEqual(owner.filter(r=>(r.anomaly_flags||[]).length).length,32);
// conflicts are reported and the verified value is kept
const arcos=audit.conflicts.find(c=>c.verified_id==='hoyt_arcos_25');assert(arcos&&arcos.owner===1338&&arcos.kept==='verified');assert.strictEqual(byId.get('hoyt_arcos_25').mass_g,1225);
assert(audit.conflicts.some(c=>c.field==='inside diameter (mm)'&&c.owner===3.2));for(const r of C.records.filter(r=>r.brand==='Pandarus'&&r.model==='Champion'&&Number.isFinite(r.spine)))assert.strictEqual(r.inside_diameter_mm,4.2);
// mandatory lineage guards still hold
assert.deepStrictEqual(plain.filter(r=>r.brand==='Pandarus'&&r.model==='Champion'&&Number.isFinite(r.spine)).map(r=>r.spine).sort((a,b)=>a-b),[300,350,400,450,500,550,600,650,700,750,800]);
assert(!C.records.some(r=>r.brand==='RamRods'&&r.model==='Ultra V4'),'no Ultra V4 alias in the selector');
assert.strictEqual(C.records.filter(r=>r.brand==='Hoyt'&&r.model==='Carbon Velos').length,2);
// owner limbs with the standard 66/68/70 bow lengths offer Short/Medium/Long; draw weights parse in the form's format
const fx=byId.get('owner_el19_hoyt_fx_limbs');assert.deepStrictEqual([...fx.sizes],['Short','Medium','Long']);assert.strictEqual(fx.marked_weight_lb_range,'22-50 lb');
const uukha=byId.get('owner_el19_uukha_altai_limbs');assert.deepStrictEqual([...uukha.bow_lengths_unmapped_in],[72],'non-standard bow length is kept, not guessed');
console.log(`PASS Equipment Catalog EL19: ${C.records.length} records (${C.verifiedRecordCount} verified + ${owner.length} owner-list unverified); EL18 kept (13 renames, 9 folds); 303 owner rows = 201 add / 90 match / 12 hold; ${audit.conflicts.length} conflicts kept verified`);
