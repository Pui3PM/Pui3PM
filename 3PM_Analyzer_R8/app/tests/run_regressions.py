"""Developer runner: preserves the legacy app cwd and records every JS result."""
from pathlib import Path
import json
import subprocess

app = Path(__file__).resolve().parents[1]
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


results = []
for test in sorted((app / 'tests').glob('test*.js')) + sorted((app / 'tests').glob('stress*.js')):
    run = subprocess.run(['node', str(test)], cwd=app, capture_output=True, text=True)
    results.append({'test': str(test.relative_to(app.parent)), 'pass': run.returncode == 0, 'output': run.stdout + run.stderr})
    if run.returncode:
        print(test.name, run.stdout, run.stderr)
out = qa_output_dir(app.parent) / 'r7_results.json'
out.write_text(json.dumps(results, indent=2) + '\n')
print('Results written to', out)
passed = sum(row['pass'] for row in results)
print(f'JS regressions: {passed}/{len(results)} PASS')
raise SystemExit(0 if passed == len(results) else 1)
