from pathlib import Path
import json, subprocess, sys
root=Path(__file__).resolve().parents[2]
tests=sorted((root/'tests').glob('test*.js'))+sorted((root/'tests').glob('stress*.js'))
def qa_output_dir(package_root):
    """Q-01: run-time QA output never goes into the SHA256SUMS-attested package.
    Committed snapshots under docs/ are refreshed only by the packaging step."""
    import os, tempfile, time
    base = os.environ.get('THREEPM_QA_OUT')
    out = Path(base).resolve() if base else Path(tempfile.gettempdir()).resolve() / '3pm_qa_runs' / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + f'-{os.getpid()}')
    pkg = Path(package_root).resolve()
    if out == pkg or pkg in out.parents:
        raise SystemExit(f'QA output directory must be outside the attested package: {out}')
    out.mkdir(parents=True, exist_ok=True)
    return out
rows=[]
for t in tests:
    p=subprocess.run(['node',str(t)],cwd=root,capture_output=True,text=True)
    rows.append({'test':str(t.relative_to(root.parent)),'pass':p.returncode==0,'returncode':p.returncode,'output':p.stdout+p.stderr})
out=qa_output_dir(root.parent)/'p006_js_regressions.json'
out.write_text(json.dumps({'passed':sum(r['pass'] for r in rows),'total':len(rows),'results':rows},indent=2)+'\n')
print('Results written to', out)
print(f"JS regressions: {sum(r['pass'] for r in rows)}/{len(rows)} PASS")
for r in rows:
    if not r['pass']:
        print('FAIL',r['test']); print(r['output'][-3000:])
sys.exit(0 if all(r['pass'] for r in rows) else 1)
