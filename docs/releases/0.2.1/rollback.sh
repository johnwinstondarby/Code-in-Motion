#!/usr/bin/env bash
set -euo pipefail
kit=$(realpath "${1:?Pass the pre-staged rollback kit directory}")
wp_root=$(realpath "${2:?Pass the WordPress root directory}")
wp_user=${3:?Pass the authorized WordPress editor login with unfiltered_html}
(cd "$kit" && sha256sum --check checksums.sha256)
cd "$wp_root"
wp --user="$wp_user" eval-file "$kit/restore-page.php" "$kit/page-3227-content-before.html" 3227 check
rollback_started=$(date +%s)
wp plugin install "$kit/code-in-motion-0.2.0.zip" --force --activate
wp --user="$wp_user" eval-file "$kit/restore-page.php" "$kit/page-3227-content-before.html" 3227
test "$(wp plugin get code-in-motion --field=version)" = "0.2.0"
wp cache flush
rollback_seconds=$(( $(date +%s) - rollback_started ))
printf 'Restored plugin 0.2.0 and exact page: %s seconds. Clear WordPress.com edge cache and verify page 3227; these are part of the live recovery time.\n' "$rollback_seconds"
