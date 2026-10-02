from pathlib import Path
import subprocess, hashlib
root=Path(__file__).resolve().parents[1]
html=(root/'static/index.html').read_text()
app=(root/'static/app.js').read_text()
start=(root/'../internal/start_analyzer.sh').read_text()
assert 'Version 5.0.0 X2.8.2 · Trust-First Live Phase + Release Evidence Field Candidate · Release Proof' in html
for marker in ['class="review-control-bar"','id="prevFrameBtn"','id="nextFrameBtn"','id="replayPlayBtn"','id="replayPanLeftBtn"','id="replayPanUpBtn"','id="replayPanDownBtn"','id="replayPanRightBtn"','id="consistencyPanel"']:
    assert marker in html, marker
bar=html[html.index('class="review-control-bar"'):html.index('id="reviewMultiView"')]
assert bar.index('id="prevFrameBtn"') < bar.index('id="nextFrameBtn"') < bar.index('id="replayPlayBtn"'), 'Frame Back/Forward/Play not grouped in order'
assert 'X2.8.2 Unified Review · Consistency · Anchor Settle · Replay Pan · Release Proof' in app
for marker in ['const CONSISTENCY_METRICS=','function renderConsistencyPanel','Tighter than reference','Similar to reference','Wider than reference']:
    assert marker in app, marker
for marker in ['Preflight: R7 transaction signatures + HV3 three-camera/timeline signatures verified.','EXPECTED_CONSISTENCY','EXPECTED_BAR','close_old_analyzer_tabs','?build=${BUILD_TAG}','lsof -Pan -p "$PID"']:
    assert marker in start, marker
# Frozen Dev4 source/runtime-facing components must remain byte-identical to the BLE43885 Source of Truth.
# pose.js uses the owner-approved trace-only narrow-thaw hash.
# app/tests/phase01/test_pose_narrow_thaw.js separately proves stripping that seam
# reconstructs the frozen HV3 pose.js hash byte-for-byte.
# P-06: pose pin per artifact class (hard-coded; PACKAGE_CONTRACT.json only selects the class).
import json
CLASS_POSE_SHA256={'development_not_release':'fe8cafaea88833c6a5068ebbefad7962b0a32ec826f61cd406d180ec72518f02','field_test_not_production':'22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d'}
artifact_class=json.loads((root/'../PACKAGE_CONTRACT.json').read_text()).get('artifact_class')
assert artifact_class in CLASS_POSE_SHA256, f'unknown artifact_class {artifact_class!r}'
expected={
 'static/core_runtime.js':'89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf',
 'static/pose.js':CLASS_POSE_SHA256[artifact_class],
 'static/app.js':'ed23976568e7f25b5fb370c516ba766f272548e13d8398be5f506029d769f378',
}
for f,want in expected.items():
    p=root/f; assert p.exists() and p.stat().st_size>0, f
    got=hashlib.sha256(p.read_bytes()).hexdigest(); assert got==want, f'{f} frozen hash changed: {got}'
baseline=(root/'../docs/RUNTIME_BASELINE_SHA256.txt').read_text()
assert 'babd2ba02406a6a42a9f62f1df77dc84056fc890b3556a86d4d1a50b76a5913b' in baseline
assert '5c41ebf790ef47ea59c2be76b4febb5ef3ee9c977166dc2065fc5f523e3eddf4' in baseline
# all JS syntax must parse
for f in sorted((root/'static').glob('*.js')):
    subprocess.run(['node','--check',str(f)],check=True,stdout=subprocess.DEVNULL)
print(f'X2.8.2 static/launch integrity: PASS · frozen Dev4 JS hashes exact · runtime binary SHA baseline pinned · artifact_class={artifact_class}')
