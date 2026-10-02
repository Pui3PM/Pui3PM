import Foundation
import CoreBluetooth
import Network

private let serviceUUID = CBUUID(string: "3a500001-7c8e-4d2a-9b11-0f3a20260001")
private let sampleUUID = CBUUID(string: "3a500002-7c8e-4d2a-9b11-0f3a20260001")
private let controlUUID = CBUUID(string: "3a500003-7c8e-4d2a-9b11-0f3a20260001")
private let identityUUID = CBUUID(string: "3a500004-7c8e-4d2a-9b11-0f3a20260001")
private let statusUUID = CBUUID(string: "3a500005-7c8e-4d2a-9b11-0f3a20260001")
private let summaryUUID = CBUUID(string: "3a500006-7c8e-4d2a-9b11-0f3a20260001")
private let traceUUID = CBUUID(string: "3a500007-7c8e-4d2a-9b11-0f3a20260001")

private struct Sample {
    let seq: UInt16
    let deviceMs: UInt32
    let hostMs: Int64
    let ax: Double
    let ay: Double
    let az: Double
    let gx: Double
    let gy: Double
    let gz: Double
    let synthetic: Bool
    let flags: UInt8

    var jsonArray: [Any] {
        [Int(seq), Int(deviceMs), hostMs, ax, ay, az, gx, gy, gz, synthetic ? 1 : 0, Int(flags)]
    }
}

private struct TrustRecord: Codable {
    var peripheralUUID: String
    var deviceID: String?
}

private final class AtomicJSONWriter {
    let outputDir: URL
    init(outputDir: URL) { self.outputDir = outputDir }

    func write(_ object: Any, named name: String) {
        guard JSONSerialization.isValidJSONObject(object) else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: object, options: [])
            let dst = outputDir.appendingPathComponent(name)
            let tmp = outputDir.appendingPathComponent(".\(name).tmp")
            try data.write(to: tmp, options: .atomic)
            _ = try? FileManager.default.removeItem(at: dst)
            try FileManager.default.moveItem(at: tmp, to: dst)
        } catch {
            fputs("3PM BLE Bridge write error: \(error)\n", stderr)
        }
    }
}


private final class LocalContextServer {
    private let listener: NWListener
    private weak var bridge: BowBLEBridge?

    init(bridge: BowBLEBridge, port: UInt16 = 39742) throws {
        self.bridge = bridge
        self.listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
        listener.newConnectionHandler = { [weak self] connection in self?.handle(connection) }
        listener.stateUpdateHandler = { state in
            if case .failed(let error) = state { fputs("3PM context server failed: \(error)\n", stderr) }
        }
        listener.start(queue: .main)
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .main)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, _, _ in
            guard let self, let data, let request = String(data: data, encoding: .utf8) else { self?.respond(connection, 400, "bad request"); return }
            let first = request.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? ""
            let parts = first.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: " ")
            guard parts.count >= 2 else { self.respond(connection, 400, "bad request"); return }
            let method = String(parts[0]), target = String(parts[1])
            if method == "OPTIONS" { self.respond(connection, 204, ""); return }
            guard method == "GET", let comps = URLComponents(string: "http://127.0.0.1\(target)") else { self.respond(connection, 404, "not found"); return }
            let q = comps.queryItems ?? []
            if comps.path == "/context" {
                guard let payload = q.first(where: { $0.name == "data" })?.value else { self.respond(connection, 400, "missing context"); return }
                bridge?.syncContextPayload(payload) { [weak self] ok, message in self?.respond(connection, ok ? 200 : 409, message) }
                return
            }
            if comps.path == "/history" {
                let limit = UInt8(max(1, min(16, Int(q.first(where: { $0.name == "limit" })?.value ?? "16") ?? 16)))
                bridge?.requestHistoryReplay(limit: limit) { [weak self] ok, message in self?.respond(connection, ok ? 200 : 409, message) }
                return
            }
            if comps.path == "/trace" {
                guard let evs = q.first(where: { $0.name == "event" })?.value, let ids = q.first(where: { $0.name == "id" })?.value,
                      let eventType = UInt8(evs), let recordID = UInt32(ids), (eventType == 1 || eventType == 2) else {
                    self.respond(connection, 400, "missing trace identity"); return
                }
                bridge?.requestTraceReplay(eventType: eventType, recordID: recordID) { [weak self] ok, message in self?.respond(connection, ok ? 200 : 409, message) }
                return
            }
            self.respond(connection, 404, "not found")
        }
    }

    private func respond(_ connection: NWConnection, _ status: Int, _ body: String) {
        let reason = status == 200 ? "OK" : status == 204 ? "No Content" : status == 409 ? "Conflict" : status == 404 ? "Not Found" : "Bad Request"
        let bytes = body.data(using: .utf8) ?? Data()
        let head = "HTTP/1.1 \(status) \(reason)\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nCache-Control: no-store\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: \(bytes.count)\r\nConnection: close\r\n\r\n"
        var out = head.data(using: .utf8) ?? Data(); out.append(bytes)
        connection.send(content: out, completion: .contentProcessed { _ in connection.cancel() })
    }
}

private final class BowBLEBridge: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var dataChar: CBCharacteristic?
    private var controlChar: CBCharacteristic?
    private var identityChar: CBCharacteristic?
    private var statusChar: CBCharacteristic?
    private var summaryChar: CBCharacteristic?
    private var traceChar: CBCharacteristic?

    private let writer: AtomicJSONWriter
    private let trustURL: URL
    private var trust: TrustRecord?
    private var samples: [Sample] = []
    private var summaryFrames: [[Any]] = []
    private var traceFrames: [[Any]] = []
    private let sampleLock = NSLock()
    private var lastSeq: UInt16?
    private var dropped = 0
    private var total = 0
    private var revision = 0
    private var state = "starting"
    private var detail = ""
    private var deviceID: String?
    private var firmware = "unknown"
    private var dataMode = "unknown"
    private var sensorRecordCount: Int?
    private var sensorShotCount: Int?
    private var connectedSinceMs: Int64?
    private var lastPacketMs: Int64?
    private var flushTimer: Timer?
    private var reconnectWork: DispatchWorkItem?
    private var contextTxId: UInt16 = 0
    private var controlWriteQueue: [Data] = []
    private var controlWriteCompletion: ((Bool, String) -> Void)?
    private var contextServer: LocalContextServer?

    init(outputDir: URL) {
        writer = AtomicJSONWriter(outputDir: outputDir)
        let appSupport = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/3PM Form Analyzer", isDirectory: true)
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        trustURL = appSupport.appendingPathComponent("bow_sensor_ble_trust.json")
        super.init()
        trust = loadTrust()
        central = CBCentralManager(delegate: self, queue: nil)
        flushTimer = Timer.scheduledTimer(withTimeInterval: 0.10, repeats: true) { [weak self] _ in
            self?.flushFiles()
        }
        RunLoop.main.add(flushTimer!, forMode: .common)
        flushFiles()
        contextServer = try? LocalContextServer(bridge: self)
    }

    private func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000.0) }

    private func loadTrust() -> TrustRecord? {
        guard let d = try? Data(contentsOf: trustURL) else { return nil }
        return try? JSONDecoder().decode(TrustRecord.self, from: d)
    }

    private func saveTrust(_ record: TrustRecord) {
        trust = record
        if let d = try? JSONEncoder().encode(record) { try? d.write(to: trustURL, options: .atomic) }
    }

    private func setState(_ s: String, _ message: String = "") {
        state = s
        detail = message
        flushFiles()
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            startScan()
        case .poweredOff: setState("bluetooth_off", "Turn Bluetooth on. Analyzer remains camera-only.")
        case .unauthorized: setState("unauthorized", "Bluetooth permission is not granted. Analyzer remains camera-only.")
        case .unsupported: setState("unsupported", "This Mac does not expose BLE through CoreBluetooth.")
        default: setState("waiting_bluetooth", "Waiting for Bluetooth…")
        }
    }

    private func startScan() {
        reconnectWork?.cancel()
        guard central.state == .poweredOn else { return }
        setState("scanning", trust == nil ? "Looking for a 3PM Bow Sensor…" : "Looking for trusted 3PM Bow Sensor…")
        central.scanForPeripherals(withServices: [serviceUUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    func centralManager(_ central: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        if let trusted = trust, trusted.peripheralUUID != p.identifier.uuidString { return }
        central.stopScan()
        peripheral = p
        p.delegate = self
        setState(trust == nil ? "enrolling" : "connecting", "Connecting to \(p.name ?? "3PM Bow Sensor")…")
        central.connect(p, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect p: CBPeripheral) {
        connectedSinceMs = nowMs()
        lastSeq = nil
        dropped = 0
        total = 0
        setState("discovering", "BLE connected; discovering 3PM service…")
        p.discoverServices([serviceUUID])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) {
        setState("connect_failed", error?.localizedDescription ?? "Could not connect")
        scheduleReconnect()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        dataChar = nil; controlChar = nil; identityChar = nil; statusChar = nil; summaryChar = nil; traceChar = nil
        controlWriteQueue.removeAll(); let pendingContext = controlWriteCompletion; controlWriteCompletion = nil; pendingContext?(false, "Sensor disconnected")
        if let error {
            let ns = error as NSError
            setState("disconnected", "\(ns.localizedDescription) [\(ns.domain) \(ns.code)] · reconnecting automatically…")
        } else {
            setState("disconnected", "Sensor disconnected; reconnecting automatically…")
        }
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        let work = DispatchWorkItem { [weak self] in self?.startScan() }
        reconnectWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: work)
    }

    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error { setState("service_error", error.localizedDescription); return }
        guard let svc = p.services?.first(where: { $0.uuid == serviceUUID }) else {
            setState("service_missing", "3PM Bow Sensor service not found")
            central.cancelPeripheralConnection(p)
            return
        }
        p.discoverCharacteristics([sampleUUID, controlUUID, identityUUID, statusUUID, summaryUUID, traceUUID], for: svc)
    }

    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error = error { setState("characteristic_error", error.localizedDescription); return }
        for c in service.characteristics ?? [] {
            if c.uuid == sampleUUID { dataChar = c }
            else if c.uuid == controlUUID { controlChar = c }
            else if c.uuid == identityUUID { identityChar = c }
            else if c.uuid == statusUUID { statusChar = c }
            else if c.uuid == summaryUUID { summaryChar = c }
            else if c.uuid == traceUUID { traceChar = c }
        }
        guard let sample = dataChar, let control = controlChar else {
            setState("characteristic_missing", "Required BLE characteristics are missing")
            central.cancelPeripheralConnection(p)
            return
        }
        p.setNotifyValue(true, for: sample)
        if let identityChar { p.readValue(for: identityChar) }
        if let statusChar { p.readValue(for: statusChar) }
        if let summaryChar { p.setNotifyValue(true, for: summaryChar) }
        if let traceChar { p.setNotifyValue(true, for: traceChar) }
        sendClockSync(control: control, peripheral: p)
        setState("subscribing", "BLE connected; enabling 3PM sample notifications…")
    }

    func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == sampleUUID else { return }
        if let error {
            setState("notify_error", error.localizedDescription)
            central.cancelPeripheralConnection(p)
            return
        }
        if characteristic.isNotifying {
            setState("connected", "Receiving physical S3 BLE stream")
        } else {
            setState("notify_error", "3PM sample notifications did not remain enabled")
            central.cancelPeripheralConnection(p)
        }
    }

    private func sendClockSync(control: CBCharacteristic, peripheral p: CBPeripheral) {
        var bytes = Data([0x10])
        var epoch = UInt64(max(0, nowMs())).littleEndian
        withUnsafeBytes(of: &epoch) { bytes.append(contentsOf: $0) }
        let writeType: CBCharacteristicWriteType = control.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        p.writeValue(bytes, for: control, type: writeType)
    }


    private func sendSimpleControl(_ bytes: [UInt8], completion: @escaping (Bool, String) -> Void) {
        guard state == "connected", let p = peripheral, let control = controlChar else { completion(false, "Bow Sensor is not connected"); return }
        let type: CBCharacteristicWriteType = control.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        p.writeValue(Data(bytes), for: control, type: type)
        completion(true, "ok")
    }

    func requestHistoryReplay(limit: UInt8, completion: @escaping (Bool, String) -> Void) {
        sendSimpleControl([0x30, 0x01, max(1, min(16, limit))], completion: completion)
    }

    func requestTraceReplay(eventType: UInt8, recordID: UInt32, completion: @escaping (Bool, String) -> Void) {
        let b: [UInt8] = [0x31, 0x01, eventType, 0x00, UInt8(recordID & 0xff), UInt8((recordID >> 8) & 0xff), UInt8((recordID >> 16) & 0xff), UInt8((recordID >> 24) & 0xff)]
        sendSimpleControl(b, completion: completion)
    }

    func syncContextPayload(_ payload: String, completion: @escaping (Bool, String) -> Void) {
        guard state == "connected", let p = peripheral, let control = controlChar else { completion(false, "Bow Sensor is not connected"); return }
        guard let body = payload.data(using: .utf8), body.count <= 768 else { completion(false, "Context payload is too large"); return }
        guard controlWriteQueue.isEmpty && controlWriteCompletion == nil else { completion(false, "Context sync busy"); return }
        contextTxId &+= 1
        if contextTxId == 0 { contextTxId = 1 }
        let tx = contextTxId
        var begin = Data([0x20, 0x01, UInt8(tx & 0xff), UInt8((tx >> 8) & 0xff), UInt8(body.count & 0xff), UInt8((body.count >> 8) & 0xff)])
        while begin.count < 20 { begin.append(0) }
        var frames = [begin]
        var offset = 0
        while offset < body.count {
            let n = min(14, body.count - offset)
            var frame = Data([0x21, 0x01, UInt8(tx & 0xff), UInt8((tx >> 8) & 0xff), UInt8(offset & 0xff), UInt8((offset >> 8) & 0xff)])
            frame.append(body.subdata(in: offset..<(offset+n)))
            frames.append(frame)
            offset += n
        }
        var commit = Data([0x22, 0x01, UInt8(tx & 0xff), UInt8((tx >> 8) & 0xff)])
        while commit.count < 20 { commit.append(0) }
        frames.append(commit)
        controlWriteQueue = frames
        controlWriteCompletion = completion
        sendNextControlWrite(peripheral: p, control: control)
    }

    private func sendNextControlWrite(peripheral p: CBPeripheral, control: CBCharacteristic) {
        guard let frame = controlWriteQueue.first else {
            let done = controlWriteCompletion; controlWriteCompletion = nil
            done?(true, "Analyzer context synced to Bow Sensor")
            return
        }
        p.writeValue(frame, for: control, type: .withResponse)
    }


    func peripheral(_ p: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == controlUUID, !controlWriteQueue.isEmpty else { return }
        if let error {
            controlWriteQueue.removeAll()
            let done = controlWriteCompletion; controlWriteCompletion = nil
            done?(false, "BLE context write failed: \(error.localizedDescription)")
            return
        }
        controlWriteQueue.removeFirst()
        if let control = controlChar {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.012) { [weak self] in
                self?.sendNextControlWrite(peripheral: p, control: control)
            }
        }
    }

    func peripheral(_ p: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error { detail = error.localizedDescription; return }
        guard let value = characteristic.value else { return }
        if characteristic.uuid == sampleUUID { parseSample(value) }
        else if characteristic.uuid == summaryUUID { parseSummaryFrame(value) }
        else if characteristic.uuid == traceUUID { parseTraceFrame(value) }
        else if characteristic.uuid == identityUUID {
            if let id = String(data: value, encoding: .utf8), !id.isEmpty {
                deviceID = id
                if let t = trust {
                    if let expected = t.deviceID, expected != id {
                        setState("identity_mismatch", "Connected BLE device does not match trusted Device ID")
                        central.cancelPeripheralConnection(p)
                        return
                    }
                    if t.deviceID == nil { saveTrust(TrustRecord(peripheralUUID: t.peripheralUUID, deviceID: id)) }
                } else {
                    saveTrust(TrustRecord(peripheralUUID: p.identifier.uuidString, deviceID: id))
                }
            }
        } else if characteristic.uuid == statusUUID {
            if let s = String(data: value, encoding: .utf8) { parseStatus(s) }
        }
        flushFiles()
    }

    private func parseStatus(_ s: String) {
        for part in s.split(separator: ";") {
            let kv = part.split(separator: "=", maxSplits: 1).map(String.init)
            guard kv.count == 2 else { continue }
            if kv[0] == "fw" { firmware = kv[1] }
            if kv[0] == "mode" { dataMode = kv[1] }
            if kv[0] == "record_count" { sensorRecordCount = Int(kv[1]) }
            if kv[0] == "shot_count" { sensorShotCount = Int(kv[1]) }
        }
    }

    private func u16(_ d: Data, _ i: Int) -> UInt16 { d.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: i, as: UInt16.self).littleEndian } }
    private func i16(_ d: Data, _ i: Int) -> Int16 { Int16(bitPattern: u16(d, i)) }
    private func u32(_ d: Data, _ i: Int) -> UInt32 { d.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: i, as: UInt32.self).littleEndian } }

    private func parseSample(_ d: Data) {
        guard d.count == 20, d[0] == 0xA1 else { return }
        let flags = d[1]
        let seq = u16(d, 2)
        let host = nowMs()
        if let last = lastSeq {
            let expected = last &+ 1
            if seq != expected {
                let gap = Int(UInt16(truncatingIfNeeded: seq &- expected))
                if gap > 0 && gap < 32768 { dropped += gap }
            }
        }
        lastSeq = seq
        total += 1
        lastPacketMs = host
        let s = Sample(
            seq: seq,
            deviceMs: u32(d, 4),
            hostMs: host,
            ax: Double(i16(d, 8)) / 1000.0,
            ay: Double(i16(d, 10)) / 1000.0,
            az: Double(i16(d, 12)) / 1000.0,
            gx: Double(i16(d, 14)) / 10.0,
            gy: Double(i16(d, 16)) / 10.0,
            gz: Double(i16(d, 18)) / 10.0,
            synthetic: (flags & 0x01) != 0,
            flags: flags
        )
        sampleLock.lock()
        samples.append(s)
        if samples.count > 600 { samples.removeFirst(samples.count - 600) }
        sampleLock.unlock()
    }

    private func parseSummaryFrame(_ d: Data) {
        guard d.count == 20 else { return }
        let kind = d[0]
        guard kind == 0xB1 || kind == 0xB2 || kind == 0xB3 else { return }
        var row: [Any] = [nowMs()]
        row.append(contentsOf: d.map { Int($0) })
        sampleLock.lock()
        summaryFrames.append(row)
        if summaryFrames.count > 90 { summaryFrames.removeFirst(summaryFrames.count - 90) }
        sampleLock.unlock()
    }

    private func parseTraceFrame(_ d: Data) {
        guard d.count == 20 else { return }
        let kind = d[0]
        guard kind == 0xC1 || kind == 0xC2 || kind == 0xC3 else { return }
        var row: [Any] = [nowMs()]
        row.append(contentsOf: d.map { Int($0) })
        sampleLock.lock()
        traceFrames.append(row)
        if traceFrames.count > 240 { traceFrames.removeFirst(traceFrames.count - 240) }
        sampleLock.unlock()
    }

    private func flushFiles() {
        revision += 1
        sampleLock.lock()
        let copy = samples
        let summaryCopy = summaryFrames
        let traceCopy = traceFrames
        sampleLock.unlock()
        let now = nowMs()
        let recent = copy.suffix(260).map { $0.jsonArray }
        let rate: Double
        if copy.count >= 2, let first = copy.first, let last = copy.last, last.hostMs > first.hostMs {
            rate = Double(copy.count - 1) * 1000.0 / Double(last.hostMs - first.hostMs)
        } else { rate = 0 }
        let stateObj: [String: Any] = [
            "transport": "BLE",
            "bridge": "native_corebluetooth",
            "state": state,
            "detail": detail,
            "device_id": deviceID ?? NSNull(),
            "firmware": firmware,
            "data_mode": dataMode,
            "record_count": sensorRecordCount ?? NSNull(),
            "shot_count": sensorShotCount ?? NSNull(),
            "connected": state == "connected",
            "trusted": trust != nil,
            "sample_rate_hz": rate,
            "packets": total,
            "dropped": dropped,
            "last_packet_ms": lastPacketMs ?? NSNull(),
            "connected_since_ms": connectedSinceMs ?? NSNull(),
            "updated_ms": now
        ]
        writer.write(stateObj, named: "3pm_ble_state.json")
        writer.write([
            "revision": revision,
            "updated_ms": now,
            "format": "[seq,device_ms,host_epoch_ms,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,synthetic,flags]",
            "samples": recent,
            "summary_frames": Array(summaryCopy.suffix(60)),
            "trace_frames": Array(traceCopy.suffix(220))
        ], named: "3pm_ble_feed.json")
    }
}

private func argumentValue(_ flag: String) -> String? {
    guard let i = CommandLine.arguments.firstIndex(of: flag), i + 1 < CommandLine.arguments.count else { return nil }
    return CommandLine.arguments[i + 1]
}

let outPath = argumentValue("--out") ?? FileManager.default.currentDirectoryPath
let outURL = URL(fileURLWithPath: outPath, isDirectory: true)
try? FileManager.default.createDirectory(at: outURL, withIntermediateDirectories: true)
print("3PM BLE Bridge starting · output: \(outURL.path)")
_ = BowBLEBridge(outputDir: outURL)
RunLoop.main.run()
