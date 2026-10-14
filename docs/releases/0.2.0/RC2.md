# RC#2: plugin 0.2.0

Base: main `87e872c356806b723213492050f96b4a5db38239`, tree `afb4d5bd5b5596cc7493ecbab8ae0ea3e0542b0c`.

Status: Candidate for Daisy's exact-head review. Merge and tag remain on hold. Live installation and the page 3227 shortcode switch are separate operations.

## Scope

The Console-Explanation Player now includes beat navigation, independent pane following, learner themes, native command Copy and neutral authored CLI badges. The v2 Git lesson is admitted through the complete Console Player. This candidate removes related-output/response line-count wording while retaining evidence IDs, Show in Console focus, phase labels and risk guidance. A mutation guard rejects restoration of the label.

Plugin/package/header/stable-tag/implementation versions and generated release info are 0.2.0. Engine capability remains `localis.cim/engine@1.0.1`. Frozen authoring/v1 is unchanged; authoring/v2 is frozen, and limn is reserved for authoring/v3.

## Exact artifacts and upgrade origin

Build twice with pinned Node 22.23.2 from a clean committed candidate. Preserve the exact ZIP and its SHA-256. Protected CI installs that checksummed file, preserves it as `rc2-installed-zip`, and exercises the v2 Player on it. The delivery ZIP must compare byte-for-byte with that CI artifact before review readiness is reported.

Candidate ZIP SHA-256: `03c2d6cf273109b37df147a54a530efb86799630ed25e85d01750e1c291344a2` (84 staged files). Local pinned builds reproduced identical bytes twice. The final candidate build and preserved installed-ZIP CI artifact must retain this checksum.

Upgrade tests explicitly start at the RC#1 0.1.10 release commit `57499893fec330769baef8d514a41a38a0b17e02`, skip intervening 0.1.11 development heads, and land on 0.2.0. The live site's installed plugin and release metadata were read-only verified as 0.1.10. The reconstructed RC#1 ZIP has SHA-256 `1ffc7d6bded21262b00fbd18163b5cb7d68d7cc3658981a0a649a8aaddeb93c1`. It is built from the official RC#1 commit, never from later 0.1.10 development work. Full byte identity with an original server-side archive is not claimed.

The delivery record accompanies the release with candidate head/tree, both archive checksums, page snapshot checksum, CI links and timed rollback evidence. Private operational captures live in the delivered rollback kit, not the plugin ZIP.

The captured raw page is 352,642 UTF-8 bytes, SHA-256 `bca1b063091e6b6da04cfcea00c3ba9bafd91310383949914cf951b4cbc4c296`. Its metadata and exact content are preserved separately; the content file is regenerated from the captured raw JSON value to avoid extra newlines.

## Rollback kit and procedure

The read-only authenticated snapshot captured page 3227 on 2026-10-13 (Los Angeles), with last modification `2026-09-19T03:34:05Z`. The current shortcode is `[cim experience="git-basic-cycle"]`. The full raw content and REST metadata are retained; no live write was made.

Before cutover:

1. Verify the delivered kit checksums and refresh/compare the live content with the snapshot. If it changed, capture again before installation.
2. Pre-stage the rollback ZIP, raw content, checksum file, PHP restore helper and rollback script on the host, outside public web access. Confirm real WP-CLI/server access and open the current page in a browser. Uploading or logging in is preparation, outside the recovery timer.
3. Record the host-specific WordPress root and kit paths. Keep the old ZIP locally too. Do not rely on downloading an expiring GitHub artifact during recovery.

Recovery, target under 60 seconds:

1. Run `bash rollback.sh /absolute/kit/path /absolute/wordpress/root`.
2. The script verifies kit checksums, reinstalls/activates 0.1.10, restores the complete captured page content through `wp_update_post`, verifies byte identity and version, and flushes object cache. It does not uninstall the plugin or delete settings.
3. Reload page 3227 and confirm the old Git Player and old shortcode. Purge any separate page/CDN cache through the site's normal cache control if needed.

Protected CI rehearses plugin downgrade plus exact raw page restoration and requires the timed operation to finish within 60 seconds, then checks restored prior modules and shortcode in a browser. This demonstrates the prepared procedure in isolated WordPress. Actual live host timing and any page/CDN-cache purge must be confirmed before cutover; no live rollback has been executed during candidate preparation.

## Known items shipping as-is

- Wrap continuation collision: the existing expected-failure browser case remains.
- Authored limn is not built; its authoring schema is reserved as v3.
- White remains shared between the keyboard pane focus ring and the future limn.
- Copy buttons are compact. Verify their usability on an actual phone after installation.
- Confirm Catamaran and IBM Plex fonts on the live page after installation.

## Review gates

Full verification, Player browsers and mutation guards, release reproducibility, exact installed ZIP and 0.1.10 upgrade/rollback proofs, and all four protected workflows must pass on the candidate head. Daisy reviews that head before any merge or tag. No candidate preparation authorizes the later live installation or shortcode switch.
