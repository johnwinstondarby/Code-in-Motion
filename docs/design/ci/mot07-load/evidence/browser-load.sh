set -u
export PATH=/home/johnw/.cache/cim-motion-test/node-v22.23.2-linux-x64/bin:/usr/bin:/bin
export PLAYWRIGHT_BROWSERS_PATH=/home/johnw/.cache/cim-motion-test/browsers
export CIM_PLAYER_BROWSER=webkit CIM_MOTION_DIAGNOSTICS=1
cd /mnt/c/Users/johnw/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/Code-in-Motion
out=../../outputs/mot07-load
setsid taskset -c 0,1 node node_modules/@playwright/test/cli.js test tests/e2e/composition.spec.mjs --repeat-each=20 --workers=2 --reporter=line --output="$out/background-composition-results" > "$out/background-composition.log" 2>&1 & background=$!
trap 'kill -TERM -- "-$background" 2>/dev/null || true' EXIT
start=$(date -u +%FT%TZ)
taskset -c 0,1 node node_modules/@playwright/test/cli.js test tests/e2e/motion-pane.spec.mjs --grep MOT-07 --repeat-each=50 --workers=4 --reporter=line --output="$out/browser-load-results" > "$out/browser-load.log" 2>&1 & foreground=$!
{ printf 'Foreground pid affinity: '; taskset -pc "$foreground";printf 'Background pid affinity: ';taskset -pc "$background"; } > "$out/browser-load-affinity.txt"
wait "$foreground";status=$?
printf '{"configuration":"2 fixed CPUs, four MOT-07 workers, two background composition workers","cpus":"0,1","workers":4,"repeatEach":50,"planned":150,"started":"%s","finished":"%s","exit":%s}\n' "$start" "$(date -u +%FT%TZ)" "$status" > "$out/browser-load-run.json"
exit "$status"
