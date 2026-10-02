const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'static/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'static/style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'static/pose_visual_fallback.js'),'utf8');
for(const marker of ['pose_visual_fallback.js?v=ble4362','data-focus-role="side"','data-focus-role="rear"','data-focus-role="overhead"'])if(!html.includes(marker))throw new Error(marker);
for(const marker of ['.pose-visual-fallback-overlay','.pose-visual-fallback-badge'])if(!css.includes(marker))throw new Error(marker);
for(const marker of ['const ROLES = ["rear", "overhead"]','coreOwnsVisual','VISUAL SKELETON · measurement gated','window.PoseEngine?.getLatestMetrics','minPoseDetectionConfidence:.40'])if(!js.includes(marker))throw new Error(marker);
// Frozen analysis files must remain byte-identical to the prior field build.
const crypto=require('crypto');
const expected={
 'static/core_runtime.js':'89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf',
 'static/pose.js':'22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d',
 'static/pose_filter_core.js':'d542d49020b85035710135a2c87dfed2718bac1a887aacce513b19cf0890e411',
 'static/shot_cycle.js':'4cc84c3ada201bb443270ae7c94f2a74814571f18b4ead44f6cb1592141c8ccb'
};
for(const [f,h] of Object.entries(expected)){const got=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');if(got!==h)throw new Error(`Frozen hash changed ${f}: ${got}`);}

// app.js is intentionally additive after BLE4362; verify the multi-camera contract instead of freezing the entire app bundle.
const app=fs.readFileSync(path.join(root,'static/app.js'),'utf8');
for(const marker of ['const CAMERA_ROLES = [\"side\", \"rear\", \"overhead\"]','$(`#${role}Video`)','reviewRole'])if(!app.includes(marker))throw new Error(`Multi-camera app contract missing ${marker}`);

console.log('BLE4.3.6.2 multi-camera skeleton/focus static QA: PASS');
