"""Packaging step (FINAL_REVIEW §14) for 3PM Analyzer R8 artifacts.

Builds a fresh standalone ZIP from a source tree and verifies the ZIP bytes:
  1. stage a copy of the tree (never edits the source tree);
  2. field class only: strip the pose.js trace seam with strip_pose_trace_seam.cjs (refuses unless the result is the
     frozen HV3 SHA-256), set artifact_class, swap DEV_NOT_RELEASE.txt for FIELD_TEST_NOT_PRODUCTION.txt;
  3. refresh the committed QA snapshots (docs/qa/r7_results.json, docs/phase01/*.json) from a real run of the staged tree;
  4. regenerate the provenance manifest (schema 2) from the final bytes, then SHA256SUMS.txt;
  5. write the ZIP (exec bits preserved), unzip it fresh and run: distribution contract, static integrity, pose guard,
     manifest-vs-filesystem verification, protected-file hashes, shadow isolation.

Usage:
  python3 -B app/tests/phase01/build_r8_artifact.py --class development_not_release|field_test_not_production \
      --base-tree <pristine baseline tree> --base-zip <baseline zip> --base-zip-name <canonical name> --out <dir> --date YYYYMMDD
"""
import argparse, hashlib, json, os, shutil, stat, subprocess, sys, tempfile, zipfile
from pathlib import Path

SRC = Path(__file__).resolve().parents[3]
PROVENANCE_REL = 'docs/lineage/R8_P1_08_CLAUDE_CODE_PROVENANCE.json'
MARKER = {'development_not_release': 'DEV_NOT_RELEASE.txt', 'field_test_not_production': 'FIELD_TEST_NOT_PRODUCTION.txt'}
ROOT_NAME = {'development_not_release': '3PM_Analyzer_R8_P1_08_DEV', 'field_test_not_production': '3PM_Analyzer_R8_P1_08_FIELD_TEST'}
ZIP_NAME = {'development_not_release': '3PM_Analyzer_R8_P1_08_DEV_{date}.zip', 'field_test_not_production': '3PM_Analyzer_R8_P1_08_FIELD_TEST_{date}.zip'}
PROTECTED = {
    'app/static/app.js': 'ed23976568e7f25b5fb370c516ba766f272548e13d8398be5f506029d769f378',
    'app/static/core_runtime.js': '89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf',
    'app/3PM_Form_Analyzer_arm64': 'babd2ba02406a6a42a9f62f1df77dc84056fc890b3556a86d4d1a50b76a5913b',
    'app/3PM_Form_Analyzer_x64': '5c41ebf790ef47ea59c2be76b4febb5ef3ee9c977166dc2065fc5f523e3eddf4',
    'app/static/equipment_catalog.js': 'd5eaf099b7823674ac884c9e210fda85496549c0fac5fdf85d41577bafadaa0a',
    'app/static/equipment_lab_core.js': 'cdff4cc13fef13d7bccedc24a79c2eb5523ceb8967fa7061b5f6fe4332e47b61',
    'app/static/equipment_lab_layer.js': 'dd425979d5e9b656ca870227d60e2ee690a2dd416f83bd8e84529eca86bf00c0',
    'internal/3PM_Equipment_Catalog_CANONICAL_EL18_FORM_UX_2026_09_30_R1.json': '40eb1a466f9f0d5f5db08d22b44791676aaf40022ae18d8b90803ef9ca4f4344',
    'internal/3PM_Equipment_Catalog_EL17_MERGE_AUDIT.json': 'bbefaa6cfc8a3382ecffa2cfda949b660ef397fcbb0cb4609cbe8db630ef5a22',
    # R8 P1-08 explicit thaw (DECISION_LOG D-108-02 / D-108-03; rollback: ROLLBACK.md). Previous pins in THAWED below.
    'app/static/evidence_budget_core.js': 'de50d1eb86423fd3c093b1a5159dcb4ba3da7de455876405e1345c91685b1799',
    'app/static/temporal_evidence_layer.js': '4af385e836e881150fe20956b8f5950ef92dbbb5d68855e253b185acbfec53bf',
    'app/static/capture_integrity_layer.js': '01f9bdfaec0ca7feb76f5a7a1d861de70437e80ca6ce0cfab6683baff110cbf3',
}
THAWED = {  # path: (P1-07 pinned sha256, decision) -- recorded so a reviewer can diff/rollback exactly these bytes
    'app/static/evidence_budget_core.js': ('fd7335e88e02af4fa2d34a49006c0d0f821d2473e0bf924afcb0c62bf0ffc3cd', 'D-108-02 H-01/H-02 root cause (epoch-only identity, cross-domain mediaTime order)'),
    'app/static/temporal_evidence_layer.js': ('65aec49083091f60be6626775b5c89115e6646a4bc93c3b458ff846d9507db42', 'D-108-03 H-02 adapter null->0 identity (augmentBundle mapping only)'),
}
P108_GATES = ['app/tests/test_p108_h01_chronology.js', 'app/tests/test_p108_h02_identity.js', 'app/tests/test_p108_h03_native_generation.js',
              'app/tests/test_p108_m01_fps_scope.js', 'app/tests/test_p108_m02_alignment_anchor.js', 'app/tests/test_p108_astra_probes.js',
              'app/tests/test_p108_m04_bridge_exposure.js', 'app/tests/test_p108_m05_migration_compat.js', 'app/tests/test_p108_m05_launcher_profile.js',
              'app/tests/phase01/repro_astra_legacy_gaps.js']
EQUIPMENT_ATHLETE_SESSION = ['app/static/app.js', 'app/static/equipment_catalog.js', 'app/static/equipment_lab_core.js', 'app/static/equipment_lab_layer.js',
                             'internal/3PM_Equipment_Catalog_CANONICAL_EL18_FORM_UX_2026_09_30_R1.json', 'internal/3PM_Equipment_Catalog_EL17_MERGE_AUDIT.json']


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def files_of(root):
    return sorted(str(p.relative_to(root)).replace(os.sep, '/') for p in Path(root).rglob('*') if p.is_file())


def run(cmd, cwd, env=None, check=True):
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(f'FAILED: {" ".join(map(str, cmd))}\n{r.stdout[-3000:]}\n{r.stderr[-3000:]}')
    return r


def stage(cls, work):
    dst = Path(work) / ROOT_NAME[cls]
    shutil.copytree(SRC, dst, symlinks=False, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.git', '.DS_Store'))
    if cls == 'field_test_not_production':
        pose = dst / 'app/static/pose.js'
        tmp = Path(work) / 'pose.frozen.js'
        run(['node', str(dst / 'app/tests/phase01/strip_pose_trace_seam.cjs'), str(pose), str(tmp)], cwd=dst)
        shutil.copyfile(tmp, pose)
        contract = json.loads((dst / 'PACKAGE_CONTRACT.json').read_text())
        contract['artifact_class'] = cls
        (dst / 'PACKAGE_CONTRACT.json').write_text(json.dumps(contract, indent=2, ensure_ascii=False) + '\n')
        (dst / 'DEV_NOT_RELEASE.txt').unlink()
        (dst / 'FIELD_TEST_NOT_PRODUCTION.txt').write_text(
            'FIELD TEST BUILD — NOT PRODUCTION\n'
            '3PM Analyzer R8 field test build. Legacy Shot Decision remains the only production authority;\n'
            'the R8 shadow pipeline is shadow-only and writes nothing to real shots.\n'
            'No accuracy claims. Not validated on a real camera, real archer or labeled field dataset yet.\n'
            'Restricted scope: macOS, Side camera only, 30 FPS, isolated/disposable data, isolated network bench.\n'
            'Keep the R7 production/field candidate and all existing sessions/DB; do not delete user data.\n'
            'Read docs/FIELD_TEST_INSTRUCTIONS.md before shooting.\n')
    (dst / 'PACKAGE_ID.txt').write_text(ZIP_NAME[cls].replace('_{date}.zip', '') + '\n')
    return dst


def refresh_qa_snapshots(tree, qa_out, strict=False):
    env = dict(os.environ, THREEPM_QA_OUT=str(qa_out))
    summary = {}
    for runner, produced, target in [
        ('app/tests/run_regressions.py', 'r7_results.json', 'docs/qa/r7_results.json'),
        ('app/tests/phase01/run_phase0_repros.py', 'phase0_repro_results.json', 'docs/phase01/phase0_repro_results.json'),
        ('app/tests/phase01/run_p006_regressions.py', 'p006_js_regressions.json', 'docs/phase01/p006_js_regressions.json'),
    ]:
        r = run([sys.executable, '-B', str(tree / runner)], cwd=tree, env=env, check=False)
        summary[runner] = {'returncode': r.returncode, 'tail': (r.stdout.strip().splitlines() or [''])[-1]}
        if strict and r.returncode != 0:
            raise SystemExit(f'field build QA gate failed: {runner}\n{r.stdout[-4000:]}\n{r.stderr[-2000:]}')
        shutil.copyfile(Path(qa_out) / produced, tree / target)
    return summary


def write_provenance(tree, cls, base_tree, base_zip, base_zip_name, qa_summary):
    base_tree = Path(base_tree)
    excluded = ['SHA256SUMS.txt', PROVENANCE_REL]
    cur = [f for f in files_of(tree) if f not in excluded]
    base = {f: sha(base_tree / f) for f in files_of(base_tree) if f != 'SHA256SUMS.txt'}
    rows, changed = [], []
    for f in cur:
        c = sha(tree / f)
        b = base.get(f)
        kind = 'added' if b is None else ('unchanged' if b == c else 'modified')
        rows.append({'path': f, 'base_sha256': b, 'current_sha256': c, 'classification': kind})
        if kind != 'unchanged':
            changed.append(f)
    for f in sorted(set(base) - set(cur) - set(excluded)):
        rows.append({'path': f, 'base_sha256': base[f], 'current_sha256': None, 'classification': 'removed'})
        changed.append(f)
    static_changed = sorted(f for f in changed if f.startswith('app/static/'))
    eas_changed = sorted(f for f in changed if f in EQUIPMENT_ATHLETE_SESSION)
    doc = {
        'schema': 2,
        'generated_at': os.environ.get('R8_BUILD_DATE_ISO', ''),
        'artifact_class': cls,
        'baseline_zip': {'filename': base_zip_name, 'sha256': sha(base_zip)},
        'lineage_policy': 'EL18 -> R7 TransactionRepair parent -> selective HV3 merge -> R8; P1-08 starts from the audited P1-07 source (commit 511cfdb, field ZIP b6f0220e...) and keeps R7 parent primacy',
        'thawed_protected_files': {f: {'previous_sha256': v[0], 'current_sha256': sha(tree / f), 'decision': v[1]} for f, v in THAWED.items()},
        'attestation_scope': {'excluded_paths': excluded, 'reason': 'provenance self-hash and SHA manifest would create circular attestation; SHA256SUMS is generated after this provenance and covers the provenance file.'},
        'current_tree_file_count_in_scope': len(cur),
        'base_tree_file_count_in_scope': len(base),
        'changed_count': len(changed),
        'changed_paths': sorted(changed),
        'files': sorted(rows, key=lambda r: r['path']),
        'claims': {
            'production_app_static_changed_count': len(static_changed),
            'production_app_static_changed_paths': static_changed,
            'equipment_athlete_session_changed_count': len(eas_changed),
            'pose_js_sha256': sha(tree / 'app/static/pose.js'),
        },
        'qa_run_at_packaging': qa_summary,
    }
    (tree / PROVENANCE_REL).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n')
    return doc


def write_sha256sums(tree):
    lines = [f'{sha(tree / f)}  {f}' for f in files_of(tree) if f != 'SHA256SUMS.txt']
    (tree / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n')


def write_zip(tree, zpath):
    with zipfile.ZipFile(zpath, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files_of(tree):
            p = tree / f
            zi = zipfile.ZipInfo(f'{tree.name}/{f}', date_time=(2026, 10, 3, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (stat.S_IFREG | (0o755 if os.access(p, os.X_OK) else 0o644)) << 16
            z.writestr(zi, p.read_bytes())


def verify_zip(zpath, cls, work):
    out = Path(work) / 'verify'
    out.mkdir()
    with zipfile.ZipFile(zpath) as z:
        for zi in z.infolist():
            z.extract(zi, out)
            mode = (zi.external_attr >> 16) & 0o777
            if mode:
                os.chmod(out / zi.filename, mode)
    roots = [p for p in out.iterdir()]
    assert len(roots) == 1 and roots[0].is_dir(), 'ZIP must contain exactly one root folder'
    root = roots[0]
    report = {}
    report['distribution_contract'] = run([sys.executable, '-B', 'app/tests/test_distribution_contract_r6.py'], cwd=root).stdout.strip().splitlines()[-1]
    report['static_integrity'] = run([sys.executable, '-B', 'app/tests/static_integrity_x282.py'], cwd=root).stdout.strip().splitlines()[-1]
    report['pose_guard'] = run(['node', 'app/tests/phase01/test_pose_narrow_thaw.js'], cwd=root).stdout.strip().splitlines()[-1]
    prov = json.loads((root / PROVENANCE_REL).read_text())
    listed = {r['path']: r['current_sha256'] for r in prov['files'] if r['classification'] != 'removed'}
    actual = files_of(root)
    mism = [f for f in listed if f not in actual or sha(root / f) != listed[f]]
    unlisted = sorted(set(actual) - set(listed))
    assert not mism, f'provenance mismatches: {mism[:10]}'
    assert unlisted == sorted(prov['attestation_scope']['excluded_paths']), f'unexpected unlisted files: {unlisted}'
    report['provenance_manifest'] = f'{len(listed)}/{len(listed)} current_sha256 exact; unlisted only {unlisted}'
    for f, h in PROTECTED.items():
        assert sha(root / f) == h, f'protected file changed: {f}'
    report['protected_files'] = f'{len(PROTECTED)}/{len(PROTECTED)} byte-identical'
    pose = sha(root / 'app/static/pose.js')
    want = '22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d' if cls == 'field_test_not_production' else 'fe8cafaea88833c6a5068ebbefad7962b0a32ec826f61cd406d180ec72518f02'
    assert pose == want, f'pose.js {pose} != {want}'
    report['pose_js'] = pose
    for f in (root / 'app/static').iterdir():
        if f.suffix in ('.js', '.mjs', '.html'):
            s = f.read_text(errors='replace')
            assert 'shadow_runtime_bundle' not in s and 'ThreePMShadow' not in s, f'app/static/{f.name} references app/shadow'
    report['shadow_isolation'] = 'no app/static file references app/shadow'
    launchers = [str(p.relative_to(root)) for p in root.rglob('*.command')]
    assert launchers == ['START_3PM.command'], launchers
    report['launchers'] = launchers
    marker = MARKER[cls]
    assert (root / marker).is_file() and not (root / MARKER[[k for k in MARKER if k != cls][0]]).exists(), 'class marker mismatch'
    report['class_marker'] = marker
    if cls == 'field_test_not_production':
        assert 'Phase 0 narrow-thaw instrumentation seam.' not in (root / 'app/static/pose.js').read_text(errors='replace'), 'trace seam present in field pose.js'
        report['field_pose_seam'] = 'absent (frozen HV3 pose.js)'
    gates = {}
    for g in P108_GATES:
        r = run(['node', g], cwd=root, env=dict(os.environ))
        gates[g] = (r.stdout.strip().splitlines() or [''])[-1][:240]
    report['p108_gates_fresh_unzip'] = gates
    shutil.rmtree(out)
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--class', dest='cls', required=True, choices=sorted(MARKER))
    ap.add_argument('--base-tree', required=True)
    ap.add_argument('--base-zip', required=True)
    ap.add_argument('--base-zip-name', required=True, help='canonical baseline ZIP filename recorded in provenance')
    ap.add_argument('--out', required=True)
    ap.add_argument('--date', required=True)
    a = ap.parse_args()
    out = Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if SRC == out or SRC in out.parents:
        raise SystemExit('output directory must be outside the source tree')
    with tempfile.TemporaryDirectory(prefix='3pm-pack-') as work:
        tree = stage(a.cls, work)
        qa = refresh_qa_snapshots(tree, Path(work) / 'qa', strict=a.cls == 'field_test_not_production')
        prov = write_provenance(tree, a.cls, a.base_tree, a.base_zip, a.base_zip_name, qa)
        write_sha256sums(tree)
        zpath = out / ZIP_NAME[a.cls].format(date=a.date)
        write_zip(tree, zpath)
        report = verify_zip(zpath, a.cls, work)
    result = {'zip': str(zpath), 'zip_sha256': sha(zpath), 'zip_bytes': zpath.stat().st_size, 'artifact_class': a.cls,
              'changed_count': prov['changed_count'], 'claims': prov['claims'], 'qa_run_at_packaging': qa, 'verification_from_fresh_unzip': report}
    (out / (zpath.stem + '.BUILD_REPORT.json')).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
