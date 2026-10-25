set -eu
export PATH=/home/johnw/.cache/cim-motion-test/node-v22.23.2-linux-x64/bin:/usr/bin:/bin
export PLAYWRIGHT_BROWSERS_PATH=/home/johnw/.cache/cim-motion-test/browsers
cd /mnt/c/Users/johnw/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/motion-final-seek
for browser in chromium firefox webkit; do
 export CIM_PLAYER_BROWSER=$browser
 node node_modules/@playwright/test/cli.js test tests/e2e/multipane-transport.spec.mjs tests/e2e/engineering-pane.spec.mjs tests/e2e/motion-pane.spec.mjs tests/e2e/composition.spec.mjs tests/e2e/diagram-capacity.spec.mjs tests/e2e/pack-v3-preview.spec.mjs --workers=1 --reporter=line --output=../seek108-final-browser-results/$browser > ../seek108-final-browser-$browser.log 2>&1
done

bash ../seek108-load-comparison.sh
