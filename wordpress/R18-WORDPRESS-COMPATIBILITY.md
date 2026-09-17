# R18 WordPress Compatibility QA

## Scope

R18 proves the Code in Motion 0.1.0 release ZIP across the WordPress support range declared by the plugin header.

- Plugin minimum: WordPress 6.5
- Current production release at execution: WordPress 7.1.1
- PHP is held at 7.4 so R18 measures the WordPress axis only.
- PHP compatibility variation remains R19.

## Matrix

The matrix uses the latest maintenance/security release in every supported WordPress major line at execution time:

| WordPress line | Tested release | Result |
| --- | --- | --- |
| 6.5 | 6.5.10 | PASS |
| 6.6 | 6.6.7 | PASS |
| 6.7 | 6.7.7 | PASS |
| 6.8 | 6.8.8 | PASS |
| 6.9 | 6.9.7 | PASS |
| 7.0 | 7.0.4 | PASS |
| 7.1 | 7.1.1 | PASS |

WordPress release references:
- https://wordpress.org/download/releases/
- https://wordpress.org/news/

The WordPress GitHub mirror tags for all seven exact versions were also resolved before the matrix was committed.

## Artifact boundary

Each matrix member:

1. builds the deterministic `code-in-motion-0.1.0.zip`,
2. starts an isolated wp-env instance with no repository-mounted CiM plugin,
3. installs the ZIP through WP-CLI and activates it,
4. verifies the exact WordPress version and CiM 0.1.0 active state,
5. creates WordPress-backed diagnostic pages,
6. runs the R18 integration suite against the installed artifact,
7. tears down the isolated environment.

The matrix does not test repository-mounted production code.

## Integration suite

Each WordPress version runs four browser checks:

1. production mount and keyboard navigation,
2. three same-Experience instance isolation,
3. connected reparent plus permanent-removal lifecycle disposal,
4. installed-ZIP module-path verification.

The matrix therefore exercises the WordPress shortcode/rendering edge, enqueue path, installed artifact tree, browser module graph, command path, multi-instance behavior, and lifecycle binding.

## Evidence

Implementation head: `7aa36edc0be2e2b48c2b9c5f9df0f016e164ecb7`

WordPress Browser E2E run #64 completed successfully.

- 7 WordPress releases tested
- 4 browser checks per release
- 28/28 matrix browser checks passed
- Verify CiM contracts #248: PASS
- WordPress Playground PR Preview #77: PASS
- WordPress Floor QA #74: PASS
- WordPress Browser E2E #64: PASS

## Boundary

R18 establishes WordPress-version compatibility for the supported 6.5 through 7.1 lines using the exact release artifact and a fixed PHP 7.4 runtime.

R19 owns PHP floor/current compatibility. Browser-family coverage remains R20.
