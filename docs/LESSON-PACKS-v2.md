# Lesson-pack v2 manifest â€” tool validation only

Normative schema: `authoring/v3/pack.schema.json`, ID `cim.lesson-pack/v2`. This candidate adds a fixed inert companion template for tool-built packs. It does not change PHP discovery, installed packs or Player admission. Existing pack v1 remains unchanged.

Validate `authoring/v3/fixtures/valid/pack.json` with `node tools/cim-author.mjs validate`. Declare canonical release versions `cim_min` (at least 1.1.0), `cim_max_exclusive` (greater than the minimum and no later than 2.0.0), explicit placeholder mode, and up to 100 uniquely identified lessons. Each entry names lesson and capture JSON basenames.

The preserved step-3 validation fixture uses `media` explicitly `{ "status": "deferred", "assets": [] }`. Its deferred branch remains unchanged. The separate production branch uses `media.status: "pack"`, carries the complete validated media map and adds `files`. Virtual asset IDs in authored placeholder GUI actions do not authorize a media file or URL.

Production construction is documented in [Authoring JSON v3](AUTHORING-JSON-v3.md). Manifest validation also checks every referenced file against the file list, then filesystem validation checks its actual bounded bytes. Validate every authored lesson separately to check its capture archive and cross-references. The minimum version describes the planned host contract; the currently released 1.0.x host refuses these packs. No new release is made in this step.

## Production payload

`files` lists every payload except `cim-lesson-pack.json` itself, with relative path, byte size and SHA-256. The ZIP checksum covers the manifest too. Compiled lesson/capture paths and every video/caption must resolve to these entries with matching sizes and fingerprints. Duplicate and case-colliding paths, traversal, escaping symlinks, changed files, oversized files and aggregate overflow are rejected. Payload and ZIP are each limited to 32 MiB; the file list permits at most 256 entries.

The PHP template is fixed; only checked lesson ID and canonical version are substituted. Teacher prose never becomes PHP. Source JSON, generator scripts and authoring tools are not shipped as executable pack code. Stable hosts must satisfy the declared canonical release interval; no prerelease suffix is stripped. Preview/admission tests use a branded in-process 1.1.0-dev capability. Bare strings and forged capability objects are refused.

For 1.1, sources are pack-local only; attachments wait for 1.2. Preflight reports the target upload limit as unknown unless supplied, so passing per-file checks does not promise a WordPress install will fit.
