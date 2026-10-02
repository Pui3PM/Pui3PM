"""Developer runner: preserves the legacy app cwd and records every JS result."""
from pathlib import Path
import json
import subprocess

app = Path(__file__).resolve().parents[1]
results = []
for test in sorted((app / 'tests').glob('test*.js')) + sorted((app / 'tests').glob('stress*.js')):
    run = subprocess.run(['node', str(test)], cwd=app, capture_output=True, text=True)
    results.append({'test': str(test.relative_to(app.parent)), 'pass': run.returncode == 0, 'output': run.stdout + run.stderr})
    if run.returncode:
        print(test.name, run.stdout, run.stderr)
(app.parent / 'docs/qa/r7_results.json').write_text(json.dumps(results, indent=2) + '\n')
passed = sum(row['pass'] for row in results)
print(f'JS regressions: {passed}/{len(results)} PASS')
raise SystemExit(0 if passed == len(results) else 1)
