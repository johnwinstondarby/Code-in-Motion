import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ENTRY_PATH = resolve(ROOT, 'code-in-motion.php');
const WORDPRESS_DIR = resolve(ROOT, 'wordpress');
const IMPLEMENTATION_ENTRY_PATH = resolve(WORDPRESS_DIR, 'code-in-motion.php');
const ADMIN_CONSOLE_PATH = resolve(WORDPRESS_DIR, 'admin-console.php');
const WP_ENV_PATH = resolve(ROOT, '.wp-env.json');
const PACKAGE_PATH = resolve(ROOT, 'package.json');
const PLAYGROUND_BLUEPRINT_PATH = resolve(WORDPRESS_DIR, 'playground', 'blueprint.json');
const PLAYGROUND_PREVIEW_WORKFLOW_PATH = resolve(ROOT, '.github', 'workflows', 'playground-preview.yml');
const REQUIRED_EXTERNAL_ASSETS = Object.freeze([
  resolve(WORDPRESS_DIR, 'assets', 'bootstrap.js'),
  resolve(WORDPRESS_DIR, 'assets', 'bootstrap-module.mjs'),
  resolve(WORDPRESS_DIR, 'assets', 'root-lifecycle-binding.mjs'),
  resolve(WORDPRESS_DIR, 'assets', 'cim.css')
]);

const WORDPRESS_FLOOR_CORE = 'WordPress/WordPress#6.5.10';
const WORDPRESS_FLOOR_PHP = '7.4';
const WP_ENV_TOOL_VERSION = '11.15.0';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function assertContains(source, token, label) {
  if (!source.includes(token)) throw new Error(`WordPress packaging gate: missing ${label}.`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`WordPress packaging gate: ${label} must be ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`);
  }
}

function assertArrayEqual(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`WordPress packaging gate: ${label} must be ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`);
  }
}

async function verifyEnvironmentBaseline() {
  const wpEnv = JSON.parse(await readFile(WP_ENV_PATH, 'utf8'));
  assertEqual(wpEnv.core, WORDPRESS_FLOOR_CORE, 'wp-env WordPress floor');
  assertEqual(wpEnv.phpVersion, WORDPRESS_FLOOR_PHP, 'wp-env PHP floor');
  assertArrayEqual(wpEnv.plugins, ['.'], 'wp-env plugin mount');

  const packageJson = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));
  assertEqual(
    packageJson.devDependencies?.['@wordpress/env'],
    WP_ENV_TOOL_VERSION,
    'pinned @wordpress/env devDependency'
  );
  assertEqual(packageJson.scripts?.['wp-env'], 'wp-env', 'locked wp-env script');
}

async function verifyPlaygroundBaseline() {
  const blueprint = JSON.parse(await readFile(PLAYGROUND_BLUEPRINT_PATH, 'utf8'));
  assertEqual(blueprint.preferredVersions?.wp, '6.5', 'Playground WordPress version');
  assertEqual(blueprint.preferredVersions?.php, '7.4', 'Playground PHP version');
  assertEqual(blueprint.landingPage, '/?pagename=cim-diagnostic', 'Playground landing page');

  const steps = Array.isArray(blueprint.steps) ? blueprint.steps : [];
  const install = steps.find((step) => step?.step === 'installPlugin' && step.pluginData?.resource === 'git:directory');
  if (!install) throw new Error('WordPress packaging gate: Playground Blueprint must install CiM through git:directory.');
  assertEqual(install.pluginData.path, '/', 'Playground repository plugin path');
  assertEqual(install.options?.activate, true, 'Playground plugin activation');
  if (!steps.some((step) => step?.step === 'runPHP' && typeof step.code === 'string' && step.code.includes('cim-diagnostic'))) {
    throw new Error('WordPress packaging gate: Playground Blueprint must create the CiM diagnostic page.');
  }

  const workflow = await readFile(PLAYGROUND_PREVIEW_WORKFLOW_PATH, 'utf8');
  assertContains(workflow, 'WordPress/action-wp-playground-pr-preview@v3', 'Playground PR Preview v3 action');
  assertContains(workflow, 'github.event.pull_request.head.ref', 'exact PR head ref in Playground preview');
  assertContains(workflow, 'pull-requests: write', 'PR preview write permission');
  if (workflow.includes('pull_request_target')) {
    throw new Error('WordPress packaging gate: Playground preview must not use pull_request_target.');
  }
}

async function run() {
  const rootEntry = await readFile(ROOT_ENTRY_PATH, 'utf8');
  assertContains(rootEntry, 'Plugin Name: Code in Motion', 'repository-root plugin header');
  assertContains(rootEntry, 'Requires at least: 6.5', 'WordPress support floor header');
  assertContains(rootEntry, 'Requires PHP: 7.4', 'PHP support floor header');
  assertContains(rootEntry, "require_once __DIR__ . '/wordpress/code-in-motion.php';", 'repository-root implementation delegation');

  const entry = await readFile(IMPLEMENTATION_ENTRY_PATH, 'utf8');
  assertContains(entry, 'wp_enqueue_script(', 'wp_enqueue_script() external JavaScript registration');
  assertContains(entry, 'wp_enqueue_style(', 'wp_enqueue_style() external CSS registration');
  assertContains(entry, "add_shortcode( 'cim'", 'cim shortcode registration');
  assertContains(entry, 'data-cim-experience', 'canonical Experience attribute');
  assertContains(entry, 'data-cim-renderer-root', 'canonical renderer-root attribute');
  assertContains(entry, "require_once __DIR__ . '/admin-console.php';", 'Admin Console module delegation');

  const adminConsole = await readFile(ADMIN_CONSOLE_PATH, 'utf8');
  assertContains(adminConsole, "add_action( 'admin_menu', 'localis_cim_register_admin_menu' );", 'Admin Console menu hook');
  assertContains(adminConsole, "'manage_options'", 'Admin Console capability');
  assertContains(adminConsole, "'code-in-motion'", 'Admin Console page slug');
  assertContains(adminConsole, 'localis_cim_read_admin_inventory()', 'registry-backed Admin Console inventory');
  assertContains(adminConsole, 'wp_json_file_decode(', 'WordPress JSON registry reader');
  assertContains(adminConsole, 'get_file_data(', 'root plugin support metadata reader');

  for (const assetPath of REQUIRED_EXTERNAL_ASSETS) await readFile(assetPath, 'utf8');

  await verifyEnvironmentBaseline();
  await verifyPlaygroundBaseline();

  const files = await walk(WORDPRESS_DIR);
  const phpFiles = [ROOT_ENTRY_PATH, ...files.filter((path) => extname(path) === '.php')];
  const forbidden = [
    ['wp_add_inline_script(', 'wp_add_inline_script()'],
    ['wp_add_inline_style(', 'wp_add_inline_style()'],
    ['wp_localize_script(', 'wp_localize_script()'],
    ['<script', 'literal <script> emission']
  ];

  for (const path of phpFiles) {
    const source = await readFile(path, 'utf8');
    const lower = source.toLowerCase();
    for (const [token, label] of forbidden) {
      const haystack = token === '<script' ? lower : source;
      if (haystack.includes(token)) {
        throw new Error(`WordPress packaging gate: ${label} is forbidden in ${path}.`);
      }
    }
  }

  console.log(
    `PASS: WordPress packaging baseline (${phpFiles.length} PHP file(s), ${REQUIRED_EXTERNAL_ASSETS.length} external asset(s), wp-env floor ${WORDPRESS_FLOOR_CORE}, PHP ${WORDPRESS_FLOOR_PHP})`
  );
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
