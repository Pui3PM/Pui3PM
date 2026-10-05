const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('static/equipment_catalog.js','utf8');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(code,ctx);const C=ctx.window.EquipmentCatalog;
// EL19 (2026-10-05): catalog version/count metadata follow the intentional EL19 merge; EL18 record retention is proven in test_equipment_catalog_el19.js.
assert(C.version==='EL18-FORM-UX-2026-09-30-R1'||C.version.startsWith('EL19-'),C.version);
assert(C.records.length>=683);assert.strictEqual(C.recordCount,C.records.length);
const ids=new Set(),sem=new Set();
for(const r of C.records){assert(r.id);assert(!ids.has(r.id),'duplicate id '+r.id);ids.add(r.id);const k=[r.category,r.brand,r.model,r.variant||'',r.spine??'',r.size??'',r.length_in??''].join('|').toLowerCase();assert(!sem.has(k),'duplicate semantic '+k);sem.add(k)}
const ram=C.records.filter(r=>r.brand==='RamRods');assert(ram.length>=39,'RamRods normalized coverage regressed');
for(const id of ['ramrods_edge_fixed_vbar_40_15','ramrods_ultra_v4_long','ramrods_vektor_2_long','ramrods_spectra_recurve_sight']) assert(C.byId(id),id);

assert.strictEqual(C.byId('ramrods_ultra_v4_long').model,'Ultra 4','current Ultra product name must match manufacturer');
assert(!ram.some(r=>r.model==='Ultra V4'),'legacy current-name alias must not leak into model selector');
assert(!ram.some(r=>['ramrods_k2_v2_12','ramrods_k2_v2_long','ramrods_k2_v2_side_family','ramrods_edge_fixed_vbar','ramrods_edge_carbon_extension','ramrods_eq_cylinder_damper','ramrods_eq_bow_damper','ramrods_edge_qd_small','ramrods_quick_disconnect','ramrods_stainless_steel_weight_collection'].includes(r.id)),'known RamRods duplicate/aggregate aliases must stay removed');
for(const r of ram.filter(r=>String(r.model||'').includes('Quick Disconnect')))assert.strictEqual(r.category,'quick_disconnect','QDC taxonomy '+r.id);
assert.deepStrictEqual([...new Set(ram.filter(r=>r.model==='K2 2').map(r=>r.length_in))].sort((a,b)=>a-b),[12,13.5,15,27,30,33]);

const p=C.records.filter(r=>r.brand==='Pandarus'&&r.model==='Champion'&&Number.isFinite(r.spine));
assert.deepStrictEqual([...p.map(r=>r.spine)].sort((a,b)=>a-b),[300,350,400,450,500,550,600,650,700,750,800]);
for(const r of p){assert.strictEqual(r.inside_diameter_mm,4.2);assert(Number.isFinite(r.outside_diameter_mm));assert(Number.isFinite(r.gpi));assert(Number.isFinite(r.recommended_point_weight_gr));assert.strictEqual(r.shaft_length_in,32)}
for(const id of ['fivics_2020_five_x_500_spine','fivics_2020_tenpro_600_spine'])assert(C.byId(id),'EL16 data lost '+id);
const velos=C.records.filter(r=>r.brand==='Hoyt'&&r.model==='Carbon Velos');assert.strictEqual(velos.length,2,'Velos Formula + Grand Prix records required');for(const r of velos){assert.deepStrictEqual([...r.sizes],['Short','Medium','Long']);assert.deepStrictEqual([...r.marked_weight_options_lb],[22,24,26,28,30,32,34,36,38,40,42,44,46,48,50]);}
console.log('PASS Equipment Catalog EL18 monotonic merge',C.records.length,'RamRods',ram.length);
