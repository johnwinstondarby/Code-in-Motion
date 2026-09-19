# R27 Git Production-Content QA and Closure Evidence

## Scope

R27 is the first Code in Motion production-content proof beyond the synthetic diagnostic Experience.

The checkpoint asks one question:

> Can one real technical subject be authored once, projected correctly into both a durable reference page and an interactive CiM experience, and remain maintainable without content divergence?

The production subject is Git repository practice.

The two public projections are:

- Localis WordPress page 3227, `/git-repository-practice/`;
- CiM Experience `git-basic-cycle` rendered by `git/v1`.

R27 also closes the WordPress Host deep-link path required for page-to-experience navigation.

## Shared-source contract

Canonical Git facts are owned by:

`authoring/git/git-subject-facts.json`

Experience sequencing, commentary, focus, and absolute states are owned by:

`authoring/git/git-basic-cycle.plan.json`

The generator emits:

- `authoring/generated/page-3227-git-reference.json`;
- `experiences/git/git-basic-cycle.json`.

The page projection carries, for each of the eight anchors:

- stable fact identity;
- command;
- verb;
- description;
- state effect;
- canonical reference links;
- `cim_step_id`.

The page adapter generator additionally emits the stable fragment:

`#cim/git-basic-cycle/{step-id}`

The page and Experience therefore share factual identity while retaining separate presentation ownership.

## Eight-anchor roster

R27 fixes the production roster as:

1. `git status` → `step-01`
2. `git diff` → `step-02`
3. `git add` → `step-03`
4. `git commit` → `step-04`
5. `git rev-parse HEAD` → `step-05`
6. `git tag v1.2` → `step-06`
7. `git push` → `step-07`
8. `git reflog` → `step-08`

R27 demonstrates plain `git add` in CiM. `git add -p` and `git add -N <path>` remain shared reference guidance until a later Experience adds the additional semantic states required to demonstrate them correctly.

## Production B-to-B observation proof

R27 distinguishes observation boundaries from mutation boundaries.

Observation commands are:

- `git status`;
- `git diff`;
- `git rev-parse HEAD`;
- `git reflog`.

The production regression proves that each observation boundary may preserve byte-equivalent subject state while still advancing:

- Runtime semantic boundary identity;
- renderer invocation;
- renderer focus;
- Commentary;
- Transport marker state.

The browser proof specifically advances from `step-01` to `step-02` and requires the four Git lane texts to remain identical while focus changes from `overview` to `working-tree`.

## Git renderer grammar

Renderer ID:

`git/v1`

The repository model has exactly four places:

1. Working Tree
2. Index
3. Local
4. Remote

Reflog is not modeled as a fifth repository place.

It is rendered separately as:

- `data-git-evidence="reflog"`;
- `data-git-grammar="evidence-timeline"`.

The browser proof requires the evidence timeline to remain outside the `data-role="git-lanes"` container.

## WordPress Host deep-link contract

The architecture grammar remains:

`#cim/{experience-id}/{step-id}`

R27 implements that grammar in the WordPress Host layer without moving URL knowledge into Runtime.

For initial page entry:

- the WordPress bootstrap reads the fragment;
- the injected resolver matches the Experience identity;
- the resolver validates the semantic boundary;
- Host passes only `{ stepId, source: 'deep_link' }` into Runtime targeted initialization.

For a mounted instance:

- `hashchange` is parsed by the same grammar;
- a matching instance receives one `seek(stepId, 'deep_link')`;
- foreign fragments are ignored.

Invalid or unresolvable CiM targets are Host diagnostic `CIM-HST-002` and recover to `initial` rather than forcing static fallback.

## Browser E2E evidence

### Repository-mapped WordPress

Browser E2E #172, job `synthetic-mount`:

- 11 tests;
- 11 passed;
- R27 Git production-path mount test executed;
- R27 Git direct-entry/hashchange test executed.

The production-path Git test proves:

- one `git-basic-cycle` invocation root reaches `ready`;
- renderer `git/v1` opens at `initial`;
- exactly four repository lanes render in the expected order;
- reflog renders as an evidence timeline outside those lanes;
- `step-01` and `step-02` preserve identical lane state while semantic focus advances;
- `step-03` stages Index content;
- expected Experience and renderer module requests occur;
- request failures: 0;
- console/page errors: 0.

### Exact installed ZIP

Browser E2E #172, job `zip-install-e2e`:

- WordPress 6.5.10;
- plugin 0.1.1;
- 60 installed files;
- 12 tests;
- 12 passed.

The same two R27 Git tests pass against a normal extracted installation of the exact release ZIP.

### Deep-link behavior

The R27 deep-link browser test proves:

1. direct load at `#cim/git-basic-cycle/step-05`;
2. mounted instance reaches `step-05`;
3. Git focus is `head`;
4. live fragment change to `#cim/git-basic-cycle/step-08`;
5. the existing mounted instance reaches `step-08`;
6. Git focus is `reflog`;
7. changing to unrelated `#reference` leaves CiM at `step-08`;
8. console/page errors: 0.

## Upgrade evidence

Browser E2E #172, job `upgrade-e2e`:

- synthetic N fixture: 0.0.9 / 61 files;
- N+1 artifact: 0.1.1 / 60 files;
- N installed active before replacement;
- versioned `modules/0.1.1` path absent before upgrade;
- warm-cache upgrade proof passed;
- N→N+1 replacement preserved activation;
- final version: 0.1.1;
- final installed-file count: 60.

## Compatibility evidence

Browser E2E #172 completed successfully across:

- WordPress 6.5.10;
- WordPress 6.6.7;
- WordPress 6.7.7;
- WordPress 6.8.8;
- WordPress 6.9.7;
- WordPress 7.0.4;
- WordPress 7.1.1;
- PHP 7.4;
- PHP 8.5;
- Chromium;
- Firefox;
- WebKit.

The browser-family jobs run against WordPress 7.1.1 / PHP 8.5 and CiM 0.1.1.

## Floor QA evidence

Floor QA #182 separates two compatibility questions.

### Supported floor

The `wordpress-floor` job proves:

- WordPress 6.5.10;
- PHP 7.4.33;
- CiM 0.1.1;
- `synthetic-wordpress` shortcode renders the canonical CiM shell;
- `git-basic-cycle` shortcode renders the canonical CiM shell;
- malformed shortcode behavior remains contained;
- authoritative WordPress fixtures remain unchanged where expected.

The Git shortcode emits:

`<div class="cim" data-cim-experience="git-basic-cycle"><div data-cim-renderer-root></div>…</div>`

### Current-WordPress Plugin Check

The `plugin-check` job proves:

- WordPress 7.1.1;
- PHP 8.5.10;
- CiM 0.1.1;
- Plugin Check 2.1.0;
- Plugin Check exit status 0;
- 0 FAIL;
- 0 REVIEW;
- 2 ACCEPTED EXCEPTION.

The accepted exception codes remain:

- `EnqueuedStylesScope`;
- `EnqueuedScriptsScope`.

Their rationales are architectural and version-neutral.

R21 now fails if an accepted-exception rationale contains a SemVer literal, preventing future release-version drift in exception prose.

## Verification evidence

R27 evidence head before this closure-record commit:

`6574c8cc9ef268ab9f8777a7fa81025121257a0b`

Verify CiM contracts #357:

- Node 20: 658 tests / 658 passed / 0 failed;
- Node 22: 658 tests / 658 passed / 0 failed;
- R27 shared-source freshness: PASS;
- page-3227 adapter freshness: PASS;
- architecture and Core-authority gates: PASS;
- R12 release-tree contract: PASS;
- R22 release metadata: PASS;
- R23 supply-chain audit: PASS;
- R14 reproducibility: PASS.

Release tree:

- 34 modules;
- 52 import edges;
- module root `wordpress/assets/modules/0.1.1`;
- Git Experience `wordpress/assets/modules/0.1.1/experiences/git/git-basic-cycle.json`;
- Git renderer `wordpress/assets/modules/0.1.1/src/renderers/subjects/git/renderer.mjs`.

## Release artifact identity

Artifact:

`code-in-motion-0.1.1.zip`

Identity:

- version: 0.1.1;
- files: 60;
- staged bytes: 433,183;
- ZIP SHA-256: `55caaa141214dd5fb36960a210d42d28278739777e0d7468abeb3f1cf967a533`;
- R23 manifest SHA-256: `f7e91414c169c90fe55c32e43215db224b18454e6fbb410a89b30525975303b7`.

R23 independently audits both staged tree and extracted ZIP and reports them byte-identical.

R14 rebuilds the artifact twice from the same candidate source and reproduces the same ZIP digest.

The retained Verify #357 development artifact is:

`r27-localis-development-artifact`

GitHub artifact ID:

`10576257085`

Outer GitHub artifact SHA-256:

`5722abc2ae84e51d91b3e859db345cd22114c0360fe4d592231c7c62188405b7`

The retained R23 manifest artifact is:

- artifact ID: `10576207023`;
- outer GitHub artifact SHA-256: `e5007bd7d629fabd5fe57b702e3c7e79dc9f32305c790f4218421e2735c8eb3f`.

## Release-version boundary

The earlier 59-file development artifact used version 0.1.0.

R27 deep-link delivery increased the release tree to 60 files. The release version therefore advanced to 0.1.1.

This is intentional R22 version ownership:

- package version;
- lockfile root version;
- plugin header version;
- implementation version constant;
- readme stable tag;
- current changelog;
- version-bearing module root

all agree on 0.1.1.

No R26 Release Candidate designation transfers to this artifact.

R26's designation remains bound only to its exact 0.1.0 candidate commit, exact 57-file artifact digest, and exact retained R24 evidence archive.

R27 0.1.1 is a distinct artifact with its own identity and evidence.

## Live Localis deployment

Localis WordPress independently reports:

- plugin: Code in Motion;
- status: active;
- version: 0.1.1;
- plugin file: `code-in-motion/code-in-motion.php`.

Page 3227 contains:

- generated R27 shared-source adapter;
- `[cim experience="git-basic-cycle"]` mount;
- generated fragments from `step-01` through `step-08`;
- native Git-row anchor rendering using each row's generated `cim_fragment`;
- page-owned styling that preserves the Entry Card presentation.

The existing page router owns hashes such as `#reference`, `#workflows`, and command/group routes. It declines unknown hash families, so the `#cim/...` namespace remains available to the CiM Host without page-router rewriting.

### Live-observation boundary

The WordPress connector can verify the live plugin version, stored page source, shortcode shell, and generated link logic.

Its page-inspection endpoint does not expose an interactive browser/evaluate surface that can click a live page-3227 row and then inspect the same post-JavaScript mounted instance.

The exact JavaScript behavior is independently proven by Browser E2E #172 against both repository-mapped WordPress and the exact installed 0.1.1 ZIP.

A human live-site click smoke remains useful as an observational confirmation of the deployed page composition, but it is not being substituted for CI evidence and does not alter artifact identity.

## Workflow saturation

At evidence head `6574c8cc9ef268ab9f8777a7fa81025121257a0b`:

- WordPress Playground PR Preview #185: PASS;
- Verify CiM contracts #357: PASS;
- WordPress Floor QA #182: PASS;
- WordPress Browser E2E #172: PASS.

PR #39 remains the R27 integration PR.

## R27 acceptance

R27 acceptance is supported by evidence that:

- one canonical Git fact source projects into both page 3227 and `git-basic-cycle`;
- projection freshness is machine-gated;
- the eight page anchors map explicitly to eight semantic CiM boundaries;
- production observation boundaries can advance semantically without mutating subject state;
- `git/v1` preserves the four-place repository model and separate reflog evidence grammar;
- WordPress targeted deep-link initialization and live hash navigation work through the production Host path;
- source-mapped and exact-ZIP browser paths both pass;
- fresh install and N→N+1 upgrade pass;
- WordPress, PHP, and browser compatibility matrices remain green;
- the locked WordPress floor and current-WordPress Plugin Check remain green;
- release metadata, release-tree topology, supply-chain audit, and reproducibility remain green;
- Localis runs CiM 0.1.1 and page 3227 contains the production mount and generated link wiring;
- R27 artifact identity is independent from R26 Release Candidate designation.

## Boundary

R27 establishes the first complete shared-source production-content path:

`canonical subject facts → reference-page projection → CiM Experience → production renderer → WordPress Host → stable deep link`

R27 does not designate a new Release Candidate.

Any future RC designation must bind independently to an exact commit, exact artifact digest, and retained evidence package. No approval or designation is inherited by version number, file count, or semantic similarity.
