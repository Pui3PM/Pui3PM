"use strict";
/**
 * 3PM Archery Form Analyzer V5 Experimental Smooth Core — Dev4 Runtime Baseline
 *
 * New-generation deterministic analysis core.
 * Design invariants:
 *  - UI never creates a shot.
 *  - A genuine release is committed from release + short post-release evidence;
 *    the athlete never has to freeze the follow-through.
 *  - Camera role labels do not receive a hidden scoring bonus.
 *  - Multiple cameras are independent evidence for ONE athlete-level shot.
 *  - Key frames are selected retrospectively from a phase timeline; a fixed number
 *    of thumbnails is never the capture limit.
 */
var ThreePMCore;
(function (ThreePMCore) {
    ThreePMCore.BUILD_ID = "x2.4-release-proof";
    ThreePMCore.BUILD_FINGERPRINT = "3pm-x24-release-proof-fullfollow-20260921";
    const CAPTURE_ROLES = ["side", "rear", "overhead"];
    const ACTIVE_PHASES = new Set(["Draw", "Anchor", "Aim / Hold", "Expansion", "Release", "Follow Through"]);
    const PHASE_RANK = {
        "Setup": 0, "Set": 1, "Draw": 2, "Anchor": 3, "Aim / Hold": 4,
        "Expansion": 5, "Release": 6, "Follow Through": 7
    };
    function finite(v) { return Number.isFinite(Number(v)); }
    function num(v, fallback = 0) { return finite(v) ? Number(v) : fallback; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function median1(values) {
        const a=(values||[]).filter(finite).map(Number).sort((x,y)=>x-y);
        if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
    }
    function mad1(values, center=median1(values)) {
        return median1((values||[]).filter(finite).map(v=>Math.abs(Number(v)-center)));
    }
    function roleOk(role) { return CAPTURE_ROLES.includes(role); }
    function point(v) {
        return v && finite(v.x) && finite(v.y) ? { x: Number(v.x), y: Number(v.y) } : null;
    }
    function point3(v) {
        return v && finite(v.x) && finite(v.y) && finite(v.z) ? { x:Number(v.x), y:Number(v.y), z:Number(v.z) } : null;
    }
    function dist3(a,b){ return a&&b?Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)):0; }
    function dist(a, b) {
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
    function normalize(x, y) {
        const m = Math.hypot(x, y);
        return m > 1e-6 ? { x: x / m, y: y / m } : null;
    }
    function dot(ax, ay, bx, by) { return ax * bx + ay * by; }
    function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
    function clonePhaseTimeline(v) { return v.map(x => ({ ...x })); }
    function evidenceScore(m) {
        if (!m || !m.detected || m.identityAmbiguous)
            return -1;
        const positioning = num(m.positioning?.score, .5);
        let score = num(m.shotObservability) * .31
            + num(m.releaseQuality) * .23
            + num(m.identityConfidence, 1) * .19
            + num(m.phaseQuality ?? m.quality) * .17
            + positioning * .10;
        if (m.armed)
            score += .06;
        if (m.releaseCandidate)
            score += .08;
        if (m.releaseConfirmed)
            score += .10;
        if (m.criticalTrackingOK === false)
            score -= .20;
        return score;
    }
    ThreePMCore.evidenceScore = evidenceScore;
    function selectAuthorityRole(metricsByRole) {
        let best = null, bestScore = -Infinity;
        for (const role of CAPTURE_ROLES) {
            const score = evidenceScore(metricsByRole[role]);
            if (score > bestScore) {
                best = role;
                bestScore = score;
            }
        }
        if (!best || bestScore < 0)
            return { role: null, score: bestScore, reason: "no reliable athlete evidence" };
        return { role: best, score: bestScore, reason: "best current shot evidence" };
    }
    ThreePMCore.selectAuthorityRole = selectAuthorityRole;
    class AuthorityTracker {
        constructor(margin = .09, dwellMs = 520) {
            this.margin = margin;
            this.dwellMs = dwellMs;
            this.currentRole = null;
            this.candidateRole = null;
            this.candidateSince = 0;
        }
        update(metricsByRole, nowMs = Date.now()) {
            const best = selectAuthorityRole(metricsByRole);
            if (!best.role)
                return { role: this.currentRole, score: -1, reason: this.currentRole ? "authority held through short evidence loss" : best.reason };
            if (!this.currentRole) {
                this.currentRole = best.role;
                return { ...best, reason: "initial authority" };
            }
            const current = metricsByRole[this.currentRole];
            const currentScore = evidenceScore(current);
            const currentActive = !!current && (!!current.armed || !!current.releaseCandidate || !!current.releaseConfirmed || ACTIVE_PHASES.has((current.phase || "Setup")));
            if (best.role === this.currentRole) {
                this.candidateRole = null;
                this.candidateSince = 0;
                return { role: this.currentRole, score: currentScore, reason: currentActive ? "authority locked during shot" : "authority stable" };
            }
            if (currentActive && currentScore >= 0)
                return { role: this.currentRole, score: currentScore, reason: "authority locked during shot" };
            if (currentScore >= 0 && best.score < currentScore + this.margin)
                return { role: this.currentRole, score: currentScore, reason: "hysteresis margin" };
            if (this.candidateRole !== best.role) {
                this.candidateRole = best.role;
                this.candidateSince = nowMs;
                return { role: this.currentRole, score: currentScore, reason: "candidate settling" };
            }
            if (nowMs - this.candidateSince < this.dwellMs)
                return { role: this.currentRole, score: currentScore, reason: "candidate settling" };
            this.currentRole = best.role;
            this.candidateRole = null;
            this.candidateSince = 0;
            return { ...best, reason: "authority switched" };
        }
        getRole() { return this.currentRole; }
        reset() { this.currentRole = null; this.candidateRole = null; this.candidateSince = 0; }
    }
    ThreePMCore.AuthorityTracker = AuthorityTracker;
    function schedulerPolicy(input) {
        const activeCount = Math.max(1, Math.min(3, Math.round(num(input.activeCount, 1))));
        const authority = input.authorityRole === input.role || input.authorityRole === null;
        const shotActive = !!input.armed || !!input.releaseCandidate || ACTIVE_PHASES.has((input.phase || "Setup"));
        const cost = Math.max(0, num(input.costMs));
        let base;
        if (authority) {
            base = activeCount === 1 ? 34 : activeCount === 2 ? 38 : 44;
            if (shotActive)
                base = activeCount === 1 ? 28 : activeCount === 2 ? 32 : 38;
        }
        else {
            base = activeCount === 2 ? 108 : 135;
            if (shotActive)
                base = activeCount === 2 ? 132 : 160;
        }
        const freeBudget = authority ? 34 : 52;
        const penalty = Math.min(authority ? 34 : 78, Math.max(0, cost - freeBudget) * (authority ? .42 : .78));
        const intervalMs = Math.round(clamp(base + penalty, authority ? 28 : 78, authority ? 96 : 220));
        return { intervalMs, authority, shotActive, targetMinHz: authority ? (shotActive ? 12 : 10) : (shotActive ? 5 : 6) };
    }
    ThreePMCore.schedulerPolicy = schedulerPolicy;
    const PROFILES = {
        verified: {
            phaseGate: .31, setConfirmMs: 105, drawTravel: .120, drawConfirmMs: 150, setToDrawMinMs: 180,
            anchorDist: .84, visualAnchorDist: .76, anchorSpeed: .14, anchorFaceVelMax: .085, anchorConfirmMs: 180, drawMinMs: 280, anchorLossMs: 560, holdConfirmMs: 220,
            minHoldMs: 180, releaseArmMs: 300, releaseSpeed: .058, releaseConfirmMs: 75, releaseAbortMs: 720,
            releaseQualityMin: .31, followCommitMinMs: 100, followCommitMaxMs: 340,
            refractoryMs: 1100, bowExtendedMin: 140
        },
        conservative: {
            phaseGate: .36, setConfirmMs: 125, drawTravel: .140, drawConfirmMs: 170, setToDrawMinMs: 210,
            anchorDist: .80, visualAnchorDist: .72, anchorSpeed: .12, anchorFaceVelMax: .070, anchorConfirmMs: 210, drawMinMs: 320, anchorLossMs: 620, holdConfirmMs: 250,
            minHoldMs: 220, releaseArmMs: 380, releaseSpeed: .070, releaseConfirmMs: 95, releaseAbortMs: 800,
            releaseQualityMin: .38, followCommitMinMs: 130, followCommitMaxMs: 390,
            refractoryMs: 1250, bowExtendedMin: 144
        },
        balanced: {
            phaseGate: .27, setConfirmMs: 85, drawTravel: .095, drawConfirmMs: 125, setToDrawMinMs: 150,
            anchorDist: .88, visualAnchorDist: .80, anchorSpeed: .17, anchorFaceVelMax: .110, anchorConfirmMs: 155, drawMinMs: 230, anchorLossMs: 480, holdConfirmMs: 190,
            minHoldMs: 160, releaseArmMs: 240, releaseSpeed: .050, releaseConfirmMs: 60, releaseAbortMs: 650,
            releaseQualityMin: .27, followCommitMinMs: 90, followCommitMaxMs: 300,
            refractoryMs: 1000, bowExtendedMin: 137
        }
    };
    function freshViewState() {
        return {
            phase: "Setup", phaseSince: 0, candidate: null, candidateSince: 0,
            setAt: 0, drawAt: 0, anchorAt: 0, holdAt: 0, expansionAt: 0,
            lastReleaseAt: 0, holdStart: 0, lastHoldTime: null,
            setFaceDist: null, maxFaceDist: null, maxDrawTravel: 0,
            anchor: null, anchorStats: null, drawMotion: null, pendingRelease: null,
            releaseConfirmed: false, releaseEpochMs: null, releaseConfidence: null,
            releaseEventId: 0, followEvidence: false, releaseSummary: null,
            releaseValidation: null, releaseInvalidated: false, invalidatedReleaseEventId: 0,
            lastInputEpochMs: 0, recoveredSequence: false, drawQualified: false, anchorQualified: false,
            bowExtensionSeen: false, setHandRel: null, setWorldFaceHandRel: null, maxHandTravel: 0, maxWorldHandTravel: 0,
            preDrawFaceDist: null, preDrawWorldFaceDist: null, lastSetFaceDist: null, lastSetWorldFaceDist: null,
            preDrawReadyAt: 0, preDrawSettledSince: 0, preDrawArmedAt: 0, preDrawArmed: false,
            drawApproachFrames: 0, drawProgress: 0, worldDrawProgress: 0,
            anchorVisualLastDist: null, anchorVisualSettledSince: 0, holdVisualFaceRef: null,
            releaseArmedAt: 0, releaseArmed: false, releaseEverArmed: false, armQuietSince: 0,
            letDownSince: 0, expansionEvidenceSince: 0, expansionRestSince: 0, expansionActive: false, expansionEpisodeCount: 0, expansionStartedAt: 0, expansionTotalMs: 0,
            holdMotionSamples: [], holdPrevHand: null, holdPrevFaceHand: null, holdPrevElbow: null, holdPrevBow: null, holdPrevEpochMs: 0,
            releaseDirectionScore: 0, releaseForwardScore: 0, followRecoverySince: 0
        };
    }
    function freshAnchorStats() {
        return { n: 0, sumHandX: 0, sumHandY: 0, sumFace: 0, sumHeadX: 0, sumHeadY: 0, handSS: 0, faceSS: 0, headSS: 0 };
    }
    function freshDrawStats() {
        return { n: 0, sum: 0, sum2: 0, lastSpeed: null, lastAt: null, lastAccel: null, peakAccel: 0, peakJerk: 0 };
    }
    function candidateReady(s, name, now, ms) {
        if (s.candidate !== name) {
            s.candidate = name;
            s.candidateSince = now;
            return false;
        }
        return now - s.candidateSince >= ms;
    }
    function clearCandidate(s) { s.candidate = null; s.candidateSince = 0; }
    function blendPoint(a, b, alpha) {
        if (!b)
            return a ? { ...a } : null;
        if (!a)
            return { ...b };
        return { x: a.x * (1 - alpha) + b.x * alpha, y: a.y * (1 - alpha) + b.y * alpha };
    }
    function pushAnchorStats(st, input) {
        if (!st || !input.anchorHandRel || !input.headRel || !finite(input.faceDist))
            return;
        const h = input.anchorHandRel, head = input.headRel, face = Number(input.faceDist);
        st.n++;
        st.sumHandX += h.x;
        st.sumHandY += h.y;
        st.sumFace += face;
        st.sumHeadX += head.x;
        st.sumHeadY += head.y;
        st.handSS += h.x * h.x + h.y * h.y;
        st.faceSS += face * face;
        st.headSS += head.x * head.x + head.y * head.y;
    }
    function anchorRms(st) {
        if (!st || st.n < 2)
            return { hand: 0, face: 0, head: 0 };
        const n = st.n, hx = st.sumHandX / n, hy = st.sumHandY / n, f = st.sumFace / n, x = st.sumHeadX / n, y = st.sumHeadY / n;
        return {
            hand: Math.sqrt(Math.max(0, st.handSS / n - (hx * hx + hy * hy))),
            face: Math.sqrt(Math.max(0, st.faceSS / n - f * f)),
            head: Math.sqrt(Math.max(0, st.headSS / n - (x * x + y * y)))
        };
    }
    function pushDrawMotion(st, speed, now) {
        if (!st || !finite(speed))
            return;
        st.n++;
        st.sum += speed;
        st.sum2 += speed * speed;
        if (st.lastSpeed !== null && st.lastAt !== null && now > st.lastAt) {
            const dt = clamp((now - st.lastAt) / 1000, .012, .25), accel = (speed - st.lastSpeed) / dt;
            st.peakAccel = Math.max(st.peakAccel, Math.abs(accel));
            if (st.lastAccel !== null)
                st.peakJerk = Math.max(st.peakJerk, Math.abs((accel - st.lastAccel) / dt));
            st.lastAccel = accel;
        }
        st.lastSpeed = speed;
        st.lastAt = now;
    }
    function drawMotionSummary(st) {
        if (!st || !st.n)
            return {};
        const mean = st.sum / st.n, sd = Math.sqrt(Math.max(0, st.sum2 / st.n - mean * mean));
        return { drawSpeedMean: mean, drawSpeedCv: mean > 1e-5 ? sd / mean : null, drawAccelerationPeak: st.peakAccel || null, drawJerkPeak: st.peakJerk || null, drawMotionSamples: st.n };
    }
    function createAnchor(input) {
        const wrist = point(input.anchorHandRel), elbow = point(input.drawElbowRel);
        const rv = wrist && elbow ? normalize(elbow.x - wrist.x, elbow.y - wrist.y) : null;
        return {
            wrist, faceHand: point(input.faceHandRel), elbow, head: point(input.headRel), rearVec: rv,
            worldFaceHand: point3(input.worldFaceHandRel), worldElbow: point3(input.worldDrawElbowRel), worldBowWrist: point3(input.worldBowWristRel),
            faceDist: finite(input.faceDist) ? Number(input.faceDist) : null,
            bowArmDeg: finite(input.bowArmDeg) ? Number(input.bowArmDeg) : null,
            drawElbowDeg: finite(input.drawElbowDeg) ? Number(input.drawElbowDeg) : null,
            headPitchDeg: finite(input.headPitchDeg) ? Number(input.headPitchDeg) : null,
            handSpreadPct: finite(input.handSpreadPct) ? Number(input.handSpreadPct) : null
        };
    }
    function refineAnchor(a, input, alpha = .30) {
        const base = a || createAnchor(input);
        base.wrist = blendPoint(base.wrist, point(input.anchorHandRel), alpha);
        base.faceHand = blendPoint(base.faceHand, point(input.faceHandRel), alpha);
        base.elbow = blendPoint(base.elbow, point(input.drawElbowRel), alpha);
        base.head = blendPoint(base.head, point(input.headRel), alpha * .7);
        if (finite(input.faceDist))
            base.faceDist = base.faceDist === null ? Number(input.faceDist) : base.faceDist * (1 - alpha) + Number(input.faceDist) * alpha;
        if (finite(input.bowArmDeg))
            base.bowArmDeg = base.bowArmDeg === null ? Number(input.bowArmDeg) : base.bowArmDeg * (1 - alpha) + Number(input.bowArmDeg) * alpha;
        if (finite(input.drawElbowDeg))
            base.drawElbowDeg = base.drawElbowDeg === null ? Number(input.drawElbowDeg) : base.drawElbowDeg * (1 - alpha) + Number(input.drawElbowDeg) * alpha;
        if (finite(input.headPitchDeg))
            base.headPitchDeg = base.headPitchDeg === null ? Number(input.headPitchDeg) : base.headPitchDeg * (1 - alpha) + Number(input.headPitchDeg) * alpha;
        if (finite(input.handSpreadPct))
            base.handSpreadPct = base.handSpreadPct === null ? Number(input.handSpreadPct) : base.handSpreadPct * (1 - alpha) + Number(input.handSpreadPct) * alpha;
        if (base.wrist && base.elbow)
            base.rearVec = normalize(base.elbow.x - base.wrist.x, base.elbow.y - base.wrist.y);
        return base;
    }
    function releaseGeom(s, input) {
        const a = s.anchor, wrist = point(input.anchorHandRel);
        if (!a?.wrist || !wrist)
            return null;
        const dx = wrist.x - a.wrist.x, dy = wrist.y - a.wrist.y;
        const rearVec = a.rearVec || (a.elbow ? normalize(a.elbow.x - a.wrist.x, a.elbow.y - a.wrist.y) : null);
        const rear = rearVec ? dot(dx, dy, rearVec.x, rearVec.y) : 0;
        const off = rearVec ? cross(dx, dy, rearVec.x, rearVec.y) : Math.hypot(dx, dy);
        const faceDelta = finite(input.faceDist) && finite(a.faceDist) ? Number(input.faceDist) - Number(a.faceDist) : 0;
        const faceRelDisp = a.faceHand && input.faceHandRel ? dist(point(input.faceHandRel), a.faceHand) : Math.hypot(dx, dy);
        const elbowPoint = point(input.drawElbowRel);
        const elbowDisp = a.elbow && elbowPoint ? dist(elbowPoint, a.elbow) : 0;
        const elbowRear = a.elbow && elbowPoint && rearVec ? dot(elbowPoint.x - a.elbow.x, elbowPoint.y - a.elbow.y, rearVec.x, rearVec.y) : 0;
        const headDisp = a.head && input.headRel ? dist(point(input.headRel), a.head) : 0;
        const wf=point3(input.worldFaceHandRel),we=point3(input.worldDrawElbowRel),wb=point3(input.worldBowWristRel);
        const worldFaceRelDisp=a.worldFaceHand&&wf?dist3(a.worldFaceHand,wf):0;
        const worldElbowDisp=a.worldElbow&&we?dist3(a.worldElbow,we):0;
        let worldRear=0;
        if(a.worldFaceHand&&a.worldElbow&&wf){const rv3={x:a.worldElbow.x-a.worldFaceHand.x,y:a.worldElbow.y-a.worldFaceHand.y,z:a.worldElbow.z-a.worldFaceHand.z};const mag=Math.hypot(rv3.x,rv3.y,rv3.z);if(mag>1e-6)worldRear=((wf.x-a.worldFaceHand.x)*rv3.x+(wf.y-a.worldFaceHand.y)*rv3.y+((wf.z||0)-(a.worldFaceHand.z||0))*rv3.z)/mag;}
        const worldBowDisp=a.worldBowWrist&&wb?dist3(a.worldBowWrist,wb):0;
        return { total: Math.hypot(dx, dy), rear, off, faceDelta, faceRelDisp, elbowDisp, elbowRear, headDisp, worldFaceRelDisp, worldElbowDisp, worldRear, worldBowDisp };
    }
    class ViewShotTracker {
        constructor(role) {
            this.role = role;
            this.s = freshViewState();
        }
        reset() { this.s = freshViewState(); }
        getPhase() { return this.s.phase; }
        getReleaseEpoch() { return this.s.releaseEpochMs; }
        getReleaseConfidence() { return num(this.s.releaseConfidence); }
        getLastInputEpoch() { return this.s.lastInputEpochMs; }
        enter(next, input) {
            const s = this.s, now = input.now;
            s.phase = next;
            s.phaseSince = now;
            clearCandidate(s);
            if (next === "Setup") {
                const releaseEventId = s.releaseEventId;
                this.s = freshViewState();
                this.s.phaseSince = now;
                this.s.releaseEventId = releaseEventId;
                return;
            }
            if (next === "Set") {
                s.setAt = now;
                s.drawAt = 0;
                s.anchorAt = 0;
                s.holdAt = 0;
                s.expansionAt = 0;
                s.setFaceDist = finite(input.faceDist) ? Number(input.faceDist) : null;
                s.maxFaceDist = s.setFaceDist;
                s.maxDrawTravel = 0;
                s.bowExtensionSeen = !!input.bowExtended;
                s.setHandRel = point(input.anchorHandRel);
                s.setWorldFaceHandRel = point3(input.worldFaceHandRel);
                s.maxHandTravel = 0;
                s.maxWorldHandTravel = 0;
                s.preDrawFaceDist = null;
                s.preDrawWorldFaceDist = null;
                s.lastSetFaceDist = null;
                s.lastSetWorldFaceDist = null;
                s.preDrawReadyAt = 0;
                s.preDrawSettledSince = 0;
                s.preDrawArmedAt = 0;
                s.preDrawArmed = false;
                s.drawApproachFrames = 0;
                s.drawProgress = 0;
                s.worldDrawProgress = 0;
                s.anchorVisualLastDist = null;
                s.anchorVisualSettledSince = 0;
                s.holdVisualFaceRef = null;
                s.releaseArmedAt = 0;
                s.releaseArmed = false;
                s.releaseEverArmed = false;
                s.armQuietSince = 0;
                s.letDownSince = 0;
                s.expansionEvidenceSince = 0;
                s.expansionRestSince = 0;
                s.expansionActive = false;
                s.expansionEpisodeCount = 0;
                s.expansionStartedAt = 0;
                s.expansionTotalMs = 0;
                s.holdMotionSamples = []; s.holdPrevHand = null; s.holdPrevFaceHand = null; s.holdPrevElbow = null; s.holdPrevBow = null; s.holdPrevEpochMs = 0; s.followRecoverySince = 0;
                s.anchorQualified = false;
                s.anchor = null;
                s.anchorStats = null;
                s.drawMotion = null;
                s.pendingRelease = null;
                s.releaseConfirmed = false;
                s.releaseEpochMs = null;
                s.releaseConfidence = null;
                s.followEvidence = false;
                s.releaseSummary = null;
                s.recoveredSequence = false;
                s.drawQualified = false;
            }
            else if (next === "Draw") {
                if (!s.drawAt)
                    s.drawAt = now;
                if (!s.drawMotion)
                    s.drawMotion = freshDrawStats();
            }
            else if (next === "Anchor") {
                s.anchorAt = now;
                s.holdStart = 0;
                s.anchorVisualLastDist = finite(input.phaseFaceDist) ? Number(input.phaseFaceDist) : null;
                s.anchorVisualSettledSince = 0;
                // Provisional anchor only. The release baseline is re-frozen after anchor settles.
                s.anchor = createAnchor(input);
                s.anchorStats = freshAnchorStats();
                pushAnchorStats(s.anchorStats, input);
                s.releaseArmedAt = 0;
                s.releaseArmed = false;
                s.releaseEverArmed = false;
                s.armQuietSince = 0;
                s.letDownSince = 0;
                s.expansionEvidenceSince = 0;
                s.expansionRestSince = 0;
                s.expansionActive = false;
                s.expansionEpisodeCount = 0;
                s.expansionStartedAt = 0;
                s.expansionTotalMs = 0;
                s.holdMotionSamples = []; s.holdPrevHand = null; s.holdPrevFaceHand = null; s.holdPrevElbow = null; s.holdPrevBow = null; s.holdPrevEpochMs = 0; s.followRecoverySince = 0;
                s.anchorQualified = false;
            }
            else if (next === "Aim / Hold") {
                s.holdAt = now;
                s.holdStart = now;
                s.holdVisualFaceRef = finite(input.phaseFaceDist) ? Number(input.phaseFaceDist) : null;
                // X1.7: final motion INTO anchor is not release evidence.
                // Freeze a fresh baseline only after the visual anchor plateau is confirmed.
                s.anchor = createAnchor(input);
                s.anchorStats = freshAnchorStats();
                pushAnchorStats(s.anchorStats, input);
                s.anchorQualified = true;
                s.releaseArmedAt = 0;
                s.releaseArmed = false;
                s.releaseEverArmed = false;
                s.armQuietSince = 0;
                s.letDownSince = 0;
                s.expansionEvidenceSince = 0;
                s.expansionRestSince = 0;
                s.expansionActive = false;
                s.expansionStartedAt = 0;
                s.holdMotionSamples = []; s.holdPrevHand = point(input.anchorHandRel); s.holdPrevFaceHand = point(input.faceHandRel); s.holdPrevElbow = point(input.drawElbowRel); s.holdPrevBow = point(input.bowWristRel); s.holdPrevEpochMs = input.epochMs || 0; s.followRecoverySince = 0;
            }
            else if (next === "Expansion") {
                if (!s.expansionAt)
                    s.expansionAt = now;
            }
            else if (next === "Release") {
                s.lastHoldTime = s.holdStart ? Math.max(0, (now - s.holdStart) / 1000) : s.lastHoldTime;
            }
        }
        update(input, profileName = "verified") {
            const s = this.s, cfg = PROFILES[profileName] || PROFILES.verified;
            const now = input.now, epochMs = input.epochMs;
            s.lastInputEpochMs = epochMs;
            const out = {
                phase: s.phase, holdTimeS: null, didRelease: false, shotComplete: false,
                releaseConfirmed: s.releaseConfirmed, followThroughConfirmed: false, postReleaseEvidence: s.followEvidence,
                releaseConfidence: s.releaseConfidence, releaseEpochMs: s.releaseEpochMs,
                armed: !!s.releaseArmed, releaseCandidate: !!s.pendingRelease,
                releaseEventId: s.releaseEventId, shotCompleteEventId: 0, blocker: null, recoveredSequence: s.recoveredSequence, sequenceQualified: !!(s.drawQualified && s.anchorQualified),
                releaseInvalidated: false, invalidatedReleaseEventId: 0
            };
            const q = num(input.phaseQuality), relQ = num(input.releaseQuality);
            const tracking = input.criticalTrackingOK && relQ >= cfg.releaseQualityMin;
            const nearFace = finite(input.faceDist) && Number(input.faceDist) < cfg.anchorDist;
            const bowExtended = input.bowExtended || (finite(input.bowArmDeg) && Number(input.bowArmDeg) >= cfg.bowExtendedMin);
            // X1.6: shot-phase posture (Set/Draw/Anchor/Hold) follows the current VISUAL pose.
            // Measurement pose remains authoritative for release mechanics, but it can be deliberately
            // frozen/rejected during fast motion and must not pin a visibly anchored archer in Draw.
            const phaseFaceDist = finite(input.phaseFaceDist) ? Number(input.phaseFaceDist) : (finite(input.faceDist) ? Number(input.faceDist) : null);
            const phaseNearFace = phaseFaceDist !== null && phaseFaceDist < (cfg.visualAnchorDist || cfg.anchorDist * .80);
            const phaseBowExtended = input.phaseBowExtended === true || bowExtended || input.setReady === true;
            const phaseShootingPosture = input.phaseShootingPosture !== undefined ? input.phaseShootingPosture === true : input.shootingPosture === true;
            const phaseWristVis = finite(input.phaseDrawWristVisibility) ? Number(input.phaseDrawWristVisibility) : num(input.drawWristVisibility);
            const phaseElbowVis = finite(input.phaseDrawElbowVisibility) ? Number(input.phaseDrawElbowVisibility) : num(input.drawElbowVisibility);
            const phaseStrongPose = phaseNearFace && phaseBowExtended && phaseShootingPosture && phaseWristVis >= .28 && phaseElbowVis >= .29;
            const strongPose = nearFace && (bowExtended || input.setReady === true) && input.shootingPosture && input.drawWristVisibility >= .30 && input.drawElbowVisibility >= .31;
            // X1.8: BEFORE Hold, low phase quality blocks phase progression. AFTER Release
            // is armed, a sudden quality/visibility drop is often part of the release itself and
            // must not short-circuit the detector. Keep processing the armed release window.
            const armedReleaseWindow = s.releaseEverArmed && ["Aim / Hold", "Expansion", "Release"].includes(s.phase);
            if (q < cfg.phaseGate && !armedReleaseWindow) {
                out.blocker = "tracking_low";
                if (s.holdStart && ["Anchor", "Aim / Hold", "Expansion"].includes(s.phase))
                    out.holdTimeS = (now - s.holdStart) / 1000;
                return Object.assign(out, this.summary(input));
            }
            if (q < cfg.phaseGate && armedReleaseWindow) out.blocker = "release_tracking_grace";
            if (s.phase === "Setup") {
                out.blocker = "waiting_set";
                // X1.3: Set is triggered by raising the bow, not by already reaching Draw posture.
                // This keeps phase order faithful to a real recurve shot and avoids Setup lock
                // when the draw arm is still low/preparing while the bow arm is already raised.
                const setReady = input.setReady === true;
                // X1.4: setReady is derived from the visual bow-raise posture.  Do not
                // veto it with a stale/frozen measurement wristsLow flag; that was the
                // live-camera Setup lock seen in X1.3.
                if (setReady) {
                    if (candidateReady(s, "set", now, cfg.setConfirmMs))
                        this.enter("Set", input);
                }
                else if (s.candidate === "set")
                    clearCandidate(s);
            }
            else if (s.phase === "Set") {
                out.blocker = "waiting_draw";
                s.bowExtensionSeen = s.bowExtensionSeen || bowExtended || input.setReady === true;
                const hasVisualFaceDist = finite(input.phaseFaceDist);
                const fd = hasVisualFaceDist ? Number(input.phaseFaceDist) : (finite(input.faceDist) ? Number(input.faceDist) : null);
                const wf = hasVisualFaceDist ? null : point3(input.worldFaceHandRel);
                const wfd = wf ? Math.hypot(wf.x, wf.y, wf.z || 0) : null;

                // X1.5: merely raising the draw arm into the shooting plane is still SET.
                // Establish a pre-draw reference only after both arms are in shooting posture,
                // then require sustained approach of the draw hand toward the face. Generic
                // hand travel is intentionally NOT enough because arm-raising/body rotation
                // created the premature Draw events seen on the real camera.
                if (!input.shootingPosture) {
                    s.preDrawFaceDist = null;
                    s.preDrawWorldFaceDist = null;
                    s.lastSetFaceDist = fd;
                    s.lastSetWorldFaceDist = wfd;
                    s.preDrawReadyAt = 0;
                    s.preDrawSettledSince = 0;
                    s.preDrawArmedAt = 0;
                    s.preDrawArmed = false;
                    s.drawApproachFrames = 0;
                    s.drawProgress = 0;
                    s.worldDrawProgress = 0;
                    if (s.candidate === "draw") clearCandidate(s);
                } else {
                    if (!s.preDrawReadyAt) s.preDrawReadyAt = now;

                    // X1.5: first let the draw arm ARRIVE in the Set plane. The live pose filter
                    // can take several frames to re-acquire a genuine arm raise; counting those
                    // settling frames as draw travel was the remaining premature-Draw bug.
                    if (!s.preDrawArmed) {
                        // X1.11 REAL-TRACE FAST-DRAW FIX:
                        // Production phase progression has a current VISUAL hand-to-face distance.
                        // Preserve its earliest/farthest value while Set settles so a fast natural
                        // draw is not erased by the 300 ms pre-draw fallback. If visual distance is
                        // unavailable, keep the older conservative measurement fallback behavior.
                        if (hasVisualFaceDist) {
                            if (fd !== null) {
                                if (s.preDrawFaceDist === null) s.preDrawFaceDist = fd;
                                else s.preDrawFaceDist = Math.max(s.preDrawFaceDist, fd);
                                s.lastSetFaceDist = fd;
                                s.drawProgress = Math.max(s.drawProgress, s.preDrawFaceDist - fd);
                            }
                        } else {
                            s.preDrawFaceDist = fd;
                            s.preDrawWorldFaceDist = wfd;
                            s.lastSetFaceDist = fd;
                            s.lastSetWorldFaceDist = wfd;
                            s.drawApproachFrames = 0;
                            s.drawProgress = 0;
                            s.worldDrawProgress = 0;
                        }
                        const quietSet = num(input.faceHandSpeed) < .065 && num(input.drawSpeed) < .105 && Math.abs(num(input.faceVelocity)) < .080;
                        if (quietSet) {
                            if (!s.preDrawSettledSince) s.preDrawSettledSince = now;
                        } else s.preDrawSettledSince = 0;
                        const settled = s.preDrawSettledSince && now - s.preDrawSettledSince >= 110;
                        // X2.0: do not make a fast archer wait for a cadence timer. If the visual
                        // draw hand has already begun a sustained approach, that motion itself is
                        // sufficient evidence to freeze the pre-draw baseline early. The 300 ms
                        // path remains only as a no-motion fallback for filter settling.
                        const earlyDrawEvidence = hasVisualFaceDist && s.drawProgress >= cfg.drawTravel * .45
                            && (num(input.faceVelocity) <= -.020 || num(input.faceHandSpeed) >= .045);
                        const seamlessFallback = now - s.preDrawReadyAt >= 300;
                        if (settled || earlyDrawEvidence || seamlessFallback) {
                            s.preDrawArmed = true;
                            s.preDrawArmedAt = now;
                            if (!hasVisualFaceDist) {
                                s.preDrawFaceDist = fd;
                                s.preDrawWorldFaceDist = wfd;
                                s.lastSetFaceDist = fd;
                                s.lastSetWorldFaceDist = wfd;
                            }
                        }
                        if (s.candidate === "draw") clearCandidate(s);
                    } else {
                        if (fd !== null) {
                            if (s.lastSetFaceDist !== null) {
                                const stepToward = s.lastSetFaceDist - fd;
                                if (stepToward >= .004) s.drawApproachFrames = Math.min(8, s.drawApproachFrames + 1);
                                else if (stepToward <= -.008) s.drawApproachFrames = Math.max(0, s.drawApproachFrames - 1);
                            }
                            s.lastSetFaceDist = fd;
                            if (s.preDrawFaceDist !== null) s.drawProgress = Math.max(s.drawProgress, s.preDrawFaceDist - fd);
                        }
                        if (wfd !== null) {
                            if (s.lastSetWorldFaceDist !== null) {
                                const wstep = s.lastSetWorldFaceDist - wfd;
                                if (wstep >= .004) s.drawApproachFrames = Math.min(8, s.drawApproachFrames + 1);
                                else if (wstep <= -.010) s.drawApproachFrames = Math.max(0, s.drawApproachFrames - 1);
                            }
                            s.lastSetWorldFaceDist = wfd;
                            if (s.preDrawWorldFaceDist !== null) s.worldDrawProgress = Math.max(s.worldDrawProgress, s.preDrawWorldFaceDist - wfd);
                        }
                        const travelEvidence = s.drawProgress >= cfg.drawTravel || s.worldDrawProgress >= cfg.drawTravel * 1.05;
                        const sustainedDirection = s.drawApproachFrames >= 2 || s.drawProgress >= cfg.drawTravel * 1.55 || s.worldDrawProgress >= cfg.drawTravel * 1.55;
                        const motionEvidence = num(input.faceVelocity) <= -.020 || num(input.faceHandSpeed) >= .045 || num(input.worldFaceHandSpeed) >= .050 || s.drawApproachFrames >= 3;
                        // Travel + direction define Draw. A short candidate dwell filters noise;
                        // there is no athlete-cadence minimum here.
                        const drawStarted = s.bowExtensionSeen && travelEvidence && sustainedDirection && motionEvidence;
                        if (drawStarted) {
                            if (candidateReady(s, "draw", now, cfg.drawConfirmMs)) {
                                this.enter("Draw", input);
                                s.drawQualified = true;
                                s.recoveredSequence = false;
                            }
                        } else if (s.candidate === "draw") clearCandidate(s);
                    }
                }
                if (input.wristsLow && input.setReady !== true && candidateReady(s, "reset", now, 320)) {
                    out.letDown = true; out.shotEvent = "let_down"; this.enter("Setup", input);
                }
            }
            else if (s.phase === "Draw") {
                out.blocker = "waiting_anchor";
                pushDrawMotion(s.drawMotion, num(input.drawSpeed), now);
                const hasVisualFaceDist = finite(input.phaseFaceDist);
                const fd = hasVisualFaceDist ? Number(input.phaseFaceDist) : (finite(input.faceDist) ? Number(input.faceDist) : null);
                const wf = hasVisualFaceDist ? null : point3(input.worldFaceHandRel);
                const wfd = wf ? Math.hypot(wf.x, wf.y, wf.z || 0) : null;
                if (fd !== null && s.preDrawFaceDist !== null) s.drawProgress = Math.max(s.drawProgress, s.preDrawFaceDist - fd);
                if (wfd !== null && s.preDrawWorldFaceDist !== null) s.worldDrawProgress = Math.max(s.worldDrawProgress, s.preDrawWorldFaceDist - wfd);
                const qualifiedTravel = Math.max(s.drawProgress || 0, s.worldDrawProgress || 0) >= cfg.drawTravel * 1.05;
                // X2.0: entering Anchor is posture/evidence driven. Draw duration itself is not a
                // requirement; qualified travel + visual anchor posture + confirmation dwell are enough.
                const anchorLike = s.drawQualified && qualifiedTravel && phaseStrongPose;
                if (anchorLike) {
                    if (candidateReady(s, "anchor", now, cfg.anchorConfirmMs)) this.enter("Anchor", input);
                } else if (s.candidate === "anchor") clearCandidate(s);
                if (input.wristsLow && input.setReady !== true && candidateReady(s, "reset", now, 320)) {
                    out.letDown = true; out.shotEvent = "let_down"; this.enter("Setup", input);
                }
            }
            else if (s.phase === "Anchor") {
                out.blocker = "stabilizing_anchor";
                // X1.7: Anchor must PLATEAU before Hold can arm release detection.
                // Continued travel into the face is still part of Draw/Anchor acquisition.
                const anchorZone = phaseStrongPose;
                let visualSettled = false;
                if (anchorZone && phaseFaceDist !== null) {
                    const prev = s.anchorVisualLastDist;
                    const delta = prev === null ? 0 : Math.abs(phaseFaceDist - prev);
                    s.anchorVisualLastDist = phaseFaceDist;
                    if (delta <= .040) {
                        if (!s.anchorVisualSettledSince) s.anchorVisualSettledSince = now;
                    } else if (delta >= .070) {
                        s.anchorVisualSettledSince = 0;
                    }
                    visualSettled = !!s.anchorVisualSettledSince && (now - s.anchorVisualSettledSince >= cfg.holdConfirmMs);
                } else {
                    s.anchorVisualSettledSince = 0;
                    if (phaseFaceDist !== null) s.anchorVisualLastDist = phaseFaceDist;
                }
                if (anchorZone) {
                    s.anchor = refineAnchor(s.anchor, input, .16);
                    pushAnchorStats(s.anchorStats, input);
                    if (visualSettled) this.enter("Aim / Hold", input);
                }
                const clearlyLost = phaseFaceDist !== null && phaseFaceDist > (cfg.visualAnchorDist || cfg.anchorDist * .80) + .18;
                if (clearlyLost) {
                    if (candidateReady(s, "anchor-lost", now, cfg.anchorLossMs)) this.enter("Draw", input);
                } else if (s.candidate === "anchor-lost") clearCandidate(s);
                if (input.wristsLow && input.setReady !== true && candidateReady(s, "reset", now, 320)) {
                    out.letDown = true; out.shotEvent = "let_down"; this.enter("Setup", input);
                }
            }
            else if (s.phase === "Aim / Hold" || s.phase === "Expansion") {
                const holdAge = s.holdStart ? now - s.holdStart : 0;

                // X2.0 EVENT CORE:
                // Hold duration is athlete-driven, never timer-driven. Once Anchor has been
                // established, this state may remain active indefinitely. Time below is used only
                // for short debounce windows that reject single-frame pose noise.
                const visualHoldPresent = phaseStrongPose || (phaseNearFace && phaseWristVis >= .25 && phaseElbowVis >= .25);

                // X2.3 RELEASE GUARD: classify FRAME-TO-FRAME motion before any Release decision.
                // Absolute displacement from Anchor cannot distinguish Expansion from Release.
                // The signed rearward step (toward the draw elbow), abruptness relative to this
                // athlete's current Hold/Expansion baseline, and elbow continuation are the event cues.
                const curHand=point(input.anchorHandRel),curFaceHand=point(input.faceHandRel),curElbow=point(input.drawElbowRel),curBow=point(input.bowWristRel);
                const rearVec=s.anchor?.rearVec||null;
                const dtMs=s.holdPrevEpochMs&&epochMs>s.holdPrevEpochMs?clamp(epochMs-s.holdPrevEpochMs,18,180):50;
                let rearStep=0,faceRearStep=0,elbowRearStep=0,bowDownStep=0,handDownStep=0,frameSpeed=0;
                if(rearVec&&curHand&&s.holdPrevHand){const dx=curHand.x-s.holdPrevHand.x,dy=curHand.y-s.holdPrevHand.y;rearStep=dot(dx,dy,rearVec.x,rearVec.y);handDownStep=dy;frameSpeed=Math.hypot(dx,dy)/(dtMs/1000);}
                if(rearVec&&curFaceHand&&s.holdPrevFaceHand){const dx=curFaceHand.x-s.holdPrevFaceHand.x,dy=curFaceHand.y-s.holdPrevFaceHand.y;faceRearStep=dot(dx,dy,rearVec.x,rearVec.y);}
                if(rearVec&&curElbow&&s.holdPrevElbow){elbowRearStep=dot(curElbow.x-s.holdPrevElbow.x,curElbow.y-s.holdPrevElbow.y,rearVec.x,rearVec.y);}
                if(curBow&&s.holdPrevBow)bowDownStep=curBow.y-s.holdPrevBow.y;
                const hist=s.holdMotionSamples||[];
                const rearHist=hist.map(x=>x.rearStep),speedHist=hist.map(x=>x.frameSpeed),rearMed=median1(rearHist),rearMad=mad1(rearHist,rearMed),speedMed=median1(speedHist),speedMad=mad1(speedHist,speedMed);
                const rearChangeThreshold=Math.max(.0045,rearMed+Math.max(.0025,rearMad*3.2));
                const speedChangeThreshold=Math.max(.070,speedMed+Math.max(.025,speedMad*2.8));
                const rearwardChange=(rearStep>=rearChangeThreshold||faceRearStep>=rearChangeThreshold*.90) && frameSpeed>=speedChangeThreshold;
                const elbowSupports=elbowRearStep>=Math.max(-.002,rearChangeThreshold*.05);
                const forwardStep=Math.min(rearStep,faceRearStep);
                const forwardGate=Math.max(.0065,rearMad*3.4+.003);
                const directionalLetDown=(forwardStep<=-forwardGate && (handDownStep>=.004||bowDownStep>=.006||input.setReady!==true)) || (bowDownStep>=.010&&handDownStep>=.006);
                const strongLowering = input.wristsLow && input.setReady !== true;
                const postureGone = input.phaseShootingPosture === false && !phaseNearFace && input.setReady !== true;
                const bowLowering = input.phaseBowExtended === false && input.setReady !== true && !phaseNearFace;
                const letDownEvidence = strongLowering || postureGone || bowLowering || directionalLetDown;
                // Let-down ALWAYS has veto authority, even after a release candidate has begun.
                if(letDownEvidence && !s.releaseConfirmed){
                    if(s.pendingRelease){s.pendingRelease=null;out.releaseCandidate=false;out.blocker="let_down_veto";}
                    if(!s.letDownSince)s.letDownSince=now;
                } else if(!s.releaseConfirmed) s.letDownSince=0;
                const letDownDebounceMs=(strongLowering||directionalLetDown)?110:220;
                if(s.letDownSince && now-s.letDownSince>=letDownDebounceMs){
                    out.letDown=true;out.shotEvent="let_down";out.releaseDirectionScore=0;out.releaseForwardScore=Math.max(0,-forwardStep);
                    this.enter("Setup",input);out.blocker="let_down_reset";return Object.assign(out,this.summary(input));
                }
                // Baseline learns normal Hold/Expansion motion only while no candidate exists.
                if(!s.pendingRelease&&curHand&&s.holdPrevHand&&!letDownEvidence){
                    hist.push({rearStep,frameSpeed,elbowRearStep,bowDownStep,epochMs});while(hist.length>24)hist.shift();
                }
                s.holdPrevHand=curHand||s.holdPrevHand;s.holdPrevFaceHand=curFaceHand||s.holdPrevFaceHand;s.holdPrevElbow=curElbow||s.holdPrevElbow;s.holdPrevBow=curBow||s.holdPrevBow;s.holdPrevEpochMs=epochMs;
                out.releaseRearStep=rearStep;out.releaseFaceRearStep=faceRearStep;out.releaseElbowRearStep=elbowRearStep;out.releaseRearThreshold=rearChangeThreshold;out.releaseSpeedThreshold=speedChangeThreshold;out.releaseFrameSpeed=frameSpeed;out.letDownDirectional=directionalLetDown;

                // Release arming is evidence-driven, not cadence-driven. Aim/Hold was already
                // admitted only after an Anchor plateau. Collect a few trustworthy baseline samples
                // and arm after a very short visual debounce. There is NO maximum Hold time and
                // no requirement to release within any time window.
                const holdPlateauDelta = (s.holdVisualFaceRef !== null && phaseFaceDist !== null)
                    ? Math.abs(phaseFaceDist - s.holdVisualFaceRef) : 0;
                const holdPlateauStable = s.holdVisualFaceRef === null || phaseFaceDist === null || holdPlateauDelta <= .050;
                const preArmVisualStable = !s.releaseEverArmed && visualHoldPresent && holdPlateauStable && input.measurementTrustScore >= .30;
                if (preArmVisualStable) {
                    if (!s.anchorStats || s.anchorStats.n < 8) pushAnchorStats(s.anchorStats, input);
                    if (!s.armQuietSince) s.armQuietSince = now;
                } else if (!s.releaseEverArmed) {
                    s.armQuietSince = 0;
                }
                const armBaselineReady = !!(s.anchorQualified && s.anchorStats && s.anchorStats.n >= 3);
                const armVisualReady = !!s.armQuietSince && now - s.armQuietSince >= 70;
                if (!s.releaseEverArmed && armBaselineReady && armVisualReady) {
                    s.releaseEverArmed = true;
                    s.releaseArmed = true;
                    s.releaseArmedAt = now;
                } else if (s.releaseEverArmed) s.releaseArmed = true;
                out.armed = s.releaseArmed;
                out.blocker = s.releaseArmed ? "armed_waiting_release" : "hold_baseline_building";

                // Expansion is an ACTIVITY inside Aim/Hold, not a one-way lifecycle phase and not
                // a prerequisite for Release. It may start/stop repeatedly. The display can surface
                // it as Expansion while the primary lifecycle remains Aim/Hold.
                const activityGeom = s.anchor ? releaseGeom(s, input) : null;
                const activityRms = anchorRms(s.anchorStats);
                if (s.releaseArmed && activityGeom && visualHoldPresent && !s.pendingRelease) {
                    const rearDisp = Math.max(0, num(activityGeom.rear), num(activityGeom.worldRear) * .90, num(activityGeom.elbowRear) * .45);
                    const faceDisp = Math.max(0, num(activityGeom.faceRelDisp), num(activityGeom.worldFaceRelDisp) * .90) * .32;
                    const expansionDisp = Math.max(rearDisp, faceDisp);
                    const expansionStart = Math.max(.006, activityRms.hand * .85 + .003);
                    const expansionStop = expansionStart * .45;
                    const expansionUpper = Math.max(.055, activityRms.hand * 3.2 + .020);
                    const expansionEvidence = expansionDisp >= expansionStart && expansionDisp < expansionUpper
                        && num(input.trackingDrop) < .10 && num(input.visibilityDrop) < .14;
                    if (!s.expansionActive) {
                        if (expansionEvidence) {
                            if (!s.expansionEvidenceSince) s.expansionEvidenceSince = now;
                            if (now - s.expansionEvidenceSince >= 120) {
                                s.expansionActive = true;
                                s.expansionEpisodeCount++;
                                s.expansionStartedAt = now;
                                s.expansionRestSince = 0;
                            }
                        } else s.expansionEvidenceSince = 0;
                    } else {
                        const settledAgain = expansionDisp <= expansionStop || !visualHoldPresent;
                        if (settledAgain) {
                            if (!s.expansionRestSince) s.expansionRestSince = now;
                            if (now - s.expansionRestSince >= 140) {
                                if (s.expansionStartedAt) s.expansionTotalMs += Math.max(0, now - s.expansionStartedAt);
                                s.expansionActive = false;
                                s.expansionStartedAt = 0;
                                s.expansionEvidenceSince = 0;
                                s.expansionRestSince = 0;
                            }
                        } else s.expansionRestSince = 0;
                    }
                } else if (!s.releaseArmed || s.pendingRelease) {
                    s.expansionEvidenceSince = 0;
                    s.expansionRestSince = 0;
                }
                out.activity = s.expansionActive ? "Expansion" : "Hold";
                out.expansionActive = !!s.expansionActive;
                out.expansionEpisodeCount = s.expansionEpisodeCount || 0;

                if (s.releaseArmed && s.anchor && (!s.lastReleaseAt || now - s.lastReleaseAt >= cfg.refractoryMs)) {
                    const g = releaseGeom(s, input), rms = anchorRms(s.anchorStats);
                    if (g) {
                        const candSep = Math.max(.035, rms.hand * 2.4 + .012);
                        const strongSep = Math.max(.070, rms.hand * 3.5 + .025);
                        const candRear = Math.max(.020, rms.hand * 1.8 + .008);
                        const strongRear = Math.max(.052, rms.hand * 2.8 + .018);
                        const candFace = Math.max(.030, rms.face * 2.2 + .010);
                        const strongFace = Math.max(.060, rms.face * 3.2 + .020);
                        const frontal = input.viewType === "front/rear-like";
                        const worldSep = num(g.worldFaceRelDisp), sep = Math.max(g.faceRelDisp, worldSep * .90);
                        const faceHandImpulse = Math.max(num(input.faceHandSpeed), num(input.worldFaceHandSpeed) * .90);
                        const independentHand = sep >= candSep || (sep >= candSep * .72 && g.faceDelta >= candFace && faceHandImpulse >= .050);
                        const headMoved = g.headDisp >= Math.max(.025, rms.head * 2.8 + .010);
                        const localSpecific = !finite(input.visualMotionLocalGlobal) || num(input.visualMotionLocalGlobal) >= 1.08;
                        const torsoRotationLike = (headMoved || !localSpecific) && sep < strongSep * .90 && g.faceDelta < strongFace * .90;
                        const rearLike = g.rear >= candRear * .25 || g.worldRear >= candRear * .22 || g.elbowRear >= .0035 || g.worldElbowDisp >= .024;
                        const localArmMotion = input.visualMotionCorroborated === true || (finite(input.visualMotionLocalGlobal) && num(input.visualMotionLocalGlobal) >= 1.16 && num(input.visualMotionRatio) >= 1.35);
                        // X1.8: X1.6 showed excellent physical recall. Restore that tolerant release
                        // acquisition ONLY after the hard Hold arming barrier. Side-view direction
                        // uncertainty may be rescued by draw-arm-local pixel motion, never by global motion.
                        const directionalRelease = frontal ? independentHand : independentHand && (rearLike || Math.abs(g.off) >= candSep * .52 || localArmMotion);
                        const releaseImpulse = faceHandImpulse >= Math.max(.045, cfg.releaseSpeed * .78)
                            || (faceHandImpulse >= .030 && num(input.drawSpeed) >= Math.max(.080, cfg.releaseSpeed * 1.20) && sep >= strongSep * .72)
                            || ((num(input.trackingDrop) >= .12 || num(input.visibilityDrop) >= .16) && sep >= strongSep * .72);
                        const trackingRelease = localArmMotion
                            && (num(input.trackingDrop) >= .10 || num(input.visibilityDrop) >= .13 || !input.criticalTrackingOK)
                            && (num(input.elbowSpeed) >= .035 || num(input.bowSpeed) >= .030 || g.worldElbowDisp >= .018);
                        const trackingUsable = (relQ >= cfg.releaseQualityMin * .58 && input.drawElbowVisibility >= .22
                            && (input.drawWristVisibility >= .18 || num(input.trackingDrop) >= .08 || num(input.visibilityDrop) >= .10))
                            || (s.releaseEverArmed && trackingRelease && input.drawElbowVisibility >= .15);
                        const anchorQualified = s.anchorQualified && s.anchorStats && s.anchorStats.n >= 2;
                        const kinematicRelease = directionalRelease && releaseImpulse;
                        const directionChange = rearwardChange && elbowSupports && !letDownEvidence;
                        const blurDirectional = trackingRelease && rearStep>Math.max(.002,rearChangeThreshold*.45) && elbowRearStep>=-.003 && !letDownEvidence;
                        const candidateSignal = anchorQualified && s.drawQualified && !s.recoveredSequence && trackingUsable && !torsoRotationLike
                            && (directionChange || blurDirectional) && (kinematicRelease || trackingRelease);
                        if (!s.pendingRelease && candidateSignal) {
                            s.pendingRelease = {
                                startedAt: now, startedEpochMs: epochMs, samples: 1, trustedSamples: input.criticalTrackingOK ? 1 : 0,
                                maxRear: g.rear, maxWorldRear:g.worldRear, maxOff: Math.abs(g.off), maxFace: g.faceDelta,
                                maxFaceRel: g.faceRelDisp, maxWorldFace: worldSep, maxElbow: g.elbowDisp, maxWorldElbow:g.worldElbowDisp,
                                maxElbowRear: g.elbowRear, maxSpeed: num(input.drawSpeed), best: g, holdMs: holdAge,
                                startSep:sep,startRear:Math.max(num(g.rear),num(g.worldRear)*.90),startFace:num(g.faceDelta),
                                startElbow:Math.max(num(g.elbowDisp),num(g.worldElbowDisp)*.65,Math.max(0,num(g.elbowRear))),
                                onsetEpochMs:epochMs, rearStepAtOnset:rearStep, faceRearStepAtOnset:faceRearStep, elbowRearStepAtOnset:elbowRearStep,
                                directionalSteps:0, forwardVetoSteps:0, rearAccum:0, elbowRearAccum:0,
                                lastSep: sep, lastGrowth:0, growthSteps:0, escapeEpochMs:null, lastEpochMs:epochMs, outwardSteps:0, inwardSteps:0, trackingDropSeen:false, bowReaction:false,
                                strongOnset: trackingRelease || faceHandImpulse>=Math.max(.085,cfg.releaseSpeed*1.35) || sep >= strongSep*.92 || g.rear >= strongRear*.82 || g.worldRear >= strongRear*.76 || num(input.drawSpeed)>=Math.max(.11,cfg.releaseSpeed*1.70)
                            };
                        }
                        if (s.pendingRelease) {
                            const p = s.pendingRelease; out.releaseCandidate = true; out.blocker = "release_candidate";
                            const step=Math.max(.004,rms.hand*.35+.001), currentSep=Math.max(g.faceRelDisp,num(g.worldFaceRelDisp)*.90);
                            const currentRear=Math.max(num(g.rear),num(g.worldRear)*.90),currentElbow=Math.max(num(g.elbowDisp),num(g.worldElbowDisp)*.65,Math.max(0,num(g.elbowRear)));
                            const growthSep=Math.max(0,currentSep-num(p.startSep)),growthRear=Math.max(0,currentRear-num(p.startRear)),growthElbow=Math.max(0,currentElbow-num(p.startElbow));
                            const growth=Math.max(growthSep,growthRear*.90,growthElbow*.55),growthStep=Math.max(.006,rms.hand*.45+.002),growthThreshold=Math.max(.016,rms.hand*1.25+.005);
                            const previousEpoch=p.lastEpochMs||p.startedEpochMs;
                            if(currentSep>p.lastSep+step)p.outwardSteps++;
                            else if(currentSep<p.lastSep-step*1.15)p.inwardSteps++;
                            if(rearwardChange&&elbowSupports){p.directionalSteps++;p.rearAccum+=Math.max(0,rearStep);p.elbowRearAccum+=Math.max(0,elbowRearStep);}
                            if(letDownEvidence||rearStep<=-Math.max(.0045,rearMad*2.8+.002)){p.forwardVetoSteps++;}
                            if(growth>p.lastGrowth+growthStep){p.growthSteps++;if(!p.escapeEpochMs&&growth>=growthThreshold)p.escapeEpochMs=previousEpoch;}
                            p.lastGrowth=Math.max(p.lastGrowth,growth);p.lastSep=currentSep;p.lastEpochMs=epochMs;p.samples++;if(input.criticalTrackingOK)p.trustedSamples++;
                            p.maxRear=Math.max(p.maxRear,g.rear);p.maxWorldRear=Math.max(p.maxWorldRear,num(g.worldRear));p.maxOff=Math.max(p.maxOff,Math.abs(g.off));
                            p.maxFace=Math.max(p.maxFace,g.faceDelta);p.maxFaceRel=Math.max(p.maxFaceRel,g.faceRelDisp);p.maxWorldFace=Math.max(p.maxWorldFace,num(g.worldFaceRelDisp));
                            p.maxElbow=Math.max(p.maxElbow,g.elbowDisp);p.maxWorldElbow=Math.max(p.maxWorldElbow,num(g.worldElbowDisp));p.maxElbowRear=Math.max(p.maxElbowRear,g.elbowRear);p.maxSpeed=Math.max(p.maxSpeed,num(input.drawSpeed));
                            if(currentSep>=p.maxFaceRel)p.best=g;
                            if(num(input.trackingDrop)>=.10||num(input.visibilityDrop)>=.16||(!input.criticalTrackingOK&&p.strongOnset))p.trackingDropSeen=true;
                            const bowDelta=finite(input.bowArmDeg)&&finite(s.anchor?.bowArmDeg)?Math.abs(Number(input.bowArmDeg)-Number(s.anchor.bowArmDeg)):0;
                            if(bowDelta>=1.15||num(input.bowSpeed)>=.055||num(g.worldBowDisp)>=.035)p.bowReaction=true;
                            const age=now-p.startedAt;
                            const returned=currentSep<candSep*.52 && g.faceDelta<candFace*.55;
                            const letDown=(letDownEvidence||p.forwardVetoSteps>0) && !p.trackingDropSeen;
                            const twistLike=g.headDisp>=Math.max(.025,rms.head*2.8+.010)&&currentSep<candSep*.92&&g.faceDelta<candFace*.82;
                            const stalledDirection=age>125&&p.directionalSteps<2&&p.growthSteps===0&&!p.trackingDropSeen;
                            if((returned&&age>55&&p.outwardSteps===0)||letDown||twistLike||stalledDirection){
                                s.pendingRelease=null;out.releaseCandidate=false;out.blocker=letDown?"let_down":twistLike?"body_rotation_not_release":stalledDirection?"release_direction_stalled":"release_returned";
                            } else if(age>Math.min(cfg.releaseAbortMs,360)){
                                s.pendingRelease=null;out.releaseCandidate=false;out.blocker="release_candidate_expired";
                            } else {
                                const strongHand=p.maxFaceRel>=strongSep||p.maxWorldFace>=strongSep*.88||p.maxFace>=strongFace||p.maxRear>=strongRear||p.maxWorldRear>=strongRear*.82;
                                const elbowContinuation=p.maxElbow>=.022||p.maxWorldElbow>=.038||p.maxElbowRear>=.008;
                                const continuation=p.outwardSteps>=1||elbowContinuation||p.bowReaction;
                                const blurGrace=p.strongOnset&&p.trackingDropSeen&&age<=220;
                                const temporal=p.trustedSamples>=2||blurGrace;
                                // X2.2: absolute displacement from the frozen Anchor is not enough to prove Release.
                                // Expansion may already have accumulated that displacement. Require NEW escape growth
                                // after the candidate starts, or an impulsive/blur onset with corroborating continuation.
                                const escapeThreshold=Math.max(.016,rms.hand*1.25+.005);
                                const escapeGrowth=p.lastGrowth>=escapeThreshold&&(p.growthSteps>=1||p.outwardSteps>=1);
                                const impulseEscape=p.strongOnset&&(p.growthSteps>=1||p.trackingDropSeen)&&(continuation||p.bowReaction);
                                const directionalConfirmed=p.directionalSteps>=2 && p.rearAccum>=Math.max(.008,rearChangeThreshold*1.35) && p.forwardVetoSteps===0;
                                const blurConfirmed=blurGrace&&p.directionalSteps>=1&&p.forwardVetoSteps===0&&p.rearAccum>=Math.max(.004,rearChangeThreshold*.65);
                                const trueDeparture=(escapeGrowth||impulseEscape) && (directionalConfirmed||blurConfirmed);
                                if(age>=45&&temporal&&trueDeparture&&(strongHand||blurGrace)&&(continuation||blurGrace)){
                                    const denom=Math.max(.0001,Math.max(0,p.maxRear)+p.maxOff);
                                    const confidence=clamp(.60+Math.min(.14,Math.max(0,relQ-cfg.releaseQualityMin)*.34)+(continuation?.09:.04)+(blurGrace?.08:0)+(p.growthSteps>=2?.05:0),.60,.97);
                                    s.lastHoldTime=Math.max(0,p.holdMs/1000);s.releaseEventId++;s.releaseConfirmed=true;
                                    s.releaseEpochMs=p.onsetEpochMs||p.escapeEpochMs||(p.strongOnset&&p.trackingDropSeen?p.startedEpochMs:epochMs);s.releaseConfidence=confidence;s.followEvidence=false;s.releaseInvalidated=false;
                                    s.releaseValidation={confirmedAt:now,candidateStartedEpochMs:p.startedEpochMs,escapeEpochMs:s.releaseEpochMs,confirmSep:currentSep,maxSep:Math.max(currentSep,p.maxFaceRel,p.maxWorldFace*.90),candidateGrowth:p.lastGrowth,growthSteps:p.growthSteps,directionalSteps:p.directionalSteps,rearAccum:p.rearAccum,elbowRearAccum:p.elbowRearAccum,trackingDropSeen:p.trackingDropSeen,bowReaction:p.bowReaction,outwardSteps:p.outwardSteps,elbowAtConfirm:p.maxElbow,worldElbowAtConfirm:p.maxWorldElbow,preTrajectory:elbowContinuation&&p.directionalSteps>=2,visualMotionSeen:input.visualMotionCorroborated===true||((!finite(input.visualMotionCorroborated))&&(num(input.visualMotionRatio)>=1.55||num(input.visualMotionMad)>=3.2))};
                                    const headToward=(()=>{if(!s.anchor?.head||!input.headRel||!s.anchor.wrist)return null;const v=normalize(s.anchor.wrist.x-s.anchor.head.x,s.anchor.wrist.y-s.anchor.head.y);if(!v)return null;return dot(input.headRel.x-s.anchor.head.x,input.headRel.y-s.anchor.head.y,v.x,v.y)*100;})();
                                    s.releaseSummary={releaseRearPct:clamp(Math.max(0,p.maxRear)/denom*100,0,100),releaseOffAxisPct:clamp(p.maxOff/denom*100,0,100),releaseRearTravelPct:p.maxRear*100,releaseOffAxisTravelPct:p.maxOff*100,releaseElbowTravelPct:p.maxElbow*100,releaseFaceRelativeTravelPct:Math.max(p.maxFaceRel,p.maxWorldFace*.90)*100,handOpeningDeltaPct:finite(input.handSpreadPct)&&finite(s.anchor.handSpreadPct)?Number(input.handSpreadPct)-Number(s.anchor.handSpreadPct):null,followBowArmDeltaDeg:finite(input.bowArmDeg)&&finite(s.anchor.bowArmDeg)?Number(input.bowArmDeg)-Number(s.anchor.bowArmDeg):null,followHeadMovePct:p.best.headDisp*100,headTowardDrawPct:headToward,releasePathConfidence:confidence,setToDrawS:s.setAt&&s.drawAt?(s.drawAt-s.setAt)/1000:null,drawToAnchorS:s.drawAt&&s.anchorAt?(s.anchorAt-s.drawAt)/1000:null,anchorToArmS:s.anchorAt&&s.holdAt?(s.holdAt-s.anchorAt)/1000:null,...drawMotionSummary(s.drawMotion)};
                                    s.pendingRelease=null;this.enter("Release",input);out.didRelease=true;out.releaseJustConfirmed=true;out.releaseConfirmed=true;out.releaseConfidence=confidence;out.releaseEpochMs=s.releaseEpochMs;out.holdTimeS=s.lastHoldTime;
                                }
                            }
                        }
                    }
                }
                // X2.0: Aim/Hold itself never regresses to Draw/Anchor from jitter. Expansion is
                // only a reversible activity label. The only lifecycle exit before Release is
                // a sustained, explicit let-down event.
            }
            else if (s.phase === "Release") {
                out.blocker = "release_validation";
                const g=releaseGeom(s,input),rms=anchorRms(s.anchorStats),v=s.releaseValidation;
                if(g&&v){
                    const age=now-v.confirmedAt,sep=Math.max(g.faceRelDisp,num(g.worldFaceRelDisp)*.90),step=Math.max(.005,rms.hand*.45+.002);
                    if(sep>v.maxSep+step){v.maxSep=sep;v.outwardSteps++;}
                    if(num(input.trackingDrop)>=.10||num(input.visibilityDrop)>=.16||(!input.criticalTrackingOK&&age<180))v.trackingDropSeen=true;
                    const bowDelta=finite(input.bowArmDeg)&&finite(s.anchor?.bowArmDeg)?Math.abs(Number(input.bowArmDeg)-Number(s.anchor.bowArmDeg)):0;
                    if(bowDelta>=1.15||num(input.bowSpeed)>=.055||num(g.worldBowDisp)>=.035)v.bowReaction=true;
                    if(input.visualMotionCorroborated===true||((!finite(input.visualMotionCorroborated))&&(num(input.visualMotionRatio)>=1.55||num(input.visualMotionMad)>=3.2)))v.visualMotionSeen=true;
                    const elbowContinued=g.elbowDisp>=Math.max(.024,v.elbowAtConfirm+.004)||num(g.worldElbowDisp)>=Math.max(.040,v.worldElbowAtConfirm+.006);
                    const elbowRearContinued=elbowContinued&&num(g.elbowRear)>=.006;
                    // X2.4 RELEASE PROOF: tracking loss is supporting evidence, never proof by itself.
                    // Hold -> lower can make the hand disappear and used to turn that visibility loss into
                    // a false post-release cue. A provisional Release must now gain independent continuation
                    // (elbow/back-tension, bow reaction, or trustworthy persistent departure).
                    const persistentDeparture=input.criticalTrackingOK&&age>=105&&sep>=Math.max(.028,v.confirmSep*.82);
                    // A real let-down is allowed at any point before a validated post-release cue. Trust lowering
                    // posture only when pose quality is usable; tracking loss itself is handled separately below.
                    const loweringTrust=input.criticalTrackingOK||num(input.measurementTrustScore)>=.45;
                    const postLoweringStrong=loweringTrust&&input.wristsLow&&input.setReady!==true;
                    const postBowLowering=loweringTrust&&input.phaseBowExtended===false&&input.setReady!==true&&!phaseNearFace;
                    const postPostureGone=loweringTrust&&input.phaseShootingPosture===false&&input.setReady!==true&&!phaseNearFace;
                    const postReleaseLetDown=postLoweringStrong||postBowLowering||postPostureGone;
                    // Bow speed/displacement is useful release corroboration only while the posture is not already
                    // classified as lowering; otherwise the lowering itself would masquerade as "bow reaction".
                    const independentContinuation=(v.bowReaction&&!postReleaseLetDown)||elbowRearContinued||(v.visualMotionSeen&&(elbowRearContinued||(v.preTrajectory&&persistentDeparture)));
                    // Blur/tracking loss can strengthen a release that also has post-confirm local visual motion;
                    // it can no longer validate Release from disappearance alone.
                    const blurSupportedContinuation=!postReleaseLetDown&&v.trackingDropSeen&&v.visualMotionSeen&&v.preTrajectory&&age>=105&&sep>=Math.max(.030,v.confirmSep*.90);
                    const continued=independentContinuation||blurSupportedContinuation;
                    out.releasePostIndependent=!!independentContinuation;out.releasePostBlurSupported=!!blurSupportedContinuation;out.releasePostLetDown=!!postReleaseLetDown;
                    const snapBack=input.criticalTrackingOK&&age<=220&&sep<Math.max(.025,v.confirmSep*.45)&&g.faceDelta<.035;
                    if(postReleaseLetDown){
                        const badId=s.releaseEventId,badEpoch=s.releaseEpochMs;s.releaseInvalidated=true;s.invalidatedReleaseEventId=badId;s.releaseConfirmed=false;s.releaseConfidence=null;s.followEvidence=false;s.releaseValidation=null;
                        out.releaseInvalidated=true;out.invalidatedReleaseEventId=badId;out.releaseEpochMs=badEpoch;out.releaseConfirmed=false;out.blocker="release_contradicted_let_down";
                        this.enter("Setup",input);s.releaseEpochMs=null;
                    } else if(snapBack){
                        const badId=s.releaseEventId,badEpoch=s.releaseEpochMs;s.releaseInvalidated=true;s.invalidatedReleaseEventId=badId;s.releaseConfirmed=false;s.releaseConfidence=null;s.followEvidence=false;s.releaseValidation=null;
                        out.releaseInvalidated=true;out.invalidatedReleaseEventId=badId;out.releaseEpochMs=badEpoch;out.releaseConfirmed=false;out.blocker="release_contradicted_return_to_anchor";
                        this.enter("Aim / Hold",input);s.releaseEpochMs=null;
                    } else if(age>=70&&continued){
                        s.lastReleaseAt=now;
                        s.followEvidence=true;this.enter("Follow Through",input);
                    } else if(age>270&&!continued){
                        const badId=s.releaseEventId,badEpoch=s.releaseEpochMs;s.releaseInvalidated=true;s.invalidatedReleaseEventId=badId;s.releaseConfirmed=false;s.releaseConfidence=null;s.followEvidence=false;s.releaseValidation=null;
                        out.releaseInvalidated=true;out.invalidatedReleaseEventId=badId;out.releaseEpochMs=badEpoch;out.releaseConfirmed=false;out.blocker="release_unvalidated";
                        this.enter("Aim / Hold",input);s.releaseEpochMs=null;
                    }
                }
            }
            else if (s.phase === "Follow Through") {
                out.blocker = "follow_through";
                // X2.3 FULL-FOLLOW: Follow-through has no maximum duration. End only when the
                // athlete actually recovers/lowers out of the shot. Never jump directly to Set.
                const recovered = input.wristsLow || (input.setReady!==true && input.phaseShootingPosture===false) || (input.setReady!==true && input.phaseBowExtended===false && !phaseNearFace);
                if(recovered){if(!s.followRecoverySince)s.followRecoverySince=now;}else s.followRecoverySince=0;
                if(s.followRecoverySince && now-s.followRecoverySince>=140){
                    out.followThroughEnded=true;out.followThroughEndEpochMs=epochMs;out.shotEvent="recovery";
                    this.enter("Setup",input);out.blocker="recovery_complete";
                }
            }
            if (s.holdStart && ["Anchor", "Aim / Hold", "Expansion"].includes(s.phase))
                out.holdTimeS = (now - s.holdStart) / 1000;
            else if (["Release", "Follow Through"].includes(s.phase) && s.lastHoldTime !== null)
                out.holdTimeS = s.lastHoldTime;
            const displayPhase = (s.phase === "Aim / Hold" && s.expansionActive) ? "Expansion" : s.phase;
            out.primaryPhase = s.phase;
            out.activity = s.phase === "Aim / Hold" ? (s.expansionActive ? "Expansion" : "Hold") : null;
            out.expansionActive = !!s.expansionActive;
            out.expansionEpisodeCount = s.expansionEpisodeCount || 0;
            out.phase = displayPhase;
            out.armed = !!s.releaseArmed;
            out.releaseCandidate = !!s.pendingRelease;
            out.releaseConfirmed = s.releaseConfirmed;
            out.releaseEpochMs = s.releaseEpochMs;
            out.releaseConfidence = s.releaseConfidence;
            out.releaseEventId = s.releaseEventId;
            out.releaseCandidateGrowth = s.pendingRelease?num(s.pendingRelease.lastGrowth):(s.releaseValidation?num(s.releaseValidation.candidateGrowth):0);
            out.releaseCandidateGrowthSteps = s.pendingRelease?num(s.pendingRelease.growthSteps):(s.releaseValidation?num(s.releaseValidation.growthSteps):0);
            out.releaseCandidateStartedEpochMs = s.pendingRelease?num(s.pendingRelease.startedEpochMs):(s.releaseValidation?num(s.releaseValidation.candidateStartedEpochMs):null);
            out.releaseDirectionalSteps = s.pendingRelease?num(s.pendingRelease.directionalSteps):(s.releaseValidation?num(s.releaseValidation.directionalSteps):0);
            out.releaseRearAccum = s.pendingRelease?num(s.pendingRelease.rearAccum):(s.releaseValidation?num(s.releaseValidation.rearAccum):0);
            out.releaseElbowRearAccum = s.pendingRelease?num(s.pendingRelease.elbowRearAccum):(s.releaseValidation?num(s.releaseValidation.elbowRearAccum):0);
            out.releaseAlignedEpochMs = s.releaseEpochMs;
            out.followThroughConfirmed = s.followEvidence;
            out.postReleaseEvidence = s.followEvidence;
            out.followEvidence = s.followEvidence;
            out.recoveredSequence = s.recoveredSequence;
            out.sequenceQualified = !!(s.drawQualified && s.anchorQualified);
            return Object.assign(out, this.summary(input));
        }
        summary(input) {
            const s = this.s, rms = anchorRms(s.anchorStats), g = releaseGeom(s, input);
            const result = {
                anchorSampleCount: s.anchorStats?.n || 0, anchorHandRmsPct: rms.hand * 100, anchorFaceRmsPct: rms.face * 100, anchorHeadRmsPct: rms.head * 100,
                anchorSettleTimeS: s.anchorAt && s.holdAt ? Math.max(0, (s.holdAt - s.anchorAt) / 1000) : null,
                anchorReferenceHandX: s.anchor?.wrist?.x ?? null, anchorReferenceHandY: s.anchor?.wrist?.y ?? null,
                anchorReferenceHeadX: s.anchor?.head?.x ?? null, anchorReferenceHeadY: s.anchor?.head?.y ?? null,
                anchorReferenceFacePct: finite(s.anchor?.faceDist) ? Number(s.anchor?.faceDist) * 100 : null, anchorReferenceHeadPitch: s.anchor?.headPitchDeg ?? null,
                expansionActive: !!s.expansionActive,
                expansionEpisodeCount: s.expansionEpisodeCount || 0,
                expansionTotalS: ((s.expansionTotalMs || 0) + (s.expansionActive && s.expansionStartedAt ? Math.max(0, (input?.now || 0) - s.expansionStartedAt) : 0)) / 1000
            };
            if (s.anchor?.wrist && input.anchorHandRel)
                result.anchorHandDriftPct = dist(s.anchor.wrist, input.anchorHandRel) * 100;
            if (g && s.anchor?.head && s.anchor?.wrist && input.headRel) {
                const v = normalize(s.anchor.wrist.x - s.anchor.head.x, s.anchor.wrist.y - s.anchor.head.y);
                if (v)
                    result.headTowardDrawPct = dot(input.headRel.x - s.anchor.head.x, input.headRel.y - s.anchor.head.y, v.x, v.y) * 100;
            }
            return Object.assign(result, s.releaseSummary || {});
        }
    }
    class AthleteShotEngine {
        constructor() {
            this.trackers = {
                side: new ViewShotTracker("side"), rear: new ViewShotTracker("rear"), overhead: new ViewShotTracker("overhead")
            };
            this.latestInputs = {};
            this.latestResults = {};
            this.authority = new AuthorityTracker(.09, 460);
            this.lockedAuthority = null;
            this.centralPhase = "Setup";
            this.timeline = [];
            this.pending = null;
            this.lastCommitEpochMs = 0;
            this.shotCompleteEventId = 0;
        }
        reset() {
            for (const r of CAPTURE_ROLES)
                this.trackers[r].reset();
            this.latestInputs = {};
            this.latestResults = {};
            this.authority.reset();
            this.lockedAuthority = null;
            this.centralPhase = "Setup";
            this.timeline = [];
            this.pending = null;
            this.lastCommitEpochMs = 0;
            this.shotCompleteEventId = 0;
        }
        metricForAuthority(role) {
            const i = this.latestInputs[role], r = this.latestResults[role];
            if (!i || !r)
                return null;
            return { role, detected: true, epochMs: i.epochMs, phase: r.phase, phaseQuality: i.phaseQuality, quality: i.phaseQuality, releaseQuality: i.releaseQuality, shotObservability: Math.max(i.phaseQuality, i.releaseQuality), identityConfidence: 1, criticalTrackingOK: i.criticalTrackingOK, armed: r.armed, releaseCandidate: r.releaseCandidate, releaseConfirmed: r.releaseConfirmed };
        }
        recordPhase(phase, epochMs, role, confidence) {
            const last = this.timeline[this.timeline.length - 1];
            if (last?.phase === phase)
                return;
            this.timeline.push({ phase, epochMs, role, confidence });
            while (this.timeline.length > 18)
                this.timeline.shift();
            this.centralPhase = phase;
        }
        authorityRole(now) {
            const metrics = {};
            for (const r of CAPTURE_ROLES)
                metrics[r] = this.metricForAuthority(r);
            const d = this.authority.update(metrics, now);
            return d.role;
        }
        update(role, input, profileName = "verified") {
            const result = this.trackers[role].update(input, profileName);
            this.latestInputs[role] = input;
            this.latestResults[role] = result;
            const now = input.now, bestRole = this.authorityRole(now);
            if (this.lockedAuthority) {
                const lockedInput = this.latestInputs[this.lockedAuthority];
                if (!lockedInput || input.epochMs - lockedInput.epochMs > 700)
                    this.lockedAuthority = null;
            }
            // Lock the display/timing authority once a genuine sequence is underway. Auxiliary
            // cameras continue to collect evidence and can corroborate the same release.
            if (!this.lockedAuthority) {
                const candidate = bestRole || role;
                const p = (this.latestResults[candidate]?.phase || "Setup");
                if (PHASE_RANK[p] >= PHASE_RANK.Draw && PHASE_RANK[p] <= PHASE_RANK["Follow Through"])
                    this.lockedAuthority = candidate;
            }
            const centralRole = this.lockedAuthority || bestRole || role;
            const centralResult = this.latestResults[centralRole] || result;
            const centralInput = this.latestInputs[centralRole] || input;
            const phase = centralResult.phase;
            if (phase !== this.centralPhase)
                this.recordPhase(phase, centralInput.epochMs, centralRole, num(centralInput.phaseQuality));
            if(result.releaseInvalidated && this.pending){
                const sameEvent=!result.invalidatedReleaseEventId||!this.pending.releaseEventId||result.invalidatedReleaseEventId===this.pending.releaseEventId;
                const sameEpoch=!result.releaseEpochMs||Math.abs(Number(result.releaseEpochMs)-Number(this.pending.releaseEpochMs))<=520;
                if(sameEvent&&sameEpoch)this.pending=null;
            }
            const justConfirmed = !!result.releaseJustConfirmed;
            if (justConfirmed && result.releaseEpochMs && (!this.lastCommitEpochMs || Math.abs(result.releaseEpochMs - this.lastCommitEpochMs) >= 850)) {
                if (!this.pending || Math.abs(result.releaseEpochMs - this.pending.releaseEpochMs) > 520) {
                    this.pending = {
                        releaseEpochMs: result.releaseEpochMs, confirmedAt: now, primaryRole: role, releaseEventId: result.releaseEventId||0,
                        confidence: num(result.releaseConfidence), holdTimeS: finite(result.holdTimeS) ? Number(result.holdTimeS) : null,
                        evidenceRoles: new Set([role]), followEvidence: !!result.postReleaseEvidence,
                        primaryResult: { ...result }
                    };
                    this.recordPhase("Release", result.releaseEpochMs, role, num(result.releaseConfidence));
                }
                else {
                    this.pending.evidenceRoles.add(role);
                    if (num(result.releaseConfidence) > this.pending.confidence) {
                        this.pending.confidence = num(result.releaseConfidence);
                        this.pending.primaryRole = role;
                        this.pending.primaryResult = { ...result };
                        this.pending.releaseEpochMs = Math.min(this.pending.releaseEpochMs, result.releaseEpochMs);
                    }
                }
            }
            else if (this.pending && result.releaseConfirmed && result.releaseEpochMs && Math.abs(result.releaseEpochMs - this.pending.releaseEpochMs) <= 520) {
                this.pending.evidenceRoles.add(role);
            }
            if (this.pending && result.postReleaseEvidence && result.releaseEpochMs && Math.abs(result.releaseEpochMs - this.pending.releaseEpochMs) <= 520)
                this.pending.followEvidence = true;
            let shotComplete = false;
            if (this.pending) {
                const cfg = PROFILES[profileName] || PROFILES.verified;
                const age = now - this.pending.confirmedAt;
                // X2.4: multiple cameras may corroborate the SAME candidate, but they cannot manufacture
                // a shot. At least one view must complete genuine post-release validation first.
                const commit = age >= cfg.followCommitMinMs && this.pending.followEvidence;
                if (commit) {
                    shotComplete = true;
                    this.shotCompleteEventId++;
                    this.lastCommitEpochMs = this.pending.releaseEpochMs;
                    if (this.centralPhase !== "Follow Through")
                        this.recordPhase("Follow Through", input.epochMs, role, this.pending.confidence);
                }
                else if (age > Math.max(900, cfg.releaseAbortMs + 180)) {
                    // Ambiguous candidate expired without real post-release evidence: do not create a shot.
                    this.pending = null;
                }
            }
            const p = this.pending;
            const primary = p?.primaryResult || centralResult;
            const out = {
                ...primary,
                phase: this.centralPhase,
                holdTimeS: p?.holdTimeS ?? centralResult.holdTimeS ?? null,
                shotComplete,
                releaseConfirmed: !!p || !!centralResult.releaseConfirmed,
                followThroughConfirmed: !!p?.followEvidence || !!centralResult.followThroughConfirmed,
                postReleaseEvidence: !!p?.followEvidence || !!centralResult.postReleaseEvidence,
                releaseConfidence: p?.confidence ?? centralResult.releaseConfidence ?? null,
                releaseEpochMs: p?.releaseEpochMs ?? centralResult.releaseEpochMs ?? null,
                evidenceRoles: p ? Array.from(p.evidenceRoles) : [centralRole],
                phaseTimeline: clonePhaseTimeline(this.timeline),
                shotCompleteEventId: this.shotCompleteEventId,
                releaseEventId: centralResult.releaseEventId || 0,
                sequenceQualified: !!primary.sequenceQualified,
                blocker: shotComplete ? null : (centralResult.blocker || null),
                releaseInvalidated: !!centralResult.releaseInvalidated,
                invalidatedReleaseEventId: centralResult.invalidatedReleaseEventId||0
            };
            if (shotComplete && p) {
                // Emit the event exactly once. Keep per-view trackers alive for natural follow-through,
                // but the central pending shot is cleared immediately so UI cadence cannot duplicate it.
                this.pending = null;
            }
            const allBack = CAPTURE_ROLES.every(r => {
                const pr = this.latestResults[r]?.phase;
                return !pr || pr === "Setup" || pr === "Set";
            });
            if (allBack && this.lastCommitEpochMs && input.epochMs - this.lastCommitEpochMs > 650) {
                this.lockedAuthority = null;
                this.timeline = [];
                this.centralPhase = "Setup";
            }
            return out;
        }
        getAuthorityRole() { return this.lockedAuthority || this.authority.getRole(); }
        getPhaseTimeline() { return clonePhaseTimeline(this.timeline); }
    }
    ThreePMCore.AthleteShotEngine = AthleteShotEngine;
    function createAthleteShotEngine() { return new AthleteShotEngine(); }
    ThreePMCore.createAthleteShotEngine = createAthleteShotEngine;
    /** Persistence invariant. Follow-through quality is ANALYSIS evidence, not a prerequisite
     * for the existence of a genuine shot. The central engine already requires a short
     * post-release window before shotComplete is emitted.
     */
    function validateCompletedShotEvidence(m) {
        if (!m || !roleOk(m.role))
            return { accepted: false, reason: "invalid camera role/evidence" };
        if (!m.detected)
            return { accepted: false, reason: "athlete not detected" };
        if (m.identityAmbiguous)
            return { accepted: false, reason: "athlete identity ambiguous" };
        if (!m.shotComplete)
            return { accepted: false, reason: "central shot event not complete" };
        if (!m.releaseConfirmed)
            return { accepted: false, reason: "release not confirmed" };
        if (!m.postReleaseEvidence)
            return { accepted: false, reason: "post-release evidence missing" };
        if (m.sequenceQualified === false)
            return { accepted: false, reason: "shot sequence not qualified" };
        if (!finite(m.releaseEpochMs))
            return { accepted: false, reason: "release timestamp missing" };
        if (num(m.shotObservability, .5) < .20)
            return { accepted: false, reason: "shot evidence too weak" };
        if (num(m.identityConfidence, 1) < .34)
            return { accepted: false, reason: "athlete identity confidence too low" };
        return { accepted: true, reason: "central release sequence validated" };
    }
    ThreePMCore.validateCompletedShotEvidence = validateCompletedShotEvidence;
    class ShotCoordinator {
        constructor(mergeWindowMs = 560, duplicateWindowMs = 850) {
            this.mergeWindowMs = mergeWindowMs;
            this.duplicateWindowMs = duplicateWindowMs;
            this.pending = [];
            this.lastCommitEpochMs = 0;
        }
        offer(m) {
            const valid = validateCompletedShotEvidence(m);
            if (!valid.accepted)
                return valid;
            const epoch = num(m.releaseEpochMs);
            if (this.lastCommitEpochMs && Math.abs(epoch - this.lastCommitEpochMs) < this.duplicateWindowMs)
                return { accepted: false, reason: "duplicate of committed shot" };
            this.pending = this.pending.filter(x => Math.abs(num(x.releaseEpochMs) - epoch) < this.mergeWindowMs);
            const i = this.pending.findIndex(x => x.role === m.role);
            if (i >= 0)
                this.pending[i] = m;
            else
                this.pending.push(m);
            return { accepted: true, reason: "queued" };
        }
        flush() {
            if (!this.pending.length)
                return { commit: null, evidenceRoles: [], reason: "empty" };
            const valid = this.pending.filter(m => validateCompletedShotEvidence(m).accepted);
            this.pending = [];
            if (!valid.length)
                return { commit: null, evidenceRoles: [], reason: "no valid evidence" };
            valid.sort((a, b) => evidenceScore(b) - evidenceScore(a));
            const best = valid[0];
            if (!best)
                return { commit: null, evidenceRoles: [], reason: "empty" };
            const epoch = num(best.releaseEpochMs);
            if (this.lastCommitEpochMs && Math.abs(epoch - this.lastCommitEpochMs) < this.duplicateWindowMs)
                return { commit: null, evidenceRoles: [], reason: "duplicate at flush" };
            this.lastCommitEpochMs = epoch;
            const roles = Array.from(new Set(valid.flatMap(v => (v.evidenceRoles?.length ? v.evidenceRoles : [v.role])))).filter(roleOk);
            return { commit: { ...best, evidenceRoles: roles }, evidenceRoles: roles, reason: "commit" };
        }
        reset() { this.pending = []; this.lastCommitEpochMs = 0; }
        getPendingCount() { return this.pending.length; }
    }
    ThreePMCore.ShotCoordinator = ShotCoordinator;
    function firstPhase(events, phase) {
        const found = events.find(e => e.phase === phase && finite(e.epochMs));
        return found ? Number(found.epochMs) : null;
    }
    function lastPhase(events, phase) {
        const arr = events.filter(e => e.phase === phase && finite(e.epochMs));
        return arr.length ? Number(arr[arr.length - 1]?.epochMs) : null;
    }
    /** Select what the coach sees AFTER the shot. This is not the capture limit. */
    function buildCoachEvidencePlan(phaseTimeline, releaseEpochMs) {
        const release = Number(releaseEpochMs), events = Array.isArray(phaseTimeline) ? phaseTimeline.filter(e => finite(e.epochMs)) : [];
        const requests = [];
        const add = (epoch, label, phase, priority) => {
            // null/undefined are not timestamps. Number(null) is 0, so the generic finite()
            // helper would otherwise create phantom phase frames at epoch zero.
            if (epoch === null || epoch === undefined || releaseEpochMs === null || releaseEpochMs === undefined || !finite(epoch) || !finite(release))
                return;
            const offset = Math.round(Number(epoch) - release);
            if (offset < -12000 || offset > 1800)
                return;
            if (requests.some(r => Math.abs(r.offset - offset) < 18 && r.phase === phase))
                return;
            requests.push({ offset, label, phase, priority });
        };
        const setAt = firstPhase(events, "Set"), drawAt = firstPhase(events, "Draw"), anchorAt = firstPhase(events, "Anchor"), holdAt = firstPhase(events, "Aim / Hold"), expansionAt = firstPhase(events, "Expansion");
        add(setAt, "Set", "Set", 5);
        add(drawAt, "Draw Start", "Draw", 5);
        if (drawAt !== null && anchorAt !== null && anchorAt - drawAt > 240)
            add(drawAt + (anchorAt - drawAt) * .52, "Mid Draw", "Draw", 6);
        add(anchorAt, "Anchor Acquisition", "Anchor", 8);
        if (holdAt !== null && release > holdAt) {
            const dur = release - holdAt;
            if (dur >= 1800) {
                add(holdAt + dur * .22, "Hold · Early", "Aim / Hold", 6);
                add(holdAt + dur * .52, "Hold · Mid", "Aim / Hold", 6);
                add(holdAt + dur * .80, "Hold · Late", "Aim / Hold", 7);
            }
            else if (dur >= 420)
                add(holdAt + dur * .50, "Hold", "Aim / Hold", 6);
            else
                add(holdAt, "Hold", "Aim / Hold", 6);
        }
        add(expansionAt, "Expansion", "Expansion", 8);
        // 30 fps release micro-sequence. These selected coach frames are NOT the capture limit;
        // Full Shot Evidence retains the dense rolling window separately.
        add(release - 200, "Pre-Release", "Release", 9);
        add(release - 100, "-0.10 s", "Release", 10);
        add(release - 33, "-0.03 s", "Release", 10);
        add(release, "Release Onset", "Release", 10);
        add(release + 33, "+0.03 s", "Follow Through", 10);
        add(release + 67, "+0.07 s", "Follow Through", 10);
        add(release + 100, "+0.10 s", "Follow Through", 10);
        add(release + 167, "+0.17 s", "Follow Through", 10);
        add(release + 250, "+0.25 s", "Follow Through", 10);
        add(release + 500, "+0.50 s", "Follow Through", 9);
        add(release + 900, "Follow-through", "Follow Through", 7);
        requests.sort((a, b) => a.offset - b.offset);
        // Keep the coach strip readable without throwing away the underlying rolling evidence.
        const compact = [];
        for (const r of requests) {
            if (compact.length < 12)
                compact.push(r);
            else {
                const low = compact.reduce((best, x, i, arr) => x.priority < arr[best].priority ? i : best, 0);
                if (r.priority > compact[low].priority)
                    compact[low] = r;
            }
        }
        compact.sort((a, b) => a.offset - b.offset);
        if (!compact.some(r => r.offset === 0))
            compact.push({ offset: 0, label: "Release Onset", phase: "Release", priority: 10 });
        compact.sort((a, b) => a.offset - b.offset);
        const requiredPostMs = Math.max(650, ...compact.map(r => Math.max(0, r.offset))) + 180;
        return { requests: compact, requiredPostMs, source: events.length ? "phase-aware" : "release-window" };
    }
    ThreePMCore.buildCoachEvidencePlan = buildCoachEvidencePlan;
    /** Passive downstream matrix: never changes detection or shot commit. */
    function buildBiomechanicsMatrix(m) {
        if (!m)
            return [];
        const confObj = (m.metricConfidence && typeof m.metricConfidence === "object") ? m.metricConfidence : {};
        const role = roleOk(m.role) ? m.role : null;
        const cell = (phase, segment, metric, key, unit = "", confKey = key) => {
            const value = finite(m[key]) ? Number(m[key]) : null, conf = finite(confObj[confKey]) ? Number(confObj[confKey]) : finite(m.phaseQuality) ? Number(m.phaseQuality) : null;
            return { phase, segment, metric, value, unit, confidence: conf, sourceRole: role, status: value === null ? "unavailable" : (conf !== null && conf < .45 ? "limited" : "measured") };
        };
        return [
            cell("Anchor", "Draw arm", "Draw elbow", "drawElbowDeg", "°", "drawElbow"),
            cell("Hold", "Bow arm", "Bow arm angle", "bowArmDeg", "°", "bowArm"),
            cell("Hold", "Shoulders", "Shoulder line", "shoulderLineDeg", "°", "shoulderLine"),
            cell("Hold", "Torso", "Torso lean", "torsoLeanDeg", "°", "torsoLean"),
            cell("Anchor", "Head / hand", "Anchor hand drift", "anchorHandDriftPct", "%", "anchor"),
            cell("Release", "Draw hand", "Rearward path share", "releaseRearPct", "%", "anchor"),
            cell("Release", "Draw hand", "Off-axis path share", "releaseOffAxisPct", "%", "anchor"),
            cell("Release", "Draw elbow", "Elbow continuation", "releaseElbowTravelPct", "%", "drawElbow"),
            cell("Follow Through", "Bow arm", "Bow arm reaction", "followBowArmDeltaDeg", "°", "bowArm"),
            cell("Follow Through", "Head", "Head movement", "followHeadMovePct", "%", "headMovement")
        ];
    }
    ThreePMCore.buildBiomechanicsMatrix = buildBiomechanicsMatrix;
    function assertRuntimeContract() {
        const errors = [];
        if (CAPTURE_ROLES.length !== 3)
            errors.push("camera role contract changed");
        const c = new ShotCoordinator();
        if (c.offer({ role: "side", detected: true, shotComplete: true }).accepted)
            errors.push("incomplete release accepted");
        if (c.offer({ role: "side", detected: true, shotComplete: true, releaseConfirmed: true, releaseEpochMs: 1000, sequenceQualified: true, shotObservability: .9, identityConfidence: .9, postReleaseEvidence: false }).accepted)
            errors.push("shot accepted without post-release evidence");
        const plan = buildCoachEvidencePlan([{ phase: "Draw", epochMs: 1000 }, { phase: "Anchor", epochMs: 1800 }, { phase: "Aim / Hold", epochMs: 2000 }, { phase: "Release", epochMs: 4000 }], 4000);
        if (!plan.requests.some(r => r.label === "Release Onset") || !plan.requests.some(r => r.label.includes("Hold")))
            errors.push("phase evidence plan incomplete");
        return { ok: errors.length === 0, errors };
    }
    ThreePMCore.assertRuntimeContract = assertRuntimeContract;
})(ThreePMCore || (ThreePMCore = {}));
window.CoreEngine = ThreePMCore;
