# Authoring JSON v3 — development authoring route

ADR 0061 step 7B adds local authoring and pack construction. Published CiM 1.0.1 does not admit this format. Existing authoring v1/v2 and pack v1 remain unchanged.

## Start, edit, preview and pack

From the downloadable candidate tool's root, use Node.js 22 or later:

```
node tools/cim-author.mjs init my-lesson --format v3
node tools/cim-author.mjs validate my-lesson/lesson.json
node tools/cim-author.mjs preview my-lesson/lesson.json
node tools/cim-author.mjs compile my-lesson/lesson.json --out compiled.json
node tools/cim-author.mjs pack my-lesson/lesson.json --out my-lesson.zip
```

The template is `examples/packs/run-custody-placeholder/`. `init` copies it, including capture records, raw evidence, simulated MP4/WebM clips and captions. Edit the copy's `lesson.json`, `capture.json` and `media.json`; keep references and resulting Diagram states consistent. Save and refresh the preview. Every error identifies its rule, JSON path and fix. Output files must not already exist.

This preview supports placeholder lessons with the starter's pane IDs. It uses the compiled lesson and actual verified clip bytes, without WordPress. Its explicit development identity is `1.1.0-dev`; that string alone grants no admission. Published 1.0.1 refuses the generated pack. Installing it on a website waits for Part C and a future release.

The old `authoring/v3/fixtures/valid/` sources remain validation/proof fixtures. Their deferred media route has not acquired public compile, preview or pack support.

## Document and beats

The normative closed schema is `authoring/v3/authoring.schema.json`, identified by `localis.cim/authoring/v3`. Declare identity, version, placeholder mode, a neighboring capture JSON basename, hosts, services, artifacts, reserved media IDs and four panes. Each pane has a unique ID, registered type and starting state: Console lines, Explanation text, Motion's initial null frame, or Diagram artifact locations/statuses.

Each beat declares its ID/title, mandatory Explanation entry and Engineering entry. Its optional `action_tab` names the sole active Console or Motion pane. `actions` contains zero or one CLI or GUI action; repeated actions and simultaneous CLI/GUI activity are rejected. Explanation links use HTTPS. Engineering names ordered capture records and the complete resulting artifact state.

Context-only beats omit `action_tab` and have an empty actions array. Their action states hold; the proof projection selects the most recent action tab, or Console initially. The preview preserves manual tab choices during Play and Next across consecutive context-only beats; direct jumps select the default tab.

## Bounds and provenance

Documents are limited to 2 MiB, depth 32 and 100,000 JSON nodes. Maximum counts: 128 beats, four panes, 32 hosts, 64 services, 128 artifacts, 32 reserved media IDs, 16 Explanation links per beat and 32 record references per beat. Schemas specify field-specific text limits (general text 16 KiB, titles 300 characters, IDs 100 characters).

All placeholder documents explicitly set `placeholder: true`; records/actions/evidence identify placeholder provenance. Simulated GUI labels say `Placeholder GUI · simulated`, never `Recorded in the lab`. The proof carries a visible-badge requirement. Validation checks declarations and consistency; it cannot establish that an author telling an internally consistent story actually recorded a real event.

## Envelope proof

Developers may run `node tools/prove-v3-envelope.mjs path/to/lesson.json --out proof.json` (output must not exist). This projects absolute held states into the frozen `localis.cim/v2` envelope using opaque `panes/v1` renderer configuration and state. The existing v2 validator is called unchanged. A structural pass is not permission for the Player or WordPress to load the result; their existing admission gates still reject it.

See [capture records](ENGINEERING-CAPTURE-v1.md) and [candidate pack manifest](LESSON-PACKS-v2.md). The rule-to-fixture review table is in `docs/design/cim-v2/step3/REVIEW.md` in the repository.

## Pack-local media

A production source declares `media: {"status":"pack","file":"media.json","asset_ids":[...]}`. Each media copy declares a pack-relative path, exact byte size, SHA-256, MIME type, codec and captions with their own path/size/fingerprint. Both MP4 and optional WebM copies are checked independently. The starter has both copies and separate VTT files for each GUI beat. Replacement bytes require updated fingerprints; mismatches are rejected before packing or preview playback.

Limits: 4 MiB per video, 64 KiB per caption, 16 MiB media total, and 32 MiB/256 files for the complete pack. Pack preflight reports each file, codec, media total, ZIP size and version interval. `--upload-limit BYTES` blocks an oversized ZIP before writing; without it the target limit is explicitly unknown. Attachment sources are rejected with a diagnostic pointing to 1.2. No arbitrary media URLs are accepted.
