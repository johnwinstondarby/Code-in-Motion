#!/usr/bin/env bash
set -euo pipefail
kit=$(realpath "${1:?Pass the pre-staged rollback kit directory}")
wp_root=$(realpath "${2:?Pass the WordPress root directory}")
(cd "$kit" && sha256sum --check checksums.sha256)
cd "$wp_root"
rollback_started=$(date +%s)
wp plugin install "$kit/code-in-motion-0.1.10.zip" --force --activate
wp eval-file "$kit/restore-page.php" "$kit/page-3227-content-before.html" 3227
test "$(wp plugin get code-in-motion --field=version)" = "0.1.10"
wp cache flush
rollback_seconds=$(( $(date +%s) - rollback_started ))
printf 'Rollback complete: %s seconds. Confirm page 3227 and the old Git Player in the browser.\n' "$rollback_seconds"
test "$rollback_seconds" -lt 60
