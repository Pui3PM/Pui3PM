const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('static/equipment_catalog.js','utf8');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(code,ctx);const C=ctx.window.EquipmentCatalog;
assert(C.version==='EL15-PDF-HIST-2026-09-30-R1'||(C.version.startsWith('EL17-') || C.version.startsWith('EL18-')));
assert(C.records.length>=632);assert(C.recordCount>=632);assert.strictEqual(C.canonical,true);
for(const cat of ['riser','limbs','sight','plunger','rest','clicker','long_rod','side_rod','extender','vbar','damper','stabilizer_weight','finger_tab','arrow','point','nock','vane','bushing','string_material','serving_material']) assert(C.records.some(r=>r.category===cat),cat);
const ids=new Set(),semantic=new Set();for(const r of C.records){assert(r.id,'missing id');assert(!ids.has(r.id),'duplicate id '+r.id);ids.add(r.id);const k=[r.category,r.brand,r.model,r.variant||'',r.spine??'',r.size??''].join('|').toLowerCase();assert(!semantic.has(k),'duplicate semantic '+k);semantic.add(k)}
const xceed=C.records.filter(r=>r.category==='riser'&&r.brand==='Hoyt'&&r.model==='Xceed 2');assert(xceed.length>=2);assert(new Set(xceed.map(C.recordLabel)).size===xceed.length,'variant labels must remain distinct');
const x10=C.records.filter(r=>r.category==='arrow'&&r.brand==='Easton'&&r.model==='X10'&&Number.isFinite(r.spine));assert(x10.length>=10,'X10 spine rows expected');
assert(C.records.some(r=>r.category==='limbs'&&Array.isArray(r.marked_weight_options_lb)),'historical limb marked weights required');
console.log('PASS Equipment Catalog EL15',C.records.length,'records');
