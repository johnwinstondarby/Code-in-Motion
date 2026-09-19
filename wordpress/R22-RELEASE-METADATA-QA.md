# R22 Release Metadata QA

## Scope

R22 validates the publication and distribution metadata carried by the Code in Motion 0.1.0 WordPress release.

Acceptance covers:

- canonical WordPress plugin headers;
- WordPress `readme.txt`;
- package and lockfile version metadata;
- license declarations and shipped license text;
- support and project URLs;
- current-version changelog;
- equality between source metadata and the staged release tree.

Reference requirements:

- https://developer.wordpress.org/plugins/plugin-basics/header-requirements/
- https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/
- https://developer.wordpress.org/plugins/wordpress-org/common-issues/
- https://developer.wordpress.org/plugins/plugin-basics/

## Canonical metadata ownership

The root `code-in-motion.php` is the sole WordPress plugin-header owner.

The header declares:

- Plugin Name: Code in Motion
- Plugin URI: https://github.com/johnwinstondarby/Code-in-Motion
- Description: WordPress host, runtime bindings, and controls for Code in Motion experiences.
- Version: 0.1.0
- Requires at least: 6.5
- Requires PHP: 7.4
- Author: Localis
- Author URI: https://localis.services/
- License: GPLv3
- License URI: https://www.gnu.org/licenses/gpl-3.0.html

R22 removed the duplicate plugin header from `wordpress/code-in-motion.php`. That implementation file owns only implementation code and the `LOCALIS_CIM_PLUGIN_VERSION` constant.

## WordPress readme

`readme.txt` now carries the release-facing metadata required by the R22 contract:

- Tags: interactive, experience, runtime
- Requires at least: 6.5
- Tested up to: 7.1
- Requires PHP: 7.4
- Stable tag: 0.1.0
- License: GPLv3
- License URI: https://www.gnu.org/licenses/gpl-3.0.html

The short description exactly matches the plugin-header Description and remains within the WordPress length guidance.

The readme contains:

- Description
- Installation
- Support
- Changelog

The support route is:

https://github.com/johnwinstondarby/Code-in-Motion/issues

The changelog contains a current `0.1.0` entry and no release-candidate wording.

## Package metadata

`package.json` and `package-lock.json` are part of the R22 version-consistency proof even though they remain outside the WordPress ZIP.

Canonical package metadata includes:

- name: `code-in-motion`
- version: `0.1.0`
- license: `GPL-3.0-only`
- homepage: project GitHub repository
- repository: project Git repository
- bugs: project GitHub Issues route

The lockfile root name, version, and license must match the package metadata.

## License

The release contains `LICENSE` with the GNU General Public License version 3 text dated 29 June 2007.

The package, plugin header, readme, and shipped license are therefore aligned on GPL version 3.

## Machine gate

`tools/check-wordpress-release-metadata.mjs` owns the R22 metadata contract.

The source gate fails on:

- package/package-lock name, version, license, repository, homepage, or support-route drift;
- missing or duplicate plugin-header fields;
- more than one WordPress `Plugin Name` header across the release PHP entries;
- plugin version drift from `package.json`;
- implementation constant drift;
- readme requirement, tested-version, stable-tag, license, support, short-description, or changelog drift;
- missing GPLv3 license text;
- release-candidate wording in the current release readme.

`npm run verify` executes the source metadata gate.

The release-build workflow independently executes:

`node tools/check-wordpress-release-metadata.mjs --release-root dist/code-in-motion`

That staged-tree gate also proves that the shipped plugin header, implementation PHP, `readme.txt`, and `LICENSE` are byte-identical to their source files.

Unit coverage is in:

`tests/wordpress-release-metadata.test.mjs`

## R16 regression discovered by R22

The single-header correction exposed a stale assumption in the R16 synthetic prior-version fixture. The old fixture attempted to rewrite a second implementation `Version:` header.

R22 corrected the fixture contract:

- root plugin header carries the prior plugin version;
- implementation version is represented only by `LOCALIS_CIM_PLUGIN_VERSION`;
- prior `readme.txt` stable tag and changelog entry are rewritten to 0.0.9;
- version-bearing module paths remain rewritten to 0.0.9.

The repaired R16 path then passed:

- N = 0.0.9 / 58 files active;
- N+1 = 0.1.0 / 57 files active;
- upgrade replacement and activation preservation green.

## Evidence

Implementation head:

`dfdb92d37c4359bcf739911275381de7e2e78045`

Release artifact:

- version: 0.1.0
- files: 57
- Node: 22.23.2
- SHA-256: `3bcc03d9e65bf3c86119704ae18ec1535be1984cceb641265e3b15dbffcd1c2b`

R22 source gate:

`PASS: R22 release metadata (source, version 0.1.0, WordPress 6.5-tested 7.1, PHP 7.4, GPLv3).`

R22 staged-release gate:

`PASS: R22 release metadata (staged release, version 0.1.0, WordPress 6.5-tested 7.1, PHP 7.4, GPLv3).`

R14 clean-build reproducibility re-proved identical ZIP bytes with the R22 artifact hash.

Node verification suite:

- 631 tests
- 631 passed

Plugin Check 2.1.0 remained green under the R21 policy:

- FAIL: 0
- REVIEW: 0
- ACCEPTED EXCEPTION: 2

Downstream artifact checks also re-passed:

- fresh ZIP installation;
- N to N+1 upgrade;
- WordPress 6.5 through 7.1 compatibility matrix;
- PHP 7.4 / 8.5 compatibility;
- Chromium / Firefox / WebKit browser coverage.

Implementation-head workflows:

- Verify CiM contracts #283: PASS
- WordPress Playground PR Preview #111: PASS
- WordPress Floor QA #108: PASS
- WordPress Browser E2E #98: PASS

## Boundary

R22 owns release metadata consistency and the publication-facing metadata contract.

Later checkpoints may change release policy or publication mechanics, but version and metadata changes must continue to satisfy the R22 gates.
