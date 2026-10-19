# ADR 0061 step 3 review packet

Status: draft for Daisy review and Johann approval. No merge, tag, release or installation is authorized by this packet. Base: `7e3d96f49d446a29a936deae437a64c5138dd3a6`. Implementation/build commit: `2a2e479`.

## Scope and feasibility

Separate v3 lesson, capture and pack schemas plus tool-only validation. Frozen v1/v2 validators and compiler modules, Player runtime and WordPress are unchanged. The eight-beat sample projects successfully into the frozen `localis.cim/v2` envelope using opaque `panes/v1` configuration/state; the unchanged existing validator accepts it. Tests also prove that engine compatibility and WordPress admission still reject it. The consecutive-context fixture has nine beats. The proof tool is developer-only, not public v3 compilation.

All three JSON schemas are checked independently with Ajv in tests. The standalone tool uses a bounded evaluator limited to the schema keywords present in these closed schemas, followed by semantic and filesystem validation. It does not fetch schemas or execute lesson code.

## Verification

Node 22.23.2: `npm run verify` passes, 991 tests (baseline 962), zero failed/skipped. All 17 new rule-bypass mutations are caught by assertions, not crashes. R42 v1 comparison: 41 identical, zero different, 28 skipped. The added frozen baseline also checks 77 file hashes and both compilers across 66 source documents, including serialized rejection messages. Logs and projection are included here.

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

`91bf2892140f269fbb9cb6fea5ce7bbb184f577c589bdd09ba8819e28ffcf702`

Filename remains `cim-authoring-1.0.1.zip` because there is no version bump or release in this step. This is a changed validation candidate, not the published 1.0.1 asset. The build adds only authoring validation modules, schemas, reference docs and valid fixtures. Extracted validation succeeds without node_modules. Existing published ZIPs and rollback kits are untouched.

## Limits and deferred work

See AUTHORING-JSON-v3, ENGINEERING-CAPTURE-v1 and LESSON-PACKS-v2 under docs. Capture validation confines raw paths and checks file hashes; it cannot authenticate an internally consistent claim that a capture is real. Manifest validation does not construct a plugin or discover packs. Media maps remain explicitly deferred and empty. Public v3 init/compile/preview/pack, pane registration, transport, rendering and media placement await later steps. No browser UI has changed.

The full verify log includes the existing checks and 17 new schema mutation probes. No new browser acceptance claim is made; existing CI runs remain required on the exact PR head. The authored placeholder examples do not represent lab capture.

## Evidence integrity

SHA256SUMS covers every evidence file in this directory except this packet, attributes and the checksum file itself. Binary Git attributes preserve recorded bytes.
