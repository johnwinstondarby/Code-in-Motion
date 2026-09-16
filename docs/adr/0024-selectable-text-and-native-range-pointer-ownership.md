# ADR 0024: Selectable Text and Native Range Pointer Ownership

Status: Accepted

Date: 2026-09-16

## Context

Transport checkpoint 9 deliberately delegated physical slider mechanics to the browser and listened only to native range `input`, `change`, `pointercancel`, and `touchcancel` events. Commentary will introduce persistent learner-facing text that must remain selectable.

A future broad pointer listener on the rail, commentary surface, document, or window could silently convert ordinary drag-selection into scrub preview or semantic commit. Keyboard selection ownership is already covered by Transport checkpoint 4, but pointer text selection required an executable ownership probe before Commentary adds more selectable content.

## Decision

1. Native scrub interaction is entered only through the injected `<input type="range">` control.

2. Transport installs no `pointerdown`, `pointermove`, `pointerup`, `mousedown`, `mousemove`, `mouseup`, `selectstart`, or `selectionchange` listener for scrub interaction.

3. Transport installs no scrub listener on learner text, the visual rail container, `document`, or `window`.

4. Pointer drag-selection originating in selectable learner content remains browser/content-owned. It causes no scrub `begin`, `update`, `commit`, or `cancel` call and no Transport command.

5. Transport does not need a `preventDefault()` exception for selectable-text drag because Transport never receives ownership of those pointer events.

6. Native range interaction remains unchanged: browser-normalized `input` updates local preview, `change` commits once, and native cancellation cancels preview.

7. Future Commentary DOM and interaction work must preserve this ownership boundary. Commentary text may be selected without entering Transport scrub behavior.

## Consequences

Selectable instructional text and the semantic slider can coexist without a gesture arbitration layer. The browser continues to own physical text selection and native slider pointer mechanics.

Any future feature that requires document-level pointer tracking must establish a separate contract and prove that it cannot capture selectable-text interaction before it is admitted to Transport or Commentary.

## Verification

The executable probe proves:

- scrub listeners are installed only on the native range control;
- no broad pointer or selection listener is installed for scrub;
- a drag-select sequence over learner text produces zero scrub gesture calls and zero refresh/command activity;
- Transport never calls `preventDefault()` for pointer selection it does not own;
- native range `input` and `change` continue to drive preview and release-only commit;
- repository schema, architecture, Core-authority, and full test gates remain green on Node 20 and Node 22.
