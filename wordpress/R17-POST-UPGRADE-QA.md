# R17 Post-Upgrade Diagnostic Mount

R17 proves that an existing WordPress page created before the N → N+1 plugin upgrade continues to execute the diagnostic Code in Motion Experience after the upgrade.

## Acceptance

The existing page must:

- mount the `synthetic-wordpress` Experience from the installed N+1 artifact,
- enter `data-cim-state="ready"`,
- render node A,
- accept learner navigation from A to B through the production Transport path,
- dispose the mounted root after permanent DOM removal,
- project `data-cim-state="fallback"` after disposal,
- remove the command focus surface by clearing `tabindex`.

## Authoritative path

R17 extends the R16 `upgrade-e2e` experiment rather than creating a second upgrade topology.

1. The page `cim-e2e-r16` is created while synthetic N `0.0.9` is installed and active.
2. Chromium loads the page under N.
3. WordPress upgrades the active plugin in place to the unchanged N+1 `0.1.0` release ZIP without an explicit activation command.
4. The same persisted WordPress page is loaded after the upgrade from the installed N+1 artifact.
5. The diagnostic Experience mounts at node A.
6. `ArrowRight` navigates the Experience to step `step-01`, node B.
7. The mounted root is permanently removed from the DOM.
8. The lifecycle binding disposes that root, projects fallback state, and removes `tabindex`.

The R17 assertions execute inside `tests/e2e/wordpress-upgrade.spec.mjs`, immediately after the R16 asset-generation isolation assertions. This preserves one authoritative upgrade path and proves the post-upgrade behavior against the same installed artifact and persisted page.

## Scope boundary

R17 proves post-upgrade mount, navigation, and disposal on the WordPress/PHP floor already used by the authoritative upgrade environment. WordPress-version compatibility expansion belongs to R18. PHP-version matrix work belongs to R19.
