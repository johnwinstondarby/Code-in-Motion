# ADR 0003: Absolute-State Rendering

Status: Accepted for CiM v1

## Context

CiM supports forward playback, backward navigation, direct seek, scrub, restart, reduced motion, recovery, deep linking, and deterministic replay. A renderer that can construct a destination only by applying deltas to its current screen state would require separate logic for each arrival path and would make restoration dependent on navigation history.

The synthetic harness also needs a renderer-independent way to prove that equivalent semantic arrivals settle to equivalent visual output.

## Decision

Every stable semantic boundary must be renderable from complete absolute state.

The renderer interface must accept the destination state as sufficient input for stable rendering. Prior state may be supplied as animation context, but prior rendered history cannot be required to reconstruct the destination.

Conceptually:

```text
render(destinationState, context)
```

`context` may contain animation policy, prior state, transition identity, abort/cancellation signal, renderer configuration, and the injected CiM clock. None of these may replace the destination state as the source of stable output.

Arrival at the same semantic boundary through the following paths must settle to canonically equivalent output:

```text
sequential playback
direct seek
reverse navigation
restart then seek
recovery restoration
reduced-motion navigation
deterministic replay
```

The conformance harness owns canonicalization. Renderers cannot provide or modify their own conformance digest logic.

For v1, renderers should expose inspectable DOM or SVG under the renderer root. The harness canonicalizer may normalize only explicitly allowlisted nondeterminism such as attribute ordering, insignificant serialization whitespace, approved generated identifier substitution, and approved ARIA bookkeeping differences. Everything else remains significant.

Canonical comparison occurs after animated settlement as well as after direct absolute rendering.

## Consequences

- Reverse and scrub do not require inverse renderer logic.
- Reduced motion uses the same destination states as animated playback.
- Renderer recovery can restore the last committed stable boundary directly.
- Deep links can initialize directly at their requested step.
- Replay fidelity can be measured independently from renderer implementation.
- Subject renderers must model complete stable state rather than only transition instructions.

Two semantic positions may intentionally have the same subject-state and render digests. Digest equality must never be used to infer that semantic position did not advance.

## Rejected Alternatives

### Delta-only rendering

Rejected because reverse, seek, restore, and replay would depend on the path used to reach a step.

### Renderer-supplied canonicalization

Rejected because a renderer could normalize away its own nondeterminism and make the conformance test circular.

### Byte-identical serialized DOM as the platform contract

Rejected because harmless serialization differences such as attribute order or approved generated identifiers can differ without changing stable rendered meaning. The synthetic renderer may use stricter equality where appropriate.

## Verification

The synthetic harness must assert that:

- direct seek and sequential arrival at the same step produce the same canonical render digest;
- animated arrival and non-animated arrival produce the same canonical render digest after settlement;
- restart then seek produces the same canonical render digest;
- recovery restoration produces the same canonical render digest;
- an observation step can advance semantic position while state and render digests remain unchanged.
