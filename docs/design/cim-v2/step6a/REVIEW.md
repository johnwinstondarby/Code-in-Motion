# ADR 0061 step 6a — Engineering pane review packet

Draft for Daisy's independent review and Johann's approval. Base: `9864071`. Implementation: `0a05a16`; source-ending normalization: `b5a1ea0`. No merge, tag, release, version bump or production installation.

## Tests-first history, including corrections

- `c98dc56`: nine unit cases, an inert Engineering lifecycle and a CSS size declaration. `98b46d8` records the pre-implementation Node 22.23.2 run: **eight assertion failures and one passing CSS check**. These are not nine failing behavioral tests.
- `02a5800`: browser tests committed before implementation. The first browser log in `81a742f` contains a harness error: the main element named `fixture` satisfied a readiness check before the session existed. It is retained, **not counted as a valid behavioral red run**.
- `519513d` changes readiness to `window.fixture?.session`. The second recorded attempt (`ce9b57c`) times out because the Windows server root had a trailing separator and rejected module requests. That is also retained and **not counted as a valid behavioral red run**.
- `8eb1661` normalizes that server root. `071f57a` records the resulting meaningful pre-implementation browser failure: **the expected Diagram · modeled element does not exist**. No implementation existed at any of these commits. The meaningful browser red run is one Chromium/laptop case, not all nine combinations.
- `0a05a16` implements the pane and modifies the tests as itemized below. No original commit or red log is rewritten. The earlier red runs prove the original scenarios failed; they are not retrospective red evidence for subsequently added assertions.

| Later test edit | Reason |
|---|---|
| Unit ENG-06: nonexistent `review-context` becomes the existing `review-custody-links` beat | Correct a fixture-ID mistake. `review-run-metadata` was examined during correction but contains an observe record, so it is not the no-movement case. The chosen beat has zero records and the same derived state as retry. |
| Browser ENG-03/06: two Next advances after completion, rather than one | The first arrival is the metadata beat with an observe record. The second is the actual zero-record context beat. This corrects the scenario rather than redefining holding. |
| Unit ENG-03: assert no in-progress label and a completed result before comparing final and settled markup | A final-frame mutation initially survived because both the transition result and the separately settled result were wrong in the same way. The extra assertions independently constrain the result. |
| Unit ENG-03: inspect reduced-motion scheduling before awaiting completion | A broken reduced-motion implementation left a pending promise with no clock advance. The scheduling assertion now catches the fault directly instead of relying on cancellation by the Node test runner. |
| Unit ENG-05 and helper: include archive ID/root/path/digest; assert the exact raw-evidence ID label | Make the reference resolvable inside the declared capture archive and prevent the word transcript in its filename from accidentally satisfying the evidence-ID check. No files or URLs are fetched by the pane. |
| New second ENG-07 unit case | Exercise a broken Engineering pane inside the real step-5 session: it reports failure while Explanation completes and playback stops normally. This is post-red integration coverage. |
| File-ending cleanup | Removes trailing blank lines; no scenario change. |

Initial surviving probes are not counted as catches. Final `mutations.json` records a passing baseline and **14 assertion-detected probes**, covering every ENG-01–09 rule. A pending/cancelled test, syntax error or reference error is not accepted as detection.

## Rules, tests and probes

`U` refers to tagged cases in `tests/engineering-pane.test.mjs`; `B` to `tests/e2e/engineering-pane.spec.mjs`, repeated at three true-size viewports in each engine.

| Rule | Proof | Mutation |
|---|---|---|
| ENG-01 records/IDs/repeatability | U01 derives every state by ordered records, checks claimed states, preserves service and record IDs, compares repeated markup; B01 | `ids`, `derived` |
| ENG-02 modeled/placeholder labels | U02 visits initial, active, held and missing states; B02 | `label`, `placeholder` |
| ENG-03 finite shared clock, exact final, reduced motion, cancellation | U03 and B03 use the existing lifecycle/virtual clock, pause and resume; cancel leaves zero pending work and permits an absolute settle | `final`, `reduced` |
| ENG-04 visible status words, distinct custody/reproduction | U04 traverses all records plus an in-progress frame; B04 | `text` |
| ENG-05 accessible current state/flow/evidence | U05 checks text and evidence reference; B05 uses selectable DOM text, not canvas-only content | `evidence` |
| ENG-06 hold/wait/visible contexts | U06 compares held absolute state and no flows; B06 checks selection survives a view-only switch and both contexts stay visible | `wait` |
| ENG-07 bounded contained failure | U07 corrupts records/references and checks zero work plus fallback; second U07 proves peers finish in the session; B07 checks fallback and usable controls | `fallback` |
| ENG-08 readability | U08 CSS minimum; B08 measures all seven service-label fonts/widths and no transform at every size; nine screenshots/geometry records | `size` |
| ENG-09 capabilities/isolation | U09 rejects non-fixture admission and non-data capability input, checks public methods and forbidden network/engine code; B09 | `guard`, `leak`, `network` |

## Implementation and limits

- `src/multipane/engineering.mjs`: deterministic capture projection and `diagram/v1` adapter on the unchanged step-4 lifecycle. It has only mount/settle/play/dispose; registered trusted code, never lesson code. The adapter consumes immutable projected configuration and identity plus the existing scoped clock/cancellation. It imports only the shared pane contract. There is no Core, Runtime, host, network, timer or registration API.
- `src/multipane/engineering.css`: isolated readable node cards, flow connectors/tokens and text alternatives. Custody has a solid green edge and explicit words; reproduction a double blue edge and different words. Failed and in-progress states also have text, so color is supplementary.
- `tests/helpers/engineering-fixture.mjs`: Node-only fixture preparation runs the unchanged step-3 `validateBundle`/`assertValid`, passing only the necessary data. No authoring module is imported by the browser pane. The pane additionally checks references, record order, action/result consistency, declared state and counts, returning `CIM-DIAGRAM-RECORDS` on failure.
- `harness/multipane-test-driver.mjs`: optional mounted-pane factories allow this real pane to replace the plaintext Engineering stub in the fixture. Default factories and all step-5 behavior remain unchanged. Other new panes are still test doubles. No production composition or admission is added.
- `tools/check-engineering-mutations.mjs`, `package.json`: isolated mutation copies and 14 probes in verify, with a passing baseline and assertion-only detections.
- `.github/workflows/wordpress-e2e.yml`: adds the new suite to all three existing browser jobs. No runner, gate, trigger or required-check changes. A local CRLF rewrite temporarily failed the workflow source check; restoring the repository's LF ending resolved it without changing the checker or workflow policy.

The frozen capture format has **record IDs, not separate topology edge IDs**. Each displayed flow uses the exact capture-record ID; service nodes use exact declared service IDs. No edge names or service names are synthesized. Service placement comes from the validated lesson architecture, and the flow separately identifies the acting capture host (including INVENT). This is a modeled service/flow diagram, not physical cabling or live telemetry.

The token moves along a schematic connector for the current record; the connector does not claim a measured network route. The finite plan is 0/80/80 ms on the injected clock. The final display is the exact absolute settled state. With reduced motion the unchanged contract skips the frame plan entirely.

Text alternatives are visible DOM text with state, flow, action, host, artifact and an archive-local raw-evidence reference/digest. The reference is informational: the pane makes no network request and does not offer a file-server route. At laptop size the context pane scrolls for long provenance details; font size stays at least 14 px and nothing is scaled. These screenshots and automated keyboard/selection checks are not an independent screen-reader or outsider sign-off.

## Final verification and artifacts

- Node **20.20.2** and **22.23.2**: full verify **1,032 passed, zero failed/skipped** each. Existing v3, pane and transport probes remain enabled.
- v1 differential: **41 identical, zero different**, 28 v2/non-JSON cases skipped. All step-3 frozen compiler baselines, step-4 canonical comparisons and step-5 sources/evidence remain unchanged.
- New Engineering suite: **nine cases per engine**, three cases at each of 1366×768, 1536×864, 1920×1080. Combined legacy and step-5/6a suites: Chromium **98 passed**; Firefox and WebKit **97 passed, one existing skip each** (the Chromium-only native clipboard-permission proof). The new Engineering suite has no skips.
- Mutation baseline and all **14 probes** pass on Node 22.23.2; the same probes run under both verify versions.
- Clean Node 22.23.2 plugin builds A/B: **99 files**, identical bytes, SHA-256 **`d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`**, exactly step 5. Archive inspection confirms no `src/multipane/` entry. The existing packaging exclusion is unchanged.
- The authoring candidate source archive includes the dormant new files. Two clean builds: **117 files**, identical bytes, SHA-256 **`56f245ea943e2d30df17bd0832d00049ec6ffdc19c6b83a5469b0a782189777e`**. Candidate name stays distinct from published 1.0.1. No CLI preview or pack admission is enabled.
- `results.json` records the protected-path check and paired archive comparisons. The published 1.0.1 ZIP, prior rollback kits and page 3227 capture are untouched. No production access occurred.

`SHA256SUMS` covers evidence files except this packet, attributes and itself. Raw failing logs are preserved. Merge waits for Daisy's review, Johann's approval and green CI on the exact candidate head. Motion/media placement and production layout composition are later steps.


## Review follow-up: flow visibility and approved graphical scope

Johann approved retaining this text/service-flow view in PR #97 and adding the graphical canvas, connecting lines and travelling tokens in step 6c. The text view remains the required text alternative; this PR does not claim to implement the moving-canvas diagram.

Daisy found that the current beat's flows were clipped at laptop size. Commit `257e555` adds ENG-08-FLOW; `734e353` records its meaningful failing laptop run before the correction. The correction puts compact flow rows first, then a native, initially closed Show evidence expander, then the service grid. Paths, record IDs, raw result values and SHA-256 fingerprints remain in the expander. The fallback code is now `CIM-PANE-DIAGRAM-RECORDS`.

Post-red test edits in this follow-up: ENG-08-FLOW additionally checks moving frames and intersections with every clipping ancestor, after an initial mutation exposed that measuring only the inner element could miss clipping by its parent. It checks keyboard opening of the evidence expander. Existing error-code assertions change to the new code; no other existing scenario changes. The added browser mutation restores the grid-first order and must fail specifically on the visibility bound. Default verify retains 14 unit probes; the optional browser run contains 15 total and is added to every browser CI job.

Updated revision logs, screenshots, measurements and build checksums below supersede the corresponding initial results above; the initial evidence remains unchanged. The separate step 6b media decision record captures the user-selected source choices and pre-playback/Admin/anonymous-access requirements without enabling media loading.
