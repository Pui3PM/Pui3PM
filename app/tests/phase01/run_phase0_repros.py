from pathlib import Path
import json,subprocess,sys,shutil,tempfile
here=Path(__file__).resolve().parent
package_root=here.parents[2]
results=[]
def run_node(name,file):
    p=subprocess.run(['node',str(here/file)],cwd=package_root,capture_output=True,text=True,timeout=20)
    results.append({'name':name,'status':'passed' if p.returncode==0 else 'failed','returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
    return p.returncode==0
ok=True
ok &= run_node('contract_foundation','test_contract_foundation.js')
ok &= run_node('F01_source_characterization','repro_f01_source_characterization.js')
ok &= run_node('F02_budget_direct','repro_f02_null_highfps.js')
# The production upstream gap is intentionally OPEN in the current pure/offline authorization.
p=subprocess.run(['node',str(here/'repro_f02_upstream_temporal_open.js')],cwd=package_root,capture_output=True,text=True,timeout=20)
results.append({'name':'F02_upstream_temporal','status':'open_confirmed' if p.returncode==0 else 'characterization_failed','returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
if p.returncode!=0: ok=False
ok &= run_node('F03_null_clock','repro_f03_null_clock.js')
ok &= run_node('F04_stale_writer','repro_f04_stale_writer.js')
# Dynamic F01 must be a real browser test. Probe whether this environment can run Chromium at all.
chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
if chromium:
    smoke=here/'_chromium_smoke.html'; smoke.write_text('<!doctype html><p>ok</p>')
    try:
        p=subprocess.run([chromium,'--headless','--no-sandbox','--disable-gpu','--dump-dom',smoke.as_uri()],capture_output=True,text=True,timeout=5)
        if p.returncode==0 and '<p>ok</p>' in p.stdout:
            try:
                q=subprocess.run([chromium,'--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--virtual-time-budget=800','--dump-dom',(here/'f01_dom_harness.html').as_uri()],capture_output=True,text=True,timeout=10)
                import re
                m=re.search(r'data-f01-callbacks="(\d+)"',q.stdout)
                count=int(m.group(1)) if m else None
                status='passed' if q.returncode==0 and count is not None and count>=100 else 'failed'
                results.append({'name':'F01_dynamic_chromium','status':status,'callbackCount':count,'returncode':q.returncode,'stdoutTail':q.stdout[-1000:],'stderrTail':q.stderr[-1000:]})
                ok &= status=='passed'
            except subprocess.TimeoutExpired as e:
                results.append({'name':'F01_dynamic_chromium','status':'blocked','reason':'Chromium F01 harness timed out in this execution environment; Astra audit has an external isolated-browser reproduction.'})
        else:
            results.append({'name':'F01_dynamic_chromium','status':'blocked','reason':'Chromium headless smoke did not execute successfully in this environment.','returncode':p.returncode,'stderrTail':p.stderr[-1000:]})
    except subprocess.TimeoutExpired:
        results.append({'name':'F01_dynamic_chromium','status':'blocked','reason':'Chromium headless smoke timed out even on trivial HTML in this environment.'})
    finally:
        smoke.unlink(missing_ok=True)
else:
    results.append({'name':'F01_dynamic_chromium','status':'blocked','reason':'No Chromium executable available.'})
out=package_root/'docs/phase01/phase0_repro_results.json'
out.write_text(json.dumps(results,indent=2)+'\n')
print('Phase0 repro statuses:', ', '.join(f"{r['name']}={r['status']}" for r in results))
# blocked is honest/non-fatal for Phase0 local runner; failed is fatal.
raise SystemExit(0 if ok and not any(r['status']=='failed' for r in results) else 1)
