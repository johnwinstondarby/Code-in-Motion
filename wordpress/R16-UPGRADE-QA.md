# R16 N → N+1 Upgrade QA

R16 proves normal WordPress artifact replacement, activation preservation, obsolete-file removal, and version-separated browser module URLs against the unchanged Code in Motion 0.1.0 release ZIP.

## Artifact pair

The N side is a synthetic 0.0.9 upgrade fixture derived from the R13-staged 0.1.0 release tree solely for upgrade QA. It is not a claim about a previously published Code in Motion release.

The fixture builder:

- rewrites the plugin version from 0.1.0 to 0.0.9;
- moves the version-bearing production module subtree from `wordpress/assets/modules/0.1.0/` to `wordpress/assets/modules/0.0.9/`;
- rewrites the classic bootstrap handoff to the 0.0.9 module root;
- marks the synthetic Experience renderer prefix as `R16 N ` so browser evidence identifies the loaded generation;
- adds `wordpress/assets/r16-obsolete.txt` as an N-only filesystem sentinel.

The N fixture contains 56 files and is emitted as:

```text
code-in-motion-0.0.9-r16-fixture.zip
```

N+1 is the unchanged deterministic R13/R14/R15 artifact:

```text
code-in-motion-0.1.0.zip
SHA-256 b91244038f827098e928139067695640f460afcf4a8f1a047a59e374fdf322b8
```

No production source or 0.1.0 release file is modified to construct N.

## Filesystem and activation gate

The authoritative `upgrade-e2e` job starts a clean Docker-backed `wp-env` instance with WordPress 6.5.10, PHP 7.4, `plugins: []`, and a dedicated port.

The job installs N with activation enabled and requires:

- plugin status `active`;
- plugin version `0.0.9`;
- 56 installed files;
- the N-only obsolete sentinel present;
- `wordpress/assets/modules/0.0.9/` present;
- `wordpress/assets/modules/0.1.0/` absent.

While the browser session remains alive, the test invokes WordPress' plugin installer with the N+1 ZIP and `--force`. It deliberately omits `--activate`; activation must therefore survive the replacement rather than being re-established by the test.

After upgrade, independent WP-CLI and filesystem assertions require:

- plugin status still `active`;
- plugin version `0.1.0`;
- 55 installed files;
- `wordpress/assets/r16-obsolete.txt` absent;
- `wordpress/assets/modules/0.0.9/` absent;
- `wordpress/assets/modules/0.1.0/` present.

This proves WordPress removes the prior plugin directory during the normal overwrite path instead of overlaying N+1 files onto the N tree.

## Warm-browser-cache gate

The Playwright proof keeps one Chromium browser context alive across the upgrade with the HTTP cache enabled.

Before upgrade it requires:

- the CiM root to reach `ready`;
- the synthetic renderer to display `R16 N A`;
- production module requests to use `/wordpress/assets/modules/0.0.9/`;
- no production request to use `/wordpress/assets/modules/0.1.0/`.

The test explicitly primes the N bootstrap-module URL with `fetch(..., { cache: 'force-cache' })`. Some Chromium/server combinations revalidate rather than report a direct disk-cache hit, so the proof does not depend on a browser-specific cache telemetry flag. The browser cache remains enabled, the N URL is requested before upgrade, and the physical URL family is version-separated.

The WordPress overwrite then runs while the same browser session remains alive. After navigation to the upgraded page the test requires:

- the CiM root to reach `ready` again;
- the renderer to display the N+1 value `Node A`;
- the bootstrap module to load from `/wordpress/assets/modules/0.1.0/wordpress/assets/bootstrap-module.mjs`;
- the Experience to load from `/wordpress/assets/modules/0.1.0/wordpress/experiences/synthetic-wordpress.json`;
- no post-upgrade request to use `/wordpress/assets/modules/0.0.9/`.

This establishes the R12 asset-versioning invariant at upgrade time: N+1 production modules resolve to a different physical URL family from N-era modules, so a warm browser cannot satisfy N+1 imports with an address-identical N module.

## Evidence

Implementation head:

```text
5b7df8ecd3b29abce1c19909fa1f4f6995e72f2b
```

Authoritative workflow evidence:

```text
WordPress Browser E2E run: 35268610410 (#60)
upgrade-e2e job: success
warm-cache upgrade test: 1/1 passed
```

The same head passed all four project workflows:

```text
Verify CiM contracts:       success, run 35268610524 (#244)
WordPress Playground:       success, run 35268610413 (#73)
WordPress Floor QA:         success, run 35268610412 (#70)
WordPress Browser E2E:      success, run 35268610410 (#60)
```

The contract suite reports:

```text
620 tests
620 passed
0 failed
```

R16 proves the upgrade mechanics and browser-generation isolation required for the first release path. Post-upgrade diagnostic mounting is R17.
