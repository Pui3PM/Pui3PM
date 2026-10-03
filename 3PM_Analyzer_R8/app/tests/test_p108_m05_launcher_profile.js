'use strict';
// R8 P1-08 M-05: the launcher's browser-open block is EXECUTED in bash (Linux) with /usr/bin/open and /Applications
// replaced by stubs, for every class/browser/opt-out combination. Proves the decision logic; it does not prove that
// macOS Chrome honours --user-data-dir (Mac run: FIELD_TEST_INSTRUCTIONS §0).
// Usage: node app/tests/test_p108_m05_launcher_profile.js [path-to-package-root]
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const sh=fs.readFileSync(path.join(root,'internal/start_analyzer.sh'),'utf8');
const start=sh.indexOf('  ISOLATED_PROFILE=""'),endMark='    /usr/bin/open "$URL" >/dev/null 2>&1 || true\n  fi\n',end=sh.indexOf(endMark,start);
assert(start>0&&end>start,'launcher browser-open block not found');
const block=sh.slice(start,end+endMark.length);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'p108m05-'));
function run({cls,apps=[],optOut=false}){
  const appsDir=path.join(tmp,'Applications-'+Math.random().toString(36).slice(2));fs.mkdirSync(appsDir);
  for(const a of apps)fs.mkdirSync(path.join(appsDir,a));
  const log=path.join(tmp,'open.log');try{fs.unlinkSync(log);}catch{}
  const body=block.split('/usr/bin/open').join('open_stub').split('"/Applications/').join(`"${appsDir}/`);
  const script=`set -u\nopen_stub(){ printf '%s\\n' "$*" >> "${log}"; }\nHOME="${tmp}/home"\nPKG_ID="PKG_TEST"\nPKG_CLASS="${cls}"\nURL="http://127.0.0.1:9/?x"\n${optOut?'export THREEPM_USE_DEFAULT_PROFILE=1':'unset THREEPM_USE_DEFAULT_PROFILE'}\n${body}`;
  const out=cp.execFileSync('bash',['-c',script],{encoding:'utf8'});
  return {out,opened:fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():''};
}
const prof=`${tmp}/home/Library/Application Support/3PM_FieldTest_Profiles/PKG_TEST`;
const failures=[];const check=(n,fn)=>{try{fn();}catch(e){failures.push(`${n}: ${e.message}`);}};
check('field + Chrome -> isolated profile, new instance',()=>{const r=run({cls:'field_test_not_production',apps:['Google Chrome.app']});
  assert(r.opened.startsWith('-na Google Chrome --args --user-data-dir='+prof),r.opened);assert(r.opened.endsWith('http://127.0.0.1:9/?x'));assert(fs.existsSync(prof),'profile dir created');});
check('field + Edge only -> isolated profile',()=>{const r=run({cls:'field_test_not_production',apps:['Microsoft Edge.app']});assert(r.opened.startsWith('-na Microsoft Edge --args --user-data-dir='+prof),r.opened);});
check('field + no Chromium browser -> UI NOT opened, warning printed',()=>{const r=run({cls:'field_test_not_production'});assert.strictEqual(r.opened,'');assert(/NOT opened automatically/.test(r.out),r.out);});
check('field + explicit opt-out -> default profile (legacy behaviour)',()=>{const r=run({cls:'field_test_not_production',apps:['Google Chrome.app'],optOut:true});assert.strictEqual(r.opened,'-a Google Chrome http://127.0.0.1:9/?x');});
check('dev class -> unchanged legacy behaviour',()=>{const r=run({cls:'development_not_release',apps:['Google Chrome.app']});assert.strictEqual(r.opened,'-a Google Chrome http://127.0.0.1:9/?x');});
check('dev class, no Chromium -> default browser (unchanged)',()=>{const r=run({cls:'development_not_release'});assert.strictEqual(r.opened,'http://127.0.0.1:9/?x');});
fs.rmSync(tmp,{recursive:true,force:true});
if(failures.length){console.error('P1-08 M-05 launcher profile FAIL\n - '+failures.join('\n - '));process.exit(1);}
console.log('P1-08 M-05 launcher profile PASS: field class isolates the browser profile; dev class and opt-out unchanged');
