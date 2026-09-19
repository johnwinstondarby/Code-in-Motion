# R19 PHP Compatibility QA

## Scope

R19 proves the Code in Motion 0.1.0 release ZIP at the plugin's declared PHP floor and the current stable PHP release while holding WordPress constant.

- WordPress: 7.1.1
- PHP floor: 7.4
- Current stable PHP branch: 8.5
- Current stable PHP release at execution: 8.5.10
- PHP 8.6 remains pre-release and is outside R19.

WordPress 7.1 fully supports PHP 7.4 through PHP 8.5. PHP 7.4 is retained by WordPress for backward compatibility; current supported PHP releases are preferred for production.

References:
- https://www.php.net/downloads.php
- https://www.php.net/supported-versions.php
- https://make.wordpress.org/core/handbook/references/php-compatibility-and-wordpress-versions/
- https://make.wordpress.org/hosting/handbook/compatibility/version/7-1/

## Matrix

| PHP matrix label | Runtime observed in CI | WordPress | CiM | Result |
| --- | --- | --- | --- | --- |
| 7.4 | 7.4.33 | 7.1.1 | 0.1.0 | PASS |
| 8.5 | 8.5.10 | 7.1.1 | 0.1.0 | PASS |

## Artifact boundary

Each matrix member:

1. builds the deterministic `code-in-motion-0.1.0.zip`,
2. starts an isolated wp-env instance with no repository-mounted CiM plugin,
3. verifies the actual PHP runtime and exact WordPress version,
4. installs and activates the ZIP through WP-CLI,
5. syntax-checks every installed PHP file using the matrix runtime,
6. creates WordPress-backed diagnostic pages,
7. runs the PHP compatibility browser suite against the installed artifact,
8. tears down the isolated environment.

## Integration suite

Each PHP runtime runs four browser checks:

1. production mount and keyboard navigation,
2. three same-Experience instance isolation,
3. connected reparent plus permanent-removal lifecycle disposal,
4. installed-ZIP module-path verification.

The suite therefore exercises the shortcode/rendering edge, enqueue path, installed artifact tree, browser module graph, command path, multi-instance behavior, and lifecycle binding under both PHP runtimes.

## Evidence

Implementation head: `32e16013d5ced6501979e412b8673d248eb5e03d`

WordPress Browser E2E run #66 completed successfully.

Observed runtime evidence:

- WordPress 7.1.1, PHP 7.4.33, CiM 0.1.0 active
- WordPress 7.1.1, PHP 8.5.10, CiM 0.1.0 active

R19 browser result:

- 2 PHP runtimes
- 4 browser checks per runtime
- 8/8 PHP compatibility browser checks passed
- installed PHP files passed `php -l` on both runtimes

Implementation-head workflows:

- Verify CiM contracts #251: PASS
- WordPress Playground PR Preview #79: PASS
- WordPress Floor QA #76: PASS
- WordPress Browser E2E #66: PASS

## Boundary

R19 establishes PHP floor/current compatibility for the release artifact while fixing WordPress at 7.1.1.

R20 owns browser-family coverage. R22 owns release metadata and license declaration.
