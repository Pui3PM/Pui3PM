#!/bin/bash
# Internal analyzer startup. Public entrypoint is START_3PM.command only.
# Direct developer invocation still starts the native services.
if [ "${THREEPM_BLE_WRAPPED:-0}" != "1" ]; then
  HERE="$(cd "$(dirname "$0")/.." && pwd)"
  exec /bin/bash "$HERE/internal/start_services.sh"
fi
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE/app"

BUILD_TAG="mac-20261001-r8-merge-candidate-dev"
EXPECTED_ABOUT='Version 5.0.0 X2.8.2 · Trust-First Live Phase + Release Evidence Field Candidate · Release Proof'
EXPECTED_PREV='id="prevFrameBtn"'
EXPECTED_PAN='id="replayPanUpBtn"'
EXPECTED_CONSISTENCY='id="consistencyPanel"'
EXPECTED_BAR='class="review-control-bar"'
EXPECTED_CAPTURE_BUILD="const BUILD_VERSION='BLE4.3.8.9.5.4';"
EXPECTED_ADAPTIVE="const VERSION='BLE4.3.8.9.5.7-adaptive-release-v16';"
EXPECTED_ANCHOR="const VERSION='BLE4.3.8.9.2-anchor-bridge-v1';"
EXPECTED_SHOTLIST="const VERSION='BLE4.3.8.9.2-shot-list-ux-v1';"
EXPECTED_HV3_TIMELINE="HV3-camera-timeline-v1"
EXPECTED_CAPTURE_PROTOCOL="3pm-capture-v1"

echo "========================================================"
echo "  3PM Archery Form Analyzer V5 X2.8.2 - Mac R8 Merge Candidate DEV"
echo "  Trust-First Live Phase + Release Evidence Field Candidate + KF25 Review"
echo "========================================================"
echo "Field-validation build - do not call Stable/RC until real-camera validation passes."
echo ""

# Preflight prevents a mislabeled/partial folder from launching.
if ! grep -Fq "$EXPECTED_ABOUT" "$HERE/app/static/index.html" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_PREV" "$HERE/app/static/index.html" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_PAN" "$HERE/app/static/index.html" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_CONSISTENCY" "$HERE/app/static/index.html" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_BAR" "$HERE/app/static/index.html" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_CAPTURE_BUILD" "$HERE/app/static/capture_integrity_layer.js" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_ADAPTIVE" "$HERE/app/static/adaptive_release_core.js" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_ANCHOR" "$HERE/app/static/real_bow_anchor_bridge_core.js" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_SHOTLIST" "$HERE/app/static/shot_list_ux_layer.js" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_HV3_TIMELINE" "$HERE/app/static/camera_timeline_core.js" 2>/dev/null || \
   ! grep -Fq "$EXPECTED_CAPTURE_PROTOCOL" "$HERE/app/native_shared/capture_protocol_v1.json" 2>/dev/null; then
  echo "ERROR: X2.8.2 UI preflight failed."
  echo "This folder does not contain the expected unified replay controls / Consistency UI."
  echo "Please use the complete X2.8.2 release folder."
  read -r -p "Press Return to close..." _
  exit 2
fi

echo "Preflight: R7 transaction signatures + HV3 three-camera/timeline signatures verified."

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  RUNTIME_NAME="3PM_Form_Analyzer_arm64"
  EXPECTED_RUNTIME_SHA="babd2ba02406a6a42a9f62f1df77dc84056fc890b3556a86d4d1a50b76a5913b"
else
  RUNTIME_NAME="3PM_Form_Analyzer_x64"
  EXPECTED_RUNTIME_SHA="5c41ebf790ef47ea59c2be76b4febb5ef3ee9c977166dc2065fc5f523e3eddf4"
fi
BIN="$HERE/app/$RUNTIME_NAME"

runtime_sha() {
  /usr/bin/shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
}

recover_frozen_runtime() {
  if [ -f "$BIN" ] && [ "$(runtime_sha "$BIN")" = "$EXPECTED_RUNTIME_SHA" ]; then
    return 0
  fi

  echo "ERROR: Bundled runtime is missing or failed SHA-256 verification."
  echo "Extract a fresh complete package; do not copy files from older builds."
  echo "Expected: app/$RUNTIME_NAME"

  return 1
}

if ! recover_frozen_runtime; then
  read -r -p "Press Return to close…" _
  exit 3
fi

chmod +x "$BIN" 2>/dev/null || true
xattr -d com.apple.quarantine "$BIN" 2>/dev/null || true

echo "Architecture: $ARCH"
echo "Frozen runtime SHA-256 verified: $(runtime_sha "$BIN")"
echo "Closing older 3PM Form Analyzer runtimes..."
pkill -f "3PM_Form_Analyzer_arm64" 2>/dev/null || true
pkill -f "3PM_Form_Analyzer_x64" 2>/dev/null || true
sleep 1

# Close only stale local Analyzer tabs. Do not touch unrelated browser tabs.
close_old_analyzer_tabs() {
/usr/bin/osascript >/dev/null 2>&1 <<'APPLESCRIPT' || true
if application "Google Chrome" is running then
  tell application "Google Chrome"
    repeat with w in windows
      repeat with i from (count of tabs of w) to 1 by -1
        try
          set t to tab i of w
          set u to URL of t
          set ttl to title of t
          if ((u starts with "http://127.0.0.1:") or (u starts with "http://localhost:")) and (ttl contains "3PM Archery Form Analyzer") then close t
        end try
      end repeat
    end repeat
  end tell
end if
if application "Safari" is running then
  tell application "Safari"
    repeat with w in windows
      repeat with i from (count of tabs of w) to 1 by -1
        try
          set t to tab i of w
          set u to URL of t
          set ttl to name of t
          if ((u starts with "http://127.0.0.1:") or (u starts with "http://localhost:")) and (ttl contains "3PM Archery Form Analyzer") then close t
        end try
      end repeat
    end repeat
  end tell
end if
APPLESCRIPT
}

close_runtime_port_tabs() {
  local PORT_TO_CLOSE="$1"
  /usr/bin/osascript - "$PORT_TO_CLOSE" >/dev/null 2>&1 <<'APPLESCRIPT' || true
on run argv
  set p to item 1 of argv
  set a to "http://127.0.0.1:" & p
  set b to "http://localhost:" & p
  if application "Google Chrome" is running then
    tell application "Google Chrome"
      repeat with w in windows
        repeat with i from (count of tabs of w) to 1 by -1
          try
            set u to URL of tab i of w
            if (u starts with a) or (u starts with b) then close tab i of w
          end try
        end repeat
      end repeat
    end tell
  end if
  if application "Safari" is running then
    tell application "Safari"
      repeat with w in windows
        repeat with i from (count of tabs of w) to 1 by -1
          try
            set u to URL of tab i of w
            if (u starts with a) or (u starts with b) then close tab i of w
          end try
        end repeat
      end repeat
    end tell
  end if
end run
APPLESCRIPT
}

close_old_analyzer_tabs

echo "Starting X2.8.2 runtime..."
echo "Keep this Terminal window open while the app is running."
echo ""
export THREEPM_FORM_NO_BROWSER=1
"$BIN" &
PID=$!

# Wait for the frozen Dev4 runtime to expose its local TCP listener.
PORT=""
for _ in $(seq 1 80); do
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  PORT="$(/usr/sbin/lsof -Pan -p "$PID" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {n=$9; sub(/^.*:/,"",n); if(n ~ /^[0-9]+$/){print n; exit}}')"
  [ -n "$PORT" ] && break
  sleep 0.25
done

if [ -n "$PORT" ]; then
  URL="http://127.0.0.1:${PORT}/?build=${BUILD_TAG}&launch=$(date +%s)"
  echo "Opening verified X2.8.2 UI: $URL"
  # The frozen runtime supports THREEPM_FORM_NO_BROWSER=1, so it does not race
  # the launcher by opening a second tab. Open exactly one preferred UI here.
  if [ -d "/Applications/Google Chrome.app" ]; then
    echo "3PM UI browser: Google Chrome"
    /usr/bin/open -a "Google Chrome" "$URL" >/dev/null 2>&1 || /usr/bin/open "$URL" >/dev/null 2>&1 || true
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    echo "3PM UI browser: Microsoft Edge"
    /usr/bin/open -a "Microsoft Edge" "$URL" >/dev/null 2>&1 || /usr/bin/open "$URL" >/dev/null 2>&1 || true
  else
    echo "WARNING: Chrome/Edge not found. Using the default browser. Native AVFoundation evidence remains independent; browser fallback is available if the native bridge cannot start."
    /usr/bin/open "$URL" >/dev/null 2>&1 || true
  fi
else
  echo "WARNING: Could not detect the local runtime port automatically."
  echo "If the browser opens an old Analyzer tab, close it and relaunch this command."
fi

wait "$PID"
