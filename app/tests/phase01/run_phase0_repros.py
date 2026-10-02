from pathlib import Path
import json,subprocess,sys,shutil,tempfile
here=Path(__file__).resolve().parent
package_root=here.parents[2]
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
# Dynamic F01 must be a real browser test.
# Q-02: discover Chromium as CHROMIUM_PATH -> Playwright chromium.executablePath() -> PATH names,
# and report `blocked` only when no candidate actually launches.
def chromium_candidates():
    import os
    found=[]
    env=os.environ.get('CHROMIUM_PATH')
    if env: found.append(('CHROMIUM_PATH',env))
    for mod in ('playwright','playwright-core'):
        try:
            q=subprocess.run(['node','-e',f"process.stdout.write(require('{mod}').chromium.executablePath())"],capture_output=True,text=True,timeout=20)
            if q.returncode==0 and q.stdout.strip(): found.append((mod,q.stdout.strip()))
        except (OSError,subprocess.TimeoutExpired): pass
    for name in ('chromium','chromium-browser','google-chrome','google-chrome-stable'):
        w=shutil.which(name)
        if w: found.append(('PATH:'+name,w))
    return found
def launch_chromium():
    attempts=[]
    with tempfile.TemporaryDirectory(prefix='3pm-chromium-smoke-') as td:
        smoke=Path(td)/'smoke.html'; smoke.write_text('<!doctype html><p>ok</p>')
        for source,exe in chromium_candidates():
            try:
                p=subprocess.run([exe,'--headless','--no-sandbox','--disable-gpu','--dump-dom',smoke.as_uri()],capture_output=True,text=True,timeout=30)
                if p.returncode==0 and '<p>ok</p>' in p.stdout: return exe,source,attempts
                attempts.append({'source':source,'path':exe,'returncode':p.returncode,'stderrTail':p.stderr[-300:]})
            except (OSError,subprocess.TimeoutExpired) as e:
                attempts.append({'source':source,'path':exe,'error':type(e).__name__})
    return None,None,attempts
chromium,chromium_source,chromium_attempts=launch_chromium()
if chromium:
    try:
        q=subprocess.run([chromium,'--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--virtual-time-budget=800','--dump-dom',(here/'f01_dom_harness.html').as_uri()],capture_output=True,text=True,timeout=30)
        import re
        m=re.search(r'data-f01-callbacks="(\d+)"',q.stdout)
        count=int(m.group(1)) if m else None
        status='passed' if q.returncode==0 and count is not None and count>=100 else 'failed'
        results.append({'name':'F01_dynamic_chromium','status':status,'browser':chromium,'browserSource':chromium_source,'callbackCount':count,'returncode':q.returncode,'stdoutTail':q.stdout[-1000:],'stderrTail':q.stderr[-1000:]})
        ok &= status=='passed'
    except subprocess.TimeoutExpired:
        results.append({'name':'F01_dynamic_chromium','status':'failed','browser':chromium,'browserSource':chromium_source,'reason':'Chromium launched but the F01 harness did not finish within 30 s.'})
        ok=False
else:
    results.append({'name':'F01_dynamic_chromium','status':'blocked','reason':'No Chromium candidate launched (CHROMIUM_PATH, Playwright, PATH).','attempts':chromium_attempts})
out=qa_output_dir(package_root)/'phase0_repro_results.json'
out.write_text(json.dumps(results,indent=2)+'\n')
print('Phase0 results written to', out)
print('Phase0 repro statuses:', ', '.join(f"{r['name']}={r['status']}" for r in results))
# blocked is honest/non-fatal for Phase0 local runner; failed is fatal.
raise SystemExit(0 if ok and not any(r['status']=='failed' for r in results) else 1)
