# ADR 0049: WordPress Console-Explanation Player Composition

Status: Accepted

Date: 2026-10-05

Amends:

- ADR 0036 Decisions 9 and 10 for separation of Host initialization from learner presentation admission.
- ADR 0044 Decision 4 for Commentary UI in Console-Explanation production composition.
- ADR 0045 Decision 16 for Restart visibility in Console-Explanation production composition.

Clarifies:

- ADR 0045 Decisions 13 through 15 for a WordPress Player containing renderer output, Explanation, and learner controls inside the existing `.cim` composition shell.

## Context

Code in Motion now has the components required for the learner-facing Console and Explanation experience, but the WordPress production composition does not yet assemble them into one Player.

The current WordPress composition root is `wordpress/assets/bootstrap-module.mjs`. It mounts the Host, obtains root-scoped command and observation ports, creates one Transport binding for each mounted root, and disposes that binding before Host disposal when a root detaches.

Commentary is implemented and independently verified under `src/commentary/`, including reveal projection, local selection, presentation, semantic navigation, native binding, follow policy, and scroll-follow behavior. The complete learner-path harness already composes Commentary with Runtime and Transport.

WordPress production does not compose that stack.

ADR 0044 Decision 4 explicitly kept Commentary UI outside WordPress production composition. ADR 0044 Decision 6 requires executable production-composition evidence whenever that composition changes.

ADR 0045 Decision 13 established the WordPress `.cim` root as the outer instrument-panel shell. Decision 15 permits a learner-facing control only when its consequence is observable in the current composition. Decision 16 therefore withheld Restart from the visible control row because resetting the reveal frontier had no visible consequence while Commentary UI was absent.

The MVP target requires a learner-facing Console plus Explanation presentation. Production Commentary composition therefore has to land before the teaching-first stylesheet in ADR 0048 Part A can be verified against a real WordPress Explanation surface.

The authoring layout name cannot serve directly as the runtime composition selector. `localis.cim/authoring/v1` uses:

`presentation.layout: "console-explanation"`

but deterministic compilation consumes that field and maps it to renderer identity:

`console-explanation` → `console/v1`

The compiled `localis.cim/v2` presentation object does not repeat the authoring layout. Adding the layout solely for WordPress composition would widen the runtime schema while duplicating information already represented by the validated renderer identity.

The existing WordPress Host projections are also insufficient for Commentary composition. Commentary can use narrow existing authority for runtime interaction:

- command capability: `seek`;
- observation capability: `snapshot`.

Commentary additionally requires instructional content:

- canonical boundary identities;
- per-boundary Commentary text and links.

The Player also requires the validated presentation title and description for its opening Explanation content.

The Host currently exposes none of that content to WordPress composition.

The entire validated experience must not cross this boundary. Renderer state, renderer configuration, beat internals, and unrelated experience fields remain outside Player composition authority.

ADR 0036 currently makes successful Runtime initialization project `data-cim-state="ready"`. That was sufficient while Host initialization and learner-visible production composition completed as one effective stage. Console-Explanation composition introduces additional required work after Runtime initialization: Player structure, Commentary binding, and Transport binding. Learner-visible readiness therefore needs an explicit presentation-admission step.

The existing stylesheet hides fallback content only after a root reaches `ready`. It does not hide live renderer or control output before `ready`. Splitting Host initialization from presentation admission therefore also requires an explicit pre-ready withholding rule so a learner never sees fallback content and partially composed live content together.

Finally, production registration of `localis.cim/v2` remains separately gated. EXPERIENCE-SCHEMA-v2 requires beat-aware Player, Transport, Commentary, and deep-link consumers before the v2 registration gate opens. The frozen authoring contract also requires independent viewport-follow behavior for Console and Explanation, including learner ownership and holds. This ADR establishes production Console-Explanation composition but does not open that gate.

## Decision

### 1. WordPress gains an explicit Player composition mode

WordPress production recognizes an internal Player composition mode:

`console-explanation`

This mode composes:

- the selected renderer as the Console pane;
- Commentary as the Explanation pane;
- the existing WordPress Transport controls;
- the existing WordPress fallback surface.

The existing `.cim` root remains the single outer WordPress composition shell.

This decision changes WordPress composition only. It changes no Core authority, Runtime authority, renderer contract, semantic event contract, timing authority, or runtime schema.

### 2. Player mode is selected from validated renderer identity

WordPress composition owns one fixed renderer-to-Player-mode table.

The initial table contains exactly:

```text
console/v1 → console-explanation
```

A renderer identifier absent from the table uses the legacy WordPress composition.

The table belongs in the WordPress composition layer, adjacent to bootstrap-module.mjs. It does not belong in generic Host, Runtime, Core, Transport, Commentary, or renderer code.

Composition must not select Player mode from:

- an experience ID;
- presentation.subject;
- DOM inspection;
- renderer-generated DOM;
- CSS selectors emitted by a renderer;
- an authoring-layout field that is absent from the compiled runtime document.

The validated renderer identity is the authoritative compiled projection of the authoring layout for this purpose.

### 3. Legacy production composition remains the compatibility path

Every renderer absent from the Player-mode table follows the existing legacy production composition.

For the existing git/v1 and synthetic/v1 production paths, the successful learner-facing composition preserves:

- existing renderer placement;
- existing Transport behavior;
- existing keyboard behavior;
- existing visible control order;
- existing playback behavior;
- existing reduced-motion behavior;
- existing lifecycle behavior;
- existing protected evidence.

The compatibility requirement is behavioral and evidentiary. Repository source files may change as the new composition path is added.

The existing git-basic-cycle experience therefore remains a valid rollback target through the MVP transition.

Legacy failure behavior changes deliberately under the atomic presentation rule defined by this ADR. A required production-binding failure that previously could leave a ready renderer without its complete learner controls now returns the root to fallback. The legacy success path remains unchanged.

### 4. Host exposes Player content and explicit presentation admission

The WordPress live Host surface gains two narrowly scoped operations:

```text
mount
commands
observations
playerContent
present
disposeRoot
dispose
```

mount() initializes the live Runtime and renderer, records the mounted root, and establishes its root-scoped capabilities.

Successful Runtime initialization no longer projects data-cim-state="ready" by itself.

playerContent(root) exposes the read-only instructional projection defined by this ADR.

present(root) is the final WordPress presentation-admission operation. It succeeds only for a mounted root that has not begun disposal.

present(root) projects:

```text
data-cim-state="ready"
```

and is idempotent after successful admission.

ready remains the only successful page-host state projection.

Failed or disposed roots project:

```text
data-cim-state="fallback"
```

This amends ADR 0036 Decisions 9 and 10 while preserving their success/fallback state model.

### 5. Host exposes one root-scoped read-only Player-content projection

playerContent(root) returns null for an unknown, failed, detached, or disposing/disposed root.

For every successfully initialized production root, including legacy roots, it returns an exact frozen plain object containing exactly:

```text
rendererId
title
description
boundaryIds
entries
```

The projection is constructed from already validated and frozen experience data plus canonical Runtime boundary identity.

It grants no mutation authority.

rendererId is always present for a successfully initialized root and is used by WordPress composition to select the internal Player mode.

For runtime schemas that do not carry learner-facing presentation title or description:

```text
title       → null
description → null
```

Legacy roots therefore receive playerContent even though they remain in legacy composition.

### 6. Player-content fields have exact ownership and alignment

rendererId

- is the validated runtime renderer identifier;
- is a non-empty string;
- is used by WordPress composition only to select the internal Player mode.

title

- is the validated learner-facing presentation title when the runtime experience carries presentation metadata;
- is null for a runtime schema that carries no presentation title.

description

- is the validated learner-facing opening description when the runtime experience carries presentation metadata;
- is null for a runtime schema that carries no presentation description.

boundaryIds

- is a frozen canonical boundary array;
- begins with initial;
- uses Runtime's canonical boundary order;
- contains no subject-specific state.

entries

- is a frozen ordered array corresponding to authored/runtime Commentary boundaries after initial;
- contains no synthetic Commentary entry for initial.

For the composition established by this ADR, each source entry contains exactly:

```text
stepId
text
links
```

Each link contains exactly:

```text
id
label
href
```

The Host does not supply a Commentary index. Commentary derives visible ordinal position from canonical order.

The Player-content projection enforces this exact alignment invariant:

```text
boundaryIds[0] === "initial"
entries.length === boundaryIds.length - 1
entries[i].stepId === boundaryIds[i + 1]
```

for every valid entry index i.

A mismatched count, displaced step ID, missing canonical boundary, reordered entry, or other alignment failure causes projection construction to fail closed.

WordPress composition does not repair, reorder, pad, or guess instructional content.

### 7. The Player-content projection does not expose the full experience

The projection excludes at least:

- initial_state;
- step state;
- renderer_config;
- step renderer configuration;
- the complete presentation object;
- beat objects;
- dwell values;
- engine metadata;
- Runtime operational state;
- Runtime control surfaces;
- renderer instances;
- Core capabilities.

Renderer-owned state remains opaque to WordPress Player composition.

Player composition receives instructional data and composition identity, not the complete runtime document.

### 8. v2 Commentary semantics remain a separate consumer-admission checkpoint

localis.cim/v2 Commentary can additionally carry:

- anchor;
- evidence;
- risk.

The Commentary presentation stack composed by this ADR currently consumes the established text and links shape.

ADR 0049 does not silently discard v2 semantics during production admission because production v2 admission remains closed.

Before the localis.cim/v2 WordPress registration gate opens, the reviewed v2 consumer checkpoint must provide a defined Player/Commentary representation for the required v2 instructional semantics, including risk guidance where authored.

That checkpoint must also satisfy the existing beat-aware Transport, viewport, and deep-link requirements.

### 9. bootstrap-module.mjs remains the outer production composition root

bootstrap-module.mjs continues to own cross-component WordPress assembly.

After Host initialization succeeds for a root, bootstrap obtains:

- the existing command port;
- the existing observation port;
- the new Player-content projection.

Bootstrap selects the Player composition mode from playerContent.rendererId.

For legacy mode, bootstrap follows this sequence:

```text
Host initialization
→ Transport binding
→ present(root)
```

For console-explanation mode, bootstrap follows this sequence:

```text
Host initialization
→ Player structure
→ Commentary binding
→ Transport binding
→ present(root)
```

Production components continue to receive narrow capabilities rather than complete peer objects.

### 10. Console-Explanation uses one WordPress-owned two-pane structure

Console-Explanation mode introduces one WordPress-owned Player container inside the existing .cim root.

The internal structure provides stable CiM-owned presentation hooks equivalent to:

```text
[data-cim-player="console-explanation"]
    [data-cim-pane="console"]
        [data-cim-renderer-root]

    [data-cim-pane="explanation"]
        Player opening content
        Commentary viewport
        Commentary controls/indicators
```

The existing [data-cim-renderer-root] remains the renderer mount root. WordPress composition may reposition that root inside the Console pane, but it does not replace the renderer's authority over descendants rendered inside it.

The Transport control region remains inside the outer .cim shell and outside renderer-owned DOM.

The fallback remains inside the outer .cim shell.

These attributes are internal CiM presentation hooks. They do not create a supported page-builder or host-theme API.

ADR 0048 Part A owns the teaching-first visual presentation of these panes.

### 11. Explanation opening content is Player metadata, not a semantic boundary

In Console-Explanation mode:

- title is the persistent learner-facing Explanation heading;
- description is the persistent opening Explanation preface.

Neither creates a Runtime boundary.

Neither advances the reveal frontier.

Neither receives a Commentary step ID.

Neither is selectable as a Commentary semantic destination.

Neither emits a semantic command.

At initial, the Explanation pane therefore contains the title and description while authored Commentary history remains empty.

Restart returns the semantic session to that same opening presentation.

### 12. WordPress composes the existing Commentary authority model

The Console-Explanation Player composes the accepted Commentary stack rather than introducing a WordPress-specific Commentary implementation.

Composition uses the existing Commentary responsibilities for:

- reveal projection;
- local selection;
- canonical active-entry presentation;
- semantic Commentary navigation;
- native text/link presentation;
- follow suspension;
- newer-steps indication;
- scroll-follow binding.

Commentary retains its existing ownership boundaries.

Commentary does not gain:

- canonical semantic authority;
- renderer authority;
- Transport authority;
- Core mutation authority;
- general Host authority.

### 13. Commentary receives only narrow Runtime capabilities

The Commentary composition derives a command capability containing exactly:

```text
seek
```

from the existing root-scoped Host command port.

Commentary navigation fixes command provenance to commentary through the existing Commentary navigation adapter.

The Commentary composition derives an observation capability containing exactly:

```text
snapshot
```

from the existing root-scoped Host observation port.

The Player supplies the projected boundaryIds and entries separately.

Commentary receives no complete Host object and no complete CiMInstance.

### 14. Restart is visible only when its consequence is visible

ADR 0045 Decision 15 remains the admission rule for learner-facing controls.

In legacy WordPress composition, the visible control order remains exactly:

```text
Start
Previous
Play/Pause
Next
End
```

In Console-Explanation composition, the visible control order is:

```text
Start
Previous
Play/Pause
Next
End
Restart
```

Restart continues to use the existing Transport command authority.

Its visible consequence in Console-Explanation mode is observable because Restart:

- returns canonical position to initial;
- resets the reveal frontier to initial;
- clears Commentary-local selection through existing reconciliation;
- removes revealed authored Commentary entries;
- restores the Player to the persistent title and opening description;
- returns the renderer to its canonical initial state through existing Runtime behavior.

Restart gains no new command semantics under this ADR.

### 15. Presentation admission is atomic

A mounted root is not learner-ready until all production bindings required by its selected composition mode have completed successfully.

present(root) is the sole operation that can project a successfully initialized root to ready.

No browser frame may present a Console-Explanation root as ready without its complete:

- Player structure;
- Commentary binding;
- Transport binding.

A legacy root likewise does not reach ready until its required Transport binding has completed successfully.

The existing { mounted, fallback } result returned by mount() describes Host initialization outcome, not final learner-presentation admission.

A later composition failure may move an initialized root to fallback without rewriting the already-settled mount result.

### 16. Pre-ready live content is structurally withheld

The ADR 0049 checkpoint adds structural CSS that withholds live CiM presentation before successful presentation admission.

While a .cim root is not ready, the stylesheet hides:

- [data-cim-renderer-root];
- [data-cim-player];
- [data-cim-transport-controls].

The withholding uses display: none so incomplete live content is absent from visual presentation and the accessibility tree.

Equivalent required behavior is:

```css
.cim:not([data-cim-state="ready"]) [data-cim-renderer-root],
.cim:not([data-cim-state="ready"]) [data-cim-player],
.cim:not([data-cim-state="ready"]) [data-cim-transport-controls] {
  display: none;
}
```

The existing inverse fallback rule remains:

```css
.cim[data-cim-state="ready"] .cim-fallback {
  display: none;
}
```

The resulting page-level presentation rule is:

```text
before presentation admission → fallback only
after presentation admission  → complete live composition only
```

This structural withholding is owned by ADR 0049. It is separate from the teaching-first palette defined by ADR 0048 Part A.

### 17. Player construction is transactional

Console-Explanation production composition is one learner-facing unit.

A root must not remain in a partially composed Console-only state after WordPress has selected Console-Explanation mode.

If Player, Commentary, or Transport construction fails after Host initialization:

1. every presentation binding already created for that root is disposed;
2. Player-created DOM is removed;
3. the renderer root is restored to its canonical root relationship where required for cleanup;
4. present(root) is not called;
5. Host root disposal is initiated;
6. the root returns to the existing fallback state;
7. the failure is reported through the existing Host/bootstrap diagnostic path.

Successful construction therefore yields either:

- the complete learner surface required by the selected composition mode; or
- the existing fallback surface.

This rule also applies to legacy composition. A required Transport binding failure now returns the legacy root to fallback rather than leaving a ready renderer without controls.

### 18. Disposal remains root-scoped, symmetric, and wins presentation races

Each mounted root owns one composite presentation lifecycle.

When disposeRoot(root) begins, Host synchronously withdraws:

```text
commands(root)
observations(root)
playerContent(root)
```

before asynchronous Runtime disposal proceeds.

After synchronous withdrawal:

```text
commands(root)      → null
observations(root)  → null
playerContent(root) → null
```

On root detachment:

1. Player/Commentary/Transport presentation bindings are disposed;
2. Player-created listeners, timers, observers, and DOM are removed;
3. Host root disposal follows.

Page-level disposal applies the same ordering to every mounted root.

One instance must not dispose, refresh, select, scroll, or navigate another instance.

Disposal remains idempotent according to the underlying component contracts.

If disposeRoot(root) has begun, a later or concurrent present(root) must fail without projecting ready.

Disposal wins every presentation race.

A disposing or disposed root cannot be resurrected by presentation admission.

### 19. console/v1 joins the WordPress renderer registry in this checkpoint

The WordPress renderer registry adds:

console/v1

using the existing createConsoleRenderer() implementation.

This registration is intentionally inert with respect to the production experience registry during ADR 0049.

Renderer availability and experience eligibility remain separate facts.

Adding console/v1 to the renderer registry does not open the localis.cim/v2 experience-registration gate.

### 20. The localis.cim/v2 production registration gate remains closed

ADR 0049 does not authorize registration of git-repository-practice or another v2 production experience.

The existing v2 admission requirement remains in force.

Before the gate opens, production must satisfy the already accepted v2 requirements for:

- engine compatibility enforcement;
- beat-aware Player/Transport behavior;
- beat-aware Previous and Next behavior;
- beat-ID deep-link resolution;
- Commentary consumption of required v2 instructional semantics;
- independent Console and Explanation viewport follow;
- Console automatic follow while learner ownership is inactive;
- a Console New output below indication when new output arrives while Console follow is suspended;
- pointer-presence holds in both panes;
- keyboard-focus holds in both panes;
- active-text-selection holds in both panes;
- explicit follow-resume behavior;
- validated renderer resolution;
- complete production-composition evidence.

The Console and Explanation panes own independent follow state.

Pointer presence, focus, and active text selection hold automatic viewport movement without changing canonical semantic position.

The later v2 consumer checkpoint must amend ADRs 0029 and 0030 where these hold semantics extend the accepted Commentary follow policy.

The v2 registration gate is lifted only in the later reviewed registration-bridge checkpoint.

### 21. ADR 0036, ADR 0044, and ADR 0045 are amended narrowly

ADR 0036 Decisions 9 and 10 are amended so successful Host initialization establishes the live instance and root-scoped capabilities, while present(root) owns the sole successful ready projection after required WordPress composition completes.

The existing ready/fallback state vocabulary remains unchanged.

ADR 0044 Decision 4 is superseded for the Commentary clause when the selected WordPress Player mode is console-explanation.

Commentary UI is then part of production composition.

Any other ADR 0044 exclusions that have not already been amended by later accepted work retain their current status.

ADR 0044 Decision 6 remains fully applicable: the production-composition change introduced by this ADR requires executable evidence in the same checkpoint.

ADR 0045 Decision 13 is clarified:

The WordPress .cim root may compose three independent learner-facing regions inside one outer shell:

- renderer output;
- Explanation/Commentary output;
- learner controls.

Renderer output remains unaware of Commentary and Transport.

Commentary remains unaware of renderer semantics.

Transport remains unaware of renderer and Commentary internals.

ADR 0045 Decision 14 remains unchanged. The renderer does not gain a second outer frame.

ADR 0045 Decision 15 remains unchanged. Visible control admission continues to depend on an observable learner consequence.

ADR 0045 Decision 16 is amended so Restart remains withheld in legacy composition and is visible in Console-Explanation composition.

### 22. ADR 0049 introduces no palette or theming interface

ADR 0049 establishes production composition, lifecycle, readiness, and DOM ownership.

It does not introduce the ADR 0048 teaching-first palette.

It introduces no --cim-* custom properties.

It introduces no author-controlled theme settings.

It changes no console/v1 renderer DOM contract.

ADR 0048 Part A follows this checkpoint and supplies the fixed Console and Explanation presentation using ordinary literal cim.css declarations.

## Consequences

WordPress gains a production-capable two-pane Player composition without widening the runtime schema merely to recover an authoring field already represented by renderer identity.

The Player can distinguish Console-Explanation composition without inspecting renderer DOM or matching a specific experience ID.

Commentary enters WordPress production through the same narrow authority model already proved by component and complete-learner-path tests.

The Host gains one additional read-only instructional projection and one explicit presentation-admission operation rather than exposing the validated experience object.

Renderer-owned state remains opaque to the Player.

WordPress readiness now means that the complete learner-facing composition required by the selected mode exists. Runtime initialization alone is insufficient to expose live content.

The pre-ready withholding rule prevents incomplete live composition from appearing visually or through assistive technology alongside the fallback.

Restart gains a learner-visible place only where its reveal-frontier consequence is visible.

Legacy git/v1 successful composition retains its current learner-facing behavior and therefore remains the rollback surface during the MVP transition.

Legacy required-binding failure now returns to fallback rather than exposing an incomplete ready surface.

console/v1 can be registered and exercised in production-composition tests before any v2 experience is admitted.

ADR 0048 Part A gains a real Console and Explanation WordPress surface against which computed colors, hostile-host isolation, focus, responsive behavior, and pane structure can be proved.

The later v2 consumer checkpoint remains responsible for beat-aware navigation, beat deep links, v2 anchor, evidence, and risk instructional semantics, Console viewport follow, independent pane ownership, and pointer/focus/selection holds required before production v2 registration.

The v2 experience gate therefore remains a real compatibility boundary rather than an administrative switch.

## Rejected alternatives

### Match a specific experience ID

Rejected because Player composition is a platform property. git-repository-practice is one experience using the composition, not the definition of the composition.

### Inspect renderer DOM to identify Console mode

Rejected because renderer DOM belongs to the renderer contract and must not become a WordPress composition-discovery mechanism.

### Reintroduce presentation.layout into localis.cim/v2

Rejected because deterministic compilation already projects the authoring layout into renderer identity. Repeating the layout in the runtime document would widen the schema with redundant information.

### Expose the complete validated experience to bootstrap or Player code

Rejected because it would widen Player visibility into renderer state and unrelated runtime data when the composition requires only a small instructional subset.

### Compose Commentary for every renderer

Rejected because Commentary admission is tied to an explicitly governed Player mode. Legacy composition remains the compatibility path.

### Make Restart visible for every WordPress experience

Rejected because ADR 0045's observable-consequence rule remains valid. The reveal-frontier consequence is visible in Console-Explanation mode and remains invisible in the legacy production surface.

### Let Host initialization continue to project ready

Rejected because Console-Explanation requires additional mandatory composition after Runtime initialization. A successful Runtime with missing Commentary or Transport is not the accepted learner surface.

### Depend on browser scheduling to avoid an intermediate layout

Rejected because readiness must be an architectural invariant rather than a timing assumption.

### Hide incomplete live content with opacity or visibility alone

Rejected because incomplete production UI must also remain absent from the accessibility tree before presentation admission. display: none provides the required structural withholding.

### Leave Player content available until asynchronous disposal settles

Rejected because root-scoped read capabilities must disappear at the same authority boundary as command and observation ports. A root that has begun disposal cannot continue presenting valid instructional content authority.

## Verification

### Contract and static evidence

The ADR 0049 checkpoint must prove:

- the WordPress renderer-to-Player-mode table contains exactly the reviewed mapping for console/v1;
- unlisted renderer IDs select legacy composition;
- composition selection does not inspect experience ID, subject, or renderer DOM;
- the WordPress Host public surface includes playerContent and present without unrelated widened capability;
- mount() no longer projects ready for a successfully initialized root;
- present(root) is the sole successful ready projection;
- present(root) is idempotent after successful admission;
- present(root) cannot succeed after disposal begins;
- playerContent(root) is root-scoped and returns null for unavailable or disposing/disposed roots;
- playerContent(root) exists for successfully initialized legacy roots as well as Console-Explanation roots;
- every returned Player-content object is frozen and has exactly the approved key set;
- boundaryIds, entries, entry records, and links are frozen;
- the alignment invariant is enforced exactly;
- malformed or reordered Player content fails closed;
- Player content contains no renderer state, renderer configuration, complete steps, or complete experience object;
- Commentary command authority contains only seek;
- Commentary observation contains only snapshot;
- WordPress remains the only cross-component composition owner;
- console/v1 is registered in the renderer registry;
- the production experience-registry gate still rejects localis.cim/v2;
- no production experience is added solely to exercise the new renderer;
- ADR 0049 introduces no --cim-* properties;
- the protected console/v1 canonical renderer evidence remains byte-identical.

### Readiness and withholding evidence

Browser evidence must prove:

- before presentation admission, fallback remains visible;
- before presentation admission, renderer root content is display: none;
- before presentation admission, Player content is display: none;
- before presentation admission, Transport controls are display: none;
- after successful presentation admission, fallback is hidden and complete live composition is exposed;
- frame sampling during asynchronous Console-Explanation mount observes no frame in which a root is ready without its complete Player structure;
- frame sampling during legacy mount observes no frame in which a root is ready before required Transport composition completes;
- withheld content is absent from accessibility exposure before ready.

### Legacy composition evidence

Existing production-composition evidence must remain green for a legacy renderer and prove:

- the existing renderer remains directly reachable;
- the visible control order remains Start, Previous, Play/Pause, Next, End;
- Restart remains absent;
- keyboard behavior is unchanged;
- playback behavior is unchanged;
- reduced-motion behavior is unchanged;
- detached-root lifecycle remains green;
- multiple-instance isolation remains green;
- the successful learner-facing legacy surface remains equivalent to the prior production surface;
- required legacy binding failure returns to fallback rather than exposing a control-less ready renderer.

### Console-Explanation composition evidence

A test-only WordPress/browser fixture or equivalent production-composition harness, outside the release experience registry, must prove:

- console/v1 selects console-explanation;
- exactly one Console pane and one Explanation pane are created;
- the existing renderer root is contained by the Console pane;
- title and description are visible at initial;
- no authored Commentary entry is visible at initial;
- semantic advance reveals the expected Commentary prefix;
- active Commentary follows canonical current position;
- previously revealed Commentary remains visible under backward navigation according to the existing high-water rule;
- Commentary entry activation seeks through source commentary;
- structured links remain native links;
- Commentary text remains native selectable text;
- Transport keyboard handling does not interfere with protected Explanation interaction targets or modified-key text selection;
- Restart is visible;
- Restart returns canonical position and reveal frontier to initial;
- Restart clears revealed authored Commentary while preserving title and description;
- Player construction failure reaches fallback rather than leaving a partial Console-only composition;
- root detachment disposes Commentary, Transport, Player DOM, and Host state;
- two Console-Explanation instances remain isolated.

### Disposal evidence

Lifecycle evidence must prove:

- disposeRoot(root) synchronously withdraws command authority;
- disposeRoot(root) synchronously withdraws observation authority;
- disposeRoot(root) synchronously withdraws Player-content authority;
- a subsequent present(root) cannot project ready;
- pending presentation loses a race with disposal;
- disposal cannot resurrect a root from fallback.

### Mutation evidence

The executable proof set must fail when each guarded behavior is intentionally broken, including at least:

- removing the console/v1 Player-mode mapping;
- routing console/v1 through legacy composition;
- exposing Restart on the legacy surface;
- hiding Restart on the Console-Explanation surface;
- removing the Commentary seek provenance adapter;
- skipping Commentary disposal on root detach;
- leaving a partial Player active after construction failure;
- projecting ready before Console-Explanation assembly completes;
- allowing present(root) after disposeRoot(root) to project ready;
- leaving playerContent(root) available after disposeRoot(root) begins;
- shifting Commentary entries by one boundary relative to boundaryIds;
- removing pre-ready renderer withholding;
- removing pre-ready Player withholding;
- removing pre-ready Transport withholding;
- opening the localis.cim/v2 production-registration gate in this checkpoint.

Each mutation proof records the protected test that detects it.

### Protected gates

The exact reviewed implementation head must complete successfully under:

1. Verify CiM contracts;
2. WordPress Floor QA;
3. WordPress Browser E2E;
4. WordPress Playground PR Preview.

No protected result transfers from another commit SHA.

## Follow-on work

After ADR 0049 lands:

1. ADR 0048 Part A supplies the fixed teaching-first Console and Explanation stylesheet and proves the unchanged console/v1 oracle.
2. The v2 consumer-admission checkpoint implements:
   - beat-aware Transport;
   - beat-aware Previous and Next;
   - beat-ID deep-link behavior;
   - v2 Commentary anchor, evidence, and risk presentation;
   - independent Console and Explanation viewport follow;
   - Console New output below;
   - pointer, focus, and active-selection holds in both panes;
   - explicit resume behavior.
3. That viewport/follow checkpoint amends ADRs 0029 and 0030 where the new hold semantics extend accepted Commentary follow policy.
4. The production registration bridge introduces explicit engine identity, enforces engine_min, proves incompatible-version rejection, and then opens the v2 registration gate.
5. git-repository-practice enters the production experience registry only after those requirements are green.
6. Issue #4 closes Player-level Console copy behavior before RC#2.
