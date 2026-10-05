'use strict';
const {isI64String,isU64String,timeUsOrNull}=require('./strict_types');
function rational(numerator,denominator){
  if(!isU64String(numerator)||!isU64String(denominator)||BigInt(numerator)<=0n||BigInt(denominator)<=0n) throw new TypeError('Invalid timebase');
  return {numerator,denominator};
}
function ticksToMicroseconds(ticks,timebase){
  if(ticks===null) return null;
  if(!isI64String(ticks)||!timebase) throw new TypeError('Invalid source ticks/timebase');
  const t=BigInt(ticks),n=BigInt(timebase.numerator),d=BigInt(timebase.denominator);
  const num=t*n*1000000n;
  const q=num/d, r=num%d, absR=r<0n?-r:r, absD=d<0n?-d:d;
  let rounded=q;
  const twice=absR*2n;
  if(twice>absD || (twice===absD && (q&1n)!==0n)) rounded += num>=0n?1n:-1n;
  const out=Number(rounded);if(!Number.isSafeInteger(out)) throw new RangeError('Mapped time exceeds JS safe integer');return out;
}
function mappedTimeOrNull(v){ return timeUsOrNull(v); }
module.exports={rational,ticksToMicroseconds,mappedTimeOrNull};
