# 3PM Windows Native Capture Adapter — HV3 foundation

Windows is a first-class target, not a later port. The shared shot/timeline/evidence logic is platform-neutral. This folder defines the Windows native adapter boundary for Media Foundation while `../native_shared/` owns the OS-independent frame identity/ring-buffer rules.

Required parity with macOS helper:
- roles: `side`, `overhead`, `rear`; any subset may be active;
- per-role capture queue/buffer; secondary views never block Side;
- protocol `3pm-capture-v1`;
- frame identity: `frame_seq`, `capture_epoch_ms`, `master_time_ms`, `media_time_ms`;
- `/health`, `/devices`, `/open`, `/close`, `/diag`, `/release`, `/bundle`, `/frame` semantics;
- browser capture remains fail-open fallback when the native adapter is unavailable.

The Linux build host cannot produce or execute the Windows `.exe`. The shared C++ core is compile-tested here; Media Foundation runtime acceptance must be performed on Windows before a Windows native package is called accepted.
