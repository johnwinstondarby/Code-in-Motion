# ADR 0015: Native Range Presentation and Semantic Labels

Status: Accepted

Date: 2026-09-15

## Context

Transport checkpoint 3 established one semantic boundary ordinal for scrub geometry and a local display projection that follows preview while a gesture is active and canonical position otherwise. Checkpoints 4 through 6 established scoped keyboard ownership and playback-action presentation without granting Transport broader Runtime authority.

The v1 experience contract already supplies the learner-facing metadata needed for rail presentation. Every authored step has a required `label`, and `marker` is an optional short learner-facing marker label. The reserved `initial` boundary has no authored step record.

The next presentation layer needs a deterministic range model and semantic labels before DOM, pointer, touch, and visual styling are attached. Reimplementing slider semantics in a custom ARIA widget would duplicate behavior already supplied by a native range control and would create a second keyboard and accessibility contract beside the Transport keyboard rules.

## Decision

1. Transport checkpoint 7 remains headless. It produces presentation data for a later native range DOM binding and installs no DOM listener.

2. The semantic rail uses the same canonical boundary ordinal established by checkpoints 2 and 3:

```text
min   = 0
max   = boundaryCount - 1
step  = 1
value = displayIndex
```

No second authored-only ordinal is introduced.

3. The presentation receives only the exact frozen checkpoint 3 scrub observation capability:

```text
read
```

Each presentation read obtains fresh scrub display state. Active local preview therefore drives the range value while a gesture is open; inactive state follows the latest canonical projection through checkpoint 3.

4. The reserved `initial` boundary remains structurally separate from authored markers and receives the platform presentation:

```text
stepId          = initial
index           = 0
visualLabel     = Start
accessibleLabel = Start
```

`initial` is never fabricated as an authored marker.

5. Authored marker presentation contains exactly:

```text
stepId
index
visualLabel
accessibleLabel
```

For each authored boundary:

```text
visualLabel     = marker when supplied, otherwise label
accessibleLabel = label
```

The required authored `label` remains the full learner-facing semantic name. The optional authored `marker` is a concise visual form only.

6. The caller supplies a non-empty learner-facing `ariaLabel` for the range. Transport does not derive the range name from technical experience or step IDs.

7. `ariaValueText` reports the semantic boundary name and one-based ordinal position:

```text
<accessibleLabel>, position <displayIndex + 1> of <boundaryCount>
```

8. The checkpoint 7 range record contains native range properties and semantic labeling data only:

```text
min
max
step
value
ariaLabel
ariaValueText
```

It does not synthesize `role="slider"`, `tabindex`, `aria-valuemin`, `aria-valuemax`, or `aria-valuenow`. A later DOM binding will use a native `<input type="range">`, which supplies its own slider role, focus behavior, numeric value, and range limits.

9. Authored metadata must align exactly with canonical boundary order. The metadata array contains one record for every authored boundary and no record for `initial`.

10. The presentation receives no command surface, Runtime implementation surface, event stream, renderer capability, commentary authority, disposal capability, or raw `CiMInstance`.

11. Malformed, mutable, widened, accessor-backed, symbol-extended, or ordinal-inconsistent inputs fail closed before presentation data is returned.

## Consequences

The later DOM range binding can remain mechanical: apply the projected native range values and semantic labels to a native range control, then connect input interaction to the existing checkpoint 3 scrub lifecycle.

One canonical ordinal continues to govern timeline projection, scrub snapping, native range position, and semantic labels.

Authored `label` and `marker` retain distinct purposes. A short visual marker cannot replace the full semantic label used for accessible value communication.

Pointer and touch interaction do not gain independent seek policy. Intermediate movement remains local preview and semantic movement remains a checkpoint 3 commit operation.

## Verification

Checkpoint 7 verification pins:

- exact frozen presentation, range, anchor, and marker records;
- native range geometry derived from the canonical semantic ordinal;
- a separate `Start` anchor for `initial`;
- authored marker text used visually and required authored labels used accessibly;
- label fallback when an authored marker is absent;
- fresh range projection from both local preview and canonical scrub display state;
- absence of custom slider role, tabindex, and redundant ARIA range limits from the headless projection;
- exact authored metadata count and canonical order;
- the narrowed frozen scrub observation capability;
- fail-closed handling of malformed display identity and ordinal state;
- an explicit learner-facing range label independent from technical IDs;
- the repository schema, architecture, Core-authority, and full test gates on Node 20 and Node 22.
