const assert=require('assert'); global.window={}; require('../static/equipment_catalog.js'); const C=window.EquipmentCatalog; const html=require('fs').readFileSync(require('path').join(__dirname,'../static/index.html'),'utf8');
assert(C.version.startsWith('EL9') || C.version.startsWith('EL10') || C.version.startsWith('EL11') || C.version.startsWith('EL15') || (C.version.startsWith('EL17') || C.version.startsWith('EL18') || C.version.startsWith('EL19')));
for(const brand of ['NIKA','Bicaster','WIAWIS / Win&Win','WNS','Fivics','Hoyt','Uukha','Kinetic','Gillo','MK Korea','Mybo','Sanlida']) assert(C.records.some(r=>r.brand===brand),brand);
const x1=C.records.find(r=>r.brand==='NIKA'&&r.model==='X1'&&r.category==='limbs'); assert.deepStrictEqual(x1.weight_options_lb,[18,20,22,24,26,28,30,32,34,36,38,40]);
for(const cat of ['riser','limbs','sight','plunger','rest','clicker','long_rod','side_rod','extender','vbar','damper','stabilizer_weight','finger_tab','arrow']) assert(C.records.some(r=>r.category===cat),cat);
for(const id of ['currentSightBrand','eqlabRestBrand','eqlabClickerBrand','eqlabDamperBrand','eqlabStabWeightBrand','eqlabFingerTabBrand','currentMarkedDrawWeight']) assert(html.includes(`id="${id}"`),id);
assert(!html.includes('name="marked_draw_weight_lb" input type="number"'));
console.log('Equipment Catalog EL9 expansion PASS',C.records.length);
