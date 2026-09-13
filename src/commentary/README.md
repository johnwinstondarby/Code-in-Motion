# Running Commentary

## Purpose

Commentary projects the semantic session into a persistent instructional event stream.

## Owns

- Commentary entry presentation
- Active-entry presentation
- Previously revealed history
- Monotonic reveal-frontier presentation
- Autoscroll and learner scroll suspension
- Newer-steps indicator
- Commentary-link activation
- Commentary-entry seek requests through the runtime interface

## Does not own

- Canonical semantic position
- Transport policy
- Subject rendering
- Raw HTML execution from experience content

## Allowed dependencies

Consumes validated commentary data and read-only semantic position supplied through documented runtime interfaces.

## Prohibited dependencies

No direct renderer access. No `innerHTML` use for authored experience text. Commentary links must use the approved structured link contract.

## Verification

Tests must prove forward reveal, backward seek without re-hiding revealed entries, deep-link frontier initialization, active-entry synchronization, scroll suspension, and safe link rendering.
