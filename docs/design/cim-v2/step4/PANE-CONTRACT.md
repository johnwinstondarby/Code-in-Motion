# Internal pane lifecycle — ADR 0061 step 4

This adapts the existing views only. It adds no renderer registration, admission, capability version, layout, transport, WordPress behavior or release. `console/v1` retains external `mount/render/dispose`; the exact renderer-v1 context in `src/renderers/interface.mjs` is unchanged. `panes/v1` is still not registered or admitted.

## Methods and data boundary

`createPaneLifecycle(trustedDefinition)` returns exactly four frozen methods:

| Method | Input and effect |
|---|---|
| `mount(container, validatedConfig, identity)` | Attach existing element handles; copy/freeze JSON config and `{id,type}` identity. No markup is added by the lifecycle. |
| `settle(absoluteState, boundary)` | Validate and copy/freeze destination, cancel preceding work, draw the absolute destination synchronously. Throws on invalid data. |
| `play(absoluteState, transition)` | Validate and copy/freeze destination; execute a finite frame plan on the supplied transition clock; return one frozen result. Supersedes prior work. |
| `dispose()` | Cancel work, withdraw cancellation subscription, cancel scheduled callbacks, clear element/config/identity references; idempotent. |

Boundary data is exactly `{stepId,stepRendererConfig}`. Transition adds only immutable `fromState`, `animate`, `reducedMotion`, and restricted `clock`/`cancellation` facades. The clock exposes `now/schedule/cancel`, and cancellation exposes `aborted/reason/onAbort`. Explicit projection never spreads the external renderer context. No runtime, core, host, command, transport or observation port is handed to the pane. JSON copying rejects functions, accessors, symbols and reserved prototype keys. Boundary and pane identities are strings; config, state and identity cannot be mutated by the adapter.

The trusted implementation defines validation, stable drawing, optional finite transition frames and frame drawing. It receives only existing container handles, destination/config/boundary data and read-only identity. The lifecycle owns clock use and cancellation; implementations have no autonomous timer or transport. There is no lesson-supplied executable code, plugin loader, eval or dynamic registration in this step. This is a capability boundary between trusted components, not a JavaScript security sandbox: DOM handles inherently belong to the host document.

## Completion and time

Results are `{status:'settled'}`, `{status:'cancelled',reason}`, or `{status:'failed',error}`. The existing Console renderer translates cancellation back into the existing `RendererCancelledError` and failures into its existing rejection channel; no result object changes the frozen external contract.

The time bound is the sum of a finite frame array's finite, non-negative delays in the shared clock's virtual milliseconds. Each callback advances exactly one frame or finishes; no new watchdog timer changes the legacy schedule. The final frame is the exact stable destination, with no added dwell. No-frame, reduced-motion and absolute arrivals draw immediately. A paused/revoked host clock does not imply a wall-clock timeout; Runtime remains responsible for its clock and cancellation lifecycle. This contract is not the later media-ready/timeout contract.

Cancel, dispose and supersede settle the old participation once, cancel the pending clock handle and unsubscribe. A late callback checks the finished flag, disposal and active-task identity before touching DOM. Invalid input for a superseding external render also revokes the old animation, retaining its current DOM until Runtime's existing restoration path runs. Frame failures produce a failed result and release the same resources.

## Console and Explanation composition

Console's stable DOM builder, animation planner, timings, Copy/risk markup and validation are unchanged. `createConsolePane` wraps them with the lifecycle. The existing `createConsoleRenderer` owns this pane and explicitly projects the existing v1 context. Mount/remount and dispose forward cleanup. No new composite renderer is introduced.

Explanation remains the host-owned read-only view required by ADR 0061 §2. Its existing native binding still validates the projected display model, owns Show-in-Console navigation listeners and performs its existing transactional rollback. `createExplanationPane` applies that validated model through the same lifecycle using the existing frozen collection of element slots as its container. It receives only an entry count and display data. The pane never receives the native binding's select/navigate callbacks, presentation reader or observation capability. Explanation is an immediate settle-only view in current lessons, with no independent animation or timer; its contract `play` also settles immediately. The host's existing polling/follow/selection behavior is unchanged.

Moving commentary observation or navigation inside the Console renderer would require adding fields to its frozen context or introducing lateral authority. This step deliberately keeps the two existing composition points and their authority boundaries while sharing the pane lifecycle. Future multi-pane composition is still deferred.

## Regression evidence

The browser comparison uses two pre-refactor source snapshots from `5869371`: Console renderer and commentary native binding. Only their relative import URLs are rewritten to absolute test-server URLs; they are fixtures, not shipped runtime code. Both implementations render the same bundled Console lessons with the same virtual schedule. Tests compare the exact inner markup at initial/resting boundaries and every animation callback, assert matching callback counts and virtual times, and attach before/after markup samples. Full Player suites retain their existing coverage of deep links, Copy, risks, themes, reduced motion, focus, text selection and timing.

`pane-contract-legacy-files.json` protects all files tracked at the base under experiences, WordPress experiences, generated page-3227 projections/adapters and canonical harness evidence. Step 3's separate frozen v1/v2 baseline remains unchanged. Five intentional mutations cover stale callbacks, authority leakage, missed lifecycle disposal, retained abort listeners and missed renderer-to-pane disposal. Existing architecture checks now also forbid shared contracts from importing Core, Runtime, host, transport, renderer or commentary implementation modules.
