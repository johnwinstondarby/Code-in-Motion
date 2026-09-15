import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { COMMAND_SOURCE } from '../src/contracts/events.mjs';
import { NAVIGATION_REASON } from '../src/contracts/session.mjs';
import { freezeValidatedExperience } from '../src/experience/freeze-validated-experience.mjs';
import { createCiMInstance } from '../src/runtime/cim-instance.mjs';
import {
  TRANSPORT_COMMAND_PORT_KEYS,
  TRANSPORT_CONTROLLER_KEYS,
  TRANSPORT_PLAYBACK_ACTION,
  TRANSPORT_PLAYBACK_KEY,
  TRANSPORT_TIMELINE_KEY_ACTION,
  assertTransportCommandPort,
  createTransportController
} from '../src/transport/transport-controller.mjs';
import { checkArchitectureBoundaries } from '../tools/check-architecture-boundaries.mjs';

function makeRecordingPort(overrides = {}) {
  const calls = [];
  const outcomes = new Map();
  const method = (name) => (...args) => {
    calls.push({ name, args });
    if (overrides[name]) return overrides[name](...args);
    if (!outcomes.has(name)) outcomes.set(name, Object.freeze({ method: name }));
    return outcomes.get(name);
  };

  return {
    port: Object.freeze({
      play: method('play'),
      pause: method('pause'),
      next: method('next'),
      previous: method('previous'),
      seek: method('seek'),
      home: method('home'),
      end: method('end'),
      restart: method('restart')
    }),
    calls,
    outcomes
  };
}

async function withArchitectureFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'cim-transport-architecture-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const path = join(root, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf8');
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function experienceFixture() {
  return freezeValidatedExperience({
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id: 'transport-runtime-fixture',
    renderer: 'synthetic/v1',
    renderer_config: {},
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'One',
        commentary: { text: 'One', links: [] },
        state: { node: 'B' }
      }
    ]
  });
}

function schedulerFixture() {
  let now = 0;
  let nextHandle = 0;
  const scheduled = new Map();
  return Object.freeze({
    now: () => now,
    schedule(fn, ms) {
      const handle = ++nextHandle;
      scheduled.set(handle, { fn, at: now + ms });
      return handle;
    },
    cancel(handle) {
      return scheduled.delete(handle);
    },
    onFrame(fn) {
      const handle = ++nextHandle;
      scheduled.set(handle, { fn, frame: true });
      return handle;
    }
  });
}

function rendererFixture() {
  return Object.freeze({
    mount() {},
    render() {
      return Promise.resolve();
    },
    dispose() {}
  });
}

function portForInstance(instance) {
  return Object.freeze({
    play: (source) => instance.play(source),
    pause: (source) => instance.pause(source),
    next: (source) => instance.next(source),
    previous: (source) => instance.previous(source),
    seek: (stepId, source) => instance.seek(stepId, source),
    home: (source) => instance.home(source),
    end: (source) => instance.end(source),
    restart: (source) => instance.restart(source)
  });
}

test('Transport command port is the exact frozen eight-function capability surface', () => {
  const { port } = makeRecordingPort();
  assert.strictEqual(assertTransportCommandPort(port), port);
  assert.deepEqual(TRANSPORT_COMMAND_PORT_KEYS, [
    'play', 'pause', 'next', 'previous', 'seek', 'home', 'end', 'restart'
  ]);
  assert.equal(Object.isFrozen(TRANSPORT_COMMAND_PORT_KEYS), true);
  assert.equal(Object.isFrozen(port), true);
});

test('a full CiMInstance is rejected instead of being accepted as Transport authority', () => {
  const instance = createCiMInstance({
    instanceId: 'transport-port-rejection',
    experience: experienceFixture(),
    clock: schedulerFixture()
  });
  assert.throws(
    () => createTransportController(instance),
    /Transport command port must be a plain object/
  );
});

test('Transport command port rejects extra keys, symbols, accessors, non-functions, non-plain objects, and mutable objects', async (t) => {
  const { port } = makeRecordingPort();

  await t.test('extra key', () => {
    const candidate = Object.freeze({ ...port, read: () => ({}) });
    assert.throws(() => assertTransportCommandPort(candidate), /contain exactly/);
  });

  await t.test('symbol key', () => {
    const symbol = Symbol('authority');
    const candidate = { ...port };
    candidate[symbol] = () => {};
    Object.freeze(candidate);
    assert.throws(() => assertTransportCommandPort(candidate), /symbol keys/);
  });

  await t.test('accessor', () => {
    const candidate = { ...port };
    Object.defineProperty(candidate, 'play', {
      enumerable: true,
      configurable: false,
      get() {
        throw new Error('must not invoke');
      }
    });
    Object.freeze(candidate);
    assert.throws(() => assertTransportCommandPort(candidate), /enumerable data property/);
  });

  await t.test('non-function', () => {
    const candidate = Object.freeze({ ...port, pause: 'pause' });
    assert.throws(() => assertTransportCommandPort(candidate), /port\.pause must be a function/);
  });

  await t.test('non-plain prototype', () => {
    const prototype = { authority: true };
    const candidate = Object.assign(Object.create(prototype), port);
    Object.freeze(candidate);
    assert.throws(() => assertTransportCommandPort(candidate), /plain object/);
  });

  await t.test('mutable object', () => {
    const candidate = { ...port };
    assert.throws(() => assertTransportCommandPort(candidate), /must be frozen/);
  });
});

test('architecture fence rejects Transport imports from Runtime and permits shared contracts', async () => {
  await withArchitectureFixture({
    'src/transport/bad.mjs': `import { createCiMInstance } from '../runtime/cim-instance.mjs';\nexport const x = createCiMInstance;\n`,
    'src/runtime/cim-instance.mjs': `export function createCiMInstance() {}\n`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.ok(result.violations.some((violation) => violation.rule === 'transport-to-runtime'));
  });

  await withArchitectureFixture({
    'src/transport/good.mjs': `import { COMMAND_SOURCE } from '../contracts/events.mjs';\nexport const x = COMMAND_SOURCE;\n`,
    'src/contracts/events.mjs': `export const COMMAND_SOURCE = Object.freeze({ TRANSPORT: 'transport' });\n`
  }, async (root) => {
    const result = await checkArchitectureBoundaries(root);
    assert.deepEqual(result.violations, []);
  });
});

test('ordinary learner controls map once to Runtime command authority with transport provenance, including restart', () => {
  const { port, calls, outcomes } = makeRecordingPort();
  const controller = createTransportController(port);

  for (const name of ['play', 'pause', 'next', 'previous', 'home', 'end', 'restart']) {
    const outcome = controller[name]();
    assert.strictEqual(outcome, outcomes.get(name));
  }

  assert.deepEqual(calls, [
    { name: 'play', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'pause', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'next', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'previous', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'home', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'end', args: [COMMAND_SOURCE.TRANSPORT] },
    { name: 'restart', args: [COMMAND_SOURCE.TRANSPORT] }
  ]);
});

test('marker activation and scrub commit use distinct provenance while scrub cancel emits no command', () => {
  const markerOutcome = Object.freeze({ result: 'marker' });
  const scrubOutcome = Object.freeze({ result: 'scrub' });
  const { port, calls } = makeRecordingPort({
    seek(stepId, source) {
      return source === COMMAND_SOURCE.MARKER ? markerOutcome : scrubOutcome;
    }
  });
  const controller = createTransportController(port);

  assert.strictEqual(controller.marker('step-02'), markerOutcome);
  assert.strictEqual(controller.scrubCommit('step-03'), scrubOutcome);
  assert.strictEqual(controller.scrubCancel(), null);
  assert.deepEqual(calls, [
    { name: 'seek', args: ['step-02', COMMAND_SOURCE.MARKER] },
    { name: 'seek', args: ['step-03', COMMAND_SOURCE.SCRUB] }
  ]);
});

test('Transport passes unknown step IDs to Runtime and returns the Runtime rejection unchanged', async () => {
  const instance = createCiMInstance({
    instanceId: 'transport-unknown-step',
    experience: experienceFixture(),
    clock: schedulerFixture(),
    renderer: rendererFixture(),
    rendererRoot: {},
    reducedMotion: false
  });
  const events = [];
  instance.events.subscribe((event) => events.push(event));
  await instance.initialize();

  const controller = createTransportController(portForInstance(instance));
  const outcome = await controller.marker('unknown-step');

  assert.equal(outcome.result, 'rejected');
  assert.equal(outcome.reason, NAVIGATION_REASON.UNKNOWN_STEP);
  assert.equal(outcome.toStepId, null);

  const rejected = events.at(-1);
  assert.equal(rejected.component, 'runtime');
  assert.equal(rejected.event, 'command.rejected');
  assert.equal(rejected.details.source, COMMAND_SOURCE.MARKER);
});

test('Transport returns command outcomes by reference identity and a normalizing near-miss would fail identity', () => {
  const sentinel = Object.freeze({ result: 'success', commandId: 'sentinel' });
  const { port } = makeRecordingPort({ next: () => sentinel });
  const controller = createTransportController(port);

  const outcome = controller.next();
  assert.strictEqual(outcome, sentinel);

  const normalizedNearMiss = { ...outcome, transport: true };
  assert.notStrictEqual(normalizedNearMiss, sentinel);
});

test('rapid input submits every action immediately without debounce, coalescing, serialization, or in-flight gating', () => {
  const calls = [];
  const pending = [];
  const deferred = (name) => (...args) => {
    calls.push({ name, args });
    const promise = new Promise(() => {});
    pending.push(promise);
    return promise;
  };
  const port = Object.freeze({
    play: deferred('play'),
    pause: deferred('pause'),
    next: deferred('next'),
    previous: deferred('previous'),
    seek: deferred('seek'),
    home: deferred('home'),
    end: deferred('end'),
    restart: deferred('restart')
  });
  const controller = createTransportController(port);

  const returned = [
    controller.next(),
    controller.next(),
    controller.previous(),
    controller.end()
  ];

  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => call.name), ['next', 'next', 'previous', 'end']);
  assert.deepEqual(calls.map((call) => call.args), [
    [COMMAND_SOURCE.TRANSPORT],
    [COMMAND_SOURCE.TRANSPORT],
    [COMMAND_SOURCE.TRANSPORT],
    [COMMAND_SOURCE.TRANSPORT]
  ]);
  for (let index = 0; index < returned.length; index += 1) {
    assert.strictEqual(returned[index], pending[index]);
  }
});

test('headless keyboard table maps timeline keys discretely and Space activates only an explicit play or pause action', () => {
  assert.deepEqual(TRANSPORT_TIMELINE_KEY_ACTION, {
    ArrowLeft: 'previous',
    ArrowRight: 'next',
    Home: 'home',
    End: 'end'
  });
  assert.equal(Object.isFrozen(TRANSPORT_TIMELINE_KEY_ACTION), true);
  assert.equal(TRANSPORT_PLAYBACK_KEY, ' ');

  const { port, calls } = makeRecordingPort();
  const controller = createTransportController(port);

  controller.timelineKey('ArrowLeft');
  controller.timelineKey('ArrowRight');
  controller.timelineKey('Home');
  controller.timelineKey('End');
  assert.strictEqual(controller.timelineKey('ArrowUp'), null);

  controller.playbackKey(TRANSPORT_PLAYBACK_KEY, TRANSPORT_PLAYBACK_ACTION.PLAY);
  controller.playbackKey(TRANSPORT_PLAYBACK_KEY, TRANSPORT_PLAYBACK_ACTION.PAUSE);
  assert.strictEqual(controller.playbackKey('Enter', TRANSPORT_PLAYBACK_ACTION.PLAY), null);
  assert.throws(
    () => controller.playbackKey(TRANSPORT_PLAYBACK_KEY, 'toggle'),
    /play or pause/
  );

  assert.deepEqual(calls.map((call) => call.name), [
    'previous', 'next', 'home', 'end', 'play', 'pause'
  ]);
});

test('Transport controller is frozen, exact, and exposes no observation or semantic event-emission authority', () => {
  const { port } = makeRecordingPort();
  const controller = createTransportController(port);

  assert.equal(Object.isFrozen(controller), true);
  assert.deepEqual(Object.keys(controller), TRANSPORT_CONTROLLER_KEYS);
  assert.equal('read' in controller, false);
  assert.equal('events' in controller, false);
  assert.equal('emit' in controller, false);
  assert.equal('dispose' in controller, false);
  assert.equal('seek' in controller, false);
});
