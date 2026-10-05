const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('static/index.html','utf8');
assert(html.includes('id="currentLimbBrand"')); assert(html.includes('id="currentLimbModel"')); assert(html.includes('id="eqlabPlungerBrand"')); assert(html.includes('id="eqlabPlungerModel"')); assert(html.includes('id="eqlabArrowBrand"')); assert(html.includes('id="eqlabArrowModel"')); assert(html.includes('id="eqlabArrowSpine"'));
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/equipment_catalog.js','utf8'),ctx);const C=ctx.window.EquipmentCatalog;
assert(/^EL(7|8|9|10|11)-2026-09-28$/.test(C.version) || C.version.startsWith('EL15-') || (C.version.startsWith('EL17-') || C.version.startsWith('EL18-')));
for(const cat of ['riser','limbs','sight','plunger','rest','long_rod','side_rod','extender','vbar','arrow']) assert(C.records.some(r=>r.category===cat),cat);
for(const b of ['Hoyt','Fivics','Gillo','Mybo','Sanlida','Shibuya','Pandarus','Easton','WNS']) assert(C.brands.includes(b),b);
const keys=new Set(); for(const r of C.records){const k=[r.category,r.brand,r.model,r.variant||''].join('|').toLowerCase();assert(!keys.has(k),'duplicate '+k);keys.add(k)}
assert(C.records.some(r=>r.category==='limbs'&&r.brand==='Hoyt'&&r.model==='Metrix'));
assert(C.records.some(r=>r.category==='arrow'&&r.brand==='Easton'&&r.model==='X10'));
console.log('PASS equipment catalog EL7');
