set -u
export PATH=/home/johnw/.cache/cim-motion-test/node-v22.23.2-linux-x64/bin:/usr/bin:/bin
export PLAYWRIGHT_BROWSERS_PATH=/home/johnw/.cache/cim-motion-test/browsers
export CIM_PLAYER_BROWSER=webkit CIM_MOTION_DIAGNOSTICS=1
cd /mnt/c/Users/johnw/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/Code-in-Motion
out=../../outputs/mot07-load
(taskset -c 0,1 node -e 'while(true){Math.sqrt(Math.random());}') & burn=$!
trap 'kill "$burn" 2>/dev/null || true' EXIT
printf 'CPU configuration: '; taskset -pc $$
printf 'Background burner: '; taskset -pc "$burn"
lscpu | head -20
start=$(date -u +%FT%TZ)
taskset -c 0,1 node node_modules/@playwright/test/cli.js test tests/e2e/motion-pane.spec.mjs --grep MOT-07 --repeat-each=50 --workers=4 --reporter=line --output="$out/cpu-load-results" > "$out/cpu-load.log" 2>&1
status=$?
printf '{"configuration":"2 fixed CPUs, four Playwright workers, one CPU burner","cpus":"0,1","workers":4,"repeatEach":50,"planned":150,"started":"%s","finished":"%s","exit":%s}\n' "$start" "$(date -u +%FT%TZ)" "$status" > "$out/cpu-load-run.json"
exit "$status"
