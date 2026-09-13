import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOM_SVG_V1_NORMALIZATION,
  DomSvgCanonicalizationError,
  canonicalizeDomSvg,
  createDomSvgRenderEvidence
} from '../harness/canonicalize-dom-svg.mjs';

const HTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

function attr(name, value, { namespaceURI = null, localName = name } = {}) {
  return { name, localName, namespaceURI, value };
}

function element(localName, {
  namespaceURI = HTML,
  attributes = [],
  children = []
} = {}) {
  return { nodeType: 1, localName, namespaceURI, attributes, childNodes: children };
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function comment(value) {
  return { nodeType: 8, nodeValue: value };
}

test('attribute order and namespace-prefix spelling normalize', () => {
  const left = element('svg', {
    namespaceURI: SVG,
    attributes: [
      attr('viewBox', '0 0 10 10'),
      attr('xlink:href', '#target', { namespaceURI: XLINK, localName: 'href' })
    ]
  });
  const right = element('svg', {
    namespaceURI: SVG,
    attributes: [
      attr('q:href', '#target', { namespaceURI: XLINK, localName: 'href' }),
      attr('viewBox', '0 0 10 10')
    ]
  });

  assert.equal(canonicalizeDomSvg(left), canonicalizeDomSvg(right));
});

test('line endings normalize but other whitespace remains significant', () => {
  const crlf = element('div', { children: [text('alpha\r\nbeta')] });
  const lf = element('div', { children: [text('alpha\nbeta')] });
  const extraSpace = element('div', { children: [text('alpha \nbeta')] });

  assert.equal(canonicalizeDomSvg(crlf), canonicalizeDomSvg(lf));
  assert.notEqual(canonicalizeDomSvg(lf), canonicalizeDomSvg(extraSpace));
});

test('unapproved DOM differences remain significant', () => {
  const base = element('div', {
    attributes: [attr('class', 'panel'), attr('aria-live', 'polite')],
    children: [text('A'), comment('one'), element('span')]
  });
  const classChanged = element('div', {
    attributes: [attr('class', 'panel-x'), attr('aria-live', 'polite')],
    children: [text('A'), comment('one'), element('span')]
  });
  const a11yChanged = element('div', {
    attributes: [attr('class', 'panel'), attr('aria-live', 'off')],
    children: [text('A'), comment('one'), element('span')]
  });
  const commentChanged = element('div', {
    attributes: [attr('class', 'panel'), attr('aria-live', 'polite')],
    children: [text('A'), comment('two'), element('span')]
  });
  const childOrderChanged = element('div', {
    attributes: [attr('class', 'panel'), attr('aria-live', 'polite')],
    children: [element('span'), text('A'), comment('one')]
  });

  const canonical = canonicalizeDomSvg(base);
  for (const changed of [classChanged, a11yChanged, commentChanged, childOrderChanged]) {
    assert.notEqual(canonical, canonicalizeDomSvg(changed));
  }
});

function generatedFixture(actualId) {
  return element('svg', {
    namespaceURI: SVG,
    children: [
      element('defs', {
        namespaceURI: SVG,
        children: [
          element('linearGradient', {
            namespaceURI: SVG,
            attributes: [
              attr('id', actualId),
              attr('data-cim-generated-id', 'gradient-main')
            ]
          })
        ]
      }),
      element('rect', {
        namespaceURI: SVG,
        attributes: [
          attr('fill', `url(#${actualId})`),
          attr('aria-labelledby', actualId),
          attr('style', `filter:url(#${actualId})`)
        ]
      }),
      element('use', {
        namespaceURI: SVG,
        attributes: [
          attr('xlink:href', `#${actualId}`, { namespaceURI: XLINK, localName: 'href' })
        ]
      })
    ]
  });
}

test('declared generated identifiers and known references normalize consistently', () => {
  const left = generatedFixture('runtime-17');
  const right = generatedFixture('runtime-9821');

  assert.equal(canonicalizeDomSvg(left), canonicalizeDomSvg(right));
  assert.equal(
    createDomSvgRenderEvidence(left).render_digest,
    createDomSvgRenderEvidence(right).render_digest
  );
});

test('unmarked identifiers remain significant', () => {
  const left = element('svg', {
    namespaceURI: SVG,
    attributes: [attr('id', 'one')]
  });
  const right = element('svg', {
    namespaceURI: SVG,
    attributes: [attr('id', 'two')]
  });

  assert.notEqual(canonicalizeDomSvg(left), canonicalizeDomSvg(right));
});

test('generated identifier declarations fail closed when malformed or ambiguous', () => {
  const missingId = element('svg', {
    namespaceURI: SVG,
    attributes: [attr('data-cim-generated-id', 'thing')]
  });
  assert.throws(
    () => canonicalizeDomSvg(missingId),
    (error) => error instanceof DomSvgCanonicalizationError && /requires a non-empty id/.test(error.message)
  );

  const duplicateToken = element('svg', {
    namespaceURI: SVG,
    children: [
      element('g', {
        namespaceURI: SVG,
        attributes: [attr('id', 'a'), attr('data-cim-generated-id', 'shared')]
      }),
      element('g', {
        namespaceURI: SVG,
        attributes: [attr('id', 'b'), attr('data-cim-generated-id', 'shared')]
      })
    ]
  });
  assert.throws(() => canonicalizeDomSvg(duplicateToken), /declared more than once/);
});

test('render evidence is frozen, versioned, stable, and changes with canonical output', () => {
  const root = element('div', {
    attributes: [attr('data-state', 'A')],
    children: [text('ready')]
  });
  const same = element('div', {
    children: [text('ready')],
    attributes: [attr('data-state', 'A')]
  });
  const changed = element('div', {
    attributes: [attr('data-state', 'B')],
    children: [text('ready')]
  });

  const first = createDomSvgRenderEvidence(root);
  const second = createDomSvgRenderEvidence(same);
  const different = createDomSvgRenderEvidence(changed);

  assert.deepEqual(Object.keys(first), ['render_digest', 'canonicalizer_id']);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.canonicalizer_id, 'cim-dom-svg/v1');
  assert.match(first.render_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.render_digest, second.render_digest);
  assert.notEqual(first.render_digest, different.render_digest);
});

test('v1 normalization policy is explicit and has no accessibility ignore list', () => {
  assert.equal(DOM_SVG_V1_NORMALIZATION.canonicalizer_id, 'cim-dom-svg/v1');
  assert.deepEqual(DOM_SVG_V1_NORMALIZATION.accessibility_bookkeeping_ignored, []);
  assert.equal(DOM_SVG_V1_NORMALIZATION.whitespace_collapsing, false);
  assert.equal(Object.isFrozen(DOM_SVG_V1_NORMALIZATION), true);
});

test('unsupported node types fail closed', () => {
  const root = element('div', { children: [{ nodeType: 11, childNodes: [] }] });
  assert.throws(() => canonicalizeDomSvg(root), /unsupported DOM nodeType 11/);
});

test('elements without an explicit namespace fail closed', () => {
  const root = element('div');
  assert.throws(
    () => canonicalizeDomSvg({ ...root, namespaceURI: null }),
    /element namespaceURI is required/
  );
  assert.throws(
    () => canonicalizeDomSvg({ ...root, namespaceURI: undefined }),
    /element namespaceURI is required/
  );
});

test('near miss: an empty-string namespace is not accepted as a namespace', () => {
  const root = element('div');
  assert.throws(
    () => canonicalizeDomSvg({ ...root, namespaceURI: '' }),
    /element namespaceURI is required/
  );

  const nested = element('div', { children: [{ ...element('span'), namespaceURI: '' }] });
  assert.throws(() => canonicalizeDomSvg(nested), /element namespaceURI is required/);
});
