const fs=require('fs'),assert=require('assert'),vm=require('vm');
const html=fs.readFileSync('static/index.html','utf8');
const layer=fs.readFileSync('static/equipment_lab_layer.js','utf8');
const catalogCode=fs.readFileSync('static/equipment_catalog.js','utf8');

// One-fact-once structure: product identity once, configuration separate.
for(const id of ['currentRiserBrand','currentRiserModel','currentRiserLength','currentLimbBrand','currentLimbModel','currentLimbSize','currentMarkedDrawWeight','currentLongRodLength','currentLeftSideRodLength','currentRightSideRodLength','currentExtenderLength','currentVbarVariant']) assert(html.includes(`id="${id}"`),id);
for(const id of ['eqlabDamperBrand','eqlabDamperModel','eqlabStabWeightBrand','eqlabStabWeightModel']) assert.strictEqual((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must exist once`);
for(const name of ['sight_weight','damper_weight','vbar_weight','long_rod_length_in','extender_length_in','left_side_rod_length_in','right_side_rod_length_in']) assert.strictEqual((html.match(new RegExp(`name="${name}"`,'g'))||[]).length,1,`${name} duplicated`);
assert(html.indexOf('name="sight_weight"') < html.indexOf('<h3>Stabilizer Setup</h3>'),'sight mass belongs with the sight, not stabilizer section');
assert(html.includes('id="barebowWeightSection"') && html.includes('class="form-section hidden" id="barebowWeightSection"'),'barebow-only weights must be conditionally hidden');

// Fixed V-Bar geometry is derived; manual angle inputs are progressive-disclosure only.
assert(html.includes('id="eqlabVbarGeometry"'),'derived V-Bar geometry summary required');
assert(html.includes('id="eqlabVbarTypeField" class="hidden"'),'V-Bar type must not be asked redundantly by default');
assert(layer.includes("status.textContent='Derived from selected fixed V-Bar variant — no duplicate entry required'"),'fixed V-Bar must derive geometry');

// Stabilizer lengths use verified model-driven selectors and mass matches selected length.
assert(layer.includes('const makeLengthBinding='),'model-driven length binding missing');
assert(layer.includes('function catalogRecordAtLength('),'length-specific catalog record matching missing');
for(const sel of ['#currentLongRodLength','#currentLeftSideRodLength','#currentRightSideRodLength','#currentExtenderLength']) assert(layer.includes(sel),`missing binding ${sel}`);

// No hard-coded nock/vane product menu layered on top of catalog.
for(const legacy of ['generic_pin','easton_gpin','jet6_175','gas_olympic_175','generic_target_pin']) assert(!html.includes(`value="${legacy}"`),`legacy hard-coded picker leaked into HTML: ${legacy}`);
assert(layer.includes('Verified catalog · ${cat}'),'component picker should be catalog-driven');

// Arrow catalog reference and actual setup remain distinct.
assert(html.includes('Factory Shaft Length (in)') && html.includes('Actual Cut Shaft Length'),'factory vs actual shaft length separation missing');
assert(html.includes('Catalog Point Reference (gr)') && html.includes('Actual Point Weight (gr)'),'catalog vs actual point weight separation missing');
assert(html.includes('Measured Finished Arrow Weight (gr)'),'actual total arrow weight must be labelled as measured');
assert(layer.includes("el.readOnly=true"),'verified ID/OD/GPI should be catalog-locked for a selected spine');
const arrowFn=layer.slice(layer.indexOf('function autoFillArrowSpec(){'),layer.indexOf('let APPSTATE='));
assert(!arrowFn.includes('[name="arrow_length_in"]'),'catalog factory length must never overwrite actual cut length');
assert(!arrowFn.includes('[name="point_weight_gr"]'),'catalog point reference must never overwrite actual point weight');

// Equipment layer must not fight/reset the main form after app reset.
const clearFn=layer.slice(layer.indexOf('function clear(){'),layer.indexOf('function syncStatus'));
assert(!clearFn.includes("f.elements?.riser_in)f.elements.riser_in.value=''"),'equipment layer erases main riser state');
assert(!clearFn.includes("autoBowLengthToggle').checked=false"),'equipment layer disables app Auto AMO');

// Actual numeric unit conversion helper, not label-only conversion.
const form={elements:{weight_unit:{value:'oz'}}};
const doc={readyState:'loading',querySelector:s=>s==='#equipmentForm'?form:null,querySelectorAll:()=>[],addEventListener:()=>{}};
const ctx={window:{},document:doc,console,Event:function(){},MutationObserver:function(){this.observe=()=>{}}};vm.createContext(ctx);
const instrumented=layer.replace("if(document.readyState==='loading')", "window.__EL18Test={gramsToCurrent,catalogMassGr,setAccessoryMassFromCatalog,catalogRecordAtLength,parseFixedVbarSetting};if(document.readyState==='loading')");vm.runInContext(instrumented,ctx);
const t=ctx.window.__EL18Test,target={value:'',dataset:{}};t.setAccessoryMassFromCatalog(target,{mass_g:211});assert.strictEqual(target.value,'7.443','211 g Shibuya sight must become 7.443 oz');
const lengthRecords=[{id:'r27',length_in:27,mass_oz:4.8},{id:'r30',length_in:30,mass_oz:5.8},{id:'r33',length_in:33,mass_oz:6.7}];assert.strictEqual(t.catalogRecordAtLength(lengthRecords,30).id,'r30','selected length must bind to the matching product variant');assert.strictEqual(t.catalogRecordAtLength(lengthRecords,29),null,'unknown length must not silently borrow another variant mass');const vb=t.parseFixedVbarSetting('40x15');assert.strictEqual(vb.type,'Fixed');assert.strictEqual(vb.out,40);assert.strictEqual(vb.down,15);assert.strictEqual(t.parseFixedVbarSetting('adjustable'),null);

// Canonical catalog keeps prior data and adds real model-specific limb choices.
const cctx={window:{}};vm.createContext(cctx);vm.runInContext(catalogCode,cctx);const C=cctx.window.EquipmentCatalog;
assert(C.version==='EL18-FORM-UX-2026-09-30-R1'||C.version.startsWith('EL19-'),C.version);assert(C.records.length>=683);
const velos=C.records.filter(r=>r.brand==='Hoyt'&&r.model==='Carbon Velos');assert.strictEqual(velos.length,2);for(const r of velos){assert.deepStrictEqual([...r.sizes],['Short','Medium','Long']);assert.deepStrictEqual([...r.marked_weight_options_lb],[22,24,26,28,30,32,34,36,38,40,42,44,46,48,50]);}
const pandarus=C.records.filter(r=>r.brand==='Pandarus'&&r.model==='Champion'&&Number.isFinite(r.spine));assert.deepStrictEqual([...pandarus.map(r=>r.spine)].sort((a,b)=>a-b),[300,350,400,450,500,550,600,650,700,750,800]);
console.log('PASS Equipment Form EL18 one-fact-once behavior');
