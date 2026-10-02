#!/bin/bash
# 3PM Form Analyzer X2.8.2 + BLE4.3.8.9.4.1 Trust-First Live Phase + Release Evidence Field Candidate.
# Sensor startup is fail-open: any BLE problem must NOT block the frozen Analyzer.
set +u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE/app" || exit 1

STATIC_DIR="$HERE/app/static"
BRIDGE_DIR="$HERE/app/ble_bridge"
RUNTIME_DIR="$HERE/.3pm_runtime"
BRIDGE_BIN="$RUNTIME_DIR/3PMBLEBridge"
BRIDGE_SRC="$BRIDGE_DIR/3PMBLEBridge.swift"
INFO_PLIST="$BRIDGE_DIR/Info.plist"
BRIDGE_LOG="$HOME/Library/Logs/3PM Form Analyzer BLE.log"
CAPTURE_DIR="$HERE/app/native_capture_bridge"
CAPTURE_SRC="$CAPTURE_DIR/3PMNativeCaptureBridge.swift"
CAPTURE_PLIST="$CAPTURE_DIR/Info.plist"
CAPTURE_BIN="$RUNTIME_DIR/3PMNativeCaptureBridge"
CAPTURE_LOG="$HOME/Library/Logs/3PM Form Analyzer Native Capture.log"
CAPTURE_STATE="$STATIC_DIR/3pm_native_capture_state.json"
mkdir -p "$RUNTIME_DIR" "$(dirname "$BRIDGE_LOG")" 2>/dev/null || true

find_swiftc() {
  SWIFTC_FOUND=""
  SWIFT_DEVELOPER_DIR=""
  SWIFT_SDKROOT=""
  SWIFT_TARGET=""
  local ARCH="$(uname -m 2>/dev/null || echo arm64)"
  [ "$ARCH" = "aarch64" ] && ARCH="arm64"
  local TARGET="${ARCH}-apple-macos13.0"
  local SMOKE_SRC="$RUNTIME_DIR/3pm_swift_smoke.swift"
  local SMOKE_BIN="$RUNTIME_DIR/3pm_swift_smoke"
  printf 'import Foundation\nprint("3pm-swift-ok")\n' > "$SMOKE_SRC" 2>/dev/null || true
  # Test every plausible toolchain instead of selecting the first one that merely exists.
  # This avoids the field failure where Xcode/CLT exposed swiftc but its stdlib/SDK targets mismatched.
  local CANDIDATES=("/Applications/Xcode.app/Contents/Developer" "/Library/Developer/CommandLineTools" "$(xcode-select -p 2>/dev/null || true)")
  local SEEN=""
  for DEV in "${CANDIDATES[@]}"; do
    [ -z "$DEV" ] && continue
    case " $SEEN " in *" $DEV "*) continue;; esac
    SEEN="$SEEN $DEV"
    [ ! -d "$DEV" ] && continue
    local CAND="$(DEVELOPER_DIR="$DEV" /usr/bin/xcrun --sdk macosx -f swiftc 2>/dev/null || true)"
    local SDK="$(DEVELOPER_DIR="$DEV" /usr/bin/xcrun --sdk macosx --show-sdk-path 2>/dev/null || true)"
    [ ! -x "$CAND" ] && continue
    [ ! -d "$SDK" ] && continue
    rm -f "$SMOKE_BIN"
    DEVELOPER_DIR="$DEV" MACOSX_DEPLOYMENT_TARGET=13.0 "$CAND" -swift-version 5 -sdk "$SDK" -target "$TARGET" "$SMOKE_SRC" -o "$SMOKE_BIN" >/dev/null 2>&1
    if [ $? -eq 0 ] && [ -x "$SMOKE_BIN" ]; then
      SWIFTC_FOUND="$CAND";SWIFT_DEVELOPER_DIR="$DEV";SWIFT_SDKROOT="$SDK";SWIFT_TARGET="$TARGET";break
    fi
  done
  rm -f "$SMOKE_SRC" "$SMOKE_BIN" 2>/dev/null || true
}

write_capture_state() {
  local state="$1" detail="$2"
  local safe_detail="${detail//\\/\\\\}"
  safe_detail="${safe_detail//\"/\\\"}"
  printf '{"state":"%s","detail":"%s","updated_ms":%s}\n' "$state" "$safe_detail" "$(($(date +%s)*1000))" > "$CAPTURE_STATE" 2>/dev/null || true
}

start_native_capture() {
  pkill -f "$CAPTURE_BIN" >/dev/null 2>&1 || true
  find_swiftc
  local SWIFTC="$SWIFTC_FOUND"
  write_capture_state "starting" "Preparing native AVFoundation capture"
  if [ ! -x "$CAPTURE_BIN" ] || [ "$CAPTURE_SRC" -nt "$CAPTURE_BIN" ] || [ "$CAPTURE_PLIST" -nt "$CAPTURE_BIN" ]; then
    if [ -z "$SWIFTC" ]; then
      write_capture_state "compiler_unavailable" "swiftc is unavailable; browser fallback active"
      echo "Native Capture: swiftc unavailable; browser temporal fallback will be used."
      return 0
    fi
    write_capture_state "building" "Compiling native AVFoundation helper with verified Swift SDK/toolchain"
    echo "Native Capture: preparing AVFoundation helper with verified macOS SDK/toolchain…"
    rm -f "$CAPTURE_BIN"
    DEVELOPER_DIR="${SWIFT_DEVELOPER_DIR:-}" MACOSX_DEPLOYMENT_TARGET=13.0 "$SWIFTC" -swift-version 5 -sdk "$SWIFT_SDKROOT" -target "$SWIFT_TARGET" -module-cache-path "$RUNTIME_DIR/swift-module-cache-capture" "$CAPTURE_SRC" -o "$CAPTURE_BIN" \
      -framework Foundation -framework AVFoundation -framework CoreImage -framework ImageIO \
      -framework Network -framework CoreMedia -framework CoreVideo -framework Vision \
      -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$CAPTURE_PLIST" >>"$CAPTURE_LOG" 2>&1
    local BUILD_STATUS=$?
    if [ "$BUILD_STATUS" -ne 0 ]; then
      rm -f "$CAPTURE_BIN"
      local BUILD_ERR="$(tail -n 12 "$CAPTURE_LOG" 2>/dev/null | sed '/^[[:space:]]*$/d' | tail -n 1 | tr '\t\r\n' '   ' | cut -c1-360)"
      [ -z "$BUILD_ERR" ] && BUILD_ERR="compiler returned a non-zero status"
      write_capture_state "build_failed" "Native helper build failed: $BUILD_ERR · browser fallback active"
      echo "Native Capture: helper build failed; browser temporal fallback remains available."
      echo "Compiler: $BUILD_ERR"
      echo "See: $CAPTURE_LOG"
      return 0
    fi
    chmod +x "$CAPTURE_BIN" 2>/dev/null || true
    /usr/bin/codesign --force --sign - "$CAPTURE_BIN" >>"$CAPTURE_LOG" 2>&1 || true
  fi
  xattr -d com.apple.quarantine "$CAPTURE_BIN" >/dev/null 2>&1 || true
  printf '\n=== 3PM Native Capture start %s ===\n' "$(date)" >>"$CAPTURE_LOG" 2>&1 || true
  "$CAPTURE_BIN" >>"$CAPTURE_LOG" 2>&1 &
  CAPTURE_PID=$!
  write_capture_state "starting" "Native helper process started"
  echo "Native Capture: helper started (PID $CAPTURE_PID)."
  local READY=0
  for _ in $(seq 1 80); do
    if /usr/bin/curl -fsS --max-time 0.25 "http://127.0.0.1:48735/health" >/dev/null 2>&1; then READY=1; break; fi
    if ! kill -0 "$CAPTURE_PID" 2>/dev/null; then break; fi
    sleep 0.10
  done
  if [ "$READY" = "1" ]; then
    write_capture_state "ready" "Native AVFoundation helper health is ready"
    echo "Native Capture: health endpoint READY."
  else
    write_capture_state "health_failed" "Native helper did not become reachable; browser fallback active"
    echo "Native Capture: health endpoint unavailable; browser temporal fallback remains available."
    echo "See: $CAPTURE_LOG"
  fi
}

write_bridge_state() {
  local state="$1" detail="$2"
  local safe_detail="${detail//\"/\\\"}"
  printf '{"transport":"BLE","bridge":"launcher","state":"%s","detail":"%s","connected":false,"updated_ms":0}\n' "$state" "$safe_detail" > "$STATIC_DIR/3pm_ble_state.json" 2>/dev/null || true
}

start_ble_bridge() {
  pkill -f "$BRIDGE_BIN" >/dev/null 2>&1 || true
  find_swiftc
  local SWIFTC="$SWIFTC_FOUND"

  if [ ! -x "$BRIDGE_BIN" ] || [ "$BRIDGE_SRC" -nt "$BRIDGE_BIN" ]; then
    if [ -z "$SWIFTC" ]; then
      write_bridge_state "native_unavailable" "Native BLE helper could not be built because swiftc is not installed. Analyzer will still open; Chrome/Edge Web Bluetooth fallback remains available in Devices."
      echo "BLE: native helper compiler not found; continuing camera-only / browser BLE fallback."
      return 0
    fi
    echo "BLE: preparing native CoreBluetooth helper (first run only)…"
    "$SWIFTC" "$BRIDGE_SRC" -o "$BRIDGE_BIN" -framework Foundation -framework CoreBluetooth -framework Network \
      -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$INFO_PLIST" >>"$BRIDGE_LOG" 2>&1
    if [ $? -ne 0 ]; then
      rm -f "$BRIDGE_BIN"
      write_bridge_state "native_build_failed" "Native BLE helper build failed. Analyzer will still open. See ~/Library/Logs/3PM Form Analyzer BLE.log"
      echo "BLE: helper build failed; continuing without blocking Analyzer."
      return 0
    fi
    chmod +x "$BRIDGE_BIN" 2>/dev/null || true
    /usr/bin/codesign --force --sign - "$BRIDGE_BIN" >>"$BRIDGE_LOG" 2>&1 || true
  fi

  xattr -d com.apple.quarantine "$BRIDGE_BIN" >/dev/null 2>&1 || true
  "$BRIDGE_BIN" --out "$STATIC_DIR" >>"$BRIDGE_LOG" 2>&1 &
  BRIDGE_PID=$!
  echo "BLE: native bridge started (PID $BRIDGE_PID)."
}

start_native_capture
start_ble_bridge

echo "Starting frozen X2.8.2 Analyzer. Sensor failures cannot block camera analysis."
export THREEPM_BLE_WRAPPED=1
/bin/bash "$HERE/internal/start_analyzer.sh"
STATUS=$?

if [ -n "${BRIDGE_PID:-}" ]; then kill "$BRIDGE_PID" >/dev/null 2>&1 || true; fi
if [ -n "${CAPTURE_PID:-}" ]; then kill "$CAPTURE_PID" >/dev/null 2>&1 || true; fi
exit $STATUS
