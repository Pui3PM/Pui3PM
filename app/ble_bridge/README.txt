3PM BLE Bridge
==============
This helper is isolated from the frozen Analyzer camera-analysis runtime.
START_3PM_FA.command compiles it locally on macOS the first time if swiftc is available,
then starts it in the background. It uses CoreBluetooth to auto-discover and reconnect
with the trusted 3PM Bow Sensor BLE service.

If native compilation is unavailable, the Analyzer still starts normally. Chrome/Edge
Web Bluetooth can be used as a fallback from the small Bow Sensor section injected at
the bottom of Settings. Sensor transport never gates camera Capture/Release.
