# P1-01 status — strict contracts / identity / clock

Status: pure shadow implementation; not wired to production.

Implemented:
- strict FrameEnvelope validation with explicit-null semantics;
- source sample FrameUID validation independent of timestamp/pixel hash;
- source/arrival/mapped clock fields kept semantically separate;
- mapping id/version/status and uncertainty validation;
- affine clock mapping utility with bounded valid tick interval and discontinuity result;
- deterministic canonical JSON hashing utility for future config/schema/event digests;
- tests for null/undefined/boolean/empty identity rejection, valid zero clock semantics, 25 distinct UIDs, mapping interval/discontinuity and canonical hashing.

Not implemented/promoted here:
- production source-time FSM;
- live native clock calibration;
- role ring/scheduler;
- shot decision owner;
- evidence writer/projector;
- Windows native runtime;
- production archive migration.

Tests:
- `test_contract_foundation.js`: PASS
- `test_p101_contract_clock.js`: PASS
- production legacy path: not wired to these modules
