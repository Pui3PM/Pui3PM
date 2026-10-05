# Post-P108 closure matrix

| Item | Status | Evidence / remaining gate |
|---|---|---|
| H02 identity | PARTIAL / integration gate blocked | New adversarial tests and browser identity persistence PASS; legacy unsafe identity assertions FAIL; historic anonymous records lack proof |
| H03 native lifecycle | PARTIAL | Facade/model/source fences PASS; actual Swift compile/runtime NOT RUN |
| M06 acknowledgement | JS software PASS | /diag status/generation/active/error negatives PASS; native hardware NOT RUN |
| Analyzer End 6 / Impact End 3 | browser PASS | Actual render and scoring chip grouping test |
| Evidence rail 25 | browser PASS | Real/Missing controls and persistent profile restore |
| Persistence / bytes | browser PASS | Synthetic Blob bytes in real IndexedDB; process restart; real backend NOT RUN |
| M01 high FPS | OPEN | 30/60/120/240 identity cores PASS, production frozen sampler/hardware not accepted |
| M04 bridge exposure | PARTIAL | Loopback and Origin source hardening; native verification/authentication OPEN |
| Legacy regression gate | FAIL | Original assertions retained; no false-green |
| Mac / Windows / field | NOT RUN | No target OS/camera/archer environment |
