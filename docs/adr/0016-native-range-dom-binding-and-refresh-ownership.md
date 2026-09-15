# ADR 0016: Native Range DOM Binding and Refresh Ownership

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoint 7 defines the exact headless presentation state for a semantic native range control. It supplies canonical range geometry, semantic value text, the separate `Start` anchor, and authored marker labels while deliberately leaving DOM ownership and interaction wiring for later checkpoints.

The next seam needs to apply that presentation to a native `<input type="range">` without acquiring semantic command authority, scrub gesture authority, or a second accessibility model. The binding also needs a deterministic way to resynchronize the control after canonical movement or local scrub preview changes.

DOM mutation can fail partway through a multi-field update. A partial write would leave the native control displaying a mixed projection, so the binding needs an explicit failure rule for the fields it owns.

## Decision

### Bind one native range control

Checkpoint 8 accepts exactly:

```text
control
presentation
```

`control` must identify an `INPUT` with `type="range"` and expose the native property and attribute operations required by the binding.

`presentation` must be the exact frozen checkpoint 7 surface containing only:

```text
read
```

The binding receives no scrub gesture, Transport command surface, Runtime read surface, Runtime event stream, renderer, commentary surface, disposal capability, or raw `CiMInstance`.

### Own six presentation fields

Checkpoint 8 owns exactly these native range fields:

```text
min
max
step
value
aria-label
aria-valuetext
```

The four numeric range values are written through native element properties. `aria-label` and `aria-valuetext` are written as attributes because they supply semantic naming that the numeric native control cannot derive on its own.

The binding does not create or mutate `role`, `tabindex`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, or unrelated host attributes. Native slider role, keyboard behavior, focus behavior, numeric value, and range limits remain native control semantics.

### Construction performs one synchronization

Construction reads the current checkpoint 7 presentation and applies it once. The returned binding surface is exact and frozen:

```text
refresh
```

`refresh()` obtains a fresh checkpoint 7 projection and reapplies the six owned fields. It does not cache prior presentation state.

The composition layer therefore owns when synchronization occurs. Checkpoint 8 does not subscribe to Runtime events or install observation listeners to create a second state propagation policy.

### Interaction remains outside checkpoint 8

Checkpoint 8 installs no DOM interaction listeners. It does not interpret `input`, `change`, pointer, touch, keyboard, focus, or blur events.

Native range interaction and coupling to the checkpoint 3 scrub gesture remain a later checkpoint. This keeps checkpoint 8 one-way: presentation state may update the DOM, but the DOM cannot initiate semantic movement through this binding.

### Validate before mutation

Each presentation read must return the exact frozen checkpoint 7 state and exact frozen range record. Range geometry must remain compatible with the checkpoint 7 contract:

```text
min   = 0
max   = positive safe integer
step  = 1
value = safe integer within [min, max]
```

`ariaLabel` and `ariaValueText` must remain non-empty strings.

Malformed or widened state fails before the first DOM write.

### Roll back checkpoint-owned fields after a write failure

Before applying a valid projection, the binding snapshots its six owned fields. If any DOM write throws, it attempts to restore all six fields to the prior values.

If rollback succeeds, the original DOM error is rethrown. If rollback itself is incomplete, the binding throws an `AggregateError` that carries the original write failure and rollback failures. The binding never reports successful synchronization after a partial write.

## Consequences

Checkpoint 8 supplies a narrow DOM projection seam without semantic movement authority.

The checkpoint 4 and checkpoint 6 keyboard ownership rules already yield to native input controls. Checkpoint 8 adds presentation synchronization only; it does not reinterpret those native keyboard interactions.

A later interaction checkpoint can translate native range activity into checkpoint 3 scrub operations while reusing this binding for presentation refresh. That later integration does not require widening checkpoint 8 with Runtime or command authority.

## Verification

Checkpoint 8 verification pins:

- an exact frozen `refresh`-only binding surface;
- one presentation application during construction;
- fresh checkpoint 7 presentation reads on later refreshes;
- restriction to native `INPUT` controls with `type="range"`;
- the exact frozen checkpoint 7 `{ read }` capability;
- mutation of only `min`, `max`, `step`, `value`, `aria-label`, and `aria-valuetext`;
- preservation of role, tabindex, native range-limit ARIA, and unrelated host attributes;
- zero interaction-listener installation and zero scrub or command authority;
- validation of projected state before any DOM write;
- propagation of presentation-read failure without DOM mutation;
- rollback of all checkpoint-owned fields after a transient DOM write failure;
- descriptor-safe option validation without invoking accessor-backed capabilities;
- the repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
