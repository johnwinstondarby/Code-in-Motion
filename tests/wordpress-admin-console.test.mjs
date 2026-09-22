import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminSource = await readFile(
  new URL('../wordpress/admin-console.php', import.meta.url),
  'utf8'
);
const implementationSource = await readFile(
  new URL('../wordpress/code-in-motion.php', import.meta.url),
  'utf8'
);

test('R31 wires one dedicated read-only Admin Console module', () => {
  assert.match(
    implementationSource,
    /require_once __DIR__ \. '\/admin-console\.php';/
  );
  assert.match(adminSource, /add_menu_page\(/);
  assert.match(adminSource, /'manage_options'/);
  assert.match(adminSource, /'code-in-motion'/);
  assert.match(
    adminSource,
    /add_action\( 'admin_menu', 'localis_cim_register_admin_menu' \);/
  );
});

test('R31 Admin Console derives inventory and support metadata from canonical sources', () => {
  assert.match(adminSource, /wp_json_file_decode\(/);
  assert.match(adminSource, /experiences\/registry\.json/);
  assert.match(adminSource, /get_file_data\(/);
  assert.match(adminSource, /Requires at least/);
  assert.match(adminSource, /Requires PHP/);
  assert.match(adminSource, /LOCALIS_CIM_PLUGIN_VERSION/);
  assert.match(adminSource, /assets\/modules\//);
  assert.match(adminSource, /wordpress\/experiences\//);
});

test('R31 selects release or source deployment mode once, not per asset', () => {
  assert.match(adminSource, /function localis_cim_admin_deployment_context/);
  assert.match(adminSource, /if \( is_dir\( \$release_root \) \) \{/);

  const resolver = adminSource.match(
    /function localis_cim_admin_resolve_asset_status[\s\S]*?\n}\n\n\/\*\*/
  )?.[0] ?? '';
  assert.match(resolver, /localis_cim_admin_deployment_context/);
  assert.doesNotMatch(resolver, /is_dir\(/);
});

test('R32 Admin Console reads inert renderer inventory and static local health', () => {
  assert.match(adminSource, /renderers\/inventory\.generated\.json/);
  assert.match(adminSource, /localis\.cim\/wordpress-renderer-inventory\/v1/);
  assert.match(adminSource, /function localis_cim_read_admin_renderer_inventory/);
  assert.match(adminSource, /function localis_cim_admin_static_health/);
  assert.match(adminSource, /function localis_cim_admin_bootstrap_present/);
  assert.match(adminSource, /function localis_cim_admin_version_consistency/);
  assert.match(adminSource, /Renderer inventory/);
  assert.match(adminSource, /Registration status/);
  assert.match(adminSource, /Plugin version consistency/);
});

test('R33 Admin Console reads inert release metadata without parsing the WordPress readme', () => {
  assert.match(adminSource, /release\/release-info\.generated\.json/);
  assert.match(adminSource, /localis\.cim\/wordpress-release-info\/v1/);
  assert.match(adminSource, /function localis_cim_read_admin_release_info/);
  assert.match(adminSource, /Release information/);
  assert.match(adminSource, /Current release notes/);
  assert.match(adminSource, /esc_url\( \$release_info\['support_uri'\] \)/);
  assert.equal(adminSource.includes('readme.txt'), false);
});

test('R34 motion-policy persistence uses one exact authenticated write surface', () => {
  assert.match(
    implementationSource,
    /LOCALIS_CIM_MOTION_POLICY_OPTION', 'localis_cim_motion_policy'/
  );
  assert.match(implementationSource, /LOCALIS_CIM_MOTION_POLICY_SYSTEM', 'system'/);
  assert.match(implementationSource, /LOCALIS_CIM_MOTION_POLICY_REDUCE', 'reduce'/);
  assert.match(implementationSource, /function localis_cim_get_motion_policy\(\)/);
  assert.match(adminSource, /function localis_cim_admin_update_motion_policy/);
  assert.match(
    adminSource,
    /update_option\( LOCALIS_CIM_MOTION_POLICY_OPTION, \$motion_policy, false \)/
  );
  assert.equal((adminSource.match(/update_option\(/g) ?? []).length, 1);
  assert.match(adminSource, /check_admin_referer\( 'localis_cim_update_motion_policy' \)/);
  assert.match(
    adminSource,
    /sanitize_key\( wp_unslash\( \$_POST\['motion_policy'\] \) \)/
  );
  assert.match(adminSource, /admin_post_localis_cim_update_motion_policy/);
  assert.match(adminSource, /current_user_can\( 'manage_options' \)/);
  assert.match(adminSource, /Host configuration/);
  assert.match(adminSource, /Force reduced motion/);
});

test('R32 PHP management surface has no renderer execution, Runtime semantics, or network health probing', () => {
  const forbidden = [
    'add_option(',
    'delete_option(',
    'register_setting(',
    'settings_fields(',
    'wp_ajax_',
    'register_rest_route(',
    'file_put_contents(',
    'fopen(',
    'unlink(',
    'rename(',
    'initial_state',
    'renderer_config',
    'ingestExperience',
    'localis.cim/v1',
    'createGitRenderer',
    'createSyntheticRenderer',
    'renderer-registry.mjs',
    'wp_remote_get(',
    'wp_remote_post(',
    'wp_remote_request(',
    'curl_',
    'fsockopen(',
    'pfsockopen(',
    'stream_socket_client('
  ];

  for (const token of forbidden) {
    assert.equal(adminSource.includes(token), false, token);
  }

  assert.doesNotMatch(adminSource, /https?:\/\//i);
  assert.match(
    adminSource,
    /if \( ! localis_cim_admin_can_view\(\) \) \{[\s\S]*?wp_die\(/
  );
});
