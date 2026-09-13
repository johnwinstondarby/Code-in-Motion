# DOM/SVG Canonicalizer v1

Status: Normative conformance support contract

Canonicalizer ID: `cim-dom-svg/v1`

## Purpose

This document fixes the normalization policy used by the harness-owned DOM/SVG canonicalizer referenced by `RENDERER-CONTRACT.md` §11.

A renderer does not supply, alter, or select canonicalization rules. A change to any rule in this document requires a new `canonicalizer_id`.

## Input boundary

The canonicalizer receives the renderer root element after a render has resolved successfully.

The v1 canonical surface supports:

- element nodes;
- text nodes;
- comment nodes.

The root must be an element. Any other reachable node type fails closed.

## Canonical structural record

Canonical output is a deterministic structural record serialized as JSON. It is not browser-generated HTML or SVG serialization.

Each element records:

- namespace URI;
- local name;
- sorted canonical attributes;
- ordered canonical child records.

Text and comment nodes record their normalized text values. Child order is significant.

## Fixed normalization allowlist

`cim-dom-svg/v1` normalizes only the following representation details:

1. Attribute ordering is sorted by namespace URI and local name.
2. Namespace-prefix spelling is normalized through namespace URI plus local name. Prefix labels themselves are not evidence.
3. CRLF and bare CR line endings normalize to LF in text, comments, and attribute values.
4. A generated identifier may be substituted only when the element explicitly declares `data-cim-generated-id="<stable-token>"` beside a non-empty `id` attribute.
5. References to a declared generated identifier are rewritten only in the documented reference forms below.

The v1 canonicalizer does not:

- trim or collapse other whitespace;
- reorder child nodes;
- ignore comments;
- ignore classes, styles, data attributes, ARIA attributes, or other accessibility state;
- normalize unmarked identifiers;
- accept renderer-defined normalization callbacks.

The approved accessibility-bookkeeping ignore list for v1 is empty.

## Generated identifier substitution

`data-cim-generated-id` declares that the concrete runtime `id` is representation noise while the marker value is the stable identity used for evidence.

Requirements:

- the marker value must match `[A-Za-z0-9][A-Za-z0-9._:-]*`;
- the same concrete `id` cannot be declared twice;
- the same stable marker token cannot be declared twice within one renderer root;
- a marker without a non-empty `id` fails closed.

The canonical identifier form is `@cim:<stable-token>`.

The v1 canonicalizer rewrites declared generated-ID references in these fixed forms:

- fragment `href` and XLink `href` values beginning with `#`;
- IDREF/IDREFS attributes: `for`, `aria-activedescendant`, `aria-controls`, `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-flowto`, `aria-labelledby`, and `aria-owns`;
- `url(#id)` references in `clip-path`, `mask`, `filter`, `fill`, `stroke`, `marker-start`, `marker-mid`, and `marker-end`;
- `url(#id)` references inside the `style` attribute.

Other attribute values remain exact apart from line-ending normalization.

## Evidence

The harness computes SHA-256 over the UTF-8 canonical structural record and emits a frozen evidence object with exactly:

```text
render_digest
canonicalizer_id
```

`render_digest` uses the form `sha256:<lowercase-hex>`.

Evidence comparison follows `RENDERER-CONTRACT.md` §11:

- same canonicalizer ID plus same digest proves canonical-output equivalence for this evidence surface;
- same canonicalizer ID plus different digest indicates a renderer-output difference;
- different canonicalizer IDs are not directly comparable.
