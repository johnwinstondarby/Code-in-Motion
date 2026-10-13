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
const mutations = [
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
  ['open v2 production registration', 'tools/check-wordpress-experience-registry.mjs', "Object.freeze(['localis.cim/v1'])", "Object.freeze(['localis.cim/v1', 'localis.cim/v2'])", ['--test','tests/wordpress-experience-registry.test.mjs']]
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
for (const args of [hostArgs, browserArgs, ['--test','tests/wordpress-production-transport-composition.test.mjs','tests/wordpress-experience-registry.test.mjs']]) {
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
      name === 'leave partial Player active' ? 'admission failure' : 'atomic readiness';
    const result = await run(args === browserArgs ? [...args, '--grep', grep] : args);
    await writeFile(resolve(work, name.replaceAll(' ', '-') + '.log'), result.output);
    if (result.code === 0 || !/not ok|failed|✖/.test(result.output)) {
      throw new Error('Mutation was not caught by protected assertions: ' + name);
    }
    console.log('CAUGHT: ' + name);
  } finally { await writeFile(path, original); }
}
console.log('PASS: all 15 ADR 0049 guarded mutations were detected. Evidence: ' + work);
