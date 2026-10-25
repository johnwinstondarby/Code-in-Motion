set -u
export PATH=/home/johnw/.cache/cim-motion-test/node-v22.23.2-linux-x64/bin:/usr/bin:/bin
export PLAYWRIGHT_BROWSERS_PATH=/home/johnw/.cache/cim-motion-test/browsers CIM_PLAYER_BROWSER=webkit CIM_MOTION_DIAGNOSTICS=1
workspace=/mnt/c/Users/johnw/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs
for variant in control fixed; do
 if [ "$variant" = control ]; then repo=seek108-control; else repo=motion-final-seek; fi
 cd "$workspace/$repo"
 out="$workspace/seek108-load-$variant"
 mkdir -p "$out"
 { git rev-parse HEAD; node --version; node -p "require('@playwright/test/package.json').version"; lscpu | head -20; git status --short; } > "$out/environment.txt"
 setsid taskset -c 0,1 node node_modules/@playwright/test/cli.js test tests/e2e/composition.spec.mjs --repeat-each=20 --workers=2 --retries=0 --reporter=line --output="$out/background-results" > "$out/background.log" 2>&1 & background=$!
 trap 'kill -TERM -- "-$background" 2>/dev/null || true' EXIT
 start=$(date -u +%FT%TZ)
 PLAYWRIGHT_JSON_OUTPUT_NAME="$out/report.json" taskset -c 0,1 node node_modules/@playwright/test/cli.js test tests/e2e/motion-pane.spec.mjs --grep MOT-07 --repeat-each=50 --workers=4 --retries=0 --reporter=line,json --output="$out/results" > "$out/foreground.log" 2>&1 & foreground=$!
 { printf 'Foreground affinity: '; taskset -pc "$foreground"; printf 'Background affinity: '; taskset -pc "$background"; } > "$out/affinity.txt"
 wait "$foreground"; status=$?
 kill -TERM -- "-$background" 2>/dev/null || true
 wait "$background"; background_status=$?
 trap - EXIT
 printf '{"variant":"%s","configuration":"two fixed CPUs, four MOT-07 workers, two composition workers","cpus":"0,1","workers":4,"repeatEach":50,"planned":150,"started":"%s","finished":"%s","exit":%s,"backgroundExit":%s,"backgroundIsLoadOnly":true}
' "$variant" "$start" "$(date -u +%FT%TZ)" "$status" "$background_status" > "$out/run.json"
done
