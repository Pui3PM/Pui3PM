from pathlib import Path
import json, subprocess, sys
root=Path(__file__).resolve().parents[2]
tests=sorted((root/'tests').glob('test*.js'))+sorted((root/'tests').glob('stress*.js'))
rows=[]
for t in tests:
    p=subprocess.run(['node',str(t)],cwd=root,capture_output=True,text=True)
    rows.append({'test':str(t.relative_to(root.parent)),'pass':p.returncode==0,'returncode':p.returncode,'output':p.stdout+p.stderr})
out=root.parent/'docs/phase01/p006_js_regressions.json'
out.write_text(json.dumps({'passed':sum(r['pass'] for r in rows),'total':len(rows),'results':rows},indent=2)+'\n')
print(f"JS regressions: {sum(r['pass'] for r in rows)}/{len(rows)} PASS")
for r in rows:
    if not r['pass']:
        print('FAIL',r['test']); print(r['output'][-3000:])
sys.exit(0 if all(r['pass'] for r in rows) else 1)
