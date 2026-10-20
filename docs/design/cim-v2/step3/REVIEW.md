# ADR 0061 step 3 review packet

Status: draft for Daisy review and Johann approval. No merge, tag, release or installation is authorized by this packet. Base: `7e3d96f49d446a29a936deae437a64c5138dd3a6`. Implementation/build commit: `33acede`.

## Scope and feasibility

Separate v3 lesson, capture and pack schemas plus tool-only validation. Frozen v1/v2 validators and compiler modules, Player runtime and WordPress are unchanged. The eight-beat sample projects successfully into the frozen `localis.cim/v2` envelope using opaque `panes/v1` configuration/state; the unchanged existing validator accepts it. Tests also prove that engine compatibility and WordPress admission still reject it. The consecutive-context fixture has nine beats. The proof tool is developer-only, not public v3 compilation.

All three JSON schemas are checked independently with Ajv in tests. The standalone tool uses a bounded evaluator limited to the schema keywords present in these closed schemas, followed by semantic and filesystem validation. It does not fetch schemas or execute lesson code.

## Verification

Node 22.23.2: `npm run verify` passes, 995 tests (baseline 962), zero failed/skipped. All 17 new rule-bypass mutations are caught by assertions, not crashes. R42 v1 comparison: 41 identical, zero different, 28 skipped. The added frozen baseline also checks 77 file hashes and both compilers across 66 source documents, including serialized rejection messages (only engine-owned parse-error suffixes are normalized). Logs and projection are included here.

## Rule / fixture map

Paths below are relative to `authoring/v3/fixtures/`. Each listed case asserts its rule, JSON path, rejection and actionable fix; every distinct rule has an enforcement-removal mutation probe.

| Rule | Fixture | Diagnostic path |
|---|---|---|
| `CIM-V3-SHAPE` | `invalid/shape.json` | `$.extra` |
| `CIM-V3-PANE-TYPE` | `invalid/pane-type.json` | `$.panes` |
| `CIM-V3-ACTION-COUNT` | `invalid/repeated-cli.json` | `$.beats[0].actions` |
| `CIM-V3-SIMULTANEOUS` | `invalid/simultaneous.json` | `$.beats[0].actions` |
| `CIM-V3-ACTION-TAB` | `invalid/wrong-tab.json` | `$.beats[0].action_tab` |
| `CIM-V3-EXPLANATION` | `invalid/missing-explanation.json` | `$.beats[0].explanation` |
| `CIM-V3-INITIAL` | `invalid/missing-initial.json` | `$.panes[0].initial_state` |
| `CIM-V3-ID` | `invalid/duplicate-id.json` | `$.beats[0].explanation.links` |
| `CIM-V3-CAPTURE-REFERENCE` | `invalid/capture-reference.json` | `$.capture.id` |
| `CIM-V3-DIAGRAM-STATE` | `invalid/diagram-result.json` | `$.beats[0].engineering.state` |
| `CIM-V3-PLACEHOLDER` | `invalid/missing-placeholder.json` | `$.placeholder` |
| `CIM-V3-PLACEHOLDER` | `invalid/real-label.json` | `$.beats[2].actions[0].label` |
| `CIM-V3-ARCHIVE-PATH` | `invalid/archive-path.json` | `$.archive.files[0].path` |
| `CIM-V3-EVIDENCE` | `invalid/evidence-digest.json` | `$capture.archive.files[0].sha256` |
| `CIM-V3-PACK-VERSION` | `invalid/pack-version.json` | `$.cim_min` |
| `CIM-V3-MEDIA-DEFERRED` | `invalid/media-map.json` | `$.media` |
| `CIM-V3-LIMIT` | `invalid/limit.json` | `$.beats` |
| `CIM-V3-PARSE` | `invalid/parse.json` | `$` |

## Candidate authoring archive

Two clean-HEAD builds on Node 22.23.2 produced identical 110-file archives:

`756731cffe5217888fdfec941076bae2a4b50460fd52f3286ea5fadb382a71ac`

Build with `node tools/build-authoring-release.mjs --candidate`; filename and archive root are `cim-authoring-1.0.1-candidate` (ZIP extension on the filename). No version bump or release is made in this step. This is a changed validation candidate, not the published 1.0.1 asset. The build adds only authoring validation modules, schemas, reference docs and valid fixtures. Extracted validation succeeds without node_modules. Existing published ZIPs and rollback kits are untouched.

## Limits and deferred work

See AUTHORING-JSON-v3, ENGINEERING-CAPTURE-v1 and LESSON-PACKS-v2 under docs. Capture validation confines raw paths and checks file hashes; it cannot authenticate an internally consistent claim that a capture is real. Manifest validation does not construct a plugin or discover packs. Media maps remain explicitly deferred and empty. Public v3 init/compile/preview/pack, pane registration, transport, rendering and media placement await later steps. No browser UI has changed.

The full verify log includes the existing checks and 17 new schema mutation probes. No new browser acceptance claim is made; existing CI runs remain required on the exact PR head. The authored placeholder examples do not represent lab capture.

## Evidence integrity

SHA256SUMS covers every evidence file in this directory except this packet, attributes and the checksum file itself. Binary Git attributes preserve recorded bytes.

## Review corrections

Full verify now passes on both Node 20.20.2 and pinned Node 22.23.2: 995 tests and 17 mutation probes each. `verify-node20.log` and `verify.log` record these runs. Frozen compiler code is unchanged. Baseline normalization replaces only the V8-generated suffix of the `CIM-AUTH-PARSE` diagnostic with `<engine parse error>`; rule IDs, paths, other fields and all non-parse messages remain exact. Only the invalid-JSON fixture's two rejection hashes changed.

Added guards enumerate every schema keyword (walking property and definition maps as schema containers), compare the built-in structural checker with Ajv on every parseable invalid fixture, and require both to refuse malformed documents for all three schemas. Semantic-only invalid fixtures may pass both structural validators and remain covered by the full validator's rule tests. Unicode code-point string length and Unicode-mode regular expressions now match JSON Schema; emoji length-boundary and pattern tests compare with Ajv.

Candidate filename/root use an explicit `-candidate` suffix via the build flag, avoiding confusion with the published asset. Two clean builds at `33acede` match the checksum above. The public release and plugin remain untouched. CI on the final PR head must pass before approval.
