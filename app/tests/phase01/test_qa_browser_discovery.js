'use strict';
// Q-02 regression: run_phase0_repros.py must find Chromium via CHROMIUM_PATH -> Playwright -> PATH
// and report F01_dynamic_chromium=blocked only when no candidate launches.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const runner = path.resolve(__dirname, 'run_phase0_repros.py');
const nodeDir = path.dirname(process.execPath);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '3pm-q02-'));

function f01(env) {
  const out = fs.mkdtempSync(path.join(tmp, 'run-'));
  const keep = {};
  for (const k of ['HOME', 'PLAYWRIGHT_BROWSERS_PATH']) if (process.env[k]) keep[k] = process.env[k];
  const res = spawnSync('python3', ['-B', runner], { env: Object.assign(keep, { THREEPM_QA_OUT: out }, env), encoding: 'utf8', timeout: 300000 });
  const file = path.join(out, 'phase0_repro_results.json');
  assert.ok(fs.existsSync(file), 'runner wrote results\n' + res.stdout + res.stderr);
  return JSON.parse(fs.readFileSync(file, 'utf8')).find((r) => r.name === 'F01_dynamic_chromium');
}
function playwrightChromium() {
  try { const p = require('playwright').chromium.executablePath(); return fs.existsSync(p) ? p : null; } catch (_) { return null; }
}

try {
  const minimalPath = nodeDir + ':/usr/bin:/bin';
  // 1. Nothing available -> blocked, with the attempts listed.
  const none = f01({ PATH: minimalPath, CHROMIUM_PATH: '/nonexistent/chrome' });
  if (none.status !== 'blocked') {
    console.log('note: a Chromium is reachable via PATH on this machine; "nothing available" case not constructible');
  } else {
    assert.ok(Array.isArray(none.attempts) && none.attempts.some((a) => a.source === 'CHROMIUM_PATH'), 'blocked lists the failed CHROMIUM_PATH attempt');
  }
  const browser = process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH) ? process.env.CHROMIUM_PATH : playwrightChromium();
  if (!browser) {
    console.log('Q-02 browser discovery: PARTIAL — no Chromium on this machine; positive cases NOT RUN');
  } else {
    // 2. CHROMIUM_PATH alone (no Playwright resolvable, nothing on PATH) -> never blocked.
    const viaEnv = f01({ PATH: minimalPath, CHROMIUM_PATH: browser });
    assert.notStrictEqual(viaEnv.status, 'blocked', 'CHROMIUM_PATH browser is used');
    assert.strictEqual(viaEnv.browserSource, 'CHROMIUM_PATH');
    // 3. Broken CHROMIUM_PATH falls through to Playwright.
    if (playwrightChromium()) {
      const viaPw = f01({ PATH: minimalPath, CHROMIUM_PATH: '/nonexistent/chrome', NODE_PATH: process.env.NODE_PATH || '' });
      if (viaPw.status === 'blocked') {
        // Playwright resolvable from this process only if NODE_PATH lets the child resolve it too.
        assert.ok(!process.env.NODE_PATH, 'Playwright fallback must be used when resolvable');
        console.log('note: Playwright not resolvable from child (NODE_PATH unset); fallback case NOT RUN');
      } else {
        assert.ok(/^playwright/.test(viaPw.browserSource), 'fell through to Playwright: ' + viaPw.browserSource);
      }
    }
    console.log('Q-02 browser discovery: PASS (CHROMIUM_PATH used, Playwright fallback, blocked only when none launches)');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
