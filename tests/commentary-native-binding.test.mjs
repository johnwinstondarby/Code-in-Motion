import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMENTARY_NATIVE_BINDING_KEYS,
  createCommentaryNativeBinding
} from '../src/commentary/native-binding.mjs';

function element({ tagName = 'DIV', type = undefined, textContent = '', hidden = false } = {}) {
  const attrs = new Map();
  const listeners = new Map();
  let innerHtmlWrites = 0;
  const target = {
    tagName,
    ...(type === undefined ? {} : { type }),
    textContent,
    hidden,
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) {
      listeners.get(name)?.delete(handler);
    }
  };
  Object.defineProperty(target, 'innerHTML', {
    get() { return ''; },
    set() { innerHtmlWrites += 1; }
  });
  return {
    target,
    dispatch(name, event = {}) {
      for (const handler of [...(listeners.get(name) ?? [])]) handler({ type: name, defaultPrevented: false, ...event });
    },
    listenerCount(name) {
      return listeners.get(name)?.size ?? 0;
    },
    innerHtmlWrites() {
      return innerHtmlWrites;
    }
  };
}

function control(linkCount) {
  const root = element();
  const text = element({ tagName: 'P' });
  const select = element({ tagName: 'BUTTON', type: 'button', textContent: 'Go to this step' });
  const links = Array.from({ length: linkCount }, () => element({ tagName: 'A' }));
  return {
    record: Object.freeze({
      root: root.target,
      text: text.target,
      select: select.target,
      links: Object.freeze(links.map((item) => item.target))
    }),
    root,
    text,
    select,
    links
  };
}

function structuredLink(id = 'learn') {
  return Object.freeze({ id, label: `Link ${id}`, href: `/${id}` });
}

function visibleEntry(stepId, index, { selected = false, active = false, links = [] } = {}) {
  return Object.freeze({
    stepId,
    index,
    text: `${stepId} commentary`,
    links: Object.freeze(links),
    selected,
    active
  });
}

function state({
  frontier = 'initial',
  current = 'initial',
  selected = null,
  entries = [],
  entryCount = 2
} = {}) {
  return Object.freeze({
    revealFrontier: frontier,
    currentStepId: current,
    selectedStepId: selected,
    entryCount,
    entries: Object.freeze(entries)
  });
}

function harness(initialState = state()) {
  const controls = [control(1), control(0)];
  let currentState = initialState;
  const calls = [];
  const presentation = Object.freeze({ read: () => currentState });
  const setSelection = (stepId) => {
    calls.push(['select', stepId]);
    currentState = Object.freeze({
      ...currentState,
      selectedStepId: stepId,
      entries: Object.freeze(currentState.entries.map((entry) => Object.freeze({
        ...entry,
        selected: entry.stepId === stepId
      })))
    });
    return currentState;
  };
  const navigate = (stepId) => {
    calls.push(['navigate', stepId]);
    return Object.freeze({ opaque: stepId });
  };
  const binding = createCommentaryNativeBinding({
    controls: Object.freeze(controls.map((item) => item.record)),
    presentation,
    select: setSelection,
    navigate
  });
  return {
    controls,
    presentation,
    binding,
    calls,
    setState(next) { currentState = next; },
    readState() { return currentState; }
  };
}

test('native Commentary binding is exact frozen and initial construction hides unrevealed entries', () => {
  const h = harness();
  assert.deepEqual(Object.keys(h.binding), COMMENTARY_NATIVE_BINDING_KEYS);
  assert.equal(Object.isFrozen(h.binding), true);
  assert.equal(h.controls[0].root.target.hidden, true);
  assert.equal(h.controls[1].root.target.hidden, true);
  assert.equal(h.controls[0].select.listenerCount('click'), 0);
  assert.equal(h.controls[1].select.listenerCount('click'), 0);
  h.binding.dispose();
});

test('refresh projects selectable text, structured links, selected state, and canonical active state', () => {
  const h = harness();
  h.setState(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  h.binding.refresh();

  const first = h.controls[0];
  assert.equal(first.root.target.hidden, false);
  assert.equal(first.root.target.getAttribute('data-cim-step-id'), 'step-01');
  assert.equal(first.root.target.getAttribute('data-cim-selected'), 'false');
  assert.equal(first.root.target.getAttribute('aria-current'), 'step');
  assert.equal(first.text.target.textContent, 'step-01 commentary');
  assert.equal(first.links[0].target.textContent, 'Link learn');
  assert.equal(first.links[0].target.getAttribute('href'), '/learn');
  assert.equal(first.links[0].target.getAttribute('data-cim-link-id'), 'learn');
  assert.equal(first.select.listenerCount('click'), 1);
  assert.equal(h.controls[1].root.target.hidden, true);
  assert.equal(first.text.innerHtmlWrites(), 0);
  h.binding.dispose();
});

test('entry activation captures identity from validated presentation rather than mutable DOM', () => {
  const h = harness();
  h.setState(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  h.binding.refresh();

  h.controls[0].root.target.setAttribute('data-cim-step-id', 'attacker-step');
  h.controls[0].select.dispatch('click');

  assert.deepEqual(h.calls, [['select', 'step-01'], ['navigate', 'step-01']]);
  assert.equal(h.controls[0].root.target.getAttribute('data-cim-selected'), 'true');
  assert.equal(h.readState().selectedStepId, 'step-01');
  h.binding.dispose();
});

test('default-prevented native selection click yields without local selection or navigation', () => {
  const h = harness();
  h.setState(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  h.binding.refresh();
  h.controls[0].select.dispatch('click', { defaultPrevented: true });
  assert.deepEqual(h.calls, []);
  h.binding.dispose();
});

test('newly revealed controls capture their semantic identity only when validated presentation reveals them', () => {
  const h = harness();
  h.setState(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  h.binding.refresh();
  assert.equal(h.controls[1].select.listenerCount('click'), 0);

  h.setState(state({
    frontier: 'step-02',
    current: 'step-02',
    entries: [
      visibleEntry('step-01', 1, { links: [structuredLink()] }),
      visibleEntry('step-02', 2, { active: true })
    ]
  }));
  h.binding.refresh();
  assert.equal(h.controls[1].select.listenerCount('click'), 1);
  h.controls[1].select.dispatch('click');
  assert.deepEqual(h.calls, [['select', 'step-02'], ['navigate', 'step-02']]);
  h.binding.dispose();
});

test('a stale hidden control cannot navigate after Restart hides its captured entry', () => {
  const h = harness(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  assert.equal(h.controls[0].select.listenerCount('click'), 1);

  h.setState(state());
  h.binding.refresh();
  h.controls[0].select.dispatch('click');
  assert.deepEqual(h.calls, []);
  h.binding.dispose();
});

test('Commentary text and native links acquire no pointer or synthetic keyboard listeners', () => {
  const h = harness(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));

  for (const event of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'keydown', 'keyup']) {
    assert.equal(h.controls[0].select.listenerCount(event), 0);
    assert.equal(h.controls[0].links[0].listenerCount(event), 0);
  }
  assert.equal(h.controls[0].select.listenerCount('click'), 1);
  h.binding.dispose();
});

test('structured link count mismatch fails before DOM projection changes visible content', () => {
  const h = harness();
  const priorText = h.controls[0].text.target.textContent;
  h.setState(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [] })]
  }));
  assert.throws(() => h.binding.refresh(), /structured link count/);
  assert.equal(h.controls[0].text.target.textContent, priorText);
  h.binding.dispose();
});

test('binding rejects widened presentation authority and duplicate DOM nodes', () => {
  const one = control(0);
  const duplicate = Object.freeze({ root: one.record.root, text: one.record.text, select: one.record.select, links: Object.freeze([]) });
  const validState = state({ entryCount: 2 });
  assert.throws(
    () => createCommentaryNativeBinding({
      controls: Object.freeze([one.record, duplicate]),
      presentation: Object.freeze({ read: () => validState }),
      select() {},
      navigate() {}
    }),
    /nodes must be distinct/
  );
  assert.throws(
    () => createCommentaryNativeBinding({
      controls: Object.freeze([control(0).record]),
      presentation: Object.freeze({ read: () => state({ entryCount: 1 }), extra() {} }),
      select() {},
      navigate() {}
    }),
    /must contain exactly: read/
  );
});

test('dispose removes only native selection click listeners and prevents later refresh', () => {
  const h = harness(state({
    frontier: 'step-01',
    current: 'step-01',
    entries: [visibleEntry('step-01', 1, { active: true, links: [structuredLink()] })]
  }));
  assert.equal(h.controls[0].select.listenerCount('click'), 1);
  h.binding.dispose();
  assert.equal(h.controls[0].select.listenerCount('click'), 0);
  h.binding.dispose();
  assert.throws(() => h.binding.refresh(), /after disposal begins/);
});
