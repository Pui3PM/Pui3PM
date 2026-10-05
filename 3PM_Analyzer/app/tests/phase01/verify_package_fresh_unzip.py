"""Fresh-unzip verification of delivered ZIPs (developer tool; records results, never promotes).

For each ZIP: extract into a NEW temp folder whose path contains spaces, check ZIP member modes, then run from the
extracted package: distribution contract, static integrity, executable Mac preflight, every app/tests/test*.js +
stress*.js (run_regressions.py), app/tests/phase01/test_*.js and, when Playwright + Chromium are available, the
browser gates. Output: one JSON report (stdout or --out). Exit 0 only if every check of every ZIP passed.

Usage: python3 app/tests/phase01/verify_package_fresh_unzip.py ZIP [ZIP ...] [--chromium PATH] [--out report.json]
"""
import argparse, hashlib, json, os, socket, subprocess, sys, tempfile, time, zipfile
from pathlib import Path

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def run(cmd, cwd, env=None, timeout=900):
    t = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
        out = (r.stdout or '') + (r.stderr or '')
        return {'command': cmd if isinstance(cmd, str) else ' '.join(map(str, cmd)), 'returncode': r.returncode, 'seconds': round(time.time() - t, 1), 'tail': out[-1500:]}
    except subprocess.TimeoutExpired:
        return {'command': ' '.join(map(str, cmd)), 'returncode': 'TIMEOUT', 'seconds': timeout, 'tail': ''}

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

def verify(zip_path, chromium, work):
    rep = {'zip': Path(zip_path).name, 'sha256': sha(zip_path), 'size_bytes': Path(zip_path).stat().st_size, 'checks': {}}
    dest = Path(tempfile.mkdtemp(prefix='3PM fresh unzip ', dir=work))
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist(); z.extractall(dest)
        modes = {i.filename: (i.external_attr >> 16) & 0o777 for i in z.infolist()}
    top = sorted({n.split('/')[0] for n in names})
    rep['top_level'] = top
    root = dest / top[0]
    # zipfile.extractall drops modes; restore them from the archive (what macOS Archive Utility does).
    for n, m in modes.items():
        if m and (dest / n).is_file():
            os.chmod(dest / n, m)
    exec_ok = all(modes.get(f'{top[0]}/{p}', 0) & 0o111 for p in ['START_3PM.command', 'app/3PM_Form_Analyzer_arm64', 'app/3PM_Form_Analyzer_x64'])
    internal_not_exec = all(not (modes.get(f'{top[0]}/{p}', 0) & 0o111) for p in ['internal/start_services.sh', 'internal/start_analyzer.sh'])
    rep['checks']['zip_member_modes'] = {'returncode': 0 if exec_ok and internal_not_exec else 1, 'tail': f'launcher/runtimes executable={exec_ok}; internal scripts non-executable={internal_not_exec}'}
    rep['package_id'] = (root / 'PACKAGE_ID.txt').read_text().strip()
    rep['artifact_class'] = json.loads((root / 'PACKAGE_CONTRACT.json').read_text()).get('artifact_class')
    rep['checks']['distribution_contract'] = run([sys.executable, '-B', 'app/tests/test_distribution_contract_r6.py'], root)
    rep['checks']['static_integrity'] = run([sys.executable, '-B', 'app/tests/static_integrity_x282.py'], root)
    rep['checks']['mac_preflight'] = run(['node', 'app/tests/test_mac_preflight_r5.js'], root)
    qa = Path(tempfile.mkdtemp(prefix='3pm-qa-', dir=work))
    env = dict(os.environ, THREEPM_QA_OUT=str(qa))
    rep['checks']['js_regressions'] = run([sys.executable, '-B', 'app/tests/run_regressions.py'], root, env=env, timeout=1800)
    try:
        rows = json.loads((qa / 'r7_results.json').read_text())
        rep['js_regressions'] = {'pass': sum(r['pass'] for r in rows), 'total': len(rows), 'failed': [r['test'] for r in rows if not r['pass']]}
    except Exception as e:
        rep['js_regressions'] = {'error': str(e)}
    ph = sorted((root / 'app/tests/phase01').glob('test_*.js'))
    res = {p.name: run(['node', str(p)], root / 'app')['returncode'] for p in ph}
    rep['phase01'] = {'pass': sum(v == 0 for v in res.values()), 'total': len(res), 'failed': [k for k, v in res.items() if v != 0]}
    if chromium:
        env = dict(os.environ)
        stat = str(root / 'app/static')
        gates = {
            'browser_fullapp_gate': ['node', 'app/tests/p108_browser/run_fullapp_gate_chromium.cjs', chromium, stat],
            'browser_post_p108_gate': ['node', 'app/tests/p108_browser/run_post_p108_browser.cjs', chromium, stat],
            'browser_r2_identity_gate': ['node', 'app/tests/p108_browser/run_post_p108_r2_identity_chromium.cjs', chromium, stat],
            'browser_identity_parity': ['node', 'app/tests/phase01/run_identity_parity_chromium_r8c.cjs', chromium],
            'browser_f01': ['node', 'app/tests/phase01/run_f01_chromium_r8c.cjs', chromium],
            'browser_shadow_bundle': ['node', 'app/tests/phase01/run_shadow_bundle_chromium.cjs', chromium],
        }
        for k, cmd in gates.items():
            rep['checks'][k] = run(cmd, root, env=env, timeout=600)
        port = free_port()
        stub = subprocess.Popen(['node', 'app/tests/p108_browser/stub_backend.cjs', stat, str(port)], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        try:
            time.sleep(1.5)
            url = f'http://127.0.0.1:{port}/static/index.html'
            rep['checks']['browser_anchor_single_owner'] = run(['node', 'app/tests/phase01/run_anchor_ownership_chromium.cjs', url, chromium], root, env=env, timeout=300)
            rep['checks']['browser_fullpage_liveness'] = run(['node', 'app/tests/phase01/run_fullpage_smoke_chromium_r8c.cjs', url, chromium], root, env=env, timeout=300)
        finally:
            stub.terminate()
    else:
        rep['browser'] = 'NOT RUN (no --chromium)'
    rep['all_checks_pass'] = all(c.get('returncode') == 0 for c in rep['checks'].values()) and rep['phase01']['failed'] == []
    return rep

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('zips', nargs='+'); ap.add_argument('--chromium'); ap.add_argument('--out')
    a = ap.parse_args()
    work = tempfile.mkdtemp(prefix='3pm-verify-')
    report = {'tool': 'verify_package_fresh_unzip.py', 'host': {'platform': sys.platform, 'python': sys.version.split()[0], 'node': subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()},
              'scope': 'Linux fresh-unzip software gates; Mach-O runtimes, Swift helpers, camera and Mac browser are NOT executed', 'packages': [verify(z, a.chromium, work) for z in a.zips]}
    text = json.dumps(report, indent=2) + '\n'
    if a.out: Path(a.out).write_text(text)
    print(text)
    sys.exit(0 if all(p['all_checks_pass'] for p in report['packages']) else 1)

if __name__ == '__main__':
    main()
