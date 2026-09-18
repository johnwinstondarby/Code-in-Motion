# R24 Release Evidence Package

## Scope

R24 assembles the release evidence required to identify, reproduce, inspect, and review one exact Code in Motion release candidate.

Acceptance requires the package to retain:

- candidate commit;
- release and tool versions;
- release artifact SHA-256;
- release file manifest;
- verification counts;
- WordPress, PHP, and browser compatibility evidence;
- Plugin Check evidence;
- upgrade evidence;
- locked build-tool inventory and its audit result.

R24 keeps two security surfaces distinct:

- **Artifact security** covers the 57 files shipped in the WordPress plugin ZIP.
- **Evidence-chain security** covers the pinned and auditable tools used to build and verify that ZIP.

## Preflight closure

The R24 preflight closed three open evidence-chain items before package assembly.

### R21 classifier log clarity

The R21 classifier self-tests intentionally feed synthetic failure and review findings to prove fail-closed behavior.

Those test-generated lines now carry the prefix:

`[fixture]`

Production Plugin Check classifications retain their existing output. A passing verification log therefore no longer contains an unlabeled synthetic `FAIL:` or `REVIEW:` line.

### Locked WordPress environment tool

`@wordpress/env@11.15.0` is now a locked development dependency.

The npm script is:

`"wp-env": "wp-env"`

The previous `npx --yes @wordpress/env@11.15.0` execution path has been removed.

The packaging gate verifies both:

- `devDependencies["@wordpress/env"] === "11.15.0"`;
- `scripts["wp-env"] === "wp-env"`.

Independent verification on INSPIRE confirmed that the locked executable starts the same environment:

- WordPress 6.5.10;
- PHP 7.4.33.

CI WordPress Floor QA independently reported the same versions.

### Development dependency refresh

AJV remains pinned at 8.20.0.

Its existing `fast-uri ^3.0.1` dependency resolved normally to `fast-uri@3.1.8`. No npm override and no major-version dependency crossing were introduced.

The prior `fast-uri@3.1.5` audit finding is absent from the resulting locked tree.

## Reproducibility result

The dependency lock expanded substantially when `@wordpress/env` entered the repository lockfile. CI installs 393 packages from the resulting lock.

The release artifact remained byte-identical across that toolchain change.

Artifact:

- version: 0.1.0
- files: 57
- ZIP SHA-256: `3bcc03d9e65bf3c86119704ae18ec1535be1984cceb641265e3b15dbffcd1c2b`

That digest is unchanged from the artifact established before the R24 dependency-lock changes.

This demonstrates that the release artifact is determined by the release source tree and pinned release runtime rather than by unrelated changes in the surrounding development dependency graph.

Independent INSPIRE verification reproduced the same ZIP digest and 57-file count after the lockfile and `fast-uri` changes.

## Evidence-chain identity

R24 evidence run #7 used candidate commit:

`162d4b8c2e6f5ac12625261eaed1570f5a8701be`

Locked toolchain:

- Node: 22.23.2
- npm: 10.9.8
- `@wordpress/env`: 11.15.0
- AJV: 8.20.0
- `fast-uri`: 3.1.8

Package-lock SHA-256:

`ebc28577baa89ec4b965fb159efeb8ec99e2c373d9b57ea65fedefd0a107ce9b`

The lockfile digest identifies the exact development dependency graph used by the evidence run.

## npm audit disposition

The retained npm audit output reports:

- 0 critical
- 0 high
- 3 moderate

The remaining finding is `qs@6.15.3`, reached through:

`@wordpress/env@11.15.0 → @wp-playground/cli@3.1.54 → express@4.22.2 → qs@6.15.3`

The retained audit names:

- GHSA-x5fp-wj9c-mxmx
- GHSA-4mjr-xmp4-gh2g

The finding is in the locked development toolchain. R23 independently proves that development dependencies, `node_modules`, package metadata, and tooling paths do not enter the 57-file release artifact.

R24 records the audit verbatim and does not use `npm audit fix` to alter the pinned WordPress environment dependency graph.

The audit step is evidentiary and non-blocking. Normal deterministic installs remain:

`npm ci --ignore-scripts --no-audit --no-fund`

## Known development-tool deprecation warnings

The locked install emits two npm deprecation warnings:

- `@octokit/webhooks-types@7.6.1`
- `glob@10.5.0`

These are retained as known development-tool warnings in the R24 evidence package. Neither package enters the release artifact.

A deprecation warning is recorded separately from an npm security advisory.

## Verification evidence

R24 runs the complete repository verification suite while assembling the package.

Result:

- tests: 638
- passed: 638
- failed: 0

The R21 synthetic classifier output in this log is explicitly marked `[fixture]`.

R24 also rebuilds the release ZIP from the exact candidate checkout, verifies its SHA-256 sidecar, counts its staged files, and independently rebuilds the R23 per-file SHA-256 manifest.

## Included release evidence

The R24 package contains the release artifact and the evidence accumulated across the release sequence.

### Artifact

- `code-in-motion-0.1.0.zip`
- ZIP SHA-256 sidecar
- independently calculated artifact SHA-256
- 57-file count
- staged-byte count
- fresh R23 per-file SHA-256 manifest

### Release QA records

- R16 upgrade QA
- R17 post-upgrade QA
- R18 WordPress compatibility
- R19 PHP compatibility
- R20 browser compatibility
- R21 Plugin Check
- R22 release metadata QA
- R23 supply-chain and file-manifest QA
- RELEASE-QA
- RELEASE-TREE

These records retain the upgrade, compatibility-matrix, browser, Plugin Check, metadata, and supply-chain results required by R24 acceptance.

### Evidence-chain records

- candidate commit
- `package.json`
- `package-lock.json`
- package-lock SHA-256
- complete npm dependency inventory
- focused `@wordpress/env` / AJV / `fast-uri` / `qs` dependency paths
- verbatim npm audit JSON
- verbatim npm audit text
- npm audit exit statuses
- npm install log
- Node/npm/tool versions
- known deprecation-warning dispositions
- complete verification log
- release-build log

### Bundle integrity

The package contains `SHA256SUMS`, covering every retained evidence file except the checksum index itself.

The first successful R24 package was uploaded by workflow run #7 as:

`r24-release-evidence`

GitHub artifact digest:

`sha256:19a7025d1b471573dfd52d3160493d6bf98d3047112246eabaca85f391b45670`

The workflow retains the package for 90 days.

## Independent verification

INSPIRE independently verified the R24 preflight on head:

`82889bba80f631f25432ed2b93662edd57eab70c`

Results:

- release ZIP digest unchanged at `3bcc03d9e65bf3c86119704ae18ec1535be1984cceb641265e3b15dbffcd1c2b`;
- 57 release files;
- locked `wp-env` executable used;
- WordPress 6.5.10;
- PHP 7.4.33;
- npm audit: 3 moderate, 0 high.

R24 CI then rebuilt the exact artifact on implementation head `162d4b8c2e6f5ac12625261eaed1570f5a8701be` and produced the same release digest.

## Boundary

R24 assembles and identifies the evidence package.

R25 owns peer-review disposition against the exact candidate artifact and evidence package. Approval must name the exact candidate commit and exact ZIP digest.
