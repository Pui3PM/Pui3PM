'use strict';
// R8 P1-08 M-04 (OPEN, characterization): native capture bridge network exposure.
// The Swift bridge cannot be compiled or run in the Linux build environment (no swiftc, no AVFoundation), so P1-08 does
// NOT edit it. This test pins the audited facts so that (a) the field prerequisite in FIELD_TEST_INSTRUCTIONS stays
// justified, and (b) whoever hardens the bridge must update this test, the prerequisite and the docs together.
// When a fact below changes, the assertion message names what to update. It never asserts the exposure is acceptable.
// Usage: node app/tests/test_p108_m04_bridge_exposure.js [path-to-package-root]
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const swift=fs.readFileSync(path.join(root,'app/native_capture_bridge/3PMNativeCaptureBridge.swift'),'utf8');
const facts={};
const pin=(name,cond,msg)=>{facts[name]=!!cond;assert(cond,`M-04 fact changed (${name}): ${msg} -> update test_p108_m04_bridge_exposure.js, KNOWN_LIMITATIONS M-04 and FIELD_TEST_INSTRUCTIONS prerequisite`);};
pin('port_48735',/defaultPort: UInt16 = 48735/.test(swift),'bridge port is no longer 48735');
pin('listener_no_interface_constraint',/NWListener\(using:\.tcp,on:NWEndpoint\.Port/.test(swift)&&!/requiredInterfaceType\s*=\s*\.loopback|requiredLocalEndpoint|NWEndpoint\.hostPort\(host:\s*"127\.0\.0\.1"/.test(swift),
  'listener now constrains interface/endpoint (loopback hardening landed)');
pin('acao_wildcard',/Access-Control-Allow-Origin: \*/.test(swift),'CORS is no longer wildcard');
pin('private_network_allowed',/Access-Control-Allow-Private-Network: true/.test(swift),'Private Network Access grant removed');
// The request parser reads exactly one header (content-length); Origin/Authorization/token headers are never read.
const headerReads=[...swift.matchAll(/lowercased\(\)\s*==\s*"([^"]+)"/g)].map(m=>m[1]);
pin('only_content_length_header_read',headerReads.length===1&&headerReads[0]==='content-length','parser now reads other headers: '+JSON.stringify(headerReads));
pin('no_origin_check',!/"origin"/i.test(swift),'bridge now reads the Origin header');
pin('no_auth',!/"authorization"|bearer|x-3pm-token|sharedSecret/i.test(swift),'bridge now has request authentication');
pin('close_unscoped',/func close\(_ body:\[String:Any\]\) -> \[String:Any\] \{ let role=\(body\["role"\] as\? String\) \?\? "side"; roles\[role\]\?\.stop\(\)/.test(swift),
  '/close now checks generation (stale-close hardening landed in Swift)');
pin('start_stops_previous',/func start\(deviceLabel[^{]*\{\s*stop\(\)/.test(swift),'open no longer replaces the previous capture');
// The JS facade compensates for unscoped /close (H-03): reopening never sends /close, and every /close carries generation.
const js=fs.readFileSync(path.join(root,'app/static/native_capture_layer.js'),'utf8');
pin('facade_close_carries_generation',/\/close[\s\S]{0,200}generation/.test(js),'facade /close no longer sends generation');
pin('facade_reopen_skips_close',/reopening/.test(js),'facade reopen path no longer suppresses /close');
console.log('P1-08 M-04 bridge exposure CHARACTERIZED (OPEN, not fixed): '+JSON.stringify(facts));
