# ADR 0050: Independent Player Pane Follow and Holds

Status: Accepted

Date: 2026-10-12

Amends:

- ADR 0029 Decisions 3, 5, 6, and 7 for temporary holds distinct from suspension.
- ADR 0030 Decisions 4, 7, 8, 9, and 11 for held movement, native scroll attribution, and deliberate repositioning.

## Context

ADR 0049 composes the Console-Explanation Player but defers independent viewport follow and holds. AUTHORING-JSON-v1 section 16.2 and AUTHORING-TO-RUNTIME-v1 section 16 require both panes to follow independently, preserve learner viewport ownership, and pause movement during pointer presence, keyboard focus, or active text selection.

The accepted distinction is that temporary holds pause automatic movement without disabling following. Only learner scrolling away suspends following until explicit resume. This checkpoint supplies that requirement ahead of the remaining v2 content-admission consumers; it does not open the production v2 registration gate.

## Decision

1. WordPress remains the composition owner. It creates one stable Console viewport outside the renderer root and uses the existing stable Explanation viewport. The renderer may replace its transcript during typing or seeking without replacing Player listeners or viewport ownership. Within the Player, the renderer transcript no longer introduces a second scrolling surface. Renderer DOM and canonical evidence stay unchanged.

2. Each pane has independent local follow state. Commentary continues to consume only validated presentation. Console consumes rendered transcript text identity through a WordPress-local reader, including partial typing and output within a semantic boundary. Neither policy gains Runtime commands, renderer state, or semantic event authority.

3. The exact frozen Commentary follow capability becomes `read`, `suspend`, `resume`, `hold`, and `release`. Its projected state becomes `following`, `held`, `newerStepsAvailable`, and `latestVisibleStepId`. Hold reasons are exactly `pointer`, `focus`, and `selection`; repeated acquisition of one reason is idempotent. Invalid input fails before hold or ownership mutation.

4. While following and unheld, fresh content is acknowledged as before. While held, acknowledgement remains at the pre-hold frontier, movement pauses, and later content can raise the pending indication. Releasing the last hold catches up only if follow is still enabled. Releasing a hold never resumes a suspended, learner-owned viewport. Explicit resume acknowledges the current frontier even if another temporary hold remains; subsequent new content still respects that hold.

5. Native pane `pointerenter`, `pointerleave`, and `pointercancel` track presence. Native `focusin` and `focusout` track focus anywhere within the pane, including links and controls. A document `selectionchange` listener checks non-collapsed ranges intersecting that pane. Selection elsewhere does not hold it. These listeners do not prevent native pointer, keyboard, link, or text-selection behavior.

6. Scroll construction additionally receives an exact frozen `scrollIntent` capability containing only `read`, which returns a boolean. WordPress tracks native wheel, touch movement, scroller keyboard input, and scrollbar dragging without preventing default behavior. Native scroll end clears intent; a one-second expiry bounds intent in browsers without scroll-end support. Focus activation clears intent so focus-induced movement cannot establish ownership. This temporal input window does not change the one-pixel bottom tolerance. Only actual scroll-position movement away from the newest content suspends following. Unchanged-position scroll events caused by new content or by the binding's own immediate scroll request do not establish ownership. Contraction/clamping likewise does not establish ownership. CSS disables scroll anchoring and smooth scrolling on the Player viewports so layout and browser interpolation cannot masquerade as learner movement.

7. A learner deliberately returning to the bottom within the existing one-CSS-pixel tolerance is explicit resume. Activating that pane's native pending-content button is also explicit resume: scroll first, resume only after successful scrolling. Labels are `New output below` for Console and `New explanation below` for Explanation. No beat-boundary or polling catch-up overrides learner ownership.

8. The exact frozen scroll-binding surface becomes `refresh`, `reposition`, and `dispose`. `refresh` never moves a held or suspended viewport and records automatic progress only after successful movement. A released hold therefore catches up even when the latest content identity has not changed again. `reposition(top)` accepts only native geometry, clamps to the viewport, and records its own scroll without altering follow ownership. Its omitted destination is the bottom.

9. WordPress routes accepted deliberate navigation completion through local viewport repositioning: Console shows the current transcript end; Explanation shows the active entry, or its opening at initial. Start, End, Restart, Previous, Next, seek, scrub, and Commentary entry activation may therefore move held or owned viewports as requested. Original command return values and provenance are preserved. Rejected or failed navigation and callbacks after disposal do not move panes. This operation does not silently re-enable follow mode.

10. Player geometry is withheld until presentation admission. A renderer-subtree observer refreshes Console movement as presentation changes; existing Player refresh supplies Commentary updates. Observer, native hold listeners, and scroll listeners are root-scoped and disposed with the Player. Partial construction rolls back installed resources. Hold-binding teardown is inert from the start of disposal and retryable after listener-removal failure.

11. Immediate `behavior: auto` scrolling remains the policy. This checkpoint introduces no scrolling animation, extra color role, configurable palette, limn, copy behavior, beat navigation, or v2 production registration. The authored-indent continuation collision recorded in PR #75 remains unresolved and retains its expected-failure proof.

## Consequences

Learners can read, focus links, or select text in either pane while the other continues following. When temporary engagement ends, a following pane catches up. When learners scroll away, that pane stays where they leave it until explicit resume or deliberate navigation.

The Commentary component README and WordPress Player QA contract describe the amended surfaces. ADR 0049's remaining content-admission gates still apply.

## Verification

- Headless tests distinguish overlapping holds, pending content, suspension, release, contraction, and explicit resume.
- Browser geometry proves independent movement, real renderer replacement, pointer/focus/selection holds in both panes, native scroll ownership, both explicit-resume paths, deliberate navigation, and sibling isolation.
- Scoped teardown and rollback proofs detect stale listeners and observer callbacks.
- Guarded mutations remove each hold reason, bypass Console follow, override ownership, or omit lifecycle cleanup; the corresponding protected tests must fail.
- Whitespace, full repository verification, unchanged Console evidence, and all four protected workflows apply to the exact candidate head.
