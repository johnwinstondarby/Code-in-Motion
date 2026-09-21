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
  assert.match(adminSource, /function localis_cim_admin_resolve_asset_status/);
  assert.match(adminSource, /if \( is_dir\( \$release_root \) \) \{/);
});

test('R31 selects release or source deployment mode once, not per asset', () => {
  const resolver = adminSource.match(
    /function localis_cim_admin_resolve_asset_status[\s\S]*?\n}\n\n\/\*\*/
  )?.[0] ?? '';

  assert.match(resolver, /\$release_root =/);
  assert.match(resolver, /if \( is_dir\( \$release_root \) \) \{/);
  assert.match(resolver, /return array\([\s\S]*?'source'\s*=>\s*is_readable\( \$release_path \) \? 'release' : 'missing'/);
  assert.match(resolver, /\$source_path =/);
});

test('R31 Admin Console contains no management mutation or Runtime semantic authority', () => {
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
    'localis.cim/v1'
  ];

  for (const token of forbidden) {
    assert.equal(adminSource.includes(token), false, token);
  }

  assert.match(
    adminSource,
    /if \( ! localis_cim_admin_can_view\(\) \) \{[\s\S]*?wp_die\(/
  );
});
