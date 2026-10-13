import { cp, mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const workArg = process.argv.find(arg => arg.startsWith('--work-directory='));
const work = resolve(workArg?.slice('--work-directory='.length) ?? resolve(ROOT, '..', 'player-mutations'));
await mkdir(work, { recursive: true });
const sandbox = await mkdtemp(resolve(work, 'candidate-'));
await cp(ROOT, sandbox, { recursive: true, filter: path =>
  !['.git', 'node_modules', 'dist', 'test-results', 'work'].includes(basename(path)) });
await symlink(resolve(ROOT, 'node_modules'), resolve(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

const host = 'src/host/wordpress-live-host.mjs';
const player = 'wordpress/assets/player-binding.mjs';
const transport = 'wordpress/assets/transport-binding.mjs';
const css = 'wordpress/assets/cim.css';
const browserArgs = [resolve(ROOT, 'node_modules/@playwright/test/cli.js'), 'test',
  'tests/e2e/wordpress-player-mvp.spec.mjs', '--reporter=line', '--timeout=10000', '--output=' + resolve(work, 'browser-results')];
const hostArgs = ['--test', 'tests/wordpress-live-host.test.mjs'];
const beatArgs = ['--test','tests/beat-consumers.test.mjs','tests/wordpress-beat-binding.test.mjs'];
const mutations = [
  ["disable manual beat navigation", "src/core/boundary-model.mjs", "if (beatFinalIndices !== null) {", "if (false) {", beatArgs],
  ["deep link selects first segment", "src/host/wordpress-deep-link.mjs", "?.finalStepId", "?.boundaryIds[0]", beatArgs],
  ["progress follows reveal frontier", "wordpress/assets/beat-binding.mjs", "beatByBoundary.get(canonical.currentStepId)", "beatByBoundary.get(canonical.revealFrontier)", browserArgs],
  ["markers select first segment", "wordpress/assets/beat-binding.mjs", "seek(beat.finalStepId,'marker')", "seek(beat.boundaryIds[0],'marker')", browserArgs],
  ["markers trust mutable DOM identity", "wordpress/assets/beat-binding.mjs", "seek(beat.finalStepId,'marker')", "seek(button.getAttribute('data-cim-beat-marker'),'marker')", browserArgs],
  ["skip beat listener withdrawal", "wordpress/assets/beat-binding.mjs", "button.removeEventListener('click',listener);", "// listener retained", beatArgs],

  ['remove Player mapping', player, "{ 'console/v1': 'console-explanation' }", '{}', browserArgs],
  ['route Console through legacy', player, "return Object.hasOwn(WORDPRESS_PLAYER_MODES, rendererId)", 'return false', browserArgs],
  ['expose legacy Restart', transport, "  'next',\n  'end'\n]);", "  'next',\n  'end',\n  'restart'\n]);", ['--test','tests/wordpress-production-transport-composition.test.mjs']],
  ['hide Console Restart', transport, "...WORDPRESS_TRANSPORT_VISIBLE_CONTROL_ORDER, 'restart'", '...WORDPRESS_TRANSPORT_VISIBLE_CONTROL_ORDER', browserArgs],
  ['remove Commentary provenance', player, 'navigation.seek(stepId)', "commandPort.seek(stepId, 'transport')", browserArgs],
  ['skip Commentary disposal', player, 'disposers.push(() => native.dispose());', '// native disposal removed', browserArgs],
  ['leave partial Player active', player, "if (player?.parentNode) attempt(() => player.parentNode.removeChild(player));", '// Player DOM removal omitted', browserArgs],
  ['project ready during mount', host, "stage = 'player_content_projection';", "stage = 'player_content_projection';\n      projectState(root, 'ready');", hostArgs],
  ['admit after disposal', host, null, null, hostArgs],
  ['retain Player content during disposal', host, 'playerContents.delete(record.root);', '// projection retained', hostArgs],
  ['shift Commentary boundaries', 'src/host/player-content.mjs', 'stepId: step.id,', "stepId: step.id + '-shifted',", hostArgs],
  ['remove renderer withholding', css, '.cim:not([data-cim-state="ready"]) [data-cim-renderer-root],', '.cim:not([data-cim-state="ready"]) [data-cim-missing-renderer],', browserArgs],
  ['remove Player withholding', css, '.cim:not([data-cim-state="ready"]) [data-cim-player],', '.cim:not([data-cim-state="ready"]) [data-cim-missing-player],', browserArgs],
  ['remove Transport withholding', css, '.cim:not([data-cim-state="ready"]) [data-cim-transport-controls] {', '.cim:not([data-cim-state="ready"]) [data-cim-missing-transport] {', browserArgs],
  ['open v2 production registration', 'tools/check-wordpress-experience-registry.mjs', "Object.freeze(['localis.cim/v1'])", "Object.freeze(['localis.cim/v1', 'localis.cim/v2'])", ['--test','tests/wordpress-experience-registry.test.mjs']],
  ['skip Console follow refresh', player, 'consoleScroll.refresh();', '// Console refresh omitted', browserArgs],
  ['remove pointer hold', 'wordpress/assets/pane-hold-binding.mjs', "() => set('pointer', true)", '() => {}', browserArgs],
  ['remove focus hold', 'wordpress/assets/pane-hold-binding.mjs', "() => set('focus', true)", '() => {}', browserArgs],
  ['remove selection hold', 'wordpress/assets/pane-hold-binding.mjs', "() => set('selection', selectionHeld())", '() => {}', browserArgs],
  ['scroll while held', 'src/commentary/scroll-binding.mjs', 'state.following && !state.held &&', 'state.following &&', browserArgs],
  ['release Commentary hold resumes ownership', 'src/commentary/follow-controller.mjs', 'holds.delete(reason);', 'holds.delete(reason); following = true;', ['--test','tests/commentary-follow-policy.test.mjs']],
  ['release Console hold resumes ownership', 'wordpress/assets/console-follow-controller.mjs', 'holds.delete(reason);', 'holds.delete(reason); following = true;', browserArgs],
  ['skip pane hold listener withdrawal', 'wordpress/assets/pane-hold-binding.mjs', 'target.removeEventListener(type, listener);', '// listener retained', ['--test','tests/pane-hold-binding.test.mjs']],
  ['skip renderer observer disposal', player, 'disposers.push(() => observer.disconnect());', '// observer retained', browserArgs],
  ['skip deliberate viewport navigation', player, 'scroll.reposition(top);', '// deliberate navigation omitted', browserArgs],
  ['focus scrolling claims ownership', 'src/commentary/scroll-binding.mjs', 'const learnerScrolling = scrollIntent.read();', 'const learnerScrolling = true;', browserArgs],
  ['ignore native wheel intent', 'wordpress/assets/pane-scroll-intent.mjs', "[viewport, 'wheel', mark]", "[viewport, 'wheel', () => {}]", browserArgs],
  ['skip scroll intent listener withdrawal', 'wordpress/assets/pane-scroll-intent.mjs', 'target.removeEventListener(type, listener);', '// listener retained', ['--test','tests/pane-hold-binding.test.mjs']],
  ['expose transcript behind pinned title', css, '  margin-bottom: 0;\n  padding-bottom: 1rem;', '  margin-bottom: 1rem;\n  padding-bottom: 0;', browserArgs],
  ['selection holds peer pane', 'wordpress/assets/pane-hold-binding.mjs', 'selection.getRangeAt(index).intersectsNode(pane)', 'true', browserArgs],
  ['ignore initial pointer presence', 'wordpress/assets/pane-hold-binding.mjs', "if (pane.matches(':hover')) follow.hold('pointer');", '// initial pointer ignored', browserArgs]
];

async function run(args) {
  return await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd: sandbox, stdio: ['ignore','pipe','pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => done({ code, output }));
  });
}

// A failing baseline must never count as successful mutation detection.
for (const args of [beatArgs, hostArgs, browserArgs, ['--test','tests/wordpress-production-transport-composition.test.mjs','tests/wordpress-experience-registry.test.mjs']]) {
  const result = await run(args);
  if (result.code !== 0) throw new Error('Mutation baseline failed:\n' + result.output);
}
for (const [name, file, from, to, args] of mutations) {
  const path = resolve(sandbox, file);
  const original = await readFile(path, 'utf8');
  let changed = original.replace(/\r\n/g, '\n');
  if (name === 'admit after disposal') {
    changed = changed.replace("if (isDisposing() || !commandPorts.has(root) || rootDisposePromises.has(root) ||\n        root.isConnected === false) return false;", '// disposed roots admitted');
    changed = changed.replace('if (isDisposing() || !commandPorts.has(root) || rootDisposePromises.has(root)) {', 'if (false) {');
  } else {
    if (!changed.includes(from)) throw new Error('Mutation target missing: ' + name);
    changed = changed.replace(from, to);
  }
  try {
    await writeFile(path, changed);
    const grep = name === 'remove Commentary provenance' ? 'reveal, Commentary' :
      name === 'skip Commentary disposal' ? 'root teardown' :
      name === 'leave partial Player active' ? 'admission failure' :
      name === 'skip Console follow refresh' ? 'pane follow survives' :
      ['remove pointer hold','remove focus hold','remove selection hold','scroll while held'].includes(name) ? 'Console pointer focus' :
      name === 'release Console hold resumes ownership' ? 'Console scroll ownership' :
      name === 'skip renderer observer disposal' ? 'root teardown' :
      name === 'skip deliberate viewport navigation' ? 'deliberate navigation repositions' : 'atomic readiness';
    const focusedGrep = name === 'progress follows reveal frontier' ? 'authored beat headings' :
      ['markers select first segment','markers trust mutable DOM identity'].includes(name) ? 'beat markers capture' :
      name === 'focus scrolling claims ownership' ? 'offscreen link focus' :
      name === 'ignore native wheel intent' ? 'Console scroll ownership' :
      name === 'expose transcript behind pinned title' ? 'pinned Console title' :
      name === 'selection holds peer pane' ? 'selection holds only' :
      name === 'ignore initial pointer presence' ? 'pointer already present' : grep;
    const result = await run(args === browserArgs ? [...args, '--grep', focusedGrep] : args);
    await writeFile(resolve(work, name.replaceAll(' ', '-') + '.log'), result.output);
    if (result.code === 0 || !/not ok|failed|✖/.test(result.output)) {
      throw new Error('Mutation was not caught by protected assertions: ' + name);
    }
    console.log('CAUGHT: ' + name);
  } finally { await writeFile(path, original); }
}
console.log('PASS: all ' + mutations.length + ' Player guarded mutations were detected. Evidence: ' + work);
