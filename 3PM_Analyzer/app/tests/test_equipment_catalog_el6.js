const assert=require('assert');global.window=global;require('../static/equipment_catalog.js');const C=global.EquipmentCatalog;
assert(C.brands.length>=50);assert(C.brands.includes('Other / Custom'));
for(const b of ['Mybo','Fivics','MK Archery','Gillo','Sanlida','Uukha','Spigarelli','Kinetic','Shocq','Topoint','Skylon','RamRods'])assert(C.brands.includes(b),b);
assert(C.marketCoverage.stabilizer.includes('Mybo'));assert(C.marketCoverage.plunger.includes('Beiter'));assert(C.marketCoverage.rest.includes('Fivics'));
assert.equal(C.aliases['W&W'],'WIAWIS / Win&Win');assert.equal(C.aliases['SF'],'Sebastien Flute / SF');
assert(C.records.find(x=>x.id==='hoyt_arcos_25').mass_g===1225);
const sf=C.records.filter(x=>x.model==='SF Pro 3K Carbon');assert(sf.some(x=>x.category==='long_rod'));assert(sf.some(x=>x.category==='side_rod'));assert(sf.some(x=>x.category==='extender'));assert(sf.every(x=>x.mass_g===null));
console.log('EL6 market catalog coverage PASS',C.brands.length,'brands');
