'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const p=path.resolve(__dirname,'../../static/evidence_integrity_repair_layer.js');
const s=fs.readFileSync(p,'utf8');
const checks={
  observerCallsRefresh:/new MutationObserver\(refresh\)\.observe\(host/.test(s),
  refreshCallsRender:/queueMicrotask\(\(\)=>\{scheduled=false;rebindAnchor\(\);renderRail\(\);annotateMeta\(\);\}\)/.test(s),
  rendererClearsObservedSubtree:/rail\.innerHTML='';/.test(s),
  rendererAppendsChildren:/rail\.appendChild\(b\)/.test(s),
  observerWatchesChildList:/childList:true/.test(s)
};
for(const [k,v] of Object.entries(checks))assert(v,`missing expected F01 source characteristic: ${k}`);
console.log(JSON.stringify({finding:'F01',sourceCharacterization:checks,dynamicBrowserRepro:'required externally; local Chromium runtime blocked'},null,2));
