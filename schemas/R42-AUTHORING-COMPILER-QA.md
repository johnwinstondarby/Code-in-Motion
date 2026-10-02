# R42 Authoring Compiler QA (revision 2: peer-review decisions applied)

**Baseline.** Protected `main` at `faf382522b6b0e22674ad54cb3a44c5c04d20b76`. Environment: Node v22.22.2 (the repository pins 22.23.2), `npm ci`.

**Scope.** The first compiler slice: an authoring validator, a deterministic compiler, the compiled 18-boundary Git specimen, conformance tests, diagnostics and fixtures, and gate evidence. This slice includes no Console renderer, Player, Transport, or Commentary work.

## Gate results

| Gate | Result |
|---|---|
| 1. Compile and validate | PASS. The eight-beat specimen compiles to **18 boundaries**: 2 + 4 + 2 + 2 + 2 + 2 + 2 + 2. It passes the production runtime validator with zero errors and is accepted by `ingestExperience`. |
| 2. Determinism | PASS. See the evidence below. |
| 3. Evidence correspondence | PASS at all 18 boundaries: 9 boundaries without evidence have empty focus, 11 focus references each name a visible output line, and ordered equality holds everywhere. |
| `npm run check:authoring-v1` | PASS: 63 validator fixtures, 1 compiled experience byte-current, 18 boundaries conforming to CONSOLE-RENDERER-v1 with evidence correspondence. |
| `npm run check:schema` | PASS, unchanged: 4 valid, 16 v1 invalid, 22 v2 invalid. |
| `npm run qa:r42-v1-differential` | PASS: 0 different. |
| `npm run verify` | PASS: **15 gates** (the 14 existing gates plus `check:authoring-v1`) and **780/780** tests (749 plus 31 new). |

### Gate 2 evidence: byte identity

Compiled runtime SHA-256: `a77e2527c4b1feb0fbfae671d98dbd008c4f2e623bd5edddddf5aad9ff1fd005`. Every case below produced exactly these bytes.

| Case | Source CR bytes | Result |
|---|---|---|
| Committed `experiences/git/git-repository-practice.json` | — | `a77e2527…` |
| Real `git clone` with `core.autocrlf=true` | 0 (`.gitattributes` pins `*.json` to LF) | `a77e2527…` |
| Real `git clone` with `core.autocrlf=input` | 0 | `a77e2527…` |
| Hostile CRLF file on disk, bypassing `.gitattributes` | 464 | `a77e2527…` |
| Unit tests: repeated compilation, CRLF bytes, minified source, key order reversed recursively, 4-space and tab indentation | — | identical |
| Separate processes with different `cwd`, `TZ` (UTC vs Pacific/Kiritimati), and locale (C vs tr_TR.UTF-8) | LF and CRLF | identical |

Line endings therefore have two independent layers of defense: repository attributes normalize checkouts, and the compiler is invariant to CRLF in the source. Provenance records an environment-invariant digest of the parsed authoring value rather than raw source bytes, so the provenance file is also byte-identical across environments.

### Gate 3 mutation probes

The shared checker is proven bidirectional and order-sensitive. Each of the following is caught:

- evidence missing from focus;
- focus not attributable to evidence;
- reordered focus;
- stray focus on a boundary without evidence;
- agreeing focus and evidence that name a line not visible at that boundary.

## Diagnostics

**Authoring (`CIM-AUTH-*`).** 34 inventory entries, every one exercised by the fixture suite. New for the compiler:

- `CIM-AUTH-RESERVED-ID`
- `CIM-AUTH-VERSION`
- `CIM-AUTH-PLAYBACK-RATE`
- `CIM-AUTH-FINAL-ANCHOR`

**Compiler (`CIM-COMP-*`).** 7 inventory entries, every one exercised by `tests/authoring-v1-failures.test.mjs`:

- `UNSUPPORTED-SCHEMA`
- `TARGET-UNSUPPORTED`
- `AUTHORING-INVALID`, which carries the `CIM-AUTH-*` causes
- `RENDERER-MAPPING`
- `SEGMENT-LIMIT`
- `ID-COLLISION`
- `RUNTIME-INVALID`

Failure never returns a partial document.

**Fixture isolation.** Two inherited fixtures coupled a second failure with the new final-anchor rule: `segment-order` and `response-without-prompt`. Both were corrected so that each still violates exactly one rule. The rule itself was not weakened.

## Peer-review decisions applied (revision 2)

| Decision | Applied |
|---|---|
| **C1** accepted | `explanationTitle`, `showCopy`, and `showRisk` are removed from Authoring v1. Authoring them is now `CIM-AUTH-UNKNOWN-FIELD` (fixture `removed-presentation-field`). The compiler code and `CIM-COMP-UNREPRESENTABLE`, which existed only to accommodate them, are removed, leaving 7 `CIM-COMP-*` codes. The specimen drops the three keys, and **the compiled runtime output is unchanged (`a77e2527…`)**, which confirms they never reached runtime. Only the provenance source digest changes. |
| **C2** accepted | `engine_min: "0.2.0"` is retained. A2R §7 now defines it as the minimum compatible engine capability level, independent of package and release identity, enforced at the experience-loading boundary before Runtime receives the document. Implementation may accompany the beat-aware consumer work, provided it lands before the v2 registration gate opens. EXPERIENCE-SCHEMA-v2 §14 loadability condition 2 points to it, and the v2 example now shows `0.2.0`. |
| **C3** accepted | `console/v1` is recorded as canonical in A2R §12, the compiler, and the README. |
| **C4** accepted | `docs/renderers/CONSOLE-RENDERER-v1.md` is the normative renderer-owned contract: configuration, state, entry fields, five invariants, presentation obligations, renderer-owned validation, and versioning. It is enforced on the producer side by the new `authoring/v1/console-state-conformance.mjs`, run in `check:authoring-v1` and proven by 18 mutation probes. Core and the shared runtime validator remain unaware of Console state. |
| **R42-C7** | `docs/AUTHORING-JSON-v1.md` brings the Authoring v1 specification into the repository and into agreement with the validator and compiler. It covers the SemVer `version`, reserved `initial`, the rate range, the final-anchor rule, tabs and line breaks across all Console text, duplicate keys, the removed fields, final-segment focus persistence (§14), beat-oriented navigation with Home, End, and Restart and beat deep links (§16.1), and the explicit-resume scroll policy with holds (§16.2). Twelve spec-statement probes against the validator all agree. |
| **C5** | Preserved as a documented post-v1 consideration in CONSOLE-RENDERER-v1 §7, A2R §8, and AUTHORING-JSON-v1 §23. No structural sharing was introduced. |

`docs/README.md` now indexes all four R42 specifications.

## R42 disposition

Recorded at peer review of patch SHA-256 `3208320ae7b6d803fb2428a6c96034d4c9f9b571f8922411fa5f6c1ad0debc0c`:

| Item | Disposition |
|---|---|
| Authoring JSON v1.0 | **Frozen.** All §24 freeze conditions were met. |
| Compiler contract | Accepted for integration. |
| Console Renderer v1 contract | Accepted as the normative pre-implementation contract. |
| Production v2 registration gate | Remains closed. |
| `0.1.10` | Remains excluded from post-R42 packaging. |

## Not covered

- **Browser E2E:** no browser-facing change in this slice.
- **Replay and harness:** these wait for the Console renderer, by agreement.
- **Release identity:** `0.1.10` must not be packaged from this or any post-R42 head.
