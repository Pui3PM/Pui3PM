"""Release gate. Run from any cwd; an optional argument selects an extracted package."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
contract = json.loads((root / 'PACKAGE_CONTRACT.json').read_text())
assert contract['public_launcher'] == 'START_3PM.command', 'The permanent launcher name cannot change'
launchers = sorted(str(p.relative_to(root)) for p in root.rglob('*.command'))
assert launchers == ['START_3PM.command'], f'Exactly one public launcher required: {launchers}'
# P-06: artifact-class-aware policy. Pins are hard-coded here; the contract only selects the class.
CLASS_POSE_SHA256 = {
    'development_not_release': 'fe8cafaea88833c6a5068ebbefad7962b0a32ec826f61cd406d180ec72518f02',  # approved trace seam
    'field_test_not_production': '22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d',  # frozen HV3 baseline
}
CLASS_MARKER = {'development_not_release': 'DEV_NOT_RELEASE.txt', 'field_test_not_production': 'FIELD_TEST_NOT_PRODUCTION.txt'}
artifact_class = contract.get('artifact_class')
assert artifact_class in CLASS_POSE_SHA256, f'Unknown artifact_class: {artifact_class!r}'
assert contract['artifact_classes'][artifact_class]['pose_sha256'] == CLASS_POSE_SHA256[artifact_class], 'Contract pose pin disagrees with the gate'
assert contract['artifact_classes'][artifact_class]['marker_file'] == CLASS_MARKER[artifact_class]
assert not set(CLASS_MARKER.values()) & set(contract['root_files']), 'Class marker files are selected by artifact_class, not listed in root_files'
assert {p.name for p in root.iterdir() if p.is_file()} == set(contract['root_files']) | {CLASS_MARKER[artifact_class]}, 'Unexpected/missing root files'
if artifact_class == 'field_test_not_production':
    assert 'FIELD TEST BUILD' in (root / 'FIELD_TEST_NOT_PRODUCTION.txt').read_text() and 'NOT PRODUCTION' in (root / 'FIELD_TEST_NOT_PRODUCTION.txt').read_text()
assert {p.name for p in root.iterdir() if p.is_dir()} == set(contract['root_directories']), 'Unexpected/missing root folders'
for rel in contract['required_application_files']:
    assert (root / rel).is_file(), f'Required source/asset/test missing: {rel}'
for rel in ['AGENTS.md', 'PROJECT_STATE.md', 'docs/HANDOFF_NEXT_CHAT.md', 'docs/QA_CURRENT.md', 'docs/TEST_CONTEXT.md']:
    assert (root / rel).is_file(), f'Required handoff/QA missing: {rel}'
assert (root / 'START_3PM.command').stat().st_mode & 0o111, 'Public launcher must be executable'
assert 'exec /bin/bash "$HERE/internal/start_services.sh"' in (root / 'START_3PM.command').read_text()
services = (root / 'internal/start_services.sh').read_text()
analyzer = (root / 'internal/start_analyzer.sh').read_text()
assert '/bin/bash "$HERE/internal/start_analyzer.sh"' in services
assert 'BIN="$HERE/app/$RUNTIME_NAME"' in analyzer
assert '$HOME/Downloads' not in analyzer, 'Standalone release must not scavenge older installations'
for rel in contract['required_internal_scripts']:
    p = root / rel
    assert p.is_file() and not p.stat().st_mode & 0o111, f'Internal scripts must not be public executable entries: {rel}'
    subprocess.run(['bash', '-n', str(p)], check=True)
subprocess.run(['bash', '-n', str(root / 'START_3PM.command')], check=True)
# pose.js: development class uses the owner-approved trace-only narrow-thaw hash, and
# app/tests/phase01/test_pose_narrow_thaw.js proves stripping that seam reconstructs the frozen HV3 hash byte-for-byte.
# field_test_not_production ships the frozen HV3 pose.js itself (OWNER DECISION D-B option 1).
expected = {
    'app/static/core_runtime.js': '89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf',
    'app/static/pose.js': CLASS_POSE_SHA256[artifact_class],
    'app/static/app.js': 'ed23976568e7f25b5fb370c516ba766f272548e13d8398be5f506029d769f378',
    'app/3PM_Form_Analyzer_arm64': 'babd2ba02406a6a42a9f62f1df77dc84056fc890b3556a86d4d1a50b76a5913b',
    'app/3PM_Form_Analyzer_x64': '5c41ebf790ef47ea59c2be76b4febb5ef3ee9c977166dc2065fc5f523e3eddf4',
}
for rel, wanted in expected.items():
    assert hashlib.sha256((root / rel).read_bytes()).hexdigest() == wanted, f'Frozen hash changed: {rel}'
for rel in contract['required_runtimes']:
    assert (root / rel).stat().st_mode & 0o111, f'Internal runtime is not executable: {rel}'
manifest = {}
for line in (root / 'SHA256SUMS.txt').read_text().splitlines():
    digest, rel = line.split('  ', 1)
    assert not Path(rel).is_absolute() and '..' not in Path(rel).parts
    assert rel not in manifest, f'Duplicate manifest path: {rel}'
    manifest[rel] = digest
actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.name != 'SHA256SUMS.txt'}
assert actual == set(manifest), 'Manifest has missing or extra files'
for rel, wanted in manifest.items():
    assert hashlib.sha256((root / rel).read_bytes()).hexdigest() == wanted, f'Unreviewed content change: {rel}'
    p = Path(rel)
    assert p.suffix.lower() not in {'.zip', '.bak', '.tmp', '.log', '.pyc'}, f'Unnecessary generated/backup file: {rel}'
    assert not any(part in {'__pycache__', 'node_modules', 'historical_notes'} for part in p.parts)
# Exercise the shipped public launcher in a path with spaces without starting Mac services.
with tempfile.TemporaryDirectory(prefix='3PM package with spaces ') as temp:
    target = Path(temp)
    shutil.copy2(root / 'START_3PM.command', target / 'START_3PM.command')
    (target / 'internal').mkdir()
    (target / 'internal/start_services.sh').write_text('printf "ROUTE_OK:%s" "$0"\n')
    r = subprocess.run(['bash', str(target / 'START_3PM.command')], cwd='/', text=True, capture_output=True, check=True)
    assert r.stdout == f'ROUTE_OK:{target}/internal/start_services.sh', r.stdout
print('Distribution contract PASS: sole fixed launcher, reviewed file set, frozen runtimes, internal routing, spaces-safe public entrypoint')
