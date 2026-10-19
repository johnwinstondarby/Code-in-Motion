# ADR 0061 Synchronized multi-pane Player

Status: Proposed implementation design, based on Johann’s agreed brief v6 and the frozen page 3547 prototype. The presentation decisions are settled; production compatibility and release gates remain to be demonstrated. Date: 2026-10-18.

## Problem and outcome

A newcomer needs to connect exact CLI commands or recorded GUI activity with an explanation and a model of where the activity occurs. Four independently controlled players would obscure that relationship. CiM v2 uses one beat sequence and transport, with pluggable panes and a deterministic held state for inactive panes.

The first worked example is AI Run Custody. Gate 10 proves retrieval and integrity on INVENT; a separately labeled reproduction check follows immediately on INSPIRE. Prototype content is placeholders, not captured evidence.

## 1 Version and backward compatibility

Target plugin **1.1.0**, not 2.0.0, by retaining legacy behavior and admitting new lessons explicitly. “CiM v2” is the initiative name. The [compatibility audit](../design/cim-v2/COMPATIBILITY.md) records the inspected boundaries and release gates. Do not claim compatibility has been proved before the new implementation exists. Failure to preserve it blocks 1.1.0; a breaking change requires a separately agreed 2.0 migration.

Frozen authoring v1/v2, runtime v1/v2, renderer interface v1, page v7 and `localis.run-custody/v1` remain unchanged. Existing lessons and installed packs keep their default appearance and controls. The new layout and icon transport are opt-in to multi-pane lessons, not a rewrite of existing page 3227 presentation.

Use `localis.cim/authoring/v3` for the new authoring contract. ADR 0048 previously reserved that identifier for deferred limn: this decision supersedes that allocation only, not its implemented legacy behavior. Per-phrase limn and author palettes remain out of scope, their fields stay rejected until separately specified. Do not silently widen v1/v2 or imply that multi-pane was their original v3 reservation.

Compile multi-pane data into the existing `localis.cim/v2` envelope with a new registered composite renderer, proposed ID `panes/v1`; opaque renderer configuration/state carry the pane declarations and absolute state. No new closed-envelope fields or reinterpretation of legacy states. The engine capability version must be explicitly raised to `1.1.0` when this consumer is implemented; compiled multi-pane documents require that capability. Package and engine versions remain distinct concepts even if these numbers coincide. A schema-stage feasibility check must confirm this design fits the frozen envelope before implementation; if it does not, record a new runtime contract rather than weakening validation.

## 2 Pane extension point

The extension point is a trusted, versioned pane registry beneath the composite renderer/host composition, not arbitrary JavaScript from lesson JSON. Unknown pane types fail preflight with a teacher-facing diagnostic. Adding a pane requires its validator, implementation, deterministic evidence, fault handling and tests. An n+1 pane can occupy an explicitly declared action tab or context slot without adding an engine control or editing every existing pane. Layout admission validates slot/type compatibility and capacity; overflow must be rejected clearly rather than silently hiding a pane. The initial approved layout admits Console and Motion in the action slot and Explanation/Engineering in the context slots; additional arrangements require an authored/validated layout definition, not automatic crowding.

Every pane, including mandatory Explanation, implements a common internal adapter contract:

```text
mount(container, validatedConfig, restrictedCapabilities)
settle(absoluteState, boundaryContext)
play(absoluteState, transitionContext) -> bounded completion result
dispose()
```

The pane declares whether it has an action at each beat and exposes no independent transport. Internal method names are design names to be fixed in the contract specification, not additions to the frozen external renderer context. Existing Console and Explanation can be adapted without changing their input or DOM contract. The composite renderer still implements external `mount/render/dispose` with the exact v1 context. Host-owned commentary remains a read-only view: pane composition receives validated projected data, never Core mutation authority. Explanation requires an authored entry on every multi-pane beat; other panes can hold.

Pane adapters receive only their validated state/config, read-only identity, transition-scoped clock, reduced-motion policy and cancellation. No runtime/core/host object, mutable event bus, network credentials or code evaluation. Pause/resume is supplied through the shared clock and media adapter, not competing intervals. Cancellation/disposal must invalidate stale completions and release media/listeners. Render promises settle or report a bounded recoverable failure; an optional pane failure cannot strand transport.

## 3 Layout and tabs

Top row: full-width action area with Console–CLI and Motion–GUI tabs. Bottom row: Explanation left, Engineering/Diagram right, equal width and always visible. A single compact icon-and-label transport follows both rows. Keep fonts, readable pane content and scope of CSS consistent with existing CiM. Verify at 1366×768, 1536×864 and 1920×1080 at true size. Fit-to-width is only a disclosed prototype comparison aid. Row ratios and adaptive breakpoints require measured readability; the prototype is a reference, not a mandate to shrink text.

At each beat start select its authored action tab once. The learner may switch at any time, including while playing or paused; selecting a view does not navigate, pause or restart. A hidden active pane continues on the shared clock. The inactive pane holds its last final state (or initial state before its first action); content remains readable, selectable and copyable, never dimmed. The learner may miss activity. Do not switch back during the same beat or when Pause/Resume occurs. Entering the next action beat selects its active pane.

Context-only beats have no CLI/GUI action. Reconstruct the most recent completed action tab and its final state with a waiting note; no prior action uses Console initial state. Direct navigation has the same deterministic result before any manual override. A learner can still inspect the other frozen pane. Consecutive context-only beats are not an opportunity to repeatedly undo a deliberate tab choice during that action-row pause: normal progression retains that choice; direct arrival starts from the deterministic last-action default. This distinction is derived from whether the learner has overridden the paused row, not from which beat was visited previously.

For initial scope, each beat has zero or one CLI/GUI action. Simultaneous CLI and GUI actions are rejected during authoring validation until their behavior is separately agreed. Diagram and Explanation can advance alongside an action or alone.

## 4 Beats, timing and navigation

One authoritative transition clock starts all scheduled pane actions. The compiler supplies validated timing/order when actions within a beat must be sequenced. Panes report completion or a classified failure. The beat pauses only when all active pane work has completed or been resolved as a recoverable failure. Completion is not a hard-coded prototype duration. Playback rate, pause/resume, reduced motion and cancellation use existing runtime authority.

Media buffering is not completion. A bounded media-load failure produces the fallback and releases its participation; normal loaded clips finish on the shared beat timeline. Schema/engine work must define the media-ready boundary and clock handshake so one pane cannot silently run ahead during startup. Seeking a clip must reach the requested frame or report fallback; it cannot block navigation indefinitely.

Next first completes an in-flight beat without resetting a manual tab choice; the next Next enters the following beat. Previous, End, direct beat selection and deep links settle every pane to an absolute destination, reconstructing held/initial states and selecting that destination’s active tab or context-only default. Start settles initial states and waits, with Console selected. Restart cancels prior work, restores initial states and begins beat 1. Restart remains distinct from Start. No pane state is reconstructed by replaying network side effects or executing sample commands.

## 5 Transport and Beats panel

Icon controls with short visible labels: Previous, Play/Pause, Next, Beats, separated Restart. Keep accessible names, tooltips and visible focus. Place lesson identity and status on the same compact row; the prototype is 72 px at 1366×768. Start and End remain in Beats. No production change to the legacy transport is implied by this arrangement.

Before any beat, status is `Start · N beats`; once started it includes the beat number and playing/paused state, including paused after a beat completes. Do not use “done” to imply lesson completion.

Beats opens without pausing. It may briefly cover Diagram motion and explicitly states that playback continues. Mark the current beat (`aria-current=step`); at Start no authored beat is current. Native keyboard navigation, Escape/Close dismissal and focus return to Beats are required. Closing never changes the beat, clock, selected tab or playback intent. Selecting a beat closes the panel and performs ordinary deterministic navigation. Moving focus must not trigger a jump.

Action tabs use tablist/tab/tabpanel roles, reciprocal ID associations, exactly one selected tab and a roving tab stop. Left/Right and Home/End select/focus tabs; Tab reaches content. Automatic playback selection must not steal focus. Verify these behaviors with browsers and real assistive technology before release; markup alone is not a screen-reader result.

## 6 Labels, errors and evidence

Motion is labeled “Recorded in the lab”, with captions and a text alternative. Missing/unusable media shows “GUI recording unavailable”, `CIM-PANE-MEDIA-UNAVAILABLE` and that alternative; it must not stall the beat or erase other panes. The failed result is the held state on subsequent no-action beats. Authored fallback and containment are validated before media loading. Diagram is labeled “Diagram · modeled”; reduced motion settles states without animation. Graph status is redundant with text, not color alone.

All recorded identifiers and artifacts are traceable to raw evidence. Names may be substituted only through the recorded substitution chain. Resource counts, timing, failure kind and epoch are behavior, not substitutions. GPU-memory exhaustion and Slurm host-memory termination remain distinct. Capture records bind beat, host, service, artifact ID, action, resulting state and raw-evidence reference; resulting diagram state is deterministically derivable. Custody verification is not a claim to have re-run evaluation.

## 7 Authoring, validation and packs

Add v3 schemas and compiler dispatch alongside the frozen v1/v2 modules. Beat authoring declares its optional action tab, pane actions/state, mandatory Explanation, Engineering progression and initial/held-state rules. Reject inconsistent action selection, unknown panes, missing initial state, invalid references and simultaneous actions. Errors name the rule, JSON path and fix through the existing CLI/preview diagnostics.

The Engineering capture schema is separate from lesson source. Resolve evidence identifiers within a declared capture archive; no implicit local path traversal or executable reference. Cross-validate lesson beat/pane/artifact references with the capture record, and require an explicit placeholder mode for the sample pack. Placeholder records cannot be presented as genuine capture evidence.

Keep `cim.lesson-pack/v1` discovery and acceptance unchanged for old Console packs. Introduce `cim.lesson-pack/v2` for multi-pane lessons with `cim_min: 1.1.0` and `cim_max_exclusive: 2.0.0`. Older hosts refuse the unsupported agreement. The fixed generated PHP template remains inert; teachers ship data, never authored code. PHP preflight, JavaScript ingestion, Admin Console and tool preview dispatch by explicit agreement and renderer/schema, not guessed fields.

Media adds a real pack boundary: the v2 specification must declare media/caption asset maps, permitted formats, per-file and total size limits, digest checks and same-pack realpath confinement before serving bytes. Reject path traversal, external symlinks, remote arbitrary sources, unknown assets and deactivated pack data. Do not turn the v1 JSON loader into an unrestricted file server. Pack-level and lesson-level rejection reasons remain visible in Admin, with an independent lesson continuing when another is rejected.

## 8 Delivery gates and sequence

0. Freeze the accessible prototype and v6 with checksums and browser evidence. See [freeze record](../design/cim-v2/PROTOTYPE-FREEZE.md).
1. Apply the additive 1.1.0 compatibility decision and keep its gates live.
2. Review this ADR before production schema or engine implementation. This file is a design proposal, not a claim that those modules have landed.
3. Specify beat authoring and capture schemas with actionable `cim-author validate` diagnostics, examples, boundary limits and mutation probes; no production UI yet.
4. Adapt existing panes behind the internal contract with no visible legacy changes. Run verify, canonical evidence, mutation and full browser suites. Frozen fixtures/capture remain byte-identical; changed source ZIPs reproduce themselves rather than the old release checksum.
5. Write acceptance tests first, then implement beat/tab/transport rules, including direct jumps, cancellation, context-only chains, manual switching, focus, text selection and faults.
6. Add Engineering, then Motion/media, then opt-in layout composition, each with failing fixtures and mutations that prove checks detect broken behavior.
7. Build the eight-beat placeholder pack through the real compiler, validator, preview and pack route. True-size review at all three sizes. It must survive upgrade/rollback as a separate plugin even when older CiM cannot render it.
8. Short authoring guide; draft PR and review packet; two pinned clean builds, all candidate checks, independent rebuild/review and Johann’s approval before merge/tag/publication. Preserve exact installed rollback ZIP and page 3227 capture. No new release or production install is authorized merely by this design record.

The original 1.0.1 ZIP stays an exact rollback artifact. New builds will have new checksums. Preserve authored/compiled legacy lesson files and frozen canonical evidence instead of imposing an impossible unchanged whole-ZIP requirement on changed shipped code.

The Ubuntu laptop is deferred. Prototype/schema work needs no lab. Real captures wait for feasibility and available machines, not inherently for BOONIE: the approved phased topology permits INSPIRE/CREATE/INVENT first. Any paid storage or rented cluster still requires a spending decision. No hardware purchase, paid service, WordPress.org submission, AI production execution, per-phrase limn, custom palettes or SSH rollback is included.

## 9 Current evidence and unresolved checks

At the baseline, verify passes all 962 tests; the v1 differential has 41 identical results and zero differences. Nine prototype browser/size combinations pass the new tab checks. Audit Node was 24.15.0; production release builds still use pinned Node 22.23.2. These are baseline/design evidence only. Full future implementation tests, real-media synchronization, assistive-technology review, independent reviewer approval, exact candidate builds and live acceptance are not yet performed.

Still to specify before the corresponding implementation gate: concrete pane capability/error/result types, media-ready synchronization and limits, v2 pack media-serving path, and readable row proportions. The n+1 extension point and admission policy above constrain those specifications without assuming that arbitrary panes fit the initial four-pane layout.
