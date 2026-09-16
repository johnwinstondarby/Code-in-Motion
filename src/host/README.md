# Host and WordPress Adapter

## Purpose

The host layer connects a page to the canonical CiM runtime without embedding platform logic in publication content.

## Owns

- Host invocation discovery
- WordPress plugin integration
- External asset enqueue
- Experience-ID handoff
- Initialization boundary
- Cross-component construction inputs required by Runtime
- Host-level static fallback when CiM cannot initialize

## Does not own

- Engine semantics
- Subject renderer logic
- Accessibility preference detection
- Dynamic reduced-motion preference-change policy
- Inline authored JavaScript in publication pages

## Allowed dependencies

May create and configure `CiMInstance` through its public construction and initialization contracts.

May consume narrow Accessibility capabilities needed to configure Runtime without transferring browser-observation authority into Runtime.

## Prohibited dependencies

Host must not reach Core directly or command Transport, Commentary, or renderers outside Runtime's public seams.

Publication pages must not contain substantial CiM runtime JavaScript. The WordPress adapter uses enqueued external assets rather than runtime code embedded in Custom HTML content.

## Accessibility checkpoint 2: reduced-motion Runtime composition

`createHostCiMInstance()` composes the Accessibility reduced-motion preference with Runtime construction.

The exact Host construction options are:

```text
instanceId
experience
clock
renderer
rendererRoot
reducedMotionPreference
```

`reducedMotionPreference` must be the exact frozen Accessibility capability:

```text
read
```

Host calls `read()` exactly once during Runtime construction. The result must be boolean and is forwarded through Runtime's existing `reducedMotion` option.

The sampled value remains fixed for that Runtime instance. Initialization and later Runtime commands do not resample the preference. A later Host composition samples the capability again and therefore may receive a changed browser preference.

Host checkpoint 2 installs no media-query listener, polling loop, timer, or preference-change subscription. Dynamic adoption of a changed preference by an existing Runtime remains outside this checkpoint.

Host does not query browser globals for reduced motion. Accessibility owns preference observation, Host owns composition, Runtime receives only the sampled boolean, and renderers receive the established Runtime context value.

Malformed, widened, mutable, symbol-extended, accessor-backed, non-function, throwing, or non-boolean preference capability behavior fails composition without selecting a fallback motion policy.

See ADR 0032.

## Accessibility checkpoint 3 compatibility

Accessibility checkpoint 3 may construct a split reduced-motion source with:

```text
preference
changes
```

Host checkpoint 2 consumes only the source's `preference` projection, whose exact frozen surface remains:

```text
read
```

The checkpoint 3 `changes` capability is not part of `createHostCiMInstance()` construction options. Host does not subscribe to reduced-motion changes, receive raw browser media-query objects, or change an existing Runtime's sampled `reducedMotion` value.

This preserves the checkpoint 2 construction boundary while Accessibility owns the independent browser preference-change observation lifecycle. A later dynamic-adoption checkpoint must define any Host or Runtime subscription policy explicitly before that authority can enter composition.

See ADR 0033.

## Verification

Checkpoint 2 tests prove:

- exact Host construction options;
- exact frozen `{ read }` reduced-motion capability;
- one preference read per Runtime construction;
- false and true values reach renderer context through Runtime;
- no resampling during initialization or later Runtime commands;
- an existing Runtime retains its construction-time value after a live preference change;
- a newly composed Runtime samples the changed preference;
- malformed capability and Host option shapes fail closed;
- non-boolean and throwing preference reads fail closed;
- architecture and Core-authority boundaries remain intact.

Checkpoint 3 compatibility preserves those same Host tests unchanged: `source.preference` satisfies the exact checkpoint 2 `{ read }` seam, while `source.changes` remains outside Host construction authority.

Broader Host verification also covers multiple-instance initialization, failed-load isolation, static-page survival, asset-version handling, and clean fallback behavior.