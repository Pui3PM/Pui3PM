# KNOWN LIMITATIONS — R8 P1-08 (2026-10-03)

Status ceiling: **Software Candidate Ready for Restricted Field Validation — NOT Production Ready.** Restricted scope: macOS, Side camera only, 30 FPS, isolated/disposable data, Legacy authority. No Windows, high-FPS or multi-camera claims.

## Not run (cannot be run in this environment)
- macOS runtime, launcher, Swift bridge compile, AVFoundation capture, Mac Chrome/Safari, real camera, real archer, labeled dataset, Windows. The shipped runtime binaries are Mach-O; browser gates use a **backend test double** (`app/tests/p108_browser/stub_backend.cjs`).
- H-03 was verified against a bridge double that follows the Swift source semantics (open applies on arrival, `start()` stops the previous capture, `/close {role}` unscoped). Real bridge timing is unmeasured.
- Supporting trace `3PM_capture_integrity_trace_2026-10-03T04-55-23-580Z.json` was not received; its pattern was rebuilt synthetically from the audit text.

## Open findings
- **M-01** frozen `app.js` `evidenceUniqueByEpoch` still collapses frames ≤8 ms apart (240 FPS: 25→13; null mediaTime treated as 0). Integration path after it is 25/25 at 30/60/120/240. Field scope = 30 FPS (measured 25/25).
- **M-04** Swift bridge: no loopback constraint on `NWListener`, `Access-Control-Allow-Origin: *`, Private-Network allowed, no Origin/auth, `/close` unscoped. Field prerequisite: isolated engineering bench, verified with the commands in FIELD_TEST_INSTRUCTIONS §0. The JS facade never sends a stale `/close`, but any other local web page or LAN host could reach the bridge.
- **M-05** mitigated, not proven on Mac: the field launcher isolates the browser profile; Mac export/restore proof is a field step (§0).

## Behavioural notes
- Cross-domain order relies on capture epoch from two clocks of the same Mac (browser `Date.now()` vs native host-time mapping). Offset between them has **not been measured** (former P-07 measurement item). Phase zones are hundreds of ms apart, so zone order is robust; frames of different domains within a few ms of each other may interleave by a few ms.
- Equal mediaTime/frameSeq inside one domain = same frame (R7 contract). Records written by the P1-07 adapter that already collapsed 0/0 worker frames cannot be recovered (data was lost at P1-07 write time).
- Boot migration re-stamps every stored record once (VERSION bump); frame sets are preserved (tested on P1-07 shapes).
- Inline Astra probe WORKER-NULL-MAPPING stays 1 by construction (D-108-06); actual adapter 25/25.
- Pre-existing, unchanged: `field_polish_layer` observer fires ~60/s while frames render in Review (frame-driven, identical on P1-07; idle settles ≤5/2 s in the full-app gate).
- The old `run_fullpage_smoke_chromium_r8c.cjs` "LOADED" is liveness only; acceptance is `run_fullapp_gate_chromium.cjs`.
- Development class keeps the 3 legacy pose sentinels red by policy (trace-seam `pose.js`); the field class must be all green.
