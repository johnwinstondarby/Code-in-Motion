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

For version `0.1.0`, the module entry is:

```text
code-in-motion/wordpress/assets/modules/0.1.0/wordpress/assets/bootstrap-module.mjs
```

The release builder preserves repository-relative topology beneath that version directory. Examples:

```text
wordpress/assets/bootstrap-module.mjs
→ wordpress/assets/modules/0.1.0/wordpress/assets/bootstrap-module.mjs

wordpress/assets/transport-binding.mjs
→ wordpress/assets/modules/0.1.0/wordpress/assets/transport-binding.mjs

src/host/wordpress-live-host.mjs
→ wordpress/assets/modules/0.1.0/src/host/wordpress-live-host.mjs

wordpress/experiences/synthetic-wordpress.json
→ wordpress/assets/modules/0.1.0/wordpress/experiences/synthetic-wordpress.json
```

Because the topology is preserved, existing relative imports such as `../../src/...` retain the same meaning inside the version-bearing module root. Static imports do not depend on query-string propagation for cache invalidation.

## Production source content

For v1, the release builder may include the full verified `src/` production tree beneath the version-bearing module root. Test, harness, tooling, documentation, Git metadata, local environment state, and dependency-installation directories remain outside the plugin artifact.

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

The final distributable tree also requires release metadata, `readme.txt`, and `LICENSE`. Their content is completed under R22. R12 reserves those root-level paths but does not select a software license.

## R12 exit rule

R12 is complete when the release-tree contract and transitive import-containment gate are green on the branch. R13 must consume this contract rather than defining a second staging layout.
