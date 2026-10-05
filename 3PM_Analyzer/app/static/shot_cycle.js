(function(root){
  'use strict';
  // V5 compatibility facade. The V4 per-camera shot algorithm has been removed.
  // PoseEngine uses CoreEngine.createAthleteShotEngine() directly. These functions
  // remain only so legacy diagnostics do not fail if they probe ShotCycleEngine.
  root.ShotCycleEngine={
    PROFILES:{verified:{},balanced:{},conservative:{}},
    createState(){return {engine:root.CoreEngine?.createAthleteShotEngine?.()||null,role:'side'};},
    reset(s){if(s?.engine?.reset)s.engine.reset();return s;},
    update(s,input,profile='verified'){
      if(!s?.engine)return {phase:'Setup',shotComplete:false,releaseConfirmed:false,followThroughConfirmed:false};
      return s.engine.update(s.role||'side',input,profile);
    }
  };
})(typeof window!=='undefined'?window:globalThis);
