# ADR 0038: WordPress Experience Deployment Registry

Status: Accepted for R30

## Context

R29 established the human-authored `.cim` compilation path and proved that human-authored source can compile deterministically into the existing validated `localis.cim/v1` Runtime contract.

WordPress already has a production Experience loader, but the outer browser composition still owns a hardcoded table in `wordpress/assets/bootstrap-module.mjs`:

```text
experience ID -> repository/release JSON path
```

The release builder separately owns another hardcoded Experience staging list.

Those two lists describe the same deployment fact in different places. Adding an Experience therefore requires coordinated edits to browser composition and release packaging. The arrangement does not provide the data-only Experience registry required by Issue #6 for future WordPress administration, discovery, and health reporting.

R30 establishes one deployment registry without changing Runtime Experience semantics or giving WordPress authority over `.cim` parsing.

## Decision

R30 adds a canonical WordPress Experience deployment registry:

```text
wordpress/experiences/registry.json
```

The registry is deployment data. It is not a Runtime contract and is never passed to `ingestExperience()`.

The R30 pipeline is:

```text
canonical/generated Runtime JSON
        |
        v
WordPress Experience registry validation
        |
        +----------------------------+
        |                            |
        v                            v
browser registry projection     release staging
        |                            |
        v                            v
experienceUrlFor(id)            versioned plugin artifact
        |
        v
existing WordPress Experience loader
        |
        v
ingestExperience()
        |
        v
validated frozen Runtime Experience
```

## Registry schema

The R30 registry uses this exact top-level shape:

```json
{
  "schema": "localis.cim/wordpress-experience-registry/v1",
  "experiences": [
    {
      "id": "synthetic-wordpress",
      "asset": "synthetic-wordpress.json"
    }
  ]
}
```

The exact top-level key set is:

- `schema`
- `experiences`

The exact Experience-record key set is:

- `id`
- `asset`

No Runtime state, renderer configuration, commentary, or authoring metadata is duplicated into the registry.

## Identity rules

Each registry `id`:

- is a non-empty canonical CiM identifier;
- is unique within the registry;
- must equal the `id` of the referenced validated `localis.cim/v1` Experience.

Registry order is deterministic and canonical: records are sorted by `id` using bytewise lexical ordering.

A duplicate registry ID is invalid even if both records reference the same asset.

## Asset rules

Each `asset` is a file name beneath:

```text
wordpress/experiences/
```

R30 does not permit arbitrary paths.

Accepted asset names:

- are relative file names;
- use lowercase ASCII letters, digits, and hyphens;
- end in `.json`;
- contain no slash or backslash;
- contain no `.` or `..` path segment;
- contain no URL scheme, query, or fragment.

The deployment registry therefore cannot escape the WordPress Experience directory or redirect Experience loading to a remote origin.

An `asset` value is a name only. It carries no path-resolution semantics. Each consumer owns the path rule that resolves that name within its deployment context. R30 does not add a `path`, base URL, subdirectory, or equivalent registry field.

## Canonical deployment copies

Every registered Runtime Experience has one deployable JSON file in:

```text
wordpress/experiences/
```

An Experience whose canonical subject source lives elsewhere in the repository may project into this directory through a deterministic generator.

The projection is data-only. It does not alter the canonical subject source and does not create a second semantic authoring path.

For the R27 Git Experience, the canonical generated Runtime object remains governed by the R27 source/generator contract. Its WordPress deployment copy must be byte-current with that canonical generated object.

## Browser projection

Browser composition must stop owning a handwritten Experience-path table.

R30 generates the browser-consumable projection `wordpress/assets/experience-registry.generated.mjs` from `wordpress/experiences/registry.json`. The generated module contains inert ID/asset data only, is staged as part of the reproducible release module graph, and is freshness-gated against the canonical registry. It contains no callbacks, renderer factories, remote URLs, path policy, Runtime objects, or other executable authority.

`bootstrap-module.mjs` may construct the existing `experienceUrlFor(experienceId)` capability from the validated registry projection.

The existing `createWordPressExperienceLoader()` contract remains unchanged.

The loader remains responsible for:

- fetching the resolved JSON asset;
- routing it through `ingestExperience()`;
- requiring the fetched Experience identity to equal the requested registry identity;
- sharing the post-ingestion immutable Experience for repeated/concurrent requests;
- evicting failed pending loads from its cache.

## Release staging

The WordPress release builder must derive staged Experience assets from the same canonical registry.

The release builder must not maintain an independent hardcoded list of registered Experience JSON files.

Every registry entry must produce exactly one staged Experience asset.

Every staged registered Experience asset must correspond to exactly one registry entry.

The JSON deployment set beneath `wordpress/experiences/` must equal the registry exactly, excluding only the registry file itself. Non-deployment fixtures belong outside that directory, for example beneath `wordpress/fixtures/`; R30 defines no exclusion mechanism for deployment-directory JSON.

## Validation boundary

R30 adds one deterministic registry validation/check surface.

At minimum it verifies:

- exact registry schema and key sets;
- canonical registry ordering;
- canonical ID syntax;
- unique IDs;
- canonical asset-name syntax;
- referenced asset existence;
- JSON parse success;
- successful production `ingestExperience()`;
- registry-ID / Runtime-ID equality;
- no unregistered deployed Experience;
- browser projection freshness;
- WordPress deployment-copy freshness where a canonical source lives elsewhere;
- release staging derives from the registry rather than a separate Experience list;
- the retired handwritten browser-path and release-staging list identifiers are absent from the repository tree.

Registry validation may inspect Runtime Experience data only by using the existing production ingestion boundary. It does not add another Runtime validator.

## Renderer ownership

The Experience registry does not become a renderer registry.

A Runtime Experience continues to declare its renderer through the existing `renderer` field.

The WordPress renderer resolver continues to own renderer-factory lookup.

R30 verification must prove that every shipped registered Experience resolves through the currently shipped renderer registry, but the two registries remain separate contracts.

## WordPress shortcode behavior

R30 does not require the shortcode edge to reject syntactically valid but currently unregistered Experience IDs.

The shortcode remains a stable invocation surface:

```html
<div class="cim" data-cim-experience="..."></div>
```

Deployment availability is resolved by the Experience registry/browser loader path.

This preserves content portability across plugin versions while retaining existing static fallback behavior for unavailable Experiences.

## Release designation

R30 intentionally changes the WordPress release tree.

The frozen 0.1.1 artifact remains the historical pre-R30 baseline:

- 60 files;
- 433,183 staged bytes;
- ZIP SHA-256 `55caaa141214dd5fb36960a210d42d28278739777e0d7468abeb3f1cf967a533`;
- R23 manifest SHA-256 `f7e91414c169c90fe55c32e43215db224b18454e6fbb410a89b30525975303b7`.

R30 therefore designates the next WordPress plugin release as:

```text
0.1.2
```

The R30 candidate must establish a new deterministic file count, staged-byte count, release-tree module/import counts, ZIP SHA-256, and release-manifest identity. Those values become immutable only after the R30 implementation head is accepted.

R30 must not silently modify the 0.1.1 artifact or reuse the 0.1.1 version for changed release bytes.

## Security and authority boundary

The registry is inert deployment data.

R30 adds no:

- executable registry fields;
- URL interpolation;
- environment substitution;
- network-origin selection;
- directory traversal;
- file-system discovery at browser runtime;
- `.cim` parsing in WordPress;
- PHP execution from Experience content;
- renderer factory construction from registry data.

All registered Experience JSON still crosses the existing production `ingestExperience()` validation boundary before Runtime use.

## Explicit non-goals

R30 does not include:

- WordPress Admin Console UI;
- WordPress upload of `.cim` source;
- server-side `.cim` compilation;
- browser-side `.cim` compilation;
- automatic directory scanning or registry mutation;
- remote Experience registries;
- network-loaded third-party Experiences;
- renderer installation or renderer registry redesign;
- plugin update-channel implementation;
- Experience editing;
- macros, includes, variables, or templating;
- Runtime schema changes;
- Runtime loading of the registry;
- replacement of R27 or R29 source-authoring contracts.

Those remain separate checkpoints.

## Consequences

- WordPress gains one authoritative data-only list of deployable Experiences.
- Browser Experience-path resolution and release staging derive from the same source.
- Adding a deployable Experience no longer requires editing two handwritten deployment lists.
- Future Admin Console work gains a machine-readable registry without requiring Runtime access.
- Existing Runtime and Host Experience-ingestion contracts remain unchanged.
- R30 becomes the first intentional WordPress artifact change after the frozen 0.1.1 baseline.

## Verification

R30 verification must prove:

- registry schema/key-set rejection is fail-closed;
- registry IDs and asset names follow the exact contract;
- duplicate IDs fail;
- traversal, URL, query, fragment, slash, backslash, and malformed asset names fail;
- every registered Experience exists and passes production `ingestExperience()`;
- registry identity equals Runtime Experience identity;
- browser Experience-path resolution derives from the registry rather than a handwritten map;
- the release builder derives Experience staging from the same registry;
- the Git deployment projection is freshness-gated against its canonical generated Runtime JSON;
- every shipped Experience renderer resolves through the shipped renderer registry;
- existing multi-instance, deep-link, lifecycle, Transport, fallback, floor, browser-E2E, and Playground behavior remains green;
- Node 20 and Node 22 verification remain green;
- plugin/release metadata consistently reports 0.1.2;
- the 0.1.2 ZIP is reproducible and installable from the release artifact;
- the final R30 artifact identity is recorded before protected-main integration.
