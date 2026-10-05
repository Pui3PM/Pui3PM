# Decision Log — Claude Repair Work Block

- D-CR01: Keep production authority frozen; repair only `app/shadow/**`, phase01 tests, package/QA truth, and approved trace-hash gate metadata.
- D-CR02: The owner-approved `pose.js` trace-only narrow thaw uses active artifact SHA-256 `fe8cafaea88833c6a5068ebbefad7962b0a32ec826f61cd406d180ec72518f02`; frozen baseline remains `22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d`. Delivery gates pin the approved current hash while `test_pose_narrow_thaw.js` must reconstruct the frozen baseline byte-for-byte.
- D-CR03: Scheduler accepts serializable worker descriptors only; function jobs are rejected. Executor completion has timeout/stale-generation/observer containment semantics. This does not claim a real Web Worker runtime has been exercised.
- D-CR04: Ring pressure drops with explicit reason instead of throwing the shooting path; leased-byte reservation and TTL prevent permanent pinning in the pure implementation.
- D-CR05: Projector follows contract objective: maximum cardinality → minimum total absolute delta → lexicographic assignment. The old 3360-case test is explicitly only input-reversal invariance; a separate 10,000-case brute-force optimality oracle is authoritative for this checkpoint.
- D-CR06: F02 reporting is split: budget-core mitigation is green 25/25, legacy upstream temporal gap remains `OPEN_CONFIRMED` 1/13. Do not call F02 closed end-to-end.
- D-CR07: Development package officially contains `DEV_NOT_RELEASE.txt`; package contract class is `development_not_release`.
- D-CR08: Browser bundle/VM conformance is not Chromium acceptance. Mac/Windows/native camera/real archer/labeled field remain NOT RUN.
