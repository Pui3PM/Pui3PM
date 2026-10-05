'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),css=fs.readFileSync(path.join(root,'static/style.css'),'utf8'),html=fs.readFileSync(path.join(root,'static/index.html'),'utf8');
for(const m of ['BLE4.3.8.9.4.1 Live-phase no-reflow contract','.phase-guard-reason','.phase-pill','.readiness-chip'])assert(css.includes(m),`no-reflow CSS marker missing ${m}`);
assert(css.includes('-webkit-line-clamp:2')||css.includes('-webkit-line-clamp: 2'),'reason line must be height-bounded');assert(css.includes('text-overflow:ellipsis')||css.includes('text-overflow: ellipsis'),'dynamic diagnostics must not grow layout');assert(css.includes('white-space:nowrap')||css.includes('white-space: nowrap'),'phase labels must not reflow on status churn');
for(const m of ['coach_keyframe25_backfill_layer.js?v=mac20260930r7','camera_fps_guard_layer.js?v=ble438941'])assert(html.includes(m),`safe background layer not wired ${m}`);
console.log('BLE4.3.8.9.4.1 UI Stability QA PASS · bounded dynamic text · fixed phase footprint · background enrichment/governor wired');
