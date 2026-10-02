# P0-07 — Native capability / security / concurrency inventory

Status: source-level inventory only. No native production code changed.

## macOS Swift helper

Observed source facts:

1. `HTTPServer` constructs `NWListener(using:.tcp,on:port)` without an explicit loopback interface/host binding in the inspected source. The console message says 127.0.0.1, but the constructor itself does not prove loopback-only binding.
2. Responses include `Access-Control-Allow-Origin: *`, private-network CORS allowance, and no inspected bearer/capability token or Origin allowlist for frame/control endpoints.
3. `CaptureManager` declares `private let queue = DispatchQueue(label:"com.3pm.capture.manager")`, but source search finds no `queue.sync`/`queue.async` use. Mutable `roles`, `releaseRequests`, and `bundles` are reached from per-connection queues. This is a source-level concurrency risk, not proof of a field race.
4. Release requests are identified using role + rounded release epoch + UUID suffix and later resolved through mutable request/bundle dictionaries. Generation is checked before bundle materialization, which is useful, but linkage still centers on release epoch/request IDs rather than the Phase 1 run/cycle/frame identity contract.
5. Bundle frame responses expose `frame_seq`, epoch, process master time and media time. Their existence is useful evidence, but current source does not prove all clock domains are calibrated to a single session master timeline.
6. `RoleCapture` already uses separate capture/encode/Vision queues per role; this is worth preserving conceptually while Phase 1 formalizes ownership and conformance.

Required before any new live native shadow promotion:
- explicit loopback-only bind verified on IPv4/IPv6 target runtime;
- per-launch scoped capability token and origin allowlist;
- serialized/actor ownership for manager mutable state;
- generation-aware stale reply fencing;
- request/body/queue limits and cancellation/expiry tests;
- macOS SDK/runtime race and socket tests.

## Windows Media Foundation

`MediaFoundationRoleCapture::start(...)` currently returns `E_NOTIMPL`. Therefore:
- Windows native capture runtime is `not-supported` in this baseline, not `passed`;
- shared header/sentinel compilation does not count as Windows runtime acceptance;
- Phase 1 should share schemas/conformance/pure decision/evidence semantics first, then implement the OS adapter in a Windows test target.

## Shared native protocol

`capture_protocol.hpp` currently defines `FrameClock` with `frameSeq`, `captureEpochMs`, `masterTimeMs`, `mediaTimeMs`. This is a useful HV3 foundation but remains weaker than the new FrameEnvelope contract because it has no explicit clockId, source timebase, mapping revision/uncertainty, streamGeneration, sourceId or FrameUID.

## P0 conclusion

No native production repair is performed in P0-07. These items become P1 native adapter/security gates. The source-level findings confirm that live native shadow must remain blocked until the boundary is secured and concurrency ownership is made explicit.
