'use strict';
class VirtualClock{
  constructor(startUs=0){if(!Number.isSafeInteger(startUs))throw new TypeError('startUs');this.nowUs=startUs;}
  now(){return this.nowUs;}
  set(us){if(!Number.isSafeInteger(us)||us<this.nowUs)throw new RangeError('virtual clock cannot move backward');this.nowUs=us;return us;}
  advance(deltaUs){if(!Number.isSafeInteger(deltaUs)||deltaUs<0)throw new RangeError('deltaUs');this.nowUs+=deltaUs;return this.nowUs;}
}
function deterministicReplay(events,reducer,initialState,clock=new VirtualClock()){
  let state=initialState;
  const out=[];
  for(const e of events){if(Number.isSafeInteger(e.atUs))clock.set(e.atUs);state=reducer(state,e,clock);out.push({atUs:clock.now(),state});}
  return {state,steps:out};
}
module.exports={VirtualClock,deterministicReplay};
