import { createHash } from 'node:crypto';

import { DOM_SVG_CANONICALIZER_ID } from '../src/renderers/interface.mjs';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const GENERATED_ID_MARKER = 'data-cim-generated-id';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const IDREF_ATTRIBUTES = new Set([
  'for',
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns'
]);

const URL_REFERENCE_ATTRIBUTES = new Set([
  'clip-path',
  'mask',
  'filter',
  'fill',
  'stroke',
  'marker-start',
  'marker-mid',
  'marker-end'
]);

const GENERATED_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export class DomSvgCanonicalizationError extends TypeError {
  constructor(path, reason) {
    super(`${path}: ${reason}`);
    this.name = 'DomSvgCanonicalizationError';
    this.path = path;
    this.reason = reason;
  }
}

function fail(path, reason) {
  throw new DomSvgCanonicalizationError(path, reason);
}

function normalizeLineEndings(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

function asArray(value, path, label) {
  if (value == null) return [];
  try {
    return Array.from(value);
  } catch {
    fail(path, `${label} must be iterable.`);
  }
}

function elementName(node, path) {
  const localName = node.localName ?? null;
  if (typeof localName !== 'string' || localName.length === 0) {
    fail(path, 'element localName is required.');
  }
  const namespaceURI = node.namespaceURI ?? null;
  if (typeof namespaceURI !== 'string' || namespaceURI.length === 0) {
    fail(path, 'element namespaceURI is required; v1 does not canonicalize namespace-less elements.');
  }
  return [namespaceURI, localName];
}

function attributeRecord(attribute, path) {
  if (!attribute || typeof attribute !== 'object') {
    fail(path, 'attribute entries must be objects.');
  }
  const localName = attribute.localName ?? attribute.name ?? null;
  if (typeof localName !== 'string' || localName.length === 0) {
    fail(path, 'attribute localName is required.');
  }
  return {
    namespace: attribute.namespaceURI ?? '',
    localName,
    value: normalizeLineEndings(attribute.value)
  };
}

function readAttributes(node, path) {
  return asArray(node.attributes, path, 'attributes').map((attribute, index) =>
    attributeRecord(attribute, `${path}.attributes[${index}]`)
  );
}

function readChildren(node, path) {
  return asArray(node.childNodes, path, 'childNodes');
}

function findAttribute(attributes, namespace, localName) {
  return attributes.find((attribute) =>
    attribute.namespace === namespace && attribute.localName === localName
  ) ?? null;
}

function rewriteHashFragment(value, idMap) {
  if (!value.startsWith('#')) return value;
  const actual = value.slice(1);
  const replacement = idMap.get(actual);
  return replacement ? `#${replacement}` : value;
}

function rewriteIdRefs(value, idMap) {
  return value
    .split(/(\s+)/)
    .map((token) => idMap.get(token) ?? token)
    .join('');
}

function rewriteUrlReferences(value, idMap) {
  return value.replace(/url\(\s*#([^) \t\r\n]+)\s*\)/g, (match, actual) => {
    const replacement = idMap.get(actual);
    return replacement ? `url(#${replacement})` : match;
  });
}

function rewriteAttributeValue(attribute, idMap) {
  let value = attribute.value;

  if (attribute.namespace === '' && attribute.localName === 'id') {
    return idMap.get(value) ?? value;
  }

  if (
    attribute.localName === 'href' &&
    (attribute.namespace === '' || attribute.namespace === XLINK_NAMESPACE)
  ) {
    value = rewriteHashFragment(value, idMap);
  }

  if (attribute.namespace === '' && IDREF_ATTRIBUTES.has(attribute.localName)) {
    value = rewriteIdRefs(value, idMap);
  }

  if (attribute.namespace === '' && URL_REFERENCE_ATTRIBUTES.has(attribute.localName)) {
    value = rewriteUrlReferences(value, idMap);
  }

  if (attribute.namespace === '' && attribute.localName === 'style') {
    value = rewriteUrlReferences(value, idMap);
  }

  return value;
}

function collectGeneratedIds(root) {
  const actualToCanonical = new Map();
  const canonicalTokens = new Set();

  function visit(node, path) {
    if (!node || typeof node !== 'object') {
      fail(path, 'DOM/SVG nodes must be objects.');
    }
    if (node.nodeType !== ELEMENT_NODE) {
      fail(path, 'generated-ID discovery expects element nodes.');
    }

    const attributes = readAttributes(node, path);
    const marker = findAttribute(attributes, '', GENERATED_ID_MARKER);

    if (marker) {
      const id = findAttribute(attributes, '', 'id');
      if (!id || id.value.length === 0) {
        fail(path, `${GENERATED_ID_MARKER} requires a non-empty id attribute.`);
      }
      if (!GENERATED_TOKEN_PATTERN.test(marker.value)) {
        fail(path, `${GENERATED_ID_MARKER} must use a stable token matching ${GENERATED_TOKEN_PATTERN}.`);
      }
      if (actualToCanonical.has(id.value)) {
        fail(path, `generated id ${id.value} is declared more than once.`);
      }
      if (canonicalTokens.has(marker.value)) {
        fail(path, `generated-id token ${marker.value} is declared more than once.`);
      }

      const canonicalId = `@cim:${marker.value}`;
      actualToCanonical.set(id.value, canonicalId);
      canonicalTokens.add(marker.value);
    }

    for (const [index, child] of readChildren(node, path).entries()) {
      if (child?.nodeType === ELEMENT_NODE) visit(child, `${path}.childNodes[${index}]`);
    }
  }

  visit(root, 'root');
  return actualToCanonical;
}

function canonicalNode(node, path, idMap) {
  if (!node || typeof node !== 'object') fail(path, 'DOM/SVG node must be an object.');

  if (node.nodeType === ELEMENT_NODE) {
    const [namespace, localName] = elementName(node, path);
    const attributes = readAttributes(node, path)
      .map((attribute) => [
        attribute.namespace,
        attribute.localName,
        rewriteAttributeValue(attribute, idMap)
      ])
      .sort((left, right) => {
        const a = `${left[0]}\u0000${left[1]}`;
        const b = `${right[0]}\u0000${right[1]}`;
        return a < b ? -1 : a > b ? 1 : 0;
      });

    const children = readChildren(node, path).map((child, index) =>
      canonicalNode(child, `${path}.childNodes[${index}]`, idMap)
    );

    return ['E', namespace, localName, attributes, children];
  }

  if (node.nodeType === TEXT_NODE) {
    return ['T', normalizeLineEndings(node.nodeValue)];
  }

  if (node.nodeType === COMMENT_NODE) {
    return ['C', normalizeLineEndings(node.nodeValue)];
  }

  fail(path, `unsupported DOM nodeType ${String(node.nodeType)}; v1 accepts element, text, and comment nodes only.`);
}

export function canonicalizeDomSvg(root) {
  if (!root || typeof root !== 'object' || root.nodeType !== ELEMENT_NODE) {
    fail('root', 'renderer conformance root must be an element node.');
  }

  const idMap = collectGeneratedIds(root);
  return JSON.stringify(canonicalNode(root, 'root', idMap));
}

export function createDomSvgRenderEvidence(root) {
  const canonical = canonicalizeDomSvg(root);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');

  return Object.freeze({
    render_digest: `sha256:${digest}`,
    canonicalizer_id: DOM_SVG_CANONICALIZER_ID
  });
}

export const DOM_SVG_V1_NORMALIZATION = Object.freeze({
  canonicalizer_id: DOM_SVG_CANONICALIZER_ID,
  generated_id_marker: GENERATED_ID_MARKER,
  line_endings: 'CRLF-and-CR-to-LF',
  attribute_order: 'namespaceURI-then-localName',
  namespace_prefixes: 'normalized-through-namespaceURI-and-localName',
  accessibility_bookkeeping_ignored: Object.freeze([]),
  whitespace_collapsing: false
});
