# R20 Browser-Family QA

## Scope

R20 proves the Code in Motion 0.1.0 release artifact across the three browser engines required by the release plan while holding the WordPress and PHP axes constant.

Fixed environment:

- WordPress 7.1.1
- PHP 8.5
- CiM 0.1.0
- Playwright 1.63.0
- exact deterministic release ZIP installed through WordPress

Browser-family matrix:

| Browser family | Engine version observed in CI | Result |
| --- | --- | --- |
| Chromium | 153.0.8010.12 | PASS |
| Firefox | 155.0 | PASS |
| WebKit | 26.6 | PASS |

## Artifact boundary

Each browser-family job:

1. builds the deterministic `code-in-motion-0.1.0.zip`,
2. starts an isolated WordPress 7.1.1 / PHP 8.5 environment with no repository-mounted CiM plugin,
3. installs and activates the release ZIP,
4. creates the WordPress-backed diagnostic pages,
5. installs only the selected Playwright browser engine,
6. runs the same R20 smoke specification against the installed artifact,
7. tears down the isolated environment.

## Smoke contract

Each browser runs five checks:

1. **Mount and navigation**
   - the installed artifact mounts `synthetic-wordpress`,
   - initial node A is visible,
   - keyboard navigation reaches node B,
   - module requests come from the version-bearing installed plugin tree.

2. **Multiple instances**
   - three same-Experience roots mount independently,
   - navigating the middle instance leaves its siblings unchanged.

3. **Fallback**
   - the Experience delivery path is intentionally failed,
   - the root projects fallback,
   - static fallback content remains visible,
   - no renderer output remains.

4. **Reduced motion**
   - `prefers-reduced-motion: reduce` is active,
   - animation-frame scheduling is forbidden during the A-to-B transition,
   - navigation still succeeds,
   - the browser surface remains free of request, console, and page errors.

5. **Teardown**
   - a mounted root is permanently removed,
   - lifecycle disposal projects fallback,
   - the root loses `tabindex` and therefore its command focus surface.

## Evidence

Implementation head: `22439c786180baaafa8de7c55d8cb0db150bdac2`

WordPress Browser E2E run #70 completed successfully.

Observed browser evidence:

- Chromium 153.0.8010.12: 5/5 PASS
- Firefox 155.0: 5/5 PASS
- WebKit 26.6: 5/5 PASS

Total R20 result: **15/15 browser-family smoke tests passed.**

Implementation-head workflows:

- Verify CiM contracts #255: PASS
- WordPress Playground PR Preview #83: PASS
- WordPress Floor QA #80: PASS
- WordPress Browser E2E #70: PASS

## Boundary

R20 establishes browser-family coverage for the installed release artifact.

R21 owns WordPress Plugin Check. R22 owns release metadata and license declaration.
