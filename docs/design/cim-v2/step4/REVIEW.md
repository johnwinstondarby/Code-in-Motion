# ADR 0061 step 4 review packet

Draft for independent review and Johann's approval. Base: `586937130e5a49bb80aeaae95ddef4ecd8236fad`. Tested/built implementation: `c2f1ef4`. Subsequent packet changes are documentation/evidence only. This approves no release or installation.

## Result

The existing Console renderer and host-owned Explanation view now use the same internal mount/settle/play/dispose lifecycle. Console's DOM builders, frame planner and animation timings are unchanged. Explanation's existing DOM application and host navigation remain separate; the pane receives only validated projected display data and element slots. The frozen external renderer-v1 context and mount/render/dispose interface are unchanged. No new renderer, pane type, layout, transport, registration, WordPress behavior, engine capability or version is admitted.

See [the internal contract](PANE-CONTRACT.md) for exact inputs, result shapes, time bounds, composition boundaries and cleanup. Explanation deliberately remains a read-only host view: routing its observation or navigation through Console would widen the frozen renderer context or violate the existing authority boundary.

## Files changed

| File | Change and purpose |
|---|---|
| `src/contracts/pane.mjs` | Shared lifecycle; explicit capability projection; immutable data/identity; finite frame scheduling; cancellation, supersession and disposal. |
| `src/renderers/subjects/console/renderer.mjs` | Existing renderer delegates to a Console pane; unchanged stable builders/planner/timing; maps bounded results to existing renderer promise outcomes. Invalid superseding renders revoke old work while retaining current DOM. |
| `src/commentary/native-binding.mjs` | Explanation adapter draws the existing validated projection through the lifecycle. Native binding continues to own listeners, navigation, selection and transactional rollback. |
| `tools/check-architecture-boundaries.mjs` | Shared contracts cannot import Core, Runtime, hosts, transport, renderer or commentary implementation modules. |
| `tools/check-pane-mutations.mjs` | Five isolated production-code mutations, with a passing baseline and assertion failures required; crashes cannot count as detection. |
| `package.json` | Runs the five new probes as part of verify; adds their command. Version stays 1.0.1. |
| `tests/pane-contract.test.mjs` | Eight tests for lifecycle, authority, cleanup, shared-clock behavior, reduced motion, invalid supersession and protected legacy bytes. |
| `tests/fixtures/pane-contract-legacy-files.json` | Base hashes for 20 bundled/generated/evidence files, including page 3227 projections and all bundled lesson copies. |
| `tests/fixtures/pane-contract-baseline/console-renderer.mjs` | Pre-refactor Console snapshot from the base; only import URLs rewritten for browser fixture serving. |
| `tests/fixtures/pane-contract-baseline/native-binding.mjs` | Pre-refactor Explanation binding snapshot with the same import-URL-only treatment. Neither snapshot ships. |
| `tests/e2e/wordpress-player-mvp.spec.mjs` | One new before/after comparison case; records exact markup at rest and every virtual transition frame for both bundled Console lessons. Existing cases remain unchanged. |
| This directory | Contract, review packet, complete logs, before/after markup, build checksums, rollback record and evidence checksums. |

No changes under `wordpress/`, frozen authoring v1/v2, or the Core/Runtime/host/experience implementation directories. The step 3 frozen baseline is unchanged.

## Gates and evidence

- [Node 20.20.2 full verify](verify-node20.log): **1,003 tests pass**, zero failures/skips. Includes the 17 v3 probes and five new pane probes.
- [Node 22.23.2 full verify](verify-node22.log): **1,003 tests pass**, zero failures/skips, with the same mutation coverage.
- [v1 differential](v1-differential.log): **41 identical, zero different**, 28 skipped v2/non-JSON cases.
- Step 3's unchanged baseline still checks **77 frozen files and 66 source documents under both compilers**, including exact outputs/provenance and normalized engine-owned parse wording only.
- New byte manifest checks **20 files** covering authored/compiled bundled lessons, WordPress lesson copies, generated page 3227 artifacts and frozen canonical render evidence. Existing compile and evidence checks also pass in verify.
- [Chromium](browser-chromium.log): **68 passed**. [Firefox](browser-firefox.log) and [WebKit](browser-webkit.log): **67 passed, one skipped each**. The existing native clipboard permission proof is explicitly Chromium-only; clipboard binding behavior runs in all engines. No new skips were added.
- [Packaging mutation run](pack-mutations.log): **44 caught**. [Existing Player mutation run](player-mutations.log): **104 caught**.

Browser runs use the full existing four-file Player/pack/preview/Admin suite used by the three-engine CI family. WordPress-version, upgrade and installation jobs remain CI gates on the eventual PR head; local browser fixtures do not claim a new live-site acceptance or installation.

## Before/after markup and timing

Raw matching markup samples: [Chromium](markup-chromium.json), [Firefox](markup-firefox.json), [WebKit](markup-webkit.json). Each engine compares **249** complete pane-markup snapshots for `git-repository-practice` across 19 boundaries and **37** for `python-first-steps` across six boundaries. Initial, intermediate and settled samples are included verbatim with equal before/after strings; every callback's markup, callback count and virtual time are asserted, not just the samples. Full browser suites additionally retain deep-link, Copy, risk, theme, reduced-motion, focus, selection, follow and transport coverage.

## New mutation probes

[Results](pane-mutations.json); every full verify above runs all five:

| Probe | Intentional break | Protected result |
|---|---|---|
| stale-callback | Permit a cancelled callback to draw | Late DOM/completion work must remain inert. |
| capability-leak | Spread caller context into pane boundary | Core/host/runtime/command authority must be absent. |
| missed-dispose | Omit active-task cancellation on lifecycle dispose | Pending handle and abort listener must be removed. |
| retained-listener | Omit cancellation unsubscription | Cancellation must release the listener. |
| renderer-missed-dispose | Drop renderer-to-pane cleanup | Renderer disposal must cancel the underlying pane. |

The new probes require assertion failures and reject syntax/reference/type crashes as evidence. The existing guards were also rerun. An initial broad-mutation baseline exposed an editing-induced encoding mistake in test text; it was restored to the base bytes before the recorded final browser and mutation runs. No failing baseline is counted as a caught mutation.

## Reproducible candidates

Two clean-HEAD builds on pinned Node 22.23.2 match for each archive:

| Artifact | SHA-256 | Logs |
|---|---|---|
| Plugin, 99 staged files | `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a` | [A](plugin-build-a.log), [B](plugin-build-b.log) |
| Authoring candidate, 111 files | `ba426be7a37d811386a8478c5f5de068c0a6db75073435a2b099ffae645ce202` | [A](authoring-build-a.log), [B](authoring-build-b.log) |

The unchanged plugin build writes `code-in-motion-1.0.1.zip` internally, but review copies are stored as `step4-plugin-candidate-build-a.zip` and `step4-plugin-candidate-build-b.zip` outside the repository. They are **unpublished candidates**, not replacements for the released ZIP. The authoring build uses `--candidate`; its filename/root include `-candidate`. The extracted authoring archive passes its [local preview browser test](extracted-authoring-preview.log) without an installed dependency tree. No version bump, tag, release or install occurred.

## Rollback and integrity

[Rollback record](rollback-record.json): exact published **1.0.1 ZIP** SHA-256 `95cdd84b2d0cc8028ff94784a9087a865fc5381f72fb09c4faa9b8aaaa5b31d7`, and saved post-install **page 3227 capture** SHA-256 `34ceed1c2b7536f20dfa62fb841d629d5ff6aa12471f3984480c27601d93f2ab`. The originals and prior rollback kits remain unchanged. Copies are in the local `outputs/step4-rollback-kit.zip`; the raw capture and release ZIP are not committed to this public PR. No new live capture or site change is claimed.

`SHA256SUMS` covers all evidence files in this directory, excluding this packet, the contract specification, attributes and the checksum file itself. Evidence uses binary text attributes to preserve committed bytes across checkouts. Verify the committed blob hashes, not merely a working-tree encoding. CI must be assessed on the exact final PR head, and merge waits for independent review and Johann's approval.
