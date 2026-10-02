# Known Limitations — R8 P1-06 Pure/Offline Repair

1. This tree remains a development candidate, not a release and not approved for live shooting.
2. Legacy production findings M01-M04 and F01-F12 remain open unless explicitly shown otherwise in the closure matrix.
3. The shadow event log and evidence writer are in-memory test doubles. IndexedDB transactional single-writer, fencing/lease ownership, journal, quota handling and crash recovery are not implemented here; D04/D24 are not claimed complete.
4. Scheduler now enforces a worker-dispatch boundary, but actual Web Worker/GPU/OS compute isolation and Side p95/p99 runtime budgets have not been measured.
5. Node and browser/WebCrypto entrypoints share validation code and negative WebCrypto vectors pass. `/usr/bin/chromium` headless did not terminate in this container in two hard-timeout attempts, so actual Chromium negative-parity is BLOCKED/NOT RUN here.
6. No macOS or Windows real camera runtime was run. Windows native adapter remains subject to the prior E_NOTIMPL/runtime limitations. Compile/syntax sanity is not runtime acceptance.
7. No real-archer or labeled hold-out field dataset evaluation was run; no release/let-down accuracy claim is made.
8. Projector repairs cover strict eligibility, source-generation cadence, deterministic order and bounded oracle tests. This is not a formal proof for all candidate cardinalities/configurations.
9. Archive importer is an in-memory validation/staging test double, not filesystem extraction or durable namespace import.
10. The owner-approved `pose.js` trace seam remains outside the original frozen hash. Three legacy tests still stop at the old pose hash sentinel; diagnostic copies substituting only the approved current hash pass downstream assertions. Original tests remain unchanged.
11. Equipment catalog remains EL18 / 683 records; Equipment/Athlete/Session were not modified in this repair.
