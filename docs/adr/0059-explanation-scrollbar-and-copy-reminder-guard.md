# ADR 0059: Explanation scrollbar track and Before copying guard

Status: Proposed for 0.2.6, 2026-10-16. Drafted by Daisy for Pilgrim. Scope: the two items deferred from the 0.2.5 review, as requested by Johann. If 0059 is already assigned when this lands, renumber and keep the title.

Amends ADR 0058's themed-scrollbar clause for the Explanation pane only. Every other part of ADR 0058 is unchanged.

## Problem

### 1. The Explanation pane's scrollbar track uses the Console background

In `wordpress/assets/cim.css` (0.2.5, about line 694), one rule styles both viewports:

```css
.cim [data-cim-player="console-explanation"] [data-cim-console-viewport],
.cim [data-cim-player="console-explanation"] [data-cim-commentary-viewport] {
  ...
  scrollbar-color: var(--cim-structural-border) var(--cim-console-background);
}
```

The commentary viewport therefore paints its track in `--cim-console-background`:

| Theme | Explanation background | Track drawn today | Effect |
|---|---|---|---|
| Localis | `#171B22` | `#000000` | A visible black strip down the slate pane |
| Light | `#FFFFFF` | `#F6F8FB` | Barely visible |
| High Contrast | `#000000` | `#000000` | None |
| Forced colors | `Canvas` | `Canvas` | None |

This was found in the 0.2.5 review and deferred so that CI and review would not restart.

### 2. Nothing guards the approved Before copying sentences

Johann approved two safety sentences at the start of the `reset --hard` explanations:

- Beat 6, `discard-commit`: "Before copying: run git status and stash or commit any work you want to keep."
- Beat 8, `recover-from-reflog`: "Before copying: confirm the target in your own reflog and preserve uncommitted work."

They appear in all three lesson copies:

- `experiences/git/git-repository-practice.authoring.json`
- `experiences/git/git-repository-practice.json`
- `wordpress/experiences/git-repository-practice.json`

The check that would have caught their removal was dropped during 0.2.5, and no test looks for them now. An edit or recompile that lost either sentence would pass CI.

## Decision

### Fix 1: each pane draws its own track

Split the `scrollbar-color` declaration. The shared rule keeps every other property (height, `scrollbar-gutter`, `scrollbar-width`).

```css
.cim [data-cim-player="console-explanation"] [data-cim-console-viewport] {
  scrollbar-color: var(--cim-structural-border) var(--cim-console-background);
}
.cim [data-cim-player="console-explanation"] [data-cim-commentary-viewport] {
  scrollbar-color: var(--cim-structural-border) var(--cim-explanation-background);
}
```

No new tokens are added. The thumb stays `--cim-structural-border` in both panes. The Console is unchanged. This also keeps the Explanation pane in line with the color grammar: a pane's chrome takes that pane's colors.

### Fix 2: lock the two sentences with a test

Add a unit test (`node:test`, in the style of the existing lesson tests) that, for each of the three lesson files:

1. finds the explanation for beat `discard-commit` and for beat `recover-from-reflog`;
2. asserts that each begins with its approved sentence exactly, as quoted above;
3. asserts that each sentence appears exactly once in that file.

Match by beat ID, not array position or line number, so reordering segments doesn't break the test while removing or rewording the sentence does. The test only reads the files. Lesson content, Console state and Copy values are unchanged.

## Tests and guards

- **E2E (`tests/e2e/wordpress-player-mvp.spec.mjs`):** extend the GA layout test. For each theme (Localis, High Contrast, Light), assert that the computed `scrollbar-color` track on the commentary viewport equals that theme's computed `--cim-explanation-background`, and on the console viewport equals `--cim-console-background`. Engines that don't report `scrollbar-color` in computed style skip only this assertion, with a recorded reason, and don't fail.
- **Mutation guards (`tools/check-wordpress-player-mutations.mjs`):**
  - a build where the commentary viewport's track is `--cim-console-background` again must be caught;
  - a lesson copy with either sentence deleted must be caught, once for each of the three files.
- **Full suite:** all existing tests, all Player browser cases in Chromium, Firefox and WebKit, all four protected workflows, and every mutation guard pass. Expect the guard count to rise from 97 by the new guards.

## Release

- Plugin version 0.2.6. Reproducible ZIP on the pinned Node version, with its checksum in the review packet.
- Rollback kit: the exact live 0.2.5 ZIP (from tag `0.2.5`, `f8651ed`) and a fresh page 3227 content capture, each with a checksum.
- Upgrade path tested from live 0.2.5. Rollback to exact 0.2.5 tested.
- Merge, tag and production installation are held for Daisy's review and Johann's approval.

## Acceptance on localis.services

- Page 3227, desktop, Localis theme: the Explanation scrollbar track matches the slate pane, with no black strip. Light and High Contrast look as before.
- Console scrollbar unchanged in all three themes.
- Beats 6 and 8 still open with their Before copying sentences.
- No change to playback, beat pauses, pane height, transport placement, mobile notice, or pages without a Player.

## Out of scope

Per-phrase limn, author palettes (ADR 0048 Part C), a "Match device" theme option, SSH rollback on WordPress.com, and any lesson wording change.

## Sequencing

The 0.2.5 live acceptance run and post-merge CI passed before 0.2.6 preparation. Development proceeds from the tagged 0.2.5 merge commit. Merge, tag and installation of 0.2.6 remain held for Daisy's independent rebuild and Johann's approval.
