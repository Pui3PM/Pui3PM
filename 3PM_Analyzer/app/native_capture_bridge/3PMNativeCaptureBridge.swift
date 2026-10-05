import Foundation
#if canImport(AVFoundation)
import AVFoundation
import CoreImage
import ImageIO
import Network
import CoreMedia
import CoreVideo
import Vision
import Darwin

private let bridgeVersion = "HV3-native-avfoundation-timeline-v1"
private let captureProtocolVersion = "3pm-capture-v1"
private let defaultPort: UInt16 = 48735
private let maxBundleAgeMs: Double = 30_000

private func epochMs() -> Double { Date().timeIntervalSince1970 * 1000.0 }
private func monotonicMs() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1_000_000.0 }
private func jsonData(_ object: Any) -> Data {
    (try? JSONSerialization.data(withJSONObject: object, options: [])) ?? Data("{}".utf8)
}
private func normalizeName(_ s: String) -> String {
    let lower = s.lowercased()
    let noParen = lower.replacingOccurrences(of: #"\s*\([^)]*\)\s*$"#, with: "", options: .regularExpression)
    return noParen.replacingOccurrences(of: #"[^a-z0-9]+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
}
private func median(_ xs: [Double]) -> Double? {
    guard !xs.isEmpty else { return nil }
    let a = xs.sorted(); let i = a.count / 2
    return a.count % 2 == 1 ? a[i] : (a[i-1] + a[i]) / 2.0
}
private func percentile(_ xs: [Double], _ p: Double) -> Double? {
    guard !xs.isEmpty else { return nil }
    let a = xs.sorted(); let idx = max(0, min(a.count-1, Int(round(Double(a.count-1) * p))))
    return a[idx]
}

private struct EncodedFrame {
    let frameSeq: UInt64
    let epoch: Double
    let masterTimeMs: Double
    let mediaTimeMs: Double
    let data: Data
}
private struct BundleFrame {
    let frameSeq: UInt64
    let epoch: Double
    let masterTimeMs: Double
    let mediaTimeMs: Double
    let data: Data
}
private struct CaptureBundle {
    let id: String
    let role: String
    let generation: Int
    let releaseEpoch: Double
    let preMs: Double
    let postMs: Double
    let createdEpoch: Double
    let captureFPS: Double?
    let evidenceFPS: Double?
    let reportedFPS: Double?
    let frames: [BundleFrame]
}

private struct VisionShadowPoint {
    let x: Double
    let y: Double
    let confidence: Double
    var json: [String:Any] { ["x":x,"y":y,"confidence":confidence] }
}

private func visionAngle(_ a: VisionShadowPoint?, _ b: VisionShadowPoint?, _ c: VisionShadowPoint?) -> Double? {
    guard let a=a, let b=b, let c=c else { return nil }
    let ux=a.x-b.x, uy=a.y-b.y, vx=c.x-b.x, vy=c.y-b.y
    let nu=sqrt(ux*ux+uy*uy), nv=sqrt(vx*vx+vy*vy)
    guard nu > 1e-8 && nv > 1e-8 else { return nil }
    let dot=max(-1.0,min(1.0,(ux*vx+uy*vy)/(nu*nv)))
    return acos(dot)*180.0/Double.pi
}

private func normalizedLineDegrees(_ value: Double) -> Double {
    var d=value
    while d > 90 { d -= 180 }
    while d < -90 { d += 180 }
    return d
}

private final class RoleCapture: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    let role: String
    private let stateLock = NSLock()
    private let captureQueue: DispatchQueue
    private let encodeQueue: DispatchQueue
    private let visionQueue: DispatchQueue
    private var session: AVCaptureSession?
    private var input: AVCaptureDeviceInput?
    private var output: AVCaptureVideoDataOutput?
    private var active = false
    private var generation = 0
    // Every close/superseding start invalidates permission/config/start work already in flight.
    private var lifecycleVersion: UInt64 = 0
    private var desiredGeneration: Int? = nil
    private var closedThroughGeneration = -1
    private let startWorkLock = NSLock()

    // Reserve ownership BEFORE permission/configuration waits. Closing pending work is atomic.
    func reserveStart(generation: Int) throws -> UInt64 {
        stateLock.lock()
        guard generation > closedThroughGeneration,
              desiredGeneration == nil || generation >= desiredGeneration! else {
            stateLock.unlock()
            throw NSError(domain:"3PMCapture",code:22,userInfo:[NSLocalizedDescriptionKey:"Closed or stale capture generation"])
        }
        lifecycleVersion &+= 1
        let token = lifecycleVersion
        desiredGeneration = generation
        let old = session
        active = false; session = nil; input = nil; output = nil
        stateLock.unlock()
        if let old = old, old.isRunning { old.stopRunning() }
        return token
    }
    private func requireCurrent(_ token: UInt64) throws {
        stateLock.lock(); let valid = lifecycleVersion == token && desiredGeneration != nil; stateLock.unlock()
        if !valid { throw NSError(domain:"3PMCapture",code:22,userInfo:[NSLocalizedDescriptionKey:"Stale capture intent cancelled"]) }
    }
    private var label = ""
    private var deviceID = ""
    private var requestedFPS: Double = 30
    private var requestedWidth: Int = 1280
    private var requestedHeight: Int = 720
    private var deliveredWidth: Int = 0
    private var deliveredHeight: Int = 0
    private var targetWidth: Int = 640
    private var captureIntervals: [Double] = []
    private var evidenceIntervals: [Double] = []
    private var lastCaptureEpoch: Double?
    private var lastEvidenceEpoch: Double?
    private var rawFrames: Int = 0
    private var evidenceFrames: Int = 0
    private var avDroppedFrames: Int = 0
    private var encoderDroppedFrames: Int = 0
    private var pendingEncode = 0
    private var nextFrameSeq: UInt64 = 1
    private var lastMasterTimeMs: Double?
    private var ring: [EncodedFrame] = []
    private var lastError: String? = nil
    // Vision is strictly shadow-only in this build: it never drives phase, release, capture, or scoring.
    private var visionEnabled = false
    private var visionAutoPaused = false
    private var visionPending = false
    private var visionLastScheduledEpoch: Double = 0
    private var visionPhaseHint = "Setup"
    private var visionHandedness = "Right-handed"
    private var visionFrames = 0
    private var visionFailures = 0
    private var visionLatencyMs: [Double] = []
    private var latestVisionSample: [String:Any]? = nil
    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    private let ringRetentionMs: Double = 6_500
    private let visionMinIntervalMs: Double = 125 // <=8 Hz shadow sampling to protect capture timing.

    init(role: String) {
        self.role = role
        self.captureQueue = DispatchQueue(label: "com.3pm.capture.\(role)", qos: .userInteractive)
        self.encodeQueue = DispatchQueue(label: "com.3pm.encode.\(role)", qos: .userInitiated)
        self.visionQueue = DispatchQueue(label: "com.3pm.vision.shadow.\(role)", qos: .utility)
        super.init()
    }

    func isActive() -> Bool { stateLock.lock(); defer { stateLock.unlock() }; return active }
    func currentGeneration() -> Int { stateLock.lock(); defer { stateLock.unlock() }; return generation }

    func start(deviceLabel: String, requestedDeviceID: String?, width: Int, height: Int, fps: Double, generation: Int, startVersion: UInt64) throws {
        startWorkLock.lock(); defer { startWorkLock.unlock() }
        try requireCurrent(startVersion)
        let device = try RoleCapture.findDevice(label: deviceLabel, requestedDeviceID: requestedDeviceID)
        let s = AVCaptureSession()
        s.beginConfiguration()
        let inp = try AVCaptureDeviceInput(device: device)
        guard s.canAddInput(inp) else { s.commitConfiguration(); throw NSError(domain:"3PMCapture", code:11, userInfo:[NSLocalizedDescriptionKey:"Cannot add camera input"] ) }
        s.addInput(inp)
        try RoleCapture.configure(device: device, width: width, height: height, fps: fps)
        let out = AVCaptureVideoDataOutput()
        out.alwaysDiscardsLateVideoFrames = true
        out.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
        out.setSampleBufferDelegate(self, queue: captureQueue)
        guard s.canAddOutput(out) else { s.commitConfiguration(); throw NSError(domain:"3PMCapture", code:12, userInfo:[NSLocalizedDescriptionKey:"Cannot add camera output"] ) }
        s.addOutput(out)
        s.commitConfiguration()

        // Do not publish ownership until startRunning completed and the lifecycle token is still current.
        try requireCurrent(startVersion)
        s.startRunning()
        stateLock.lock()
        guard lifecycleVersion == startVersion else {
            stateLock.unlock()
            if s.isRunning { s.stopRunning() }
            throw NSError(domain:"3PMCapture", code:22, userInfo:[NSLocalizedDescriptionKey:"Stale camera start cancelled by newer lifecycle intent"])
        }
        self.session = s; self.input = inp; self.output = out; self.active = true
        self.generation = generation; self.label = device.localizedName; self.deviceID = device.uniqueID
        self.requestedFPS = fps > 1 ? fps : 30; self.requestedWidth = width; self.requestedHeight = height
        self.targetWidth = self.requestedFPS >= 50 ? 480 : 640
        self.captureIntervals.removeAll(keepingCapacity: true); self.evidenceIntervals.removeAll(keepingCapacity: true)
        self.lastCaptureEpoch = nil; self.lastEvidenceEpoch = nil; self.rawFrames = 0; self.evidenceFrames = 0
        self.avDroppedFrames = 0; self.encoderDroppedFrames = 0; self.pendingEncode = 0; self.nextFrameSeq = 1; self.lastMasterTimeMs = nil; self.ring.removeAll(keepingCapacity: true); self.lastError = nil
        self.visionPending = false; self.visionAutoPaused = false; self.visionLastScheduledEpoch = 0; self.visionFrames = 0; self.visionFailures = 0; self.visionLatencyMs.removeAll(keepingCapacity: true); self.latestVisionSample = nil
        stateLock.unlock()
    }

    @discardableResult func stop(expectedGeneration: Int? = nil) -> Bool {
        stateLock.lock()
        if let expected = expectedGeneration, let desired = desiredGeneration, expected != desired {
            stateLock.unlock(); return false
        }
        if let expected = expectedGeneration { closedThroughGeneration = max(closedThroughGeneration, expected) }
        else if let desired = desiredGeneration { closedThroughGeneration = max(closedThroughGeneration, desired) }
        desiredGeneration = nil
        lifecycleVersion &+= 1
        let s = session
        active = false; session = nil; input = nil; output = nil; pendingEncode = 0; ring.removeAll(); lastCaptureEpoch = nil; lastEvidenceEpoch = nil; lastMasterTimeMs = nil; visionPending = false
        stateLock.unlock()
        if let s = s, s.isRunning { s.stopRunning() }
        return true
    }

    func diagnostics() -> [String: Any] {
        stateLock.lock(); defer { stateLock.unlock() }
        let cmed = median(captureIntervals), emed = median(evidenceIntervals)
        let cdev = cmed.map { m in captureIntervals.map { abs($0-m) } } ?? []
        let edev = emed.map { m in evidenceIntervals.map { abs($0-m) } } ?? []
        var d: [String:Any] = [
            "role": role, "active": active, "generation": generation, "label": label, "device_id": deviceID,
            "requested_width": requestedWidth, "requested_height": requestedHeight, "requested_fps": requestedFPS,
            "delivered_width": deliveredWidth, "delivered_height": deliveredHeight, "target_width": targetWidth,
            "raw_frames": rawFrames, "evidence_frames": evidenceFrames,
            "av_dropped_frames": avDroppedFrames, "encoder_dropped_frames": encoderDroppedFrames,
            "buffer_frames": ring.count, "buffer_duration_ms": ringRetentionMs, "last_frame_seq": ring.last?.frameSeq ?? 0, "clock_domain": "3pm-master-monotonic-v1", "protocol": captureProtocolVersion, "backend": "native-avfoundation", "mode": active ? "native-avfoundation" : "idle",
            "vision_shadow_available": true, "vision_shadow_enabled": visionEnabled, "vision_shadow_auto_paused": visionAutoPaused, "vision_shadow_frames": visionFrames, "vision_shadow_failures": visionFailures,
            "vision_shadow_phase_hint": visionPhaseHint
        ]
        if let vm=median(visionLatencyMs) { d["vision_shadow_latency_ms"] = vm; d["vision_shadow_latency_p95_ms"] = percentile(visionLatencyMs,0.95) }
        if let cmed = cmed { d["capture_fps"] = 1000.0/cmed; d["capture_median_interval_ms"] = cmed; d["capture_p95_interval_ms"] = percentile(captureIntervals,0.95); d["capture_jitter_p95_ms"] = percentile(cdev,0.95) }
        if let emed = emed { d["raw_fps"] = 1000.0/emed; d["median_interval_ms"] = emed; d["p95_interval_ms"] = percentile(evidenceIntervals,0.95); d["jitter_p95_ms"] = percentile(edev,0.95) }
        if let e = lastError { d["error"] = e }
        return d
    }

    func setVisionEnabled(_ enabled: Bool) {
        stateLock.lock(); defer { stateLock.unlock() }
        visionEnabled=enabled; if enabled { visionAutoPaused=false }
    }

    func setVisionHint(phase: String, handedness: String) {
        stateLock.lock(); defer { stateLock.unlock() }
        if !phase.isEmpty { visionPhaseHint = phase }
        if handedness.lowercased().contains("left") { visionHandedness = "Left-handed" }
        else if handedness.lowercased().contains("right") { visionHandedness = "Right-handed" }
    }

    func visionSnapshot() -> [String:Any] {
        stateLock.lock(); defer { stateLock.unlock() }
        guard let sample=latestVisionSample else {
            return ["ok":true,"available":false,"role":role,"backend":"apple-vision-shadow","phase_hint":visionPhaseHint,"frames":visionFrames,"failures":visionFailures]
        }
        return sample
    }

    private func bodyPoint(_ observation: VNHumanBodyPoseObservation, _ name: VNHumanBodyPoseObservation.JointName) -> VisionShadowPoint? {
        guard let p = try? observation.recognizedPoint(name), p.confidence >= 0.08 else { return nil }
        // Vision uses lower-left origin; 3PM/MediaPipe uses top-left normalized image coordinates.
        return VisionShadowPoint(x:Double(p.location.x), y:1.0-Double(p.location.y), confidence:Double(p.confidence))
    }

    private func handPoint(_ observation: VNHumanHandPoseObservation, _ name: VNHumanHandPoseObservation.JointName) -> VisionShadowPoint? {
        guard let p = try? observation.recognizedPoint(name), p.confidence >= 0.08 else { return nil }
        return VisionShadowPoint(x:Double(p.location.x), y:1.0-Double(p.location.y), confidence:Double(p.confidence))
    }

    private func processVision(sampleBuffer: CMSampleBuffer, epoch: Double, frameGeneration: Int, frameVersion: UInt64) {
        let started=epochMs()
        defer {
            stateLock.lock(); if lifecycleVersion == frameVersion { visionPending=false }; stateLock.unlock()
        }
        guard let px=CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        stateLock.lock()
        guard active && generation == frameGeneration && lifecycleVersion == frameVersion else { stateLock.unlock(); return }
        let phase=visionPhaseHint, handedness=visionHandedness
        stateLock.unlock()
        let bodyReq=VNDetectHumanBodyPoseRequest()
        let critical=["Anchor","Aim / Hold","Aim/Hold","Hold","Expansion","Release","Follow Through","Follow-through"].contains(phase)
        let handReq: VNDetectHumanHandPoseRequest? = critical ? VNDetectHumanHandPoseRequest() : nil
        handReq?.maximumHandCount=1
        let handler=VNImageRequestHandler(cvPixelBuffer:px, orientation:.up, options:[:])
        do {
            var reqs:[VNRequest]=[bodyReq]
            if let h=handReq { reqs.append(h) }
            try handler.perform(reqs)
            guard let body=bodyReq.results?.first else {
                stateLock.lock(); if lifecycleVersion == frameVersion { visionFailures += 1 }; stateLock.unlock(); return
            }
            let named:[String:VNHumanBodyPoseObservation.JointName] = [
                "nose":.nose,"neck":.neck,"left_eye":.leftEye,"right_eye":.rightEye,"left_ear":.leftEar,"right_ear":.rightEar,
                "left_shoulder":.leftShoulder,"right_shoulder":.rightShoulder,"left_elbow":.leftElbow,"right_elbow":.rightElbow,
                "left_wrist":.leftWrist,"right_wrist":.rightWrist,"left_hip":.leftHip,"right_hip":.rightHip,
                "left_knee":.leftKnee,"right_knee":.rightKnee,"left_ankle":.leftAnkle,"right_ankle":.rightAnkle,"root":.root
            ]
            var points:[String:VisionShadowPoint]=[:]
            for (k,n) in named { if let p=bodyPoint(body,n) { points[k]=p } }
            let rightHanded = !handedness.lowercased().contains("left")
            let bowPrefix = rightHanded ? "left" : "right"
            let drawPrefix = rightHanded ? "right" : "left"
            let ls=points["left_shoulder"], rs=points["right_shoulder"]
            var geometry:[String:Any]=[:]
            if let ls=ls, let rs=rs {
                geometry["shoulderLineDeg"] = normalizedLineDegrees(-atan2(rs.y-ls.y,rs.x-ls.x)*180.0/Double.pi)
            }
            if let v=visionAngle(points["\(bowPrefix)_shoulder"],points["\(bowPrefix)_elbow"],points["\(bowPrefix)_wrist"]) { geometry["bowArm2DDeg"]=v }
            if let v=visionAngle(points["\(drawPrefix)_shoulder"],points["\(drawPrefix)_elbow"],points["\(drawPrefix)_wrist"]) { geometry["drawElbow2DDeg"]=v }
            let qualityKeys=["nose","left_shoulder","right_shoulder","left_elbow","right_elbow","left_wrist","right_wrist"]
            let qs=qualityKeys.compactMap{points[$0]?.confidence}
            let quality=qs.isEmpty ? 0 : qs.reduce(0,+)/Double(qs.count)
            var handJSON:[String:Any]=[:]
            if let hand=handReq?.results?.first {
                let handNames:[String:VNHumanHandPoseObservation.JointName] = [
                    "wrist":.wrist,"thumb_tip":.thumbTip,"index_tip":.indexTip,"middle_tip":.middleTip,"ring_tip":.ringTip,"little_tip":.littleTip,
                    "index_mcp":.indexMCP,"middle_mcp":.middleMCP,"ring_mcp":.ringMCP,"little_mcp":.littleMCP
                ]
                for (k,n) in handNames { if let p=handPoint(hand,n) { handJSON[k]=p.json } }
            }
            let ended=epochMs(), latency=max(0,ended-started)
            var bodyJSON:[String:Any]=[:]; for (k,p) in points { bodyJSON[k]=p.json }
            let sample:[String:Any] = [
                "ok":true,"available":true,"role":role,"backend":"apple-vision-shadow","shadow_only":true,"authority":false,
                "epoch_ms":epoch,"completed_epoch_ms":ended,"latency_ms":latency,"phase_hint":phase,"handedness":handedness,
                "body_quality":quality,"body_points":bodyJSON,"hand_points":handJSON,"hand_pose_active":critical,"geometry":geometry
            ]
            stateLock.lock()
            guard active && generation == frameGeneration && lifecycleVersion == frameVersion else { stateLock.unlock(); return }
            latestVisionSample=sample; visionFrames += 1; visionLatencyMs.append(latency); if visionLatencyMs.count>180 { visionLatencyMs.removeFirst(visionLatencyMs.count-180) }
            stateLock.unlock()
        } catch {
            stateLock.lock(); if lifecycleVersion == frameVersion { visionFailures += 1; lastError="Vision shadow: \(error)" }; stateLock.unlock()
        }
    }

    func bundle(releaseEpoch: Double, preMs: Double, postMs: Double, id: String) -> CaptureBundle {
        stateLock.lock(); defer { stateLock.unlock() }
        let lo = releaseEpoch-preMs, hi = releaseEpoch+postMs
        let frames = ring.filter { $0.epoch >= lo && $0.epoch <= hi }.map { BundleFrame(frameSeq:$0.frameSeq, epoch:$0.epoch, masterTimeMs:$0.masterTimeMs, mediaTimeMs:$0.mediaTimeMs, data:$0.data) }
        let cmed = median(captureIntervals), emed = median(evidenceIntervals)
        return CaptureBundle(id:id, role:role, generation:generation, releaseEpoch:releaseEpoch, preMs:preMs, postMs:postMs, createdEpoch:epochMs(), captureFPS:cmed.map{1000.0/$0}, evidenceFPS:emed.map{1000.0/$0}, reportedFPS:requestedFPS, frames:frames)
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        let t = epochMs()
        let master = monotonicMs()
        let ptsSeconds = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
        let mediaMs = ptsSeconds.isFinite ? ptsSeconds * 1000.0 : master
        guard let px = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let w = CVPixelBufferGetWidth(px), h = CVPixelBufferGetHeight(px)
        stateLock.lock()
        guard active && self.output === output else { stateLock.unlock(); return }
        let frameGeneration = generation
        let frameLifecycle = lifecycleVersion
        let frameSeq = nextFrameSeq; nextFrameSeq &+= 1; lastMasterTimeMs = master
        rawFrames += 1; deliveredWidth = w; deliveredHeight = h
        if let prev = lastCaptureEpoch { let dt=t-prev; if dt>1 && dt<250 { captureIntervals.append(dt); if captureIntervals.count > 240 { captureIntervals.removeFirst(captureIntervals.count-240) } } }
        lastCaptureEpoch = t
        let cmedNow=median(captureIntervals)
        let captureHealthy = cmedNow == nil || (1000.0/max(1.0,cmedNow!)) >= requestedFPS*0.85
        if visionEnabled && !captureHealthy && visionFrames >= 8 { visionAutoPaused=true }
        let runVision = role == "side" && visionEnabled && !visionAutoPaused && !visionPending && (t-visionLastScheduledEpoch >= visionMinIntervalMs)
        if runVision { visionPending=true; visionLastScheduledEpoch=t }
        if pendingEncode >= 3 { encoderDroppedFrames += 1; stateLock.unlock(); if runVision { visionQueue.async { [weak self] in self?.processVision(sampleBuffer:sampleBuffer,epoch:t,frameGeneration:frameGeneration,frameVersion:frameLifecycle) } }; return }
        pendingEncode += 1
        let tw = targetWidth
        stateLock.unlock()

        if runVision { visionQueue.async { [weak self] in self?.processVision(sampleBuffer:sampleBuffer,epoch:t,frameGeneration:frameGeneration,frameVersion:frameLifecycle) } }

        encodeQueue.async { [weak self] in
            guard let self = self else { return }
            autoreleasepool {
                let data = self.encodeJPEG(pixelBuffer:px, targetWidth:tw)
                self.stateLock.lock()
                guard self.active && self.generation == frameGeneration && self.lifecycleVersion == frameLifecycle else { self.stateLock.unlock(); return }
                self.pendingEncode = max(0, self.pendingEncode-1)
                if let data = data {
                    self.evidenceFrames += 1
                    if let prev = self.lastEvidenceEpoch { let dt=t-prev; if dt>1 && dt<250 { self.evidenceIntervals.append(dt); if self.evidenceIntervals.count > 240 { self.evidenceIntervals.removeFirst(self.evidenceIntervals.count-240) } } }
                    self.lastEvidenceEpoch = t
                    self.ring.append(EncodedFrame(frameSeq:frameSeq,epoch:t,masterTimeMs:master,mediaTimeMs:mediaMs,data:data))
                    let cutoff = master-self.ringRetentionMs
                    if let firstKeep = self.ring.firstIndex(where:{$0.masterTimeMs >= cutoff}), firstKeep > 0 { self.ring.removeFirst(firstKeep) }
                } else { self.encoderDroppedFrames += 1 }
                self.stateLock.unlock()
            }
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        stateLock.lock(); avDroppedFrames += 1; stateLock.unlock()
    }

    private func encodeJPEG(pixelBuffer: CVPixelBuffer, targetWidth: Int) -> Data? {
        let sw = CVPixelBufferGetWidth(pixelBuffer), sh = CVPixelBufferGetHeight(pixelBuffer)
        guard sw > 0, sh > 0 else { return nil }
        let scale = min(1.0, CGFloat(targetWidth)/CGFloat(sw))
        let ci = CIImage(cvPixelBuffer: pixelBuffer).transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let rect = CGRect(x:0,y:0,width:CGFloat(sw)*scale,height:CGFloat(sh)*scale).integral
        guard let cg = ciContext.createCGImage(ci, from: rect) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, "public.jpeg" as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: 0.74] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return out as Data
    }

    private static func findDevice(label: String, requestedDeviceID: String?) throws -> AVCaptureDevice {
        let ds = AVCaptureDevice.DiscoverySession(deviceTypes:[.builtInWideAngleCamera,.externalUnknown],mediaType:.video,position:.unspecified).devices
        if let id = requestedDeviceID, !id.isEmpty, let d=ds.first(where:{$0.uniqueID==id}) { return d }
        let n = normalizeName(label)
        if !n.isEmpty {
            if let d=ds.first(where:{normalizeName($0.localizedName)==n}) { return d }
            if let d=ds.first(where:{let x=normalizeName($0.localizedName); return !x.isEmpty && (x.contains(n) || n.contains(x))}) { return d }
        }
        if ds.count == 1, let d=ds.first { return d }
        throw NSError(domain:"3PMCapture", code:10, userInfo:[NSLocalizedDescriptionKey:"Native camera not found for browser label: \(label)"])
    }

    private static func configure(device: AVCaptureDevice, width: Int, height: Int, fps: Double) throws {
        try device.lockForConfiguration(); defer { device.unlockForConfiguration() }
        var best: (AVCaptureDevice.Format, Double)? = nil
        for f in device.formats {
            let dims = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
            let dw = Double(abs(Int(dims.width)-width)), dh = Double(abs(Int(dims.height)-height))
            let maxFPS = f.videoSupportedFrameRateRanges.map{$0.maxFrameRate}.max() ?? 0
            if maxFPS + 0.5 < fps { continue }
            let score = dw + dh + abs(maxFPS-fps)*2.0
            if best == nil || score < best!.1 { best=(f,score) }
        }
        if let f=best?.0 { device.activeFormat=f }
        let duration = CMTime(seconds:1.0/max(1.0,fps), preferredTimescale:60_000)
        let ranges = device.activeFormat.videoSupportedFrameRateRanges
        if ranges.contains(where:{$0.minFrameRate <= fps+0.5 && $0.maxFrameRate >= fps-0.5}) {
            device.activeVideoMinFrameDuration=duration; device.activeVideoMaxFrameDuration=duration
        }
    }
}

private func cameraAuthorizationString() -> String {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "not_determined"
    @unknown default: return "unknown"
    }
}

private func ensureCameraPermissionSync() -> Bool {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
        return true
    case .notDetermined:
        let sem = DispatchSemaphore(value: 0)
        var granted = false
        AVCaptureDevice.requestAccess(for: .video) { ok in
            granted = ok
            sem.signal()
        }
        sem.wait()
        return granted
    default:
        return false
    }
}

private final class CaptureManager {
    private let queue = DispatchQueue(label:"com.3pm.capture.manager")
    private var roles: [String:RoleCapture] = [:]
    private var releaseRequests: [String:[String:Any]] = [:]
    private var bundles: [String:CaptureBundle] = [:]

    init() { for r in ["side","rear","overhead"] { roles[r]=RoleCapture(role:r) } }
    func devices() -> [[String:Any]] {
        AVCaptureDevice.DiscoverySession(deviceTypes:[.builtInWideAngleCamera,.externalUnknown],mediaType:.video,position:.unspecified).devices.map { d in
            let maxFPS=d.formats.flatMap{$0.videoSupportedFrameRateRanges.map{$0.maxFrameRate}}.max() ?? 0
            let maxDims=d.formats.map{CMVideoFormatDescriptionGetDimensions($0.formatDescription)}.max{(a,b) in Int64(a.width)*Int64(a.height) < Int64(b.width)*Int64(b.height)}
            return ["label":d.localizedName,"device_id":d.uniqueID,"max_fps":maxFPS,"max_width":Int(maxDims?.width ?? 0),"max_height":Int(maxDims?.height ?? 0),"high_speed_capable":maxFPS>=60] as [String:Any]
        }
    }
    func open(_ body:[String:Any]) throws -> [String:Any] {
        let role=(body["role"] as? String) ?? "side"; guard let c=roles[role] else { throw NSError(domain:"3PMCapture",code:20,userInfo:[NSLocalizedDescriptionKey:"Unknown role"])}
        let label=(body["label"] as? String) ?? ""; let did=body["device_id"] as? String
        let width=(body["width"] as? NSNumber)?.intValue ?? 1280, height=(body["height"] as? NSNumber)?.intValue ?? 720
        let fps=(body["fps"] as? NSNumber)?.doubleValue ?? 30, generation=(body["generation"] as? NSNumber)?.intValue ?? 1
        let token = try c.reserveStart(generation:generation)
        guard ensureCameraPermissionSync() else {
            throw NSError(domain:"3PMCapture",code:21,userInfo:[NSLocalizedDescriptionKey:"Camera permission is not granted to 3PM Native Capture Bridge"])
        }
        try c.start(deviceLabel:label,requestedDeviceID:did,width:width,height:height,fps:fps,generation:generation,startVersion:token)
        return ["ok":true,"role":role,"diagnostics":c.diagnostics()]
    }
    func close(_ body:[String:Any]) -> [String:Any] {
        let role=(body["role"] as? String) ?? "side"
        guard let c=roles[role] else { return ["ok":false,"role":role,"error":"unknown role"] }
        guard let requested=(body["generation"] as? NSNumber)?.intValue else { return ["ok":false,"role":role,"error":"generation required"] }
        let stopped=c.stop(expectedGeneration:requested)
        return ["ok":true,"role":role,"ignored":!stopped]
    }

    func visionEnable(_ body:[String:Any]) -> [String:Any] {
        let enabled=(body["enabled"] as? Bool) ?? false
        for (_,c) in roles { c.setVisionEnabled(enabled) }
        return ["ok":true,"enabled":enabled,"shadow_only":true,"authority":false]
    }
    func visionHint(_ body:[String:Any]) -> [String:Any] {
        let role=(body["role"] as? String) ?? "side"
        let phase=(body["phase"] as? String) ?? "Setup"
        let handedness=(body["handedness"] as? String) ?? "Right-handed"
        guard let c=roles[role] else { return ["ok":false,"error":"unknown role"] }
        c.setVisionHint(phase:phase,handedness:handedness)
        return ["ok":true,"role":role,"phase":phase,"handedness":handedness,"shadow_only":true]
    }
    func visionLatest(role:String) -> [String:Any] { roles[role]?.visionSnapshot() ?? ["ok":false,"error":"unknown role"] }
    func diag() -> [String:Any] { ["version":bridgeVersion,"protocol":captureProtocolVersion,"platform":"macOS","backend_id":"native-avfoundation","epoch_ms":epochMs(),"master_time_ms":monotonicMs(),"camera_authorization":cameraAuthorizationString(),"roles":Dictionary(uniqueKeysWithValues:roles.map{($0.key,$0.value.diagnostics())})] }
    func requestRelease(_ body:[String:Any]) -> [String:Any] {
        let release=(body["release_epoch_ms"] as? NSNumber)?.doubleValue ?? epochMs(), pre=(body["pre_ms"] as? NSNumber)?.doubleValue ?? 1250, post=(body["post_ms"] as? NSNumber)?.doubleValue ?? 1350
        var tokens:[String:String]=[:]
        for (role,c) in roles where c.isActive() {
            let id="\(role)-\(Int(release.rounded()))-\(UUID().uuidString.prefix(8))"
            releaseRequests[id]=["role":role,"release":release,"pre":pre,"post":post,"generation":c.currentGeneration(),"created":epochMs()]
            tokens[role]=id
        }
        return ["ok":true,"release_epoch_ms":release,"tokens":tokens]
    }
    func bundle(id:String) -> CaptureBundle? {
        cleanup()
        if let b=bundles[id] { return b }
        guard let req=releaseRequests[id], let role=req["role"] as? String, let c=roles[role], let release=req["release"] as? Double, let pre=req["pre"] as? Double, let post=req["post"] as? Double else { return nil }
        if let gen=req["generation"] as? Int, c.currentGeneration() != gen { releaseRequests.removeValue(forKey:id); return nil }
        // Do not freeze the bundle until the requested post-release window has elapsed.
        if epochMs() < release+post+120 { return nil }
        let b=c.bundle(releaseEpoch:release,preMs:pre,postMs:post,id:id); bundles[id]=b; return b
    }
    func frame(bundleID:String,index:Int) -> Data? { guard let b=bundle(id:bundleID), index>=0, index<b.frames.count else { return nil }; return b.frames[index].data }
    private func cleanup() {
        let cutoff=epochMs()-maxBundleAgeMs
        releaseRequests=releaseRequests.filter{ (($0.value["created"] as? Double) ?? 0) >= cutoff }
        bundles=bundles.filter{ $0.value.createdEpoch >= cutoff }
    }
}

private struct HTTPRequest { let method:String; let path:String; let query:[String:String]; let body:Data; let headers:[String:String] }
private final class HTTPServer {
    let manager: CaptureManager
    let listener: NWListener
    init(port:UInt16, manager:CaptureManager) throws {
        self.manager=manager
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host:"127.0.0.1",port:NWEndpoint.Port(rawValue:port)!)
        self.listener=try NWListener(using:parameters)
    }
    func start() {
        listener.newConnectionHandler={ [weak self] c in self?.handleConnection(c) }
        listener.stateUpdateHandler={ st in if case .failed(let e)=st { fputs("Native Capture listener failed: \(e)\n",stderr) } }
        listener.start(queue:DispatchQueue(label:"com.3pm.capture.http",qos:.userInitiated))
    }
    private func handleConnection(_ c:NWConnection) {
        c.start(queue:DispatchQueue(label:"com.3pm.capture.http.conn"))
        var buf=Data()
        func recv() {
            c.receive(minimumIncompleteLength:1,maximumLength:1_048_576){ data,_,isComplete,err in
                if let data=data { buf.append(data) }
                if let req=self.parse(buf) { self.respond(req,on:c); return }
                if err != nil || isComplete || buf.count > 2_000_000 { c.cancel(); return }
                recv()
            }
        }
        recv()
    }
    private func parse(_ data:Data) -> HTTPRequest? {
        guard let sep=data.range(of:Data("\r\n\r\n".utf8)) else { return nil }
        let hd=data.subdata(in:0..<sep.lowerBound), hs=String(data:hd,encoding:.utf8) ?? "", lines=hs.components(separatedBy:"\r\n")
        guard let first=lines.first else { return nil }; let parts=first.split(separator:" "); guard parts.count>=2 else{return nil}
        var length=0; var headers:[String:String]=[:]
        for l in lines.dropFirst() {
            let p=l.split(separator:":",maxSplits:1).map(String.init)
            if p.count==2 { headers[p[0].lowercased()]=p[1].trimmingCharacters(in:.whitespaces) }
        }
        if let raw=headers["content-length"] {
            guard let n=Int(raw), n>=0, n<=1_048_576 else { return nil }; length=n
        }
        let bodyStart=sep.upperBound; guard data.count>=bodyStart+length else{return nil}; let body=data.subdata(in:bodyStart..<(bodyStart+length))
        let target=String(parts[1]); let comps=target.split(separator:"?",maxSplits:1).map(String.init); let path=comps[0]; var q:[String:String]=[:]
        if comps.count>1 { for pair in comps[1].split(separator:"&") { let p=pair.split(separator:"=",maxSplits:1).map(String.init); let k=p[0].removingPercentEncoding ?? p[0]; let v=p.count>1 ? (p[1].removingPercentEncoding ?? p[1]) : ""; q[k]=v } }
        return HTTPRequest(method:String(parts[0]),path:path,query:q,body:body,headers:headers)
    }
    private func send(_ c:NWConnection,status:Int=200,type:String="application/json",body:Data) {
        let reason=status==200 ? "OK" : status==202 ? "Accepted" : status==204 ? "No Content" : status==404 ? "Not Found" : "Error"
        let h="HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type, Access-Control-Request-Private-Network\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Private-Network: true\r\nCross-Origin-Resource-Policy: cross-origin\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
        var out=Data(h.utf8); out.append(body); c.send(content:out,completion:.contentProcessed{_ in c.cancel()})
    }
    private func respond(_ r:HTTPRequest,on c:NWConnection) {
        // Browser commands are accepted only from loopback HTTP Analyzer origins.
        // Requests without Origin are local command-line/launcher health probes (loopback listener).
        if let origin=r.headers["origin"] {
            guard let u=URLComponents(string:origin), u.scheme=="http",
                  (u.host=="127.0.0.1" || u.host=="localhost"),
                  u.user==nil, u.password==nil, u.query==nil, u.fragment==nil,
                  u.path.isEmpty else {
                send(c,status:403,body:jsonData(["ok":false,"error":"Origin denied"])); return
            }
        }
        if r.method=="OPTIONS" { send(c,status:204,body:Data()); return }
        let bodyObj: [String:Any] = (try? JSONSerialization.jsonObject(with:r.body)) as? [String:Any] ?? [:]
        do {
            switch (r.method,r.path) {
            case ("GET","/health"): send(c,body:jsonData(["ok":true,"version":bridgeVersion,"protocol":captureProtocolVersion,"platform":"macOS","backend":"AVFoundation","backend_id":"native-avfoundation","roles":["side","overhead","rear"],"secondary_blocking":false,"clock_domain":"3pm-master-monotonic-v1","vision_shadow":true,"vision_authority":false,"camera_authorization":cameraAuthorizationString(),"epoch_ms":epochMs(),"master_time_ms":monotonicMs()]))
            case ("GET","/devices"): send(c,body:jsonData(["ok":true,"devices":manager.devices()]))
            case ("POST","/open"): send(c,body:jsonData(try manager.open(bodyObj)))
            case ("POST","/close"): send(c,body:jsonData(manager.close(bodyObj)))
            case ("POST","/vision/enable"): send(c,body:jsonData(manager.visionEnable(bodyObj)))
            case ("POST","/vision/hint"): send(c,body:jsonData(manager.visionHint(bodyObj)))
            case ("GET","/vision/latest"):
                let role=r.query["role"] ?? "side"; send(c,body:jsonData(manager.visionLatest(role:role)))
            case ("GET","/diag"): send(c,body:jsonData(manager.diag()))
            case ("POST","/release"): send(c,body:jsonData(manager.requestRelease(bodyObj)))
            case ("GET","/bundle"):
                guard let id=r.query["id"] else { send(c,status:404,body:jsonData(["ok":false,"error":"missing bundle id"])); return }
                guard let b=manager.bundle(id:id) else { send(c,status:202,body:jsonData(["ok":false,"pending":true,"id":id])); return }
                let frames=b.frames.enumerated().map{ i,f in ["index":i,"frame_seq":f.frameSeq,"epoch_ms":f.epoch,"capture_epoch_ms":f.epoch,"master_time_ms":f.masterTimeMs,"media_time_ms":f.mediaTimeMs,"url":"http://127.0.0.1:\(defaultPort)/frame?bundle=\(b.id)&index=\(i)"] as [String:Any] }
                send(c,body:jsonData(["ok":true,"id":b.id,"role":b.role,"generation":b.generation,"protocol":captureProtocolVersion,"platform":"macOS","backend_id":"native-avfoundation","clock_domain":"3pm-master-monotonic-v1","release_epoch_ms":b.releaseEpoch,"pre_ms":b.preMs,"post_ms":b.postMs,"capture_fps":b.captureFPS.map{$0 as Any} ?? NSNull(),"raw_fps":b.evidenceFPS.map{$0 as Any} ?? NSNull(),"reported_fps":b.reportedFPS.map{$0 as Any} ?? NSNull(),"dense_frame_count":b.frames.count,"frames":frames]))
            case ("GET","/frame"):
                guard let id=r.query["bundle"], let i=Int(r.query["index"] ?? ""), let d=manager.frame(bundleID:id,index:i) else { send(c,status:404,type:"text/plain",body:Data("missing".utf8)); return }
                send(c,type:"image/jpeg",body:d)
            default: send(c,status:404,body:jsonData(["ok":false,"error":"not found"]))
            }
        } catch { send(c,status:500,body:jsonData(["ok":false,"error":String(describing:error)])) }
    }
}

do {
    let manager=CaptureManager()
    let server=try HTTPServer(port:defaultPort,manager:manager)
    server.start()
    print("3PM Native Capture Bridge \(bridgeVersion) listening on 127.0.0.1:\(defaultPort)")
    dispatchMain()
} catch {
    fputs("3PM Native Capture failed: \(error)\n",stderr)
    exit(3)
}
#else
print("3PM Native Capture Bridge requires macOS AVFoundation.")
#endif
