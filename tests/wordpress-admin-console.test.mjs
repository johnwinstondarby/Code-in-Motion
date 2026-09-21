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

test('R32 PHP management surface has no renderer execution, Runtime semantics, or network health probing', () => {
  const forbidden = [
    'update_option(',
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
