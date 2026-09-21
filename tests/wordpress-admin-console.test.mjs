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
