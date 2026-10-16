import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {freezeValidatedExperience} from '../src/experience/freeze-validated-experience.mjs';
import {readExperienceBeats} from '../src/experience/beat-groups.mjs';
import {createPlayerContent} from '../src/host/player-content.mjs';
import {resolveWordPressDeepLink} from '../src/host/wordpress-deep-link.mjs';
import {createBoundaryModel} from '../src/core/boundary-model.mjs';
import {createCiMInstance} from '../src/runtime/cim-instance.mjs';

const raw = JSON.parse(await readFile(new URL('../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));
const lesson = freezeValidatedExperience(raw);
const ids = ['initial',...lesson.steps.map(step => step.id)];
const beats = readExperienceBeats(lesson);
function changed(mutator) {const copy = structuredClone(raw); mutator(copy); return freezeValidatedExperience(copy);}

test('beat metadata is exact frozen instructional data aligned with every boundary', () => {
  const content = createPlayerContent(lesson,ids);
  assert.equal(content.beats.length,8);
  assert.deepEqual(content.beats.flatMap(beat => beat.boundaryIds),ids.slice(1));
  for (const beat of content.beats) {
    assert.deepEqual(Object.keys(beat),['id','ordinal','heading','finalStepId','boundaryIds']);
    assert.equal(beat.finalStepId,beat.boundaryIds.at(-1));
    assert.equal(Object.isFrozen(beat),true); assert.equal(Object.isFrozen(beat.boundaryIds),true);
  }
  assert.equal(Object.isFrozen(content.beats),true);
  let inspected = 0;
  const steps = lesson.steps.map(step => Object.freeze({...step,
    get state() { inspected += 1; throw new Error('opaque state inspected'); }}));
  const opaque = Object.freeze({...lesson,steps:Object.freeze(steps)});
  assert.equal(createPlayerContent(opaque,ids).beats.length,8);
  assert.equal(resolveWordPressDeepLink('#cim/git-repository-practice/stage-hunk',lesson.id,opaque).stepId,'stage-hunk--s04');
  assert.equal(inspected,0);
});

test('malformed beat grouping fails before a partial projection is exposed', () => {
  for (const mutate of [
    e => { e.presentation.beat_count = 9; },
    e => { e.steps[1].beat.segment_ordinal = 3; },
    e => { e.steps[1].beat.heading = 'Changed'; },
    e => { e.steps[0].beat.final = true; },
    e => { e.steps[2].beat.id = 'check-status'; },
    e => { e.steps[0].beat.extra = true; },
    e => { e.steps.at(-1).beat.final = false; }
  ]) assert.throws(() => readExperienceBeats(changed(mutate)),/Beat|beat/);
  let invoked = 0;
  const accessor = Object.freeze({...lesson.steps[0].beat,get heading() { invoked += 1; return 'Wrong'; }});
  const malformed = Object.freeze({...lesson,steps:Object.freeze([Object.freeze({...lesson.steps[0],beat:accessor}),...lesson.steps.slice(1)])});
  assert.throws(() => readExperienceBeats(malformed),/data object/); assert.equal(invoked,0);
});

test('Core beat navigation uses final boundaries while retaining segment seek and pending cancellation', () => {
  const model = createBoundaryModel(ids.slice(1),beats.map(beat => beat.finalStepId));
  assert.deepEqual(model.boundaryIds(),ids);
  for (const [index,beat] of beats.entries()) {
    for (const boundary of beat.boundaryIds) {
      const next = model.resolve(boundary,null,{command:'next'});
      const destination = boundary === beat.finalStepId ? beats[Math.min(index+1,beats.length-1)] : beat;
      assert.equal(next.toStepId,destination.finalStepId);
      assert.equal(model.resolve(boundary,ids[1],{command:'next'}).toStepId,next.toStepId);
      const previous = model.resolve(boundary,null,{command:'previous'});
      assert.equal(previous.toStepId,index === 0 ? 'initial' : beats[index-1].finalStepId);
      assert.equal(model.resolve('initial',null,{command:'seek',stepId:boundary}).toStepId,boundary);
    }
  }
  assert.equal(model.resolve('initial',null,{command:'next'}).toStepId,beats[0].finalStepId);
  assert.equal(model.resolve('initial',null,{command:'previous'}).result,'no_change');
  assert.equal(model.resolve(ids.at(-1),null,{command:'next'}).reason,'at_end');
  assert.equal(model.resolve(ids[2],ids[3],{command:'previous'}).toStepId,ids[2]);
  assert.equal(model.resolve(ids[2],null,{command:'next'},'faulted').result,'rejected');
  assert.equal(model.resolve(ids[2],null,{command:'next'},'disposed').result,'rejected');
  assert.equal(model.resolve(ids[2],null,{command:'home'}).toStepId,'initial');
  assert.equal(model.resolve(ids[2],null,{command:'end'}).toStepId,ids.at(-1));
  assert.equal(model.resolve(ids[2],null,{command:'restart'}).toStepId,'initial');
});

test('Core rejects invalid beat partitions and keeps v1 navigation unchanged', () => {
  for (const finals of [[],['missing'],[ids.at(-1),ids[2]],[ids[2],ids[2],ids.at(-1)],[ids[2]],['initial',ids.at(-1)]]) {
    assert.throws(() => createBoundaryModel(ids.slice(1),finals),/Beat final/);
  }
  assert.equal(createBoundaryModel(ids.slice(1)).resolve('initial',null,{command:'next'}).toStepId,ids[1]);
});

function runtime({reducedMotion=false} = {}) {
  const renders = []; const reducedFlags = []; const events = []; const timers = new Map(); let handle = 0;
  const clock = Object.freeze({now:() => 0,
    schedule:(fn,ms) => { const id = ++handle; timers.set(id,{fn,ms}); return id; },
    cancel:id => timers.delete(id),onFrame:() => ++handle});
  const experience = changed(e => {for (const step of e.steps) step.dwell_ms = 0;});
  const instance = createCiMInstance({instanceId:'beat-runtime',experience,clock,reducedMotion,rendererRoot:{},
    renderer:Object.freeze({mount() {},render(_state,context) {renders.push(context.stepId); reducedFlags.push(context.reducedMotion); return Promise.resolve();},dispose() {}})});
  instance.events.subscribe(event => events.push(event));
  return {instance,renders,reducedFlags,events,async flush() {
    await new Promise(setImmediate);
    for (const [id,entry] of [...timers]) if (entry.ms === 0) {timers.delete(id);entry.fn();}
  }};
}

test('Runtime preserves Next and Previous command identity and individual Commentary destinations', async () => {
  const h = runtime(); await h.instance.initialize();
  const next = await h.instance.next('transport');
  assert.equal(next.command,'next'); assert.equal(next.toStepId,beats[0].finalStepId);
  await h.instance.seek('stage-hunk--s02','commentary');
  const finish = await h.instance.next('transport');
  assert.equal(finish.command,'next'); assert.equal(finish.toStepId,'stage-hunk--s04');
  const advance = await h.instance.next('transport');
  assert.equal(advance.toStepId,'review-staged--s02');
  await h.instance.seek('stage-hunk--s02','commentary');
  const previous = await h.instance.previous('transport');
  assert.equal(previous.command,'previous'); assert.equal(previous.toStepId,beats[0].finalStepId);
  assert.equal(h.instance.read.snapshot().canonical.revealFrontier,'review-staged--s02');
  await h.instance.restart('transport');
  assert.equal(h.instance.read.snapshot().canonical.revealFrontier,'initial');
  assert.ok(h.events.some(event => event.details?.source === 'commentary'));
  await h.instance.dispose();
});

test('v2 playback stops after each complete beat and resumes through every segment', async () => {
  for (const reducedMotion of [false,true]) {
    const h = runtime({reducedMotion}); await h.instance.initialize();
    for (const beat of beats) {
      await h.instance.play('transport');
      for (let count=0;count<100 && h.instance.read.snapshot().canonical.currentStepId !== beat.finalStepId;count+=1) await h.flush();
      assert.equal(h.instance.read.snapshot().canonical.currentStepId,beat.finalStepId);
      assert.equal(h.instance.read.snapshot().operational.playbackIntent,false);
      await h.flush();
      assert.equal(h.instance.read.snapshot().canonical.currentStepId,beat.finalStepId);
    }
    assert.deepEqual(h.renders,ids);
    if (reducedMotion) assert.ok(h.reducedFlags.every(flag=>flag===true));
    await h.instance.dispose();
  }
});

test('public v2 beat links resolve final boundaries and reject internal segment IDs while v1 stays direct', () => {
  for (const beat of beats) assert.deepEqual(resolveWordPressDeepLink(`#cim/${lesson.id}/${beat.id}`,lesson.id,lesson),
    {stepId:beat.finalStepId,source:'deep_link'});
  assert.equal(resolveWordPressDeepLink(`#cim/${lesson.id}/initial`,lesson.id,lesson).stepId,'initial');
  assert.equal(resolveWordPressDeepLink('#cim/other/stage-hunk',lesson.id,lesson),null);
  assert.throws(() => resolveWordPressDeepLink(`#cim/${lesson.id}/stage-hunk--s02`,lesson.id,lesson),/known semantic boundary/);
  assert.throws(() => resolveWordPressDeepLink(`#cim/${lesson.id}/missing`,lesson.id,lesson),/known semantic boundary/);
  const legacy = changed(e => {e.schema='localis.cim/v1';delete e.presentation;for (const step of e.steps) delete step.beat;});
  assert.deepEqual(readExperienceBeats(legacy),[]);
  assert.equal(resolveWordPressDeepLink(`#cim/${legacy.id}/stage-hunk--s02`,legacy.id,legacy).stepId,'stage-hunk--s02');
});


test('reading stop applies when Play begins inside a beat and manual navigation cancels it', async () => {
  const h=runtime(); await h.instance.initialize();
  await h.instance.seek('stage-hunk--s02','commentary');
  await h.instance.play('transport');
  for(let count=0;count<100 && h.instance.read.snapshot().canonical.currentStepId!=='stage-hunk--s04';count+=1) await h.flush();
  assert.equal(h.instance.read.snapshot().canonical.currentStepId,'stage-hunk--s04');
  assert.equal(h.instance.read.snapshot().operational.playbackIntent,false);
  const stops=h.events.filter(event=>event.event==='playback.stopped');
  assert.ok(stops.some(event=>event.details?.reason==='beat_end'));
  await h.instance.play('transport');
  await h.instance.home('transport');
  for(let count=0;count<3;count+=1) await h.flush();
  assert.equal(h.instance.read.snapshot().canonical.currentStepId,'initial');
  assert.equal(h.instance.read.snapshot().operational.playbackIntent,false);
  await h.instance.dispose();
});


test('Next continues from every beat reading stop without restarting playback',async()=>{
  for(const reducedMotion of [false,true]) {
    const h=runtime({reducedMotion});await h.instance.initialize();await h.instance.play('transport');
    for(let count=0;count<100&&h.instance.read.snapshot().canonical.currentStepId!==beats[0].finalStepId;count+=1)await h.flush();
    assert.equal(h.instance.read.snapshot().operational.playbackIntent,false);
    for(const beat of beats.slice(1)) {
      await h.instance.next('transport');await h.flush();
      assert.equal(h.instance.read.snapshot().canonical.currentStepId,beat.finalStepId);
      assert.equal(h.instance.read.snapshot().operational.playbackIntent,false);
    }
    await h.instance.dispose();
  }
});
