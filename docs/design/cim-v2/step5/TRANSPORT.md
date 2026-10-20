# Experimental multi-pane transport — ADR 0061 step 5

This is fixture-only work. Existing lessons, frozen formats, Core, Runtime, host, WordPress registration and engine capability remain unchanged. The WordPress ZIP explicitly excludes `src/multipane/`; enabling a real consumer later requires an explicit packaging/admission review. Nothing mounts this UI from the plugin or the authoring CLI. The private entry point requires `testFixture: true`, a valid frozen-v2 envelope using `panes/v1`, engine capability 1.1.0, the action/context layout, placeholder mode and four known pane declarations. The input is produced by the existing step-3 proof from validated authoring-v3/capture fixtures; this is not a new public compiler or renderer registration.

## Pure state machine

`model.mjs` owns immutable logical state and has no DOM, timers, network or Runtime/Core/host dependency. State contains the beat index, initial/active/settled progress, playback intent, selected action tab, generation, Beats visibility, absolute target pane states, waiting flags, failures and derived status. A generation changes on navigation or explicit completion by Next; it is not changed by tab selection, pause/resume or opening/closing Beats. Stale completion events are ignored.

Every direct arrival uses the destination's absolute state and deterministic tab from the validated proof. Sequential arrivals preserve the current tab across context-only beats, while an action beat selects its authored tab once. Manual selection does not alter position, generation, intent or clock. Initial state selects Console. Start restores initial states and waits; Restart restores all initial states and starts beat one. Next finishes in-flight work in place, preserving the manual tab, then a subsequent Next enters the next beat's final state and waits, matching the v7 prototype. Play after a settled beat starts the following beat; normal completion pauses for reading.

Status is `Start · N beats` before playback, then `Beat i / N · playing` or `Beat i / N · paused`, including automatic completion. No whole-lesson “done” state is implied. Deep-link events accept only `#cim/<this lesson>/<known beat>`; malformed, foreign and unknown links leave state unchanged. No production fragment handler is installed.

## Shared clock and existing pane contract

`session.mjs` composes mounted step-4 pane contracts and an injected transition driver. The driver exposes a scoped clock, cancellation, pause/resume, cancel and close; it is not passed to panes. Panes receive only their existing immutable state/config/boundary and restricted clock/cancellation projection. No code or command in a lesson is executed.

The test driver uses the existing Runtime clock and abort capabilities over virtual time. The session implements no timer or second clock. All active panes start on that one transition clock, including an active pane whose tab is hidden. Pause/resume affect the shared clock without changing tab choice. Completion waits for all participating pane results; a classified failed result releases its participation and is recorded. There is no hard-coded beat duration: the text test adapters have finite plans for measurement, while the session waits on their actual contract results. Media buffering, video seeking/timeouts and the real new pane implementations remain step 6 work.

Navigation cancels and closes prior work, settles every pane from the complete destination snapshot and invalidates stale results. Restart settles the complete initial snapshot before playing. A late result cannot clear the current transition's control handle or defeat a later Pause. Disposal cancels the transition, disposes every pane and withdraws subscribers. The test text panes use the existing lifecycle; they are instrumentation, not new production Console, Motion or Engineering renderers.

## View and keyboard behavior

`controls.mjs` creates the action tabs, two persistent context regions, compact icon/label controls and non-modal Beats popup using DOM methods and text nodes. CSS is scoped to `.mp-fixture` and is not included in the WordPress ZIP. The test adapters display plaintext placeholder state; no real diagram or video implementation is claimed.

Tabs have reciprocal tab/tabpanel IDs, one selected tab and one roving tab stop. Left/Right and Home/End select and focus; Tab reaches the content. Automatic beat selection changes attributes and visibility only, never focus. A hidden active pane continues independently of view selection. Held content stays at full opacity with selectable text and its waiting note. The placeholder badge remains visible throughout.

Beats opens without pausing and explains that playback continues. It marks the current authored beat (none at Start). Arrow keys and Home/End move focus without navigating; native activation performs the chosen jump. Escape and Close only dismiss and return focus to Beats. Start/End remain distinct menu actions; Restart is separated in the bar. Status and Play/Pause labels/tooltips update without replacing controls or taking focus.

## Tests-first provenance

Commit `5a89a69` contains the behavior tests, v3 fixture/clock instrumentation and inert stubs, before implementation. Node 22.23.2 produced 18 failing assertions and one passing initial-view test; the browser tabs check failed with two expected tabs and zero found. Commit `944f611` preserves those logs and their hashes before the implementation commit. No failed import, syntax error or crash is treated as the intended red result.

A later, clearly labeled historical replay runs all 21 original browser cases from that same untouched stub commit. It supplements the original pre-implementation run; it is not represented as having happened earlier. During mutation work, tests were strengthened for automatic completion retaining a manual tab, no redraw on view-only selection, resetting all four states on Restart, and pausing a new beat after stale results arrive. Waiting selection, content keyboard access and tooltips also received stronger browser assertions. These strengthen the same v7 rules; the original committed tests and red logs remain available without rewriting history.

The review packet maps MP-01 through MP-22 to test names and intentional mutations. Unit mutation probes run inside verify on Node 20 and 22. Browser mutation probes additionally run in all three browser CI jobs, while positive browser cases run at all three true-size viewports. Existing step-4 byte/markup comparisons and legacy browser cases are unchanged. This is automated browser/geometry evidence, not a human usability or assistive-technology sign-off.
