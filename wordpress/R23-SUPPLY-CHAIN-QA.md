# R23 Supply-Chain and File-Manifest QA

## Scope

R23 proves that the exact Code in Motion WordPress ZIP contains only approved release files and contains no secret-bearing, development, test/harness, or unapproved binary material.

Acceptance:

- the ZIP manifest excludes secrets;
- the ZIP manifest excludes development files;
- the ZIP manifest excludes test and harness material;
- the ZIP contains no unapproved binaries;
- the staged tree and extracted ZIP are byte-identical;
- an SHA-256 file manifest is retained as CI evidence.

## Independent audit boundary

R13 owns the staging manifest and deterministic ZIP writer.

R23 does not accept the R13 manifest as proof of supply-chain cleanliness. It independently inspects the resulting staged tree and a fresh extraction of the ZIP.

That separation means a mistaken builder include rule cannot approve itself.

## Approved v1 artifact surface

The v0.1.0 artifact is text-only.

Approved static paths:

- `LICENSE`
- `readme.txt`
- `code-in-motion.php`
- `wordpress/code-in-motion.php`
- `wordpress/assets/bootstrap.js`
- `wordpress/assets/cim.css`

Approved version-bearing paths:

- `wordpress/assets/modules/0.1.0/src/**/*.mjs`
- `wordpress/assets/modules/0.1.0/wordpress/assets/**/*.mjs`
- `wordpress/assets/modules/0.1.0/wordpress/experiences/synthetic-wordpress.json`

R30 extends the current machine gate so `wordpress/experiences/registry.json` is an approved static path and version-bearing Experience JSON is approved only when its asset name appears in the canonical registry. R31 additionally approves the exact production path `wordpress/admin-console.php`; no general PHP-directory wildcard is introduced. R32 additionally approves the exact inert management projection `wordpress/renderers/inventory.generated.json`; no renderer-directory wildcard is introduced. R33 additionally approves the exact generated release metadata projection `wordpress/release/release-info.generated.json`; no release-directory wildcard is introduced. The historical v0.1.0 evidence below remains unchanged.

Any path outside the applicable approved surface fails the R23 audit.

## Denied development and test material

R23 explicitly rejects release paths containing or naming development/test material including:

- `.git/`
- `.github/`
- `.ci/`
- `node_modules/`
- `tests/`
- `test/`
- `__tests__/`
- `harness/`
- `tools/`
- `docs/`
- `examples/`
- `schemas/`
- `authoring/`
- `fixtures/`
- `mocks/`
- `package.json`
- `package-lock.json`
- `.nvmrc`
- `.wp-env.json`
- Composer metadata
- PHPUnit configuration
- environment files

## Denied binary and secret-bearing material

The v1 text-only artifact rejects:

- private-key and certificate files;
- Java/native binary forms;
- WebAssembly;
- archives and compressed bundles;
- databases;
- source maps;
- any file that cannot be decoded as UTF-8.

R23 also scans approved text content for high-confidence credential indicators including:

- private-key blocks;
- AWS access-key forms;
- GitHub token forms;
- OpenAI-style secret-key forms;
- Google API-key forms;
- assignments to selected secret-bearing environment names such as `AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CLIENT_SECRET`, `PRIVATE_KEY`, and `PASSWORD`.

Ordinary runtime vocabulary such as a variable named `token` or a string containing `password` does not trigger the gate by itself.

## Machine gate

`tools/check-wordpress-supply-chain.mjs` owns the R23 artifact audit.

CI performs this sequence against the release-build output:

1. audit `dist/code-in-motion/`;
2. write its sorted per-file SHA-256 manifest;
3. extract `code-in-motion-0.1.0.zip` into a clean temporary directory;
4. audit the extracted plugin tree independently;
5. write the extracted ZIP manifest;
6. recursively compare staged and extracted trees;
7. require the two manifests to be byte-identical;
8. require staged-file and ZIP-entry counts to agree;
9. upload the R23 manifests as CI evidence.

Unit coverage is in:

`tests/wordpress-supply-chain.test.mjs`

The tests prove approved paths, development/test rejection, environment/credential filename rejection, binary/archive rejection, non-UTF-8 rejection, credential-indicator rejection, and safe ordinary token vocabulary.

## Evidence

Implementation head:

`1007c18b448717e12fe413ffc91255974c25685a`

Release artifact:

- version: 0.1.0
- files: 57
- staged bytes audited: 405,947
- ZIP SHA-256: `3bcc03d9e65bf3c86119704ae18ec1535be1984cceb641265e3b15dbffcd1c2b`

R23 staged-tree result:

`PASS: R23 supply-chain audit (57 file(s), 405947 byte(s), no denied paths, unapproved binaries, or secret indicators; manifest SHA-256 e6fe790d4d519329104bd34fd94dff02041aa220ce12fba9a84484728a270dae).`

R23 extracted-ZIP result:

`PASS: R23 supply-chain audit (57 file(s), 405947 byte(s), no denied paths, unapproved binaries, or secret indicators; manifest SHA-256 e6fe790d4d519329104bd34fd94dff02041aa220ce12fba9a84484728a270dae).`

Tree comparison:

`PASS: R23 staged tree and extracted ZIP are byte-identical (57 file(s)).`

Manifest SHA-256:

`e6fe790d4d519329104bd34fd94dff02041aa220ce12fba9a84484728a270dae`

The manifest files are uploaded by the release-build job as the `r23-supply-chain-manifest` CI artifact.

Node verification suite:

- 638 tests
- 638 passed

The existing release controls also remained green:

- R14 reproducible ZIP hash;
- R15 fresh install;
- R16 N to N+1 upgrade;
- R18 WordPress compatibility matrix;
- R19 PHP compatibility;
- R20 Chromium / Firefox / WebKit;
- R21 Plugin Check;
- R22 release metadata.

Implementation-head workflows:

- Verify CiM contracts #286: PASS
- WordPress Playground PR Preview #114: PASS
- WordPress Floor QA #111: PASS
- WordPress Browser E2E #101: PASS

## Boundary

R23 establishes supply-chain cleanliness and a retained per-file manifest for the release artifact.

R24 owns assembly of the complete release evidence package using the exact candidate artifact and the evidence produced by R13 through R23.
