# R42 Runtime Schema v2 QA

Base: `r42/runtime-validator-v2` at `317b5a6e122dfa7e106ebbd3739728d6feefffcb`.
Environment: Node v22.22.2 (repository `.nvmrc` pins 22.23.2), `npm ci`.

## Scope

R42 steps 1–8: close the runtime-schema and validator portion of R42. No beat-aware Player, Transport, Commentary, or renderer work is included.

1. **Unsupported-schema compatibility.** Every test and fixture that used `localis.cim/v2` as a deliberately unsupported identifier now uses `localis.cim/v99`. That covers `schemas/fixtures/invalid/unsupported-schema.json`, three unit-test files, and the Browser E2E fault-matrix spec.
2. **v1 differential retained** as `tools/r42-v1-differential.mjs` (`npm run qa:r42-v1-differential`).
3. **`docs/EXPERIENCE-SCHEMA-v2.md` amended:** §4, §9 (`anchor`, `evidence`, and `risk`, plus the evidence authority boundary), §14, and §16. `docs/AUTHORING-TO-RUNTIME-v1.md` §9 gains the explicit field mapping and the compiler's evidence-correspondence obligation.
4. **`schemas/localis.cim.v2.schema.json`:** closed v2 commentary with `anchor`, `evidence`, and `risk`; `dependentSchemas` requires an anchor for evidence and excludes `command`; `$defs.risk` is closed.
5. **Production validator:** `CIM-EXP-013` (anchor and evidence) and `CIM-EXP-014` (risk). The v1 commentary object stays closed.
6. **Fixtures:**
   - new positive `compiled-console-v2.json`, shaped like compiler output;
   - 11 isolated v2 negatives, one rule each;
   - 1 new v1 negative (`v1-commentary-evidence.json` → `CIM-EXP-002`).
7. **Tests:** v2 ingestion preservation, deep-freeze, and non-interpretation (`tests/experience-v2-ingestion.test.mjs`); evidence authority boundary (`tests/experience-v2-evidence-authority.test.mjs`); WordPress v2 registration gate (`tests/wordpress-experience-registry.test.mjs`, plus `REGISTRABLE_RUNTIME_SCHEMAS` in `tools/check-wordpress-experience-registry.mjs`).
8. **Gates:** `check:schema` and `verify`, below.

## Results

| Gate | Result |
|---|---|
| `npm run check:schema` | PASS: 4 valid, 16 v1 invalid, 22 v2 invalid fixtures |
| `npm run verify` | PASS: all 14 repository gates; **749/749** tests (739 before, plus 10 new) |
| `npm run qa:r42-v1-differential` | PASS: 37 identical, 0 different (25 repository v1 documents + 12 mutation probes), 24 skipped as v2 or non-JSON |

### Published schema and production validator agreement (new rules)

| Fixture | Published schema | Production |
|---|---|---|
| commentary-anchor-unknown | CIM-EXP-013 | CIM-EXP-013 |
| commentary-evidence-without-anchor | CIM-EXP-013 | CIM-EXP-013 |
| commentary-evidence-on-command | CIM-EXP-013 | CIM-EXP-013 |
| commentary-evidence-malformed-id | CIM-EXP-013 | CIM-EXP-013 |
| commentary-evidence-duplicate | CIM-EXP-013 | CIM-EXP-013 |
| commentary-evidence-empty | CIM-EXP-013 | CIM-EXP-013 |
| commentary-risk-unknown-level | CIM-EXP-014 | CIM-EXP-014 |
| commentary-risk-label-present | CIM-EXP-014 | CIM-EXP-014 |
| commentary-risk-empty-guidance | CIM-EXP-014 | CIM-EXP-014 |
| commentary-anchor-regression | accepted (cross-step) | CIM-EXP-013 |
| commentary-risk-not-final | accepted (cross-step) | CIM-EXP-014 |

The two cross-step rules are production-semantic only, consistent with the existing v2 beat-continuity rules (§14).

### Authority-boundary evidence

`tests/experience-v2-evidence-authority.test.mjs` replaces every `state` and `initial_state` with a Proxy that throws on any trap, and validation completes with zero errors. Evidence identifiers absent from, matching, or contradicting state all produce identical diagnostics.

**Mutation check:** adding one `'focus' in step.state` read to the validator makes the test fail with `validator inspected opaque steps[0].state via has`. Reverting it restores green.

## Not covered by this slice

- **Browser E2E** (Playwright) was not executed here. Its only change is the `localis.cim/v99` substitution.
- **The 18-boundary Git specimen** (§16) awaits the compiler and is the next R42 step.
- **Release identity.** This slice changes shipped module bytes (`src/experience/validate-experience.mjs`). Per the RC#1 identity finding, no release artifact may be built from it under version `0.1.10`.
