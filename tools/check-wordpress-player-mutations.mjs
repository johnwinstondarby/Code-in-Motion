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
const themeArgs = ['--test','tests/learner-themes.test.mjs'];
const engineArgs = ['--test','tests/engine-compatibility.test.mjs','tests/wordpress-live-host.test.mjs'];
const copyArgs = ['--test','tests/console-copy-binding.test.mjs','tests/player-cli-config.test.mjs','tests/frozen-authoring-v1.test.mjs'];
const limnArgs = ['--test','tests/console-line-limn.test.mjs'];
const mutations = [
  ['registration enqueues script','wordpress/code-in-motion.php','wp_register_script(','wp_enqueue_script(',['--test','tests/wordpress-asset-scope.test.mjs']],
  ['registration enqueues style','wordpress/code-in-motion.php','wp_register_style(','wp_enqueue_style(',['--test','tests/wordpress-asset-scope.test.mjs']],
  ['empty page imports Player modules','wordpress/assets/bootstrap.js',"  if (!document.querySelector('[data-cim-experience]')) return;",'  // empty-page guard removed',['--test','tests/wordpress-empty-page-bootstrap.test.mjs']],
  ['limn dim text loses flash contrast',css,'  color: var(--cim-console-text);\n}\n\n@keyframes','  color: var(--cim-console-quiet);\n}\n\n@keyframes',browserArgs],
  ['limn quiet tint loses dim contrast',css,'var(--cim-console-quiet) 12%','var(--cim-console-quiet) 18%',browserArgs],
  ['limn text hides cue band',css,'  background: transparent;\n}\n\n/* The renderer supplies','  background: var(--cim-console-background);\n}\n\n/* The renderer supplies',browserArgs],
  ['limn box overlaps text',css,'border-inline: 6px solid transparent','border-inline: 0 solid transparent',browserArgs],
  ['limn outline clips outside line',css,'outline-offset: -3px;','outline-offset: 1px;',browserArgs],
  ['limn initial background stays quiet',css,'var(--cim-limn) 24%','var(--cim-console-quiet) 12%',browserArgs],
  ['limn command target omitted','wordpress/assets/console-line-limn.mjs',"instruction.anchor === 'command'",'false',browserArgs],
  ['limn response target omitted','wordpress/assets/console-line-limn.mjs',"instruction.anchor === 'response'",'false',browserArgs],
  ['limn evidence target omitted','wordpress/assets/console-line-limn.mjs','evidence.has(node.getAttribute(\'data-output-id\'))','false',browserArgs],
  ['limn fade ends too early','wordpress/assets/console-line-limn.mjs','}, 1200);','}, 100);',browserArgs],
  ['limn ignores reduced motion','wordpress/assets/console-line-limn.mjs',"view.matchMedia('(prefers-reduced-motion: reduce)').matches ||","false ||",browserArgs],
  ['limn retains emphasis after navigation','wordpress/assets/console-line-limn.mjs','stepId !== activeStep','false',limnArgs],
  ['limn skips disposal cleanup','wordpress/assets/console-line-limn.mjs','dispose() { disposed = true; clear(); }','dispose() { disposed = true; }',browserArgs],
  ['mobile gate bypassed','wordpress/assets/bootstrap.js','if (window.matchMedia(mobileQuery).matches)', 'if (false)', ['--test','tests/wordpress-mobile-player-gate.test.mjs']],
  ['mobile notice misleading','wordpress/assets/bootstrap.js','Widen this window and reload, or open the lesson on a larger screen.', 'Open this lesson on a laptop.', ['--test','tests/wordpress-mobile-player-gate.test.mjs']],
  ['mobile late embeds ignored','wordpress/assets/bootstrap.js','new MutationObserver(showDesktopNotice).observe', 'new MutationObserver(() => {}).observe', ['--test','tests/wordpress-mobile-player-gate.test.mjs']],
  ['v2 related-lines label returns',player,"entryRoot.setAttribute('data-cim-commentary-evidence', JSON.stringify(instruction.evidence));","entryRoot.setAttribute('data-cim-commentary-evidence', JSON.stringify(instruction.evidence));\n        const label = element('span','data-cim-commentary-evidence-label'); label.textContent = 'Related output: 1 line'; entryRoot.appendChild(label);",browserArgs],
  ['copy badge reuses risk color',css,'  color: var(--cim-console-quiet);','  color: var(--cim-risk-free);',browserArgs],
  ['copy tall button edge',css,'  padding: 0 0.35rem;\n  font-size: 0.8em;','  padding: 0.2rem 0.5rem;\n  font-size: 1em;',browserArgs],
  ['copy frozen v1 altered','authoring/v1/validate-authoring.mjs',"presentation: ['layout', 'defaultPlaybackRate']","presentation: ['layout', 'defaultPlaybackRate', 'command_window']",copyArgs],
  ['copy CLI minimum underdeclared','authoring/v2/compile-authoring.mjs','engineMin = COMPILATION_CONSTANTS.cliEngineMin','engineMin = COMPILATION_CONSTANTS.engineMin',copyArgs],
  ['copy writes altered value','wordpress/assets/console-copy-binding.mjs','writeText(value)','writeText(value + " altered")',copyArgs],
  ['copy reports failed write as success','wordpress/assets/console-copy-binding.mjs','Could not copy. Select','Copied command. Select',copyArgs],
  ['copy ignores disposal','wordpress/assets/console-copy-binding.mjs','if (disposed || event.defaultPrevented)','if (event.defaultPrevented)',copyArgs],
  ['copy stale write overwrites newer result','wordpress/assets/console-copy-binding.mjs','token === request','true',copyArgs],
  ['copy retains listener','wordpress/assets/console-copy-binding.mjs',"viewport.removeEventListener('click', click);",'// listener retained',copyArgs],
  ['copy badge derives label from kind',player,'badge.textContent = content.commandWindow.cli.label;','badge.textContent = content.commandWindow.cli.kind;',browserArgs],
  ['copy badge derives kind from label',player,"element('div', 'data-cim-cli', content.commandWindow.cli.kind)","element('div', 'data-cim-cli', content.commandWindow.cli.label)",browserArgs],
  ['copy controls hidden',css,'  display: inline-block;','  display: none;',browserArgs],
  ['v2 bypass loader admission', 'src/host/wordpress-browser-bindings.mjs', 'assertWordPressExperienceAdmission(experience);', 'void experience;', engineArgs],
  ['v2 bypass registry admission', 'tools/check-wordpress-experience-registry.mjs', 'assertWordPressExperienceAdmission(experience);', 'void experience;', ['--test','tests/wordpress-experience-registry.test.mjs']],
  ['v2 ignore engine minimum', 'src/experience/engine-compatibility.mjs', 'compareEngineVersions(ENGINE_IDENTITY.version, experience.engine_min) < 0', 'false', engineArgs],
  ['v2 admit unsupported Player mode', 'src/host/wordpress-admission-policy.mjs', '!WORDPRESS_V2_RENDERERS.includes(experience.renderer)', 'false', engineArgs],
  ['v2 drop instruction metadata', 'src/host/player-content.mjs', "experience.schema === 'localis.cim/v2' ?", 'false ?', engineArgs],
  ['v2 drop evidence relationship', 'src/host/player-content.mjs', '...(step.commentary.evidence ?? [])', '', engineArgs],
  ['v2 drop risk guidance', 'src/host/player-content.mjs', 'guidance:step.commentary.risk.guidance ?? null', 'guidance:null', engineArgs],
  ['v2 hide anchor phase', player, 'if (instruction?.anchor)', 'if (false)', browserArgs],
  ['v2 hide risk label', player, "label.textContent = {'free-to-undo':'FREE TO UNDO','leaves-a-trace':'LEAVES A TRACE','cannot-be-undone':'CANNOT BE UNDONE'}[instruction.risk.level];", "label.textContent = 'Risk';", browserArgs],
  ['v2 bypass hash beat normalization', 'wordpress/assets/bootstrap-module.mjs', 'commandPort.seek(resolution.stepId, COMMAND_SOURCE.DEEP_LINK)', 'commandPort.seek(target.stepId, COMMAND_SOURCE.DEEP_LINK)', browserArgs],
  ['theme drop light role', 'wordpress/assets/theme-presets.mjs', "'console-text': '#1A4B8C',", '', themeArgs],
  ['theme break persistence', 'wordpress/assets/theme-binding.mjs', 'view.localStorage.setItem(LEARNER_THEME_STORAGE_KEY, theme);', 'void theme;', themeArgs],
  ['theme discard in-memory choice', 'wordpress/assets/theme-binding.mjs', 'explicit = theme;', 'explicit = null;', themeArgs],
  ['theme device overrides explicit choice', 'wordpress/assets/theme-presets.mjs', 'if (isThemeId(explicit)) return explicit;', 'if (false) return explicit;', themeArgs],
  ['theme skip select withdrawal', 'wordpress/assets/theme-binding.mjs', "select.removeEventListener('change', change);", 'void change;', themeArgs],
  ['theme skip media withdrawal', 'wordpress/assets/theme-binding.mjs', "query.removeEventListener('change', listener)", 'void listener', themeArgs],
  ['theme omit sibling publication', 'wordpress/assets/theme-binding.mjs', 'of subscribers)', 'of [...subscribers].slice(0, 1))', themeArgs],
  ['theme retain stale device values', 'wordpress/assets/theme-binding.mjs', "contrast: media('(prefers-contrast: more)').matches,", 'contrast: contrast.matches,', themeArgs],
  ['theme show menu under forced colors', 'wordpress/assets/theme-binding.mjs', 'label.hidden = snapshot.forcedColors;', 'label.hidden = false;', browserArgs],
  ["skip unfinished beat", "src/core/boundary-model.mjs", "(advance ? 1 : 0)", "1", beatArgs],
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
  ['close v2 production registration', 'tools/check-wordpress-experience-registry.mjs', "Object.freeze(['localis.cim/v1', 'localis.cim/v2'])", "Object.freeze(['localis.cim/v1'])", ['--test','tests/wordpress-experience-registry.test.mjs']],
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
for (const args of [limnArgs, copyArgs, engineArgs, themeArgs, beatArgs, hostArgs, browserArgs, ['--test','tests/wordpress-production-transport-composition.test.mjs','tests/wordpress-experience-registry.test.mjs']]) {
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
    const focusedGrep = name.startsWith('limn ') ? 'line limn' : name.startsWith('copy ') ? 'CLI and copy|Copy button edge' : name.startsWith('v2 ') ? 'production v2|instructional consumers' : name.startsWith('theme ') ? 'learner themes' : name === 'progress follows reveal frontier' ? 'authored beat headings' :
      ['markers select first segment','markers trust mutable DOM identity'].includes(name) ? 'beat markers capture' :
      name === 'focus scrolling claims ownership' ? 'offscreen link focus' :
      name === 'ignore native wheel intent' ? 'Console scroll ownership' :
      name === 'expose transcript behind pinned title' ? 'pinned Console title' :
      name === 'selection holds peer pane' ? 'selection holds only' :
      name === 'ignore initial pointer presence' ? 'pointer already present' : grep;
    const result = await run(args === browserArgs ? [...args, '--grep', focusedGrep] : args);
    await writeFile(resolve(work, name.replaceAll(' ', '-') + '.log'), result.output);
    if (result.code === 0 || !/not ok|failed|\u2716/.test(result.output)) {
      throw new Error('Mutation was not caught by protected assertions: ' + name);
    }
    console.log('CAUGHT: ' + name);
  } finally { await writeFile(path, original); }
}
console.log('PASS: all ' + mutations.length + ' Player guarded mutations were detected. Evidence: ' + work);
