'use strict';
// R8 P1-08 M-04 (OPEN, characterization): native capture bridge network exposure.
// The Swift bridge cannot be compiled or run in the Linux build environment (no swiftc, no AVFoundation). This test pins
// the source facts so that (a) the field prerequisite in FIELD_TEST_INSTRUCTIONS stays justified, and (b) whoever
// changes the bridge must update this test, the prerequisite and the docs together.
// When a fact below changes, the assertion message names what to update. It never asserts the exposure is acceptable.
//
// History: P1-08 pinned the audited exposure (listener on every interface, no Origin check, unscoped /close, start()
// stopping the previous capture). Post-P108 hardened the SOURCE (loopback-only listener, loopback-HTTP Origin allow-list,
// generation-scoped /close, lifecycle reservation before permission/start) and this file's own message required the pins
// to be updated when that landed ("loopback hardening landed -> update test_p108_m04_bridge_exposure.js"). Post-P108 R2
// re-pins the hardened facts. M-04 stays OPEN: no request authentication (any local process can command the bridge),
// and none of this was compiled or executed on macOS.
// Usage: node app/tests/test_p108_m04_bridge_exposure.js [path-to-package-root]
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const swift=fs.readFileSync(path.join(root,'app/native_capture_bridge/3PMNativeCaptureBridge.swift'),'utf8');
const facts={};
const pin=(name,cond,msg)=>{facts[name]=!!cond;assert(cond,`M-04 fact changed (${name}): ${msg} -> update test_p108_m04_bridge_exposure.js, KNOWN_LIMITATIONS M-04 and FIELD_TEST_INSTRUCTIONS prerequisite`);};
pin('port_48735',/defaultPort: UInt16 = 48735/.test(swift),'bridge port is no longer 48735');
pin('listener_loopback_only',/requiredLocalEndpoint\s*=\s*\.hostPort\(host:\s*"127\.0\.0\.1"/.test(swift)&&!/NWListener\(using:\.tcp,on:NWEndpoint\.Port/.test(swift),
  'listener is no longer bound to 127.0.0.1 only');
pin('acao_wildcard',/Access-Control-Allow-Origin: \*/.test(swift),'CORS is no longer wildcard');
pin('private_network_allowed',/Access-Control-Allow-Private-Network: true/.test(swift),'Private Network Access grant removed');
// Header parser now records every header (lower-cased); only content-length and origin are consulted.
const consulted=[...swift.matchAll(/headers\["([a-z-]+)"\]/g)].map(m=>m[1]).sort();
pin('only_content_length_and_origin_consulted',JSON.stringify([...new Set(consulted)])===JSON.stringify(['content-length','origin']),'headers consulted changed: '+JSON.stringify(consulted));
pin('origin_allow_list_loopback_http',/if let origin=r\.headers\["origin"\]/.test(swift)&&/u\.scheme=="http"/.test(swift)&&/u\.host=="127\.0\.0\.1" \|\| u\.host=="localhost"/.test(swift)&&/status:403/.test(swift),
  'Origin allow-list (http://127.0.0.1|localhost, else 403) changed');
pin('no_origin_header_accepted',/Requests without Origin are local/.test(swift),'requests without an Origin header are no longer accepted (launcher /health probe uses curl without Origin)');
pin('no_auth',!/"authorization"|bearer|x-3pm-token|sharedSecret/i.test(swift),'bridge now has request authentication (M-04 may be closable: re-audit)');
pin('close_requires_generation',/guard let requested=\(body\["generation"\] as\? NSNumber\)\?\.intValue else \{ return \["ok":false,"role":role,"error":"generation required"\] \}/.test(swift)&&/c\.stop\(expectedGeneration:requested\)/.test(swift),
  '/close is no longer generation-scoped');
pin('open_reserves_before_permission',/let token = try c\.reserveStart\(generation:generation\)\s*\n\s*guard ensureCameraPermissionSync\(\)/.test(swift),'lifecycle reservation no longer precedes the permission wait');
pin('start_fenced_by_lifecycle_token',/try requireCurrent\(startVersion\)\s*\n\s*s\.startRunning\(\)/.test(swift)&&/guard lifecycleVersion == startVersion else/.test(swift),'start() no longer re-checks its lifecycle token around startRunning');
pin('manager_tables_locked',/private let tableLock = NSLock\(\)/.test(swift)&&(swift.match(/tableLock\.lock\(\); defer \{ tableLock\.unlock\(\) \}/g)||[]).length===2,'releaseRequests/bundles are no longer guarded (parallel /frame downloads race on Swift dictionaries)');
// The JS facade compensates for local-command exposure (H-03): reopening never sends /close, and every /close carries generation.
const js=fs.readFileSync(path.join(root,'app/static/native_capture_layer.js'),'utf8');
pin('facade_close_carries_generation',/\/close[\s\S]{0,200}generation/.test(js),'facade /close no longer sends generation');
pin('facade_reopen_skips_close',/reopening/.test(js),'facade reopen path no longer suppresses /close');
console.log('P1-08 M-04 bridge exposure CHARACTERIZED (OPEN: no request authentication; Swift source facts only, not compiled/run on macOS): '+JSON.stringify(facts));
