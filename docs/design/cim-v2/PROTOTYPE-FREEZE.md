# CiM v2 frozen design reference

Date: 2026-10-18. Scope: design reference, not a production release or authentic lab capture.

The reference is private Localis page **3547**, `https://localis.services/cim-v2-prototype/`, and **AI-in-Motion Committee Brief v6**. Frozen means further edits require a new recorded revision and acceptance run; it does not lock the WordPress account or make the files read-only.

The prototype has eight placeholder beats, including beat 5 with Explanation/Diagram activity and neither CLI nor GUI activity. Its template evaluator is prototype-only and must not enter the production Player.

## Accepted behavior

- One tablist with named Console–CLI and Motion–GUI tabs, exactly one selected tab, stable tab/panel IDs and reciprocal accessible labeling.
- One tab stop; Left/Right and Home/End select and focus tabs. Tab reaches the displayed panel. Both pane initial states and most recent final states are preserved.
- Automatic selection happens at beat entry without stealing keyboard focus. Manual choice during playback persists through pause/resume and completion of that beat; entering the next action beat selects its tab.
- Context-only navigation reconstructs the most recent action tab and final state; no prior action uses the Console initial state. Explanation and Diagram remain visible.
- Beats opens without pausing, marks the current beat, and may cover Diagram motion. Escape and Close return focus without changing navigation or playback. Start waits, Restart plays; End remains available. Initial status is `Start · N beats`, then beat status says playing/paused.

## Acceptance evidence

`tab-acceptance.json` records nine passing combinations: Chromium, Firefox, WebKit × 1366×768, 1536×864, 1920×1080. Checks cover roles, selected state, controlled panel, roving focus, arrows/Home/End, no automatic focus theft, manual playback override, pause/resume, Next completion, context jump, current beat, Escape and Close. This is browser evidence, not a real screen-reader audit or a human usability sign-off.

The local freeze kit `outputs/cim-v2-design-freeze/` holds the self-contained HTML, WordPress block, v6 DOCX, runnable prototype checks, baseline compatibility logs and SHA-256 manifest. Private page/account metadata is excluded from this repository.

| Artifact | SHA-256 |
| --- | --- |
| Brief v6 DOCX | `ce6f5fc83ac905dbdc0bf68ff734f4b15eaae79e17e0ccc467385429bf4105ff` |
| WordPress block snapshot | `d93de2873d907c9f0533ace4777c00c37300ba0077152f1e585875d4352b361c` |
| Standalone prototype | `8322c6f24e2ca411b85e25865f768c2d51404635e2de47767de762c019ee799a` |
| Tab acceptance results | `caa1a9419f14998b9265cd98b4f1a9778d95910b27511a4464688c2eb6809b61` |

The WordPress block checksum identifies the UTF-8 local snapshot; live saved content is compared after CRLF/LF normalization and trimming boundary whitespace. It is not a hash of the entire theme-rendered page.

## Approved v7 amendment

Johann approved retaining manual tab choice across consecutive context-only beats during normal playback, while direct jumps reconstruct the deterministic last-action default. Brief v7 records this distinction; the original v6 DOCX and its freeze artifacts above remain unchanged. Page 3547 now carries the recorded v7 amendment. New hashes are in the local freeze manifest's `v7_amendment` entry, and the public standalone prototype/evidence are linked below. This is a new recorded revision, not a silent change to the v6 freeze.

The prototype's continuation behavior now follows that rule. The media pane says **Placeholder GUI · simulated**, in addition to the persistent frame badge, so no placeholder clip is labeled as a genuine lab recording. Normal playback and Next preserve the override across the context-only run; direct navigation resets to the last-action default.

For the continuation test, one additional context-only beat is injected into the browser's test fixture only. The displayed sample remains eight beats. Chromium, Firefox and WebKit at all three review sizes pass the nine continuation combinations, including pause/resume, the next action's automatic selection and keyboard/menu regression checks. This is not a claim to have tested real media or assistive technology.

Review evidence is available in this branch, without access to Pilgrim's workspace:

- [Standalone v7 prototype](evidence/prototype-v7.html)
- [V7 acceptance results](evidence/v7-acceptance.json)
- [V7 browser check](evidence/check-v7-prototype.cjs)
- [Node 22.23.2 verification log](evidence/verify-node22.log)
- [Pinned-runtime v1 comparison](evidence/v1-differential-node22.log)
- [Node/npm versions](evidence/node22-runtime.txt)
- [Evidence checksums](evidence/manifest.json)

To replay the prototype check, use Node with Playwright installed and its Chromium/Firefox/WebKit browsers available, then run `node docs/design/cim-v2/evidence/check-v7-prototype.cjs` from the repository root. It writes `v7-acceptance-rerun.json` in the working directory; it does not edit the frozen evidence. No WordPress credentials are needed.
