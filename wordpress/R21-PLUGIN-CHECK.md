# R21 WordPress Plugin Check QA

## Scope

R21 runs WordPress Plugin Check against the exact installed Code in Motion release artifact and classifies every reported finding.

Policy:

- `FAIL` — release-blocking; all Plugin Check errors fall here.
- `REVIEW` — warning or other finding without an explicit release decision; R21 remains open.
- `ACCEPTED EXCEPTION` — warning with a documented, repository-owned rationale.
- Security, sanitization, executable-source, and distribution-metadata findings cannot be accepted as exceptions.

## Tool and environment

- WordPress: 7.1.1
- PHP: 8.5.10
- CiM: 0.1.0
- Plugin Check: 2.1.0
- Plugin Check invocation: all stable checks, static plus runtime checks through the documented WP-CLI `--require` path
- Artifact: deterministic release ZIP installed through WordPress

## Initial unfiltered result

The first R21 pass exposed two release-blocking metadata errors:

| Classification | Code | Resolution |
| --- | --- | --- |
| FAIL | `plugin_header_no_license` | Added GPLv3 license metadata to both plugin headers and shipped the GPLv3 `LICENSE`. |
| FAIL | `no_plugin_readme` | Added and staged WordPress `readme.txt`. |

It also reported:

- `EnqueuedStylesScope`
- `EnqueuedScriptsScope`
- `NonBlockingScripts.NoStrategy`

The nonblocking-script warning was resolved by declaring the stable classic bootstrap with WordPress's `defer` strategy while retaining footer placement.

Adding `LICENSE` and `readme.txt` changed the release artifact from 55 to 57 files. The R15 and R16 installed-file assertions were updated rather than relaxed.

## Final Plugin Check result

Final unfiltered Plugin Check output contains exactly two findings:

| Classification | Code | File | Rationale |
| --- | --- | --- | --- |
| ACCEPTED EXCEPTION | `EnqueuedStylesScope` | `wordpress/assets/cim.css` | CiM 0.1.0 keeps the stable stylesheet available across frontend contexts so Host rendering does not depend on shortcode-presence prediction. |
| ACCEPTED EXCEPTION | `EnqueuedScriptsScope` | `wordpress/assets/bootstrap.js` | CiM 0.1.0 keeps the stable bootstrap available across frontend contexts so Host startup does not depend on shortcode-presence prediction. |

Final classification:

- FAIL: 0
- REVIEW: 0
- ACCEPTED EXCEPTION: 2

There are no Plugin Check security, sanitization, executable-source, or distribution-metadata findings remaining.

## Machine gate

`tools/check-wordpress-plugin-check.mjs` owns the R21 classification policy.

The gate:

- fails every Plugin Check `ERROR`;
- fails every warning without an explicit classification as `REVIEW`;
- permits only the two approved enqueue-scope warnings;
- prints each accepted exception and its rationale;
- fails closed on malformed or unknown report content.

`tests/wordpress-plugin-check-classification.test.mjs` proves the accepted-warning path, universal error rejection, and unknown-warning REVIEW path.

## Artifact revalidation

Implementation head: `646ab61cb7f3b6a264bafd2b882a1b538fa62843`

The rebuilt release artifact contains 57 files.

SHA-256:

`bbf9a64f3d70a79340f8b9c3f833267bf56501433aa21c80346390693c6aaeb7`

R14 clean-build reproducibility re-proved identical ZIP bytes with that hash.

The updated artifact also re-passed the existing downstream release gates, including:

- fresh ZIP installation;
- N to N+1 upgrade and activation preservation;
- WordPress compatibility matrix;
- PHP 7.4 / 8.5 compatibility;
- Chromium / Firefox / WebKit browser coverage.

Node verification suite: 623/623 PASS.

Implementation-head workflows:

- Verify CiM contracts #265: PASS
- WordPress Playground PR Preview #93: PASS
- WordPress Floor QA #90: PASS
- WordPress Browser E2E #80: PASS

## Boundary

R21 establishes Plugin Check compliance for the release artifact with two explicitly documented performance-scope exceptions.

R22 retains broader publication metadata QA and metadata consistency work.
