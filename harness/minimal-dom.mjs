// Deterministic minimal DOM for harness-side render evidence in Node.
//
// Exposes exactly the surface the canonicalizer reads (nodeType, localName, namespaceURI,
// attributes, childNodes, nodeValue) and the surface subject renderers use to build output
// (createElement, createTextNode, setAttribute, appendChild, replaceChildren). It has no
// layout, events, or styling, so evidence depends only on the structure a renderer produces.
const HTML = 'http://www.w3.org/1999/xhtml';

export class MinimalDocument {
  createElement(localName) { return new MinimalElement(this, localName, HTML); }
  createTextNode(value) { return { nodeType: 3, nodeValue: String(value), childNodes: [], ownerDocument: this }; }
}

export class MinimalElement {
  constructor(ownerDocument, localName, namespaceURI = HTML) {
    this.nodeType = 1;
    this.localName = localName;
    this.namespaceURI = namespaceURI;
    this.attributes = [];
    this.childNodes = [];
    this.ownerDocument = ownerDocument;
  }
  setAttribute(name, value) {
    const record = { name, localName: name, namespaceURI: null, value: String(value) };
    const existing = this.attributes.findIndex((a) => a.namespaceURI == null && a.localName === name);
    if (existing >= 0) this.attributes[existing] = record; else this.attributes.push(record);
  }
  getAttribute(name) { return this.attributes.find((a) => a.localName === name)?.value ?? null; }
  appendChild(node) { this.childNodes.push(node); return node; }
  replaceChildren(...nodes) { this.childNodes = [...nodes]; }
}

export function createMinimalRoot() {
  const document = new MinimalDocument();
  return { document, root: new MinimalElement(document, 'div') };
}
