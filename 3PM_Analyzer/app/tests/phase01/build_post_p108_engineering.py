"""Create UNPROMOTED engineering artifacts. Never substitute for build_r8_artifact's release gates.
Retains failed test outputs; no READY/field promotion on failures. Fresh verification is separate.
"""
import argparse, hashlib, json, shutil, subprocess, zipfile, stat
from pathlib import Path
SRC=Path(__file__).resolve().parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(root):
 files=sorted(p for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
 (root/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(root)}\n' for p in files))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--commit',required=True);a=ap.parse_args()
 out=Path(a.out).resolve();out.mkdir(exist_ok=True,parents=True)
 if out==SRC or SRC in out.parents:raise SystemExit('Output must be outside source')
 for cls,label in [('development_not_release','DEV'),('field_test_not_production','MAC_BENCH_UNPROMOTED')]:
  root=out/f'3PM_Analyzer_R8_POST_P108_{label}';shutil.copytree(SRC,root,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
  contract=json.loads((root/'PACKAGE_CONTRACT.json').read_text());contract['artifact_class']=cls;(root/'PACKAGE_CONTRACT.json').write_text(json.dumps(contract,indent=2)+'\n')
  if cls=='field_test_not_production':
   temp=out/'pose-frozen.intermediate';subprocess.run(['node',str(root/'app/tests/phase01/strip_pose_trace_seam.cjs'),str(root/'app/static/pose.js'),str(temp)],check=True);shutil.move(temp,root/'app/static/pose.js')
   (root/'DEV_NOT_RELEASE.txt').unlink();(root/'FIELD_TEST_NOT_PRODUCTION.txt').write_text('FIELD TEST BUILD — NOT PRODUCTION\nUNPROMOTED ENGINEERING PACKAGE — MANDATORY REGRESSION GATE BLOCKED\nNo live shooting. Mac/Swift/camera NOT RUN. Read docs/post_p108/DELIVERY_REPORT.md.\n')
  (root/'PACKAGE_ID.txt').write_text(root.name+'_20261005\n')
  source_files={str(p.relative_to(SRC)):sha(p) for p in SRC.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt'}
  proof={'base_commit':'0f3ee6d08ab59a1cca98611762d2d7947b012bb5','source_commit':a.commit,'branch':'codex/3pm-r8-post-p108-20261005','status':'UNPROMOTED; mandatory regression gate FAIL','lineage':'EL18 -> R7 TransactionRepair -> selective HV3 merge -> R8','source_files':source_files,'packaged_files':{str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt'}}
  (root/'docs/post_p108/PROVENANCE.json').write_text(json.dumps(proof,indent=2)+'\n');manifest(root)
  target=out/(root.name+'_20261005.zip')
  with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for p in sorted(root.rglob('*')):
    if p.is_file():
     i=zipfile.ZipInfo(str(Path(root.name)/p.relative_to(root)),date_time=(2026,10,5,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=(stat.S_IFREG|(p.stat().st_mode&0o777))<<16;z.writestr(i,p.read_bytes())
  print(json.dumps({'artifact':str(target),'sha256':sha(target),'status':'UNPROMOTED'}))
if __name__=='__main__':main()
