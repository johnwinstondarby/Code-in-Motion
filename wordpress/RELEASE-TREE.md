# Code in Motion WordPress Release Tree Contract

R12 defines the standalone WordPress plugin directory contract used by the deterministic builder in R13 and the install-from-ZIP proof in R15.

## Scope

The release artifact preserves CiM production semantics and relative module relationships. Packaging may relocate the production graph into its release location. Packaging does not change Core, Runtime, Host, Transport, renderer, or Experience authority.

The repository-root `wp-env` configuration remains a development and pre-artifact integration environment. Its `plugins: ["."]` mount is deliberately a superset of the release tree and does not prove artifact containment.

## Plugin root

The installable ZIP contains one top-level directory:

```text
code-in-motion/
```

The plugin entry remains:

```text
code-in-motion/code-in-motion.php
```

The entry delegates to the WordPress implementation under:

```text
code-in-motion/wordpress/code-in-motion.php
```

This preserves the established PHP implementation boundary while giving WordPress one canonical root plugin file.

## Stable top-level assets

The following release paths remain stable across versions because WordPress versions their top-level URLs with the plugin version:

```text
code-in-motion/wordpress/assets/bootstrap.js
code-in-motion/wordpress/assets/cim.css
```

The classic `bootstrap.js` is a release handoff. R13 deterministically changes only its module-entry target from the repository-tree location to the version-bearing module location defined below.

## Version-bearing module graph

All unbundled ES modules and module-relative Experience data ship below:

```text
code-in-motion/wordpress/assets/modules/<plugin-version>/
```

For version `0.1.1`, the module entry is:

```text
code-in-motion/wordpress/assets/modules/0.1.1/wordpress/assets/bootstrap-module.mjs
```

The release builder preserves repository-relative topology beneath that version directory. Examples:

```text
wordpress/assets/bootstrap-module.mjs
→ wordpress/assets/modules/0.1.1/wordpress/assets/bootstrap-module.mjs

wordpress/assets/transport-binding.mjs
→ wordpress/assets/modules/0.1.1/wordpress/assets/transport-binding.mjs

src/host/wordpress-live-host.mjs
→ wordpress/assets/modules/0.1.1/src/host/wordpress-live-host.mjs

wordpress/experiences/synthetic-wordpress.json
→ wordpress/assets/modules/0.1.1/wordpress/experiences/synthetic-wordpress.json
```

Because the topology is preserved, existing relative imports such as `../../src/...` retain the same meaning inside the version-bearing module root. Static imports do not depend on query-string propagation for cache invalidation.

## Production source content

For v1, the release builder may include the full verified `src/` production tree beneath the version-bearing module root. Test, harness, tooling, general project documentation, Git metadata, local environment state, and dependency-installation directories remain outside the plugin artifact. The release-specific `readme.txt` and `LICENSE` are explicit distribution inputs.

The approved non-production runtime inputs are limited to the WordPress production assets and the synthetic diagnostic Experience required by the shipped checkpoint.

The release artifact excludes at least:

```text
.github/
.git/
node_modules/
tests/
tools/
harness/
docs/
.ci/
.wp-env.json
package.json
package-lock.json
```

R13 owns the exact staging manifest and deterministic archive mechanics.

## Transitive import containment

`npm run check:wordpress-release-tree` walks the JavaScript module graph transitively from `wordpress/assets/bootstrap-module.mjs`.

The gate requires every runtime import to:

- be relative;
- resolve to an existing `.mjs` production file;
- remain inside the approved repository production roots;
- preserve its exact target when mapped into the version-bearing release module directory;
- remain inside that version-bearing directory after release mapping.

This gate exists because repository-root `wp-env` can satisfy imports from files that would be absent from a release artifact. A green repo-tree WordPress test is therefore behavioral evidence, while this gate is structural artifact-contract evidence.

## Experience placement

The synthetic diagnostic Experience follows the module graph into the same version-bearing release root:

```text
code-in-motion/wordpress/assets/modules/<plugin-version>/wordpress/experiences/synthetic-wordpress.json
```

`bootstrap-module.mjs` resolves the Experience relative to its own physical module URL, preserving the existing production loader contract.

## Metadata and license

R21 pulled the minimum non-waivable distribution metadata forward after WordPress Plugin Check identified two release-blocking findings. The distributable tree now includes:

```text
code-in-motion/LICENSE
code-in-motion/readme.txt
```

The root plugin header declares GPLv3 and the GNU GPLv3 license URI. `wordpress/code-in-motion.php` carries implementation code and the internal plugin-version constant, but no second WordPress plugin header. The shipped `LICENSE` is the GNU General Public License version 3 text supplied for the project.

R22 retains ownership of broader release-metadata QA and publication-facing metadata consistency.

## R13 deterministic builder

R13 implements the contract above with one command:

```text
npm run build:wordpress
```

The exact release-build Node runtime is pinned in `.nvmrc`. The builder fails before staging when the active Node runtime does not match that version exactly. General CiM verification retains the broader supported Node matrix; the exact pin applies to release artifact construction.

The command creates:

```text
dist/code-in-motion/
dist/code-in-motion-<plugin-version>.zip
dist/code-in-motion-<plugin-version>.zip.sha256
```

`dist/` is generated output and is excluded from Git.

### Staging manifest

The builder stages only these inputs:

```text
LICENSE
readme.txt
code-in-motion.php
wordpress/code-in-motion.php
wordpress/assets/bootstrap.js
wordpress/assets/cim.css
src/**/*.mjs
wordpress/assets/**/*.mjs
wordpress/experiences/synthetic-wordpress.json
```

The `src/**/*.mjs` and `wordpress/assets/**/*.mjs` production modules are relocated beneath the version-bearing module root while preserving repository-relative topology. The synthetic Experience follows the same mapping. The stable PHP, classic bootstrap, and stylesheet remain at their R12 paths.

The classic bootstrap must contain exactly one repository-tree module handoff. During staging, that one target changes from:

```text
./bootstrap-module.mjs
```

to:

```text
./modules/<plugin-version>/wordpress/assets/bootstrap-module.mjs
```

No other classic-bootstrap source is rewritten.

The staged file list is compared against the manifest generated from those inputs. Duplicate destinations or unexpected staged files fail the build.

### Archive policy

The ZIP writer is part of the repository build code and uses fixed archive policy:

- lexicographic POSIX entry ordering;
- one `code-in-motion/` top-level prefix;
- DEFLATE method with level 9, memory level 8, and the default zlib strategy;
- fixed DOS timestamp of 1980-01-01 00:00:00;
- Unix regular-file mode `0644` in central-directory attributes;
- UTF-8 filename flag;
- zero ZIP extra fields;
- zero file comments and archive comment;
- no duplicate entries;
- no ZIP64 output in v1.

Staged regular files are normalized to mode `0644`; staged directories are normalized to `0755`; staged file and directory timestamps use the same fixed epoch. The generated ZIP and SHA-256 sidecar also receive normalized file mode and timestamp metadata.

The build prints the staged file count, exact Node version, archive name, and SHA-256. CI independently verifies the checksum, ZIP integrity, single top-level prefix, duplicate-entry absence, and equality between staged-file count and ZIP-entry count.

R13 establishes deterministic build mechanics. R14 performs the independent repeated-clean-build proof that identical declared inputs produce the identical ZIP SHA-256.

## R23 supply-chain and manifest audit

R23 independently audits the artifact produced by R13 rather than reusing the builder manifest as its approval source.

The audit runs against both:

- `dist/code-in-motion/`;
- a fresh extraction of `dist/code-in-motion-<plugin-version>.zip`.

The v1 release policy is text-only. Approved content is limited to the release metadata and WordPress entry/assets plus the version-bearing `.mjs` module graph and the synthetic diagnostic Experience.

R23 fails closed on:

- development and repository paths such as `.git/`, `.github/`, `node_modules/`, `tests/`, `harness/`, `tools/`, `docs/`, `examples/`, schemas, fixtures, mocks, and authoring material;
- development files such as `package.json`, `package-lock.json`, `.nvmrc`, `.wp-env.json`, Composer metadata, PHPUnit configuration, and environment files;
- key, certificate, archive, native-binary, WebAssembly, database, and source-map extensions;
- non-UTF-8 or binary content at an approved text path;
- private-key blocks and high-confidence cloud/API credential indicators.

The audit produces a lexicographically sorted SHA-256 manifest for every shipped file. CI creates one manifest from the staged tree and one from the extracted ZIP, requires the two manifests to be identical, and performs a recursive byte comparison between staged and extracted trees.

The R23 manifest is uploaded as CI evidence for later release-governance assembly under R24.

## R24 release evidence package

R24 assembles one reviewable evidence package against the exact candidate commit.

The R24 workflow checks out the pull-request head SHA rather than GitHub's synthetic merge commit, then rebuilds and verifies the release artifact from that exact tree.

The package retains:

- candidate commit identity;
- exact release ZIP and SHA-256 sidecar;
- fresh R23 per-file SHA-256 manifest;
- release file count and staged-byte count;
- R16 through R24 release QA records;
- complete verification and build logs;
- locked Node/npm/wp-env/AJV/fast-uri identities;
- package-lock SHA-256;
- complete npm dependency inventory;
- focused dependency paths for the audited toolchain;
- verbatim npm audit JSON and text;
- known development-tool deprecation warnings;
- a SHA-256 index over the retained evidence files.

R24 keeps artifact security separate from evidence-chain security. R23 proves that development tooling does not enter the 57-file plugin artifact. R24 identifies and audits the locked toolchain used to produce and verify that artifact.

The evidence package is uploaded as `r24-release-evidence` with 90-day retention.

## R12 exit rule

R12 is complete when the release-tree contract and transitive import-containment gate are green on the branch. R13 must consume this contract rather than defining a second staging layout.

## R13 exit rule

R13 is complete when the pinned-runtime build command creates the R12-conforming staged tree and ZIP, unit tests prove the release-node rejection and fixed ZIP metadata contract, and CI verifies the generated archive structure and checksum. Repeated-build hash equality remains R14 scope.
