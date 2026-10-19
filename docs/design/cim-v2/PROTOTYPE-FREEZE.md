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
