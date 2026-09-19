# .cim Authoring Compiler

## Purpose

This directory owns the human-authored `.cim` source path defined by ADR 0037.

The compiler converts restricted YAML authoring source into the existing validated `localis.cim/v1` Runtime contract.

Runtime never consumes `.cim` directly.

## Public compiler boundary

`compiler.mjs` exports:

- `compileCimSource(source, { sourceId })`;
- `CimAuthoringError`.

Successful compilation returns a frozen object containing:

- `experience`: the validated, deeply frozen result returned through the production `ingestExperience()` path;
- `locations`: a frozen path-to-source-location record;
- `sourceId`: the caller-supplied source identity.

The source-location record is authoring evidence only. It is never added to the Runtime experience.

## Diagnostic phases

Three phases are visible to authoring tools:

- `parse`: malformed YAML syntax, using `CIM-AUTH-001`;
- `authoring`: restricted-grammar or authoring-version failures, using `CIM-AUTH-002` or `CIM-AUTH-003`;
- `validation`: existing production Experience validation, preserving `CIM-EXP-*` codes.

Every compiler diagnostic includes:

- code;
- Runtime-style path where available;
- one-based line and column;
- end line and end column;
- message;
- phase;
- source identity.

When a Runtime validation path has no exact authored node, the compiler resolves the nearest authored ancestor.

## Inert rebuild

The YAML AST is never passed into Runtime ingestion.

The compiler rebuilds accepted nodes into:

- null;
- boolean;
- finite number;
- string;
- arrays;
- plain objects with string keys.

The rebuild also rejects:

- anchors;
- aliases;
- explicit/custom tags;
- merge keys;
- duplicate keys;
- non-string keys;
- non-finite numbers;
- directives;
- multiple documents.

No interpolation, include, network loading, callback, expression, or executable-authority mechanism exists.

## CLI

Compile the committed neutral fixture:

```bash
npm run generate:cim-fixture
```

Check fixture freshness:

```bash
npm run check:cim-authoring
```

Compile another source to stdout:

```bash
node tools/compile-cim.mjs path/to/example.cim
```

Compile another source to a file:

```bash
node tools/compile-cim.mjs path/to/example.cim --out path/to/example.json
```

Human-facing CLI failures render:

```text
source.cim:line:column [CODE] $.path message
```

## Fixtures

`fixtures/valid/synthetic-authored.cim` is the neutral positive fixture.

It proves:

- multiline commentary;
- structured links;
- nested opaque state;
- experience renderer configuration;
- step renderer configuration;
- authored dwell;
- B-to-B observation boundaries with equivalent state.

`fixtures/invalid/` contains the committed negative corpus and its expected diagnostic manifest.

## Architecture boundary

Code under `src/` cannot import `authoring/cim/`.

The WordPress release builder does not stage the parser/compiler.

R29 therefore adds an authoring path without adding a second Runtime path or moving the WordPress 0.1.1 artifact.
