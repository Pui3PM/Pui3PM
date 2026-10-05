"""Create UNPROMOTED engineering artifacts. Never substitute for build_r8_artifact's release gates.
Retains failed test outputs; no READY/field promotion on failures. Fresh verification is separate.

Post-P108 R2: name/date/branch/base/status are parameters (defaults reproduce the original Post-P108 call).
Example (R2):
  python3 app/tests/phase01/build_post_p108_engineering.py --out <dir outside source> --commit <sha> \
      --name 3PM_Analyzer_R8_POST_P108_R2 --date 20261005 --branch claude/magical-rubin-bovhje \
      --base 42a24800ddc963fd93f160aea0b785df987fc76a --status-doc docs/post_p108_r2/DELIVERY_REPORT.md
"""
import argparse, hashlib, json, shutil, subprocess, zipfile, stat
from pathlib import Path
SRC=Path(__file__).resolve().parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(root):
 files=sorted(p for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
 (root/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(root)}\n' for p in files))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--commit',required=True)
 ap.add_argument('--name',default='3PM_Analyzer_R8_POST_P108');ap.add_argument('--date',default='20261005')
 ap.add_argument('--branch',default='codex/3pm-r8-post-p108-20261005');ap.add_argument('--base',default='0f3ee6d08ab59a1cca98611762d2d7947b012bb5')
 ap.add_argument('--status',default='UNPROMOTED; mandatory regression gate FAIL');ap.add_argument('--status-doc',default='docs/post_p108/DELIVERY_REPORT.md')
 a=ap.parse_args()
 out=Path(a.out).resolve();out.mkdir(exist_ok=True,parents=True)
 if out==SRC or SRC in out.parents:raise SystemExit('Output must be outside source')
 if not (SRC/a.status_doc).is_file():raise SystemExit(f'status document missing: {a.status_doc}')
 for cls,label in [('development_not_release','DEV'),('field_test_not_production','MAC_BENCH_UNPROMOTED')]:
  root=out/f'{a.name}_{label}'
  if root.exists():shutil.rmtree(root)
  shutil.copytree(SRC,root,ignore=shutil.ignore_patterns('__pycache__','*.pyc','.git','node_modules'))
  contract=json.loads((root/'PACKAGE_CONTRACT.json').read_text());contract['artifact_class']=cls;(root/'PACKAGE_CONTRACT.json').write_text(json.dumps(contract,indent=2)+'\n')
  if cls=='field_test_not_production':
   temp=out/'pose-frozen.intermediate';subprocess.run(['node',str(root/'app/tests/phase01/strip_pose_trace_seam.cjs'),str(root/'app/static/pose.js'),str(temp)],check=True);shutil.move(temp,root/'app/static/pose.js')
   (root/'DEV_NOT_RELEASE.txt').unlink();(root/'FIELD_TEST_NOT_PRODUCTION.txt').write_text(f'FIELD TEST BUILD — NOT PRODUCTION\nUNPROMOTED ENGINEERING PACKAGE — MANDATORY REGRESSION GATE BLOCKED (owner policy decision pending)\nNo live shooting. Mac/Swift/camera NOT RUN. Read {a.status_doc}.\n')
  (root/'PACKAGE_ID.txt').write_text(f'{root.name}_{a.date}\n')
  source_files={str(p.relative_to(SRC)):sha(p) for p in SRC.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt' and '.git' not in p.relative_to(SRC).parts}
  proof={'base_commit':a.base,'source_commit':a.commit,'branch':a.branch,'status':a.status,'lineage':'EL18 -> R7 TransactionRepair -> selective HV3 merge -> R8','source_files':source_files,'packaged_files':{str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt'}}
  prov=root/Path(a.status_doc).parent/'PROVENANCE.json';prov.parent.mkdir(parents=True,exist_ok=True);prov.write_text(json.dumps(proof,indent=2)+'\n');manifest(root)
  target=out/(root.name+f'_{a.date}.zip')
  with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for p in sorted(root.rglob('*')):
    if p.is_file():
     i=zipfile.ZipInfo(str(Path(root.name)/p.relative_to(root)),date_time=(int(a.date[:4]),int(a.date[4:6]),int(a.date[6:8]),0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=(stat.S_IFREG|(p.stat().st_mode&0o777))<<16;z.writestr(i,p.read_bytes())
  print(json.dumps({'artifact':str(target),'sha256':sha(target),'size_bytes':target.stat().st_size,'status':'UNPROMOTED'}))
if __name__=='__main__':main()
