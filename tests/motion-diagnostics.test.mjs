import test from 'node:test';
import assert from 'node:assert/strict';
import * as diagnostics from './helpers/motion-diagnostics.mjs';
test('disabled Motion diagnostics leave routes, init scripts and media prototypes untouched',async()=>{
 const calls=[];const page={async route(){calls.push('route');},async addInitScript(){calls.push('init');},async evaluate(){calls.push('evaluate');}};
 await diagnostics.installMotionDiagnostics(page,{enabled:false});await diagnostics.recordMotionFailure(page,{}, {enabled:false});assert.deepEqual(calls,[],'ordinary MOT-07 must install no interception or prototype-changing script');
});
test('enabled Motion diagnostics observe without rewriting source or overriding native setters',async()=>{
 const calls=[];const page={async route(){calls.push('route');},async addInitScript(fn){calls.push('init');assert.doesNotMatch(fn.toString(),/defineProperty|\.prototype|__motionDebug/);}};
 await diagnostics.installMotionDiagnostics(page,{enabled:true});assert.deepEqual(calls,['init']);assert.equal(diagnostics.instrumentMotionSource,undefined);
});
test('disabled MOT-07 reads its original predicate and writes no diagnostic artifact',async()=>{
 let reads=0;const video={async evaluate(fn){reads++;return fn({ended:false,currentTime:1.2,duration:1.2});}};
 const info={outputPath(){assert.fail('disabled artifact write');},attach(){assert.fail('disabled attachment');}};let value;
 await assert.doesNotReject(async()=>{value=await diagnostics.recordMotionCheck({},video,info,{enabled:false});});assert.equal(value,true);assert.equal(reads,1);
});
