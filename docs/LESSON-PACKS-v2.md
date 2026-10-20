# Lesson-pack v2 manifest — tool validation only

Normative schema: `authoring/v3/pack.schema.json`, ID `cim.lesson-pack/v2`. This candidate does not change PHP discovery, generated plugin templates, installed packs or Player admission. Existing pack v1 remains unchanged.

Validate `authoring/v3/fixtures/valid/pack.json` with `node tools/cim-author.mjs validate`. Declare canonical release versions `cim_min` (at least 1.1.0), `cim_max_exclusive` (greater than the minimum and no later than 2.0.0), explicit placeholder mode, and up to 100 uniquely identified lessons. Each entry names lesson and capture JSON basenames.

`media` is explicitly `{ "status": "deferred", "assets": [] }`. Populated asset maps are refused until media placement is decided before ADR step 6. Virtual asset IDs in authored placeholder GUI actions do not authorize a media file or URL.

Manifest validation is structural/semantic validation of this document, not pack construction or filesystem discovery. Validate every authored lesson separately to check its capture archive and cross-references. The minimum version describes the planned host contract; the currently released 1.0.x host refuses these packs. No new release is made in this step.
