import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ENTRY_PATH = resolve(ROOT, 'code-in-motion.php');
const UNINSTALL_PATH = resolve(ROOT, 'uninstall.php');
const WORDPRESS_DIR = resolve(ROOT, 'wordpress');
const IMPLEMENTATION_ENTRY_PATH = resolve(WORDPRESS_DIR, 'code-in-motion.php');
const ADMIN_CONSOLE_PATH = resolve(WORDPRESS_DIR, 'admin-console.php');
const WP_ENV_PATH = resolve(ROOT, '.wp-env.json');
const PACKAGE_PATH = resolve(ROOT, 'package.json');
const PLAYGROUND_BLUEPRINT_PATH = resolve(WORDPRESS_DIR, 'playground', 'blueprint.json');
const PLAYGROUND_PREVIEW_WORKFLOW_PATH = resolve(ROOT, '.github', 'workflows', 'playground-preview.yml');
const R34_APPROVED_MOTION_POLICY_WRITE =
  'update_option( LOCALIS_CIM_MOTION_POLICY_OPTION, $motion_policy, false )';
const R34_APPROVED_MOTION_POLICY_DELETE =
  "delete_option( 'localis_cim_motion_policy' )";
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

  const uninstall = await readFile(UNINSTALL_PATH, 'utf8');
  assertContains(uninstall, "defined( 'WP_UNINSTALL_PLUGIN' )", 'R34 uninstall execution guard');
  assertContains(uninstall, R34_APPROVED_MOTION_POLICY_DELETE, 'R34 exact motion-policy uninstall cleanup');
  if ((uninstall.match(/delete_option\(/g) ?? []).length !== 1) {
    throw new Error('WordPress packaging gate: R34 uninstall.php must contain exactly one delete_option() call.');
  }

  const entry = await readFile(IMPLEMENTATION_ENTRY_PATH, 'utf8');
  assertContains(entry, 'wp_enqueue_script(', 'wp_enqueue_script() external JavaScript registration');
  assertContains(entry, 'wp_enqueue_style(', 'wp_enqueue_style() external CSS registration');
  assertContains(entry, "add_shortcode( 'cim'", 'cim shortcode registration');
  assertContains(entry, 'data-cim-experience', 'canonical Experience attribute');
  assertContains(entry, 'data-cim-renderer-root', 'canonical renderer-root attribute');
  assertContains(entry, "require_once __DIR__ . '/admin-console.php';", 'Admin Console module delegation');
  assertContains(entry, "LOCALIS_CIM_MOTION_POLICY_OPTION', 'localis_cim_motion_policy'", 'R34 motion-policy option constant');
  assertContains(entry, 'function localis_cim_get_motion_policy()', 'R34 motion-policy reader');

  const adminConsole = await readFile(ADMIN_CONSOLE_PATH, 'utf8');
  assertContains(adminConsole, "add_action( 'admin_menu', 'localis_cim_register_admin_menu' );", 'Admin Console menu hook');
  assertContains(adminConsole, "'manage_options'", 'Admin Console capability');
  assertContains(adminConsole, "'code-in-motion'", 'Admin Console page slug');
  assertContains(adminConsole, 'localis_cim_read_admin_inventory()', 'registry-backed Admin Console inventory');
  assertContains(adminConsole, 'wp_json_file_decode(', 'WordPress JSON registry reader');
  assertContains(adminConsole, 'get_file_data(', 'root plugin support metadata reader');
  assertContains(adminConsole, 'renderers/inventory.generated.json', 'R32 inert renderer inventory');
  assertContains(adminConsole, 'localis_cim_admin_deployment_context', 'shared deployment-mode resolver');
  assertContains(adminConsole, 'localis_cim_admin_static_health', 'R32 static health');
  assertContains(adminConsole, 'localis_cim_admin_version_consistency', 'R32 version consistency');
  assertContains(adminConsole, 'release/release-info.generated.json', 'R33 inert release information');
  assertContains(adminConsole, 'localis_cim_read_admin_release_info', 'R33 release-info reader');
  assertContains(adminConsole, "esc_url( $release_info['support_uri'] )", 'R33 escaped support URI');
  assertContains(adminConsole, 'localis_cim_admin_update_motion_policy', 'R34 motion-policy writer');
  assertContains(adminConsole, "check_admin_referer( 'localis_cim_update_motion_policy' )", 'R34 motion-policy nonce check');
  assertContains(adminConsole, "'admin_post_localis_cim_update_motion_policy'", 'R34 authenticated admin-post action');
  assertContains(adminConsole, R34_APPROVED_MOTION_POLICY_WRITE, 'R34 exact motion-policy persistence call');
  if (adminConsole.includes('readme.txt')) {
    throw new Error('WordPress packaging gate: Admin Console must not parse readme.txt.');
  }
  for (const token of [
    'wp_remote_get(',
    'wp_remote_post(',
    'wp_remote_request(',
    'curl_',
    'fsockopen(',
    'pfsockopen(',
    'stream_socket_client('
  ]) {
    if (adminConsole.includes(token)) {
      throw new Error(`WordPress packaging gate: network health token ${token} is forbidden in Admin Console.`);
    }
  }

  for (const assetPath of REQUIRED_EXTERNAL_ASSETS) await readFile(assetPath, 'utf8');

  await verifyEnvironmentBaseline();
  await verifyPlaygroundBaseline();

  const files = await walk(WORDPRESS_DIR);
  const phpFiles = [ROOT_ENTRY_PATH, UNINSTALL_PATH, ...files.filter((path) => extname(path) === '.php')];
  const forbidden = [
    ['wp_add_inline_script(', 'wp_add_inline_script()'],
    ['wp_add_inline_style(', 'wp_add_inline_style()'],
    ['wp_localize_script(', 'wp_localize_script()'],
    ['<script', 'literal <script> emission']
  ];

  const statefulTokens = [
    'register_activation_hook(',
    'register_deactivation_hook(',
    'register_uninstall_hook(',
    'register_setting(',
    'add_option(',
    'add_site_option(',
    'update_site_option(',
    'delete_site_option(',
    'set_transient(',
    'delete_transient(',
    'set_site_transient(',
    'delete_site_transient(',
    'dbDelta(',
    '$wpdb->insert(',
    '$wpdb->replace(',
    '$wpdb->update(',
    '$wpdb->delete(',
    'CREATE TABLE',
    'ALTER TABLE',
    'DROP TABLE'
  ];
  const updateTokens = [
    'pre_set_site_transient_update_plugins',
    'site_transient_update_plugins',
    'plugins_api',
    'upgrader_process_complete',
    'wp_remote_get(',
    'wp_remote_post(',
    'wp_remote_request('
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
    const deleteOptionCalls = source.match(/delete_option\(/g) ?? [];
    if (deleteOptionCalls.length > 0) {
      if (
        path !== UNINSTALL_PATH ||
        deleteOptionCalls.length !== 1 ||
        !source.includes(R34_APPROVED_MOTION_POLICY_DELETE)
      ) {
        throw new Error(
          `WordPress packaging gate: R34 permits exactly one approved motion-policy delete_option() call in ${UNINSTALL_PATH}.`
        );
      }
    }

    const updateOptionCalls = source.match(/update_option\(/g) ?? [];
    if (updateOptionCalls.length > 0) {
      if (
        path !== ADMIN_CONSOLE_PATH ||
        updateOptionCalls.length !== 1 ||
        !source.includes(R34_APPROVED_MOTION_POLICY_WRITE)
      ) {
        throw new Error(
          `WordPress packaging gate: R34 permits exactly one approved motion-policy update_option() call in ${ADMIN_CONSOLE_PATH}.`
        );
      }
    }

    for (const token of statefulTokens) {
      if (source.includes(token)) {
        throw new Error(`WordPress packaging gate: R34 persistence boundary forbids ${token} in ${path}.`);
      }
    }
    for (const token of updateTokens) {
      if (source.includes(token)) {
        throw new Error(`WordPress packaging gate: R33 custom update/network behavior forbids ${token} in ${path}.`);
      }
    }
  }

  const rootEntries = await readdir(ROOT);
  if (!rootEntries.includes('uninstall.php')) {
    throw new Error('WordPress packaging gate: R34 uninstall.php is required once motion-policy state exists.');
  }
  if (files.some((path) => path.endsWith('/uninstall.php'))) {
    throw new Error('WordPress packaging gate: R34 permits uninstall.php only at the plugin root.');
  }

  console.log(
    `PASS: WordPress packaging baseline (${phpFiles.length} PHP file(s), ${REQUIRED_EXTERNAL_ASSETS.length} external asset(s), wp-env floor ${WORDPRESS_FLOOR_CORE}, PHP ${WORDPRESS_FLOOR_PHP})`
  );
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
