import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWordPressClockFactory,
  createWordPressExperienceLoader,
  createWordPressRendererResolver
} from '../src/host/wordpress-browser-bindings.mjs';

function rawExperience(id = 'synthetic-wordpress') {
  return {
    schema: 'localis.cim/v1',
    engine_min: '1.0.0',
    experience_version: '1.0.0',
    id,
    renderer: 'synthetic/v1',
    initial_state: { node: 'A' },
    steps: [
      {
        id: 'step-01',
        label: 'Step 1',
        commentary: { text: 'Advance to B.', links: [] },
        state: { node: 'B' }
      }
    ]
  };
}

function responseFor(value) {
  return {
    ok: true,
    status: 200,
    async json() {
      return value;
    }
  };
}

test('WordPress experience loader validates, ingests, and caches one shared frozen object', async () => {
  let fetchCount = 0;
  const loader = createWordPressExperienceLoader({
    fetch: async (url) => {
      fetchCount += 1;
      assert.equal(url, '/experiences/synthetic-wordpress.json');
      return responseFor(rawExperience());
    },
    experienceUrlFor: (experienceId) => `/experiences/${experienceId}.json`
  });

  assert.equal(Object.isFrozen(loader), true);
  assert.deepEqual(Object.keys(loader), ['load']);

  const firstPending = loader.load('synthetic-wordpress');
  const secondPending = loader.load('synthetic-wordpress');
  assert.equal(firstPending, secondPending);

  const [first, second] = await Promise.all([firstPending, secondPending]);
  const third = await loader.load('synthetic-wordpress');

  assert.equal(fetchCount, 1);
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.steps), true);
  assert.equal(Object.isFrozen(first.steps[0]), true);
});

test('WordPress experience loader does not cache failed validation and permits retry', async () => {
  let fetchCount = 0;
  const loader = createWordPressExperienceLoader({
    fetch: async () => {
      fetchCount += 1;
      const value = rawExperience();
      if (fetchCount === 1) value.schema = 'localis.cim/v2';
      return responseFor(value);
    },
    experienceUrlFor: () => '/experiences/synthetic-wordpress.json'
  });

  await assert.rejects(loader.load('synthetic-wordpress'), /CIM-EXP-001/);
  const recovered = await loader.load('synthetic-wordpress');

  assert.equal(fetchCount, 2);
  assert.equal(recovered.schema, 'localis.cim/v1');
});

test('WordPress experience loader rejects an experience identity mismatch', async () => {
  const loader = createWordPressExperienceLoader({
    fetch: async () => responseFor(rawExperience('different-experience')),
    experienceUrlFor: () => '/experiences/synthetic-wordpress.json'
  });

  await assert.rejects(
    loader.load('synthetic-wordpress'),
    /identity mismatch: requested synthetic-wordpress, received different-experience/
  );
});

test('WordPress renderer resolver is exact lookup and creates isolated renderer instances', () => {
  let created = 0;
  const makeRenderer = () => {
    const identity = ++created;
    return Object.freeze({
      mount() { return identity; },
      render() {},
      dispose() {}
    });
  };
  const resolver = createWordPressRendererResolver({
    registry: new Map([['synthetic/v1', makeRenderer]])
  });

  assert.equal(Object.isFrozen(resolver), true);
  assert.deepEqual(Object.keys(resolver), ['resolve']);

  const first = resolver.resolve('synthetic/v1');
  const second = resolver.resolve('synthetic/v1');
  assert.notEqual(first, second);
  assert.equal(created, 2);

  assert.throws(
    () => resolver.resolve('unknown/v1'),
    (error) => error.code === 'CIM-RND-001' && /Unknown WordPress CiM renderer/.test(error.message)
  );
});

function fakeBrowserTiming() {
  let nowValue = 100;
  let nextTimer = 0;
  let nextFrame = 1000;
  const timers = new Map();
  const frames = new Map();

  return {
    options: {
      now: () => nowValue,
      setTimeout(fn, ms) {
        const id = ++nextTimer;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      requestAnimationFrame(fn) {
        const id = ++nextFrame;
        frames.set(id, fn);
        return id;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      }
    },
    advance(ms) {
      nowValue += ms;
    },
    timerIds() {
      return [...timers.keys()];
    },
    frameIds() {
      return [...frames.keys()];
    },
    fireTimer(id) {
      const entry = timers.get(id);
      assert.ok(entry);
      timers.delete(id);
      entry.fn();
    },
    fireFrame(id) {
      const fn = frames.get(id);
      assert.ok(fn);
      frames.delete(id);
      fn(nowValue);
    }
  };
}

test('WordPress browser clock keeps delayed work independent from frame progress', () => {
  const timing = fakeBrowserTiming();
  const factory = createWordPressClockFactory(timing.options);
  const clock = factory.create();

  assert.equal(Object.isFrozen(factory), true);
  assert.deepEqual(Object.keys(factory), ['create']);
  assert.equal(Object.isFrozen(clock), true);
  assert.deepEqual(Object.keys(clock), ['now', 'schedule', 'cancel', 'onFrame']);

  let delayedAt = null;
  let frames = 0;
  clock.schedule((at) => { delayedAt = at; }, 25);
  const frameHandle = clock.onFrame(() => { frames += 1; });

  const [timerId] = timing.timerIds();
  assert.equal(timing.frameIds().length, 1);

  timing.advance(30);
  timing.fireTimer(timerId);
  assert.equal(delayedAt, 130);
  assert.equal(frames, 0);

  const [firstFrameId] = timing.frameIds();
  timing.fireFrame(firstFrameId);
  assert.equal(frames, 1);
  assert.equal(timing.frameIds().length, 1);

  assert.equal(clock.cancel(frameHandle), true);
  assert.equal(timing.frameIds().length, 0);
});

test('WordPress clock factory creates isolated scheduler instances', () => {
  const timing = fakeBrowserTiming();
  const factory = createWordPressClockFactory(timing.options);
  const first = factory.create();
  const second = factory.create();

  assert.notEqual(first, second);
  const firstHandle = first.schedule(() => {}, 10);
  assert.equal(second.cancel(firstHandle), false);
  assert.equal(first.cancel(firstHandle), true);
});
