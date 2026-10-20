# Authoring JSON v3 — validation candidate

ADR 0061 step 3 only. This format is not admitted by the released Player or WordPress. Existing authoring v1/v2 and pack v1 remain unchanged. Do not install these fixtures as lessons.

Start with `authoring/v3/fixtures/valid/run-custody/lesson.json`, keeping its neighboring `capture.json` and `raw/` directory. Run `node tools/cim-author.mjs validate path/to/lesson.json`. Validation checks the lesson, linked capture, references, derived Diagram states and evidence files together. Errors identify the rule, JSON path and a suggested fix. Public init, compile, preview and pack support waits for later steps.

## Document and beats

The normative closed schema is `authoring/v3/authoring.schema.json`, identified by `localis.cim/authoring/v3`. Declare identity, version, placeholder mode, a neighboring capture JSON basename, hosts, services, artifacts, reserved media IDs and four panes. Each pane has a unique ID, registered type and starting state: Console lines, Explanation text, Motion's initial null frame, or Diagram artifact locations/statuses.

Each beat declares its ID/title, mandatory Explanation entry and Engineering entry. Its optional `action_tab` names the sole active Console or Motion pane. `actions` contains zero or one CLI or GUI action; repeated actions and simultaneous CLI/GUI activity are rejected. Explanation links use HTTPS. Engineering names ordered capture records and the complete resulting artifact state.

Context-only beats omit `action_tab` and have an empty actions array. Their action states hold; the proof projection selects the most recent action tab, or Console initially. Playback's manual-choice persistence remains an engine requirement for a later step; this validator implements no transport or UI.

## Bounds and provenance

Documents are limited to 2 MiB, depth 32 and 100,000 JSON nodes. Maximum counts: 128 beats, four panes, 32 hosts, 64 services, 128 artifacts, 32 reserved media IDs, 16 Explanation links per beat and 32 record references per beat. Schemas specify field-specific text limits (general text 16 KiB, titles 300 characters, IDs 100 characters).

All placeholder documents explicitly set `placeholder: true`; records/actions/evidence identify placeholder provenance. Simulated GUI labels say `Placeholder GUI · simulated`, never `Recorded in the lab`. The proof carries a visible-badge requirement. Validation checks declarations and consistency; it cannot establish that an author telling an internally consistent story actually recorded a real event.

## Envelope proof

Developers may run `node tools/prove-v3-envelope.mjs path/to/lesson.json --out proof.json` (output must not exist). This projects absolute held states into the frozen `localis.cim/v2` envelope using opaque `panes/v1` renderer configuration and state. The existing v2 validator is called unchanged. A structural pass is not permission for the Player or WordPress to load the result; their existing admission gates still reject it.

See [capture records](ENGINEERING-CAPTURE-v1.md) and [candidate pack manifest](LESSON-PACKS-v2.md). The rule-to-fixture review table is in `docs/design/cim-v2/step3/REVIEW.md` in the repository.
