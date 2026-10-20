# ADR 0061 step 5 review packet

Draft for independent review and Johann's approval. Base: `b9c3c955f473d69fcf24e478f44c8c7d1f42d988`. Implementation: `a6963b6407ab88529ea59e027d201596fc7ed4c8`. Later packet changes are evidence/documentation only. No release, version bump, tag, merge or installation is authorized by this packet.

## Tests first — the primary evidence

1. **`5a89a69`** commits the tests, validated-v3 fixture/clock instrumentation and inert model/session/view stubs. There is no working transport in this commit.
2. On **Node 22.23.2**, the [original unit run](red-unit.log) fails **18 of 19 tests**, with assertion failures rather than import/syntax crashes. The one passing case is the already-correct initial Start view. The [original browser run](red-browser.log) fails because the expected two action tabs do not exist (received zero).
3. **`944f611`** commits those red logs and [source/log hashes](tests-first.json), still before implementation.
4. **`a6963b6`** implements the behavior. It also strengthens the same tests: manual choice through automatic completion; no pane redraw on a view-only switch; all four initial states on Restart; and pausing the current beat after stale callbacks arrive. Selection during peer motion, content keyboard access and tooltips receive stronger browser assertions. No initial red record or commit was rewritten.

The [supplemental historical replay](historical-stub-replay.log) later runs all **21 original browser cases** at all three sizes against an untouched worktree of `5a89a69`: all 21 fail. This replay happened **after** implementation and is labeled accordingly; it supplements the original pre-implementation run, not a claim to an earlier timestamp. `results.json` and `tests-first.json` record the distinction. The original committed source hashes have been independently checked against Git blobs.

## Implementation and isolation

See [TRANSPORT.md](TRANSPORT.md) for the exact state, event, clock, pane and view contracts.

| File | Change |
|---|---|
| `src/multipane/model.mjs` | Pure immutable state machine: beat/tab selection, sequential/direct context rules, progress, reading pauses, navigation generations, menu and status. Explicit fixture-only activation guard; no DOM or timers. |
| `src/multipane/session.mjs` | Drives existing mounted pane contracts using an injected shared transition clock. Cancels/rebuilds absolute states, waits for all participants, records classified failures and rejects stale results. |
| `src/multipane/controls.mjs` | Opt-in DOM controls, native action tabs and Beats popup, keyboard/focus rules, stable controls, labels/tooltips and cleanup. No existing renderer/host registration imports it. |
| `src/multipane/controls.css` | Scoped test-fixture layout at true size. No existing styles or themes changed. |
| `harness/multipane-test-driver.mjs` | Test-only plaintext pane instrumentation backed by the step-4 lifecycle and existing Runtime clock/abort capabilities. These are not the real Motion or Engineering panes. |
| `tests/helpers/multipane-experience.mjs` | Projects the existing validated authoring-v3/capture fixture through the unchanged step-3 proof. Adds a separately validated leading context-only case. |
| `tests/multipane-transport.test.mjs` | Nineteen rule/state/clock cases, written initially against stubs and subsequently strengthened as described above. |
| `tests/e2e/multipane-transport.spec.mjs` | Seven browser cases at each of three sizes: 21 per engine, with real keyboard/focus/selection and true-size evidence. |
| `tools/check-multipane-mutations.mjs` | 26 unit mutations plus eight optional browser mutations. Each has a passing baseline; failures must be protected assertions, not syntax/reference/type crashes. |
| `package.json` | Adds 26 unit probes to verify. Version remains 1.0.1. No dependency changes. |
| `.github/workflows/wordpress-e2e.yml` | Adds the new positive suite and all 34 probes to each existing Chromium/Firefox/WebKit job. Existing jobs/gates remain. |
| `tools/check-architecture-boundaries.mjs` | Forbids the experimental transport from importing Core, Runtime or host implementations. Clock authority is injected. |
| `tools/build-wordpress-release.mjs` | Explicitly excludes `src/multipane/` from the WordPress archive until a later reviewed consumer/admission step. Existing shipped sources remain byte-identical. |
| This directory | Red/green logs, rule map, provenance, screenshots/geometry, mutations, builds and integrity records. |

**Unchanged:** WordPress files, Core, Runtime, host, experience validation, existing renderers, commentary, shared pane contract, all authoring formats and the step-3/step-4 frozen baseline files. No new renderer or pack agreement is registered/admitted, no engine capability is raised, and public v3 init/compile/preview/pack remains deferred. The private constructor accepts only an explicitly flagged placeholder multi-pane fixture; it is not a WordPress or CLI mount path.

## Rule → tests → mutation map

`U` denotes the named `[MP-xx]` case in `tests/multipane-transport.test.mjs`; `B` denotes the same tag in `tests/e2e/multipane-transport.spec.mjs`, executed at 1366×768, 1536×864 and 1920×1080 in all three engines. Probe IDs are listed in each `mutations-<engine>.json`. Some cross-cutting tests protect more than one rule.

| Rule | Required behavior | Tests | Mutation IDs |
|---|---|---|---|
| MP-01 | Beat-start selection once, no focus theft, manual choice survives completion | U/B01 | `tab`, `completion-tab`, `focus` |
| MP-02 | Manual switch changes view only; hidden work continues | U/B02 | `view-only` |
| MP-03 | Pause/resume keep choice; shared clock freezes/resumes | U/B03 | `pause-tab`, `resume-tab`, `clock` |
| MP-04 | Next completes first, preserves choice, then advances | U/B04 | `next` |
| MP-05 | Context-only holds last action's final states with waits | U/B05 | `held-state` |
| MP-06 | No earlier action uses Console initial state | U/B06 | `initial-default` |
| MP-07 | Sequential context chain preserves override; jump uses default | U/B07 | `context-override` |
| MP-08 | Previous/End/jump/deep link rebuild every pane absolutely | U08/U18, B08 | `reconstruction`, `pane-wiring` (MP-18 test) |
| MP-09 | Start restores initial view and waits | U/B09 | `start` |
| MP-10 | Restart cancels, restores all initial states and plays beat one | U/B10 | `restart`, `reset` |
| MP-11 | Beats stays live, marks current beat (none at Start) | U/B11 | `open`, `current` |
| MP-12 | Keyboard movement does not jump; Escape/Close preserve state and return focus | U/B12 | `close`, `focus-return` |
| MP-13 | Initial/playing/paused status and matching Play/Pause tooltip | U/B13 | `status`, `tooltip` |
| MP-14 | Reciprocal roles/IDs, exactly one selected tab/focus stop | B14 | `roving` |
| MP-15 | Left/Right/Home/End and Tab-to-content keyboard use | B15 | `keyboard` |
| MP-16 | Held content stays selectable and undimmed during peer work | B16 | `selection` |
| MP-17 | Cancelled mid-beat completion cannot finish another beat | U/B17 | `stale-completion` |
| MP-18 | Rapid navigation and stale results cannot clobber new work/clock control | U/B18 | `late-results` |
| MP-19 | Reduced motion settles without scheduling animation | U/B19 | `reduced-motion` |
| MP-20 | Fixture guard rejects legacy activation; no experimental WordPress modules | U20, archive inspection | `fixture-guard`, `packaging` |
| MP-21 | Dispose withdraws work, subscribers, controls and stale commands | U/B21 | `dispose`, `view-dispose` |
| MP-22 | Every participant completes or releases classified failure | U22 | `all-panes`, `failure` |

One initial late-result mutation survived a test that only ended at a settled destination: the reducer's own stale-event guard masked the lost transition handle. The test was strengthened to pause a new in-flight beat after old results arrive; it then detects the broken shared-clock control. Surviving probes are not counted as caught. The final reports contain only successful detections with the complete passing baseline.

## Final gates

- Full verify: **1,022 passed** on [Node 20.20.2](verify-node20.log) and [Node 22.23.2](verify-node22.log), zero failed/skipped. Each runs the existing 17 schema and five pane probes plus 26 new state/clock probes.
- [v1 comparison](v1-differential.log): **41 identical, zero different**, 28 v2/non-JSON cases skipped. Existing 77-file/66-source compiler baseline and step-4 20-file legacy/canonical evidence protection remain unchanged and pass.
- Combined legacy and new browser suite: [Chromium](browser-chromium.log) **89 passed**; [Firefox](browser-firefox.log) and [WebKit](browser-webkit.log) **88 passed, one existing skip each**. The skipped native clipboard-permission proof is Chromium-only; clipboard binding behavior is exercised in all engines.
- Pinned-Node new acceptance suite: **21/21 per engine**, seven cases per viewport, **63 total across all nine engine/size combinations**. See `acceptance-<engine>.log` and the nine `<engine>-<size>.json/.png` files. No scaling is used; contexts remain equal-width/visible and controls fit at laptop size. This is automated geometry plus visual fixture evidence, not an outsider or assistive-technology sign-off.
- Final mutation suite: **34/34 per engine**, comprising 26 unit and eight browser probes. See `mutations-chromium`, `mutations-firefox` and `mutations-webkit` logs/JSON, run with Node 22.23.2. The browser CI jobs run this same command.
- The existing step-4 before/after markup test still passes unchanged in the combined suites: 249 Git and 37 Python complete pane snapshots per engine, with matching virtual timing.

**WebKit run history:** the initial concurrent run had one failure in the unchanged legacy “Explanation overlapping holds and pane-owned scrolling remain independent” test. [That initial log](browser-webkit-initial.log) is retained. [Three isolated repeats](webkit-hold-repeats.log) and the subsequent complete serial WebKit suite passed, without changing legacy code or tests. The final new acceptance/mutation runs also pass. CI on the exact PR head remains required; no failed result is silently replaced or claimed as an initial pass.

## Builds and rollback

Two clean-checkout builds on Node 22.23.2 match:

| Candidate | SHA-256 | Logs |
|---|---|---|
| Plugin, 99 files | `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a` | [A](plugin-build-a.log), [B](plugin-build-b.log) |
| Authoring candidate, 115 files | `826dbe2746c4063d43b36f47fd9cac1dd875858ff94d2b245016c076ec5123c3` | [A](authoring-build-a.log), [B](authoring-build-b.log) |

The plugin is **byte-identical to step 4's unpublished candidate**, because this step changes no shipped code and explicitly excludes the experimental directory. Archive inspection confirms there is no `src/multipane/` entry. Local review copies are distinctly named `step5-plugin-candidate-build-a.zip` / `-b.zip`; no published asset is overwritten. The authoring source archive includes dormant source/CSS and uses the existing `--candidate` suffix; its [extracted legacy preview test](extracted-preview.log) passes. Public authoring-v3 preview/admission is not enabled.

The exact published 1.0.1 ZIP (`95cdd84b2d0cc8028ff94784a9087a865fc5381f72fb09c4faa9b8aaaa5b31d7`), page 3227 capture (`34ceed1c2b7536f20dfa62fb841d629d5ff6aa12471f3984480c27601d93f2ab`) and step-4 rollback kit remain unchanged; see [rollback record](rollback-record.json). No production site was touched.

`SHA256SUMS` covers all evidence files in this directory except this packet, TRANSPORT.md, attributes and itself. Raw evidence line endings are preserved. The original tests-first Git-blob hashes, final committed evidence hashes, paired build bytes and protected-source diff have been checked. CI must be reviewed on the final draft PR head; merge awaits independent review and Johann's approval.
