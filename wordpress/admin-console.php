<?php
/**
 * Read-only WordPress administration inventory and static health for Code in Motion.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Determine whether the current user may view the CiM Admin Console.
 *
 * @return bool
 */
function localis_cim_admin_can_view() {
	return current_user_can( 'manage_options' );
}

/**
 * Read plugin metadata from the canonical root plugin header.
 *
 * @return array
 */
function localis_cim_admin_support_metadata() {
	$root_plugin = dirname( __DIR__ ) . '/code-in-motion.php';

	return get_file_data(
		$root_plugin,
		array(
			'version'            => 'Version',
			'requires_wordpress' => 'Requires at least',
			'requires_php'       => 'Requires PHP',
		),
		'plugin'
	);
}

/**
 * Determine whether a registry asset is a single safe deployment file name.
 *
 * @param mixed $asset Candidate asset value.
 * @return bool
 */
function localis_cim_admin_is_safe_asset_name( $asset ) {
	return is_string( $asset )
		&& 1 === preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/', $asset );
}

/**
 * Determine whether a renderer ID is safe inert inventory data.
 *
 * @param mixed $renderer_id Candidate renderer identifier.
 * @return bool
 */
function localis_cim_admin_is_renderer_id( $renderer_id ) {
	return is_string( $renderer_id )
		&& 1 === preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*\/v[1-9][0-9]*$/', $renderer_id );
}

/**
 * Return the one active deployment context.
 *
 * @param string $wordpress_dir WordPress implementation directory.
 * @param string $version       Plugin version.
 * @return array
 */
function localis_cim_admin_deployment_context( $wordpress_dir, $version ) {
	if (
		! is_string( $wordpress_dir )
		|| '' === $wordpress_dir
		|| ! is_string( $version )
		|| '' === $version
	) {
		return array(
			'mode'        => 'unavailable',
			'module_root' => '',
		);
	}

	$release_root = $wordpress_dir . '/assets/modules/' . $version;
	if ( is_dir( $release_root ) ) {
		return array(
			'mode'        => 'release',
			'module_root' => $release_root,
		);
	}

	return array(
		'mode'        => 'source',
		'module_root' => $wordpress_dir,
	);
}

/**
 * Return a fail-closed unavailable Experience inventory.
 *
 * @return array
 */
function localis_cim_admin_unavailable_inventory() {
	return array(
		'status'      => 'unavailable',
		'schema'      => '',
		'experiences' => array(),
	);
}

/**
 * Return a fail-closed unavailable renderer inventory.
 *
 * @return array
 */
function localis_cim_admin_unavailable_renderer_inventory() {
	return array(
		'status'    => 'unavailable',
		'schema'    => '',
		'renderers' => array(),
	);
}

/**
 * Resolve one registry asset against one deployment mode.
 *
 * @param string $asset         Safe registry asset file name.
 * @param string $wordpress_dir WordPress implementation directory.
 * @param string $version       Plugin version.
 * @return array
 */
function localis_cim_admin_resolve_asset_status( $asset, $wordpress_dir, $version ) {
	if ( ! localis_cim_admin_is_safe_asset_name( $asset ) ) {
		return array(
			'present' => false,
			'source'  => 'unavailable',
		);
	}

	$deployment = localis_cim_admin_deployment_context( $wordpress_dir, $version );

	if ( 'release' === $deployment['mode'] ) {
		$release_path = $deployment['module_root'] . '/wordpress/experiences/' . $asset;
		$present      = is_readable( $release_path );

		return array(
			'present' => $present,
			'source'  => $present ? 'release' : 'missing',
		);
	}

	if ( 'source' === $deployment['mode'] ) {
		$source_path = $wordpress_dir . '/experiences/' . $asset;
		$present     = is_readable( $source_path );

		return array(
			'present' => $present,
			'source'  => $present ? 'source' : 'missing',
		);
	}

	return array(
		'present' => false,
		'source'  => 'unavailable',
	);
}

/**
 * Resolve one registry asset against the active plugin deployment mode.
 *
 * @param string $asset Safe registry asset file name.
 * @return array
 */
function localis_cim_admin_asset_status( $asset ) {
	return localis_cim_admin_resolve_asset_status(
		$asset,
		__DIR__,
		LOCALIS_CIM_PLUGIN_VERSION
	);
}

/**
 * Read the canonical R30 registry for administration inventory only.
 *
 * This function performs structural and path-safety checks required for safe
 * display. It does not validate Runtime Experience semantics.
 *
 * @return array
 */
function localis_cim_read_admin_inventory() {
	$registry_path = __DIR__ . '/experiences/registry.json';
	if ( ! is_readable( $registry_path ) ) {
		return localis_cim_admin_unavailable_inventory();
	}

	$registry = wp_json_file_decode(
		$registry_path,
		array(
			'associative' => true,
		)
	);

	if (
		! is_array( $registry )
		|| ! isset( $registry['schema'], $registry['experiences'] )
		|| ! is_string( $registry['schema'] )
		|| '' === $registry['schema']
		|| ! is_array( $registry['experiences'] )
	) {
		return localis_cim_admin_unavailable_inventory();
	}

	$experiences = array();

	foreach ( $registry['experiences'] as $entry ) {
		if (
			! is_array( $entry )
			|| ! isset( $entry['id'], $entry['asset'] )
			|| ! localis_cim_is_identifier( $entry['id'] )
			|| ! localis_cim_admin_is_safe_asset_name( $entry['asset'] )
		) {
			return localis_cim_admin_unavailable_inventory();
		}

		$deployment   = localis_cim_admin_asset_status( $entry['asset'] );
		$experiences[] = array(
			'id'        => $entry['id'],
			'asset'     => $entry['asset'],
			'present'   => $deployment['present'],
			'source'    => $deployment['source'],
			'shortcode' => '[cim experience="' . $entry['id'] . '"]',
		);
	}

	return array(
		'status'      => 'available',
		'schema'      => $registry['schema'],
		'experiences' => $experiences,
	);
}

/**
 * Read the generated R32 renderer inventory for display only.
 *
 * @return array
 */
function localis_cim_read_admin_renderer_inventory() {
	$inventory_path = __DIR__ . '/renderers/inventory.generated.json';
	if ( ! is_readable( $inventory_path ) ) {
		return localis_cim_admin_unavailable_renderer_inventory();
	}

	$inventory = wp_json_file_decode(
		$inventory_path,
		array(
			'associative' => true,
		)
	);

	if (
		! is_array( $inventory )
		|| ! isset( $inventory['schema'], $inventory['renderers'] )
		|| 'localis.cim/wordpress-renderer-inventory/v1' !== $inventory['schema']
		|| ! is_array( $inventory['renderers'] )
	) {
		return localis_cim_admin_unavailable_renderer_inventory();
	}

	$renderers = array();
	$seen      = array();

	foreach ( $inventory['renderers'] as $entry ) {
		if (
			! is_array( $entry )
			|| array( 'id' ) !== array_keys( $entry )
			|| ! localis_cim_admin_is_renderer_id( $entry['id'] )
			|| isset( $seen[ $entry['id'] ] )
		) {
			return localis_cim_admin_unavailable_renderer_inventory();
		}

		$seen[ $entry['id'] ] = true;
		$renderers[]          = array(
			'id'     => $entry['id'],
			'status' => 'registered',
		);
	}

	return array(
		'status'    => 'available',
		'schema'    => $inventory['schema'],
		'renderers' => $renderers,
	);
}

/**
 * Compare the runtime plugin version with the canonical root plugin header.
 *
 * @param string $header_version  Root plugin header version.
 * @param string $runtime_version Runtime plugin version constant.
 * @return string
 */
function localis_cim_admin_version_consistency( $header_version, $runtime_version ) {
	return is_string( $header_version )
		&& is_string( $runtime_version )
		&& '' !== $header_version
		&& $header_version === $runtime_version
			? 'consistent'
			: 'mismatch';
}

/**
 * Resolve bootstrap presence from the active deployment mode.
 *
 * @param string $wordpress_dir WordPress implementation directory.
 * @param string $version       Plugin version.
 * @return bool
 */
function localis_cim_admin_bootstrap_present( $wordpress_dir, $version ) {
	$deployment = localis_cim_admin_deployment_context( $wordpress_dir, $version );

	if ( 'release' === $deployment['mode'] ) {
		return is_readable(
			$deployment['module_root'] . '/wordpress/assets/bootstrap-module.mjs'
		);
	}

	if ( 'source' === $deployment['mode'] ) {
		return is_readable( $wordpress_dir . '/assets/bootstrap-module.mjs' );
	}

	return false;
}

/**
 * Assemble local artifact health without network or Runtime probing.
 *
 * @param array $experience_inventory R31 Experience inventory.
 * @param array $renderer_inventory   R32 renderer inventory.
 * @return array
 */
function localis_cim_admin_static_health( $experience_inventory, $renderer_inventory ) {
	$deployment = localis_cim_admin_deployment_context(
		__DIR__,
		LOCALIS_CIM_PLUGIN_VERSION
	);
	$metadata   = localis_cim_admin_support_metadata();

	$experience_available = is_array( $experience_inventory )
		&& isset( $experience_inventory['status'] )
		&& 'available' === $experience_inventory['status'];
	$renderer_available   = is_array( $renderer_inventory )
		&& isset( $renderer_inventory['status'], $renderer_inventory['renderers'] )
		&& 'available' === $renderer_inventory['status']
		&& is_array( $renderer_inventory['renderers'] );

	return array(
		'deployment_mode'     => $deployment['mode'],
		'active_module_root'  => 'release' === $deployment['mode'] ? 'present' : 'source',
		'bootstrap'           => localis_cim_admin_bootstrap_present( __DIR__, LOCALIS_CIM_PLUGIN_VERSION ) ? 'present' : 'missing',
		'experience_registry' => $experience_available ? 'available' : 'unavailable',
		'renderer_inventory'  => $renderer_available ? 'available' : 'unavailable',
		'renderer_count'      => $renderer_available ? count( $renderer_inventory['renderers'] ) : null,
		'version_consistency' => localis_cim_admin_version_consistency(
			$metadata['version'] ?? '',
			LOCALIS_CIM_PLUGIN_VERSION
		),
	);
}

/**
 * Register the top-level Code in Motion administration page.
 */
function localis_cim_register_admin_menu() {
	add_menu_page(
		'Code in Motion',
		'Code in Motion',
		'manage_options',
		'code-in-motion',
		'localis_cim_render_admin_console',
		'dashicons-admin-tools'
	);
}
add_action( 'admin_menu', 'localis_cim_register_admin_menu' );

/**
 * Render one escaped two-column information table row.
 *
 * @param string $label Row label.
 * @param string $value Row value.
 */
function localis_cim_admin_info_row( $label, $value ) {
	printf(
		'<tr><th scope="row">%1$s</th><td>%2$s</td></tr>',
		esc_html( $label ),
		esc_html( $value )
	);
}

/**
 * Convert internal status vocabulary to display text.
 *
 * @param string $status Internal status.
 * @return string
 */
function localis_cim_admin_status_label( $status ) {
	$labels = array(
		'release'     => 'Release',
		'source'      => 'Source',
		'present'     => 'Present',
		'missing'     => 'Missing',
		'available'   => 'Available',
		'unavailable' => 'Unavailable',
		'consistent'  => 'Consistent',
		'mismatch'    => 'Mismatch',
		'registered'  => 'Registered',
	);

	return isset( $labels[ $status ] ) ? $labels[ $status ] : 'Unavailable';
}

/**
 * Render the read-only Code in Motion Admin Console.
 */
function localis_cim_render_admin_console() {
	if ( ! localis_cim_admin_can_view() ) {
		wp_die(
			'You do not have permission to view Code in Motion administration.',
			'Code in Motion',
			array(
				'response' => 403,
			)
		);
	}

	$support            = localis_cim_admin_support_metadata();
	$inventory          = localis_cim_read_admin_inventory();
	$renderer_inventory = localis_cim_read_admin_renderer_inventory();
	$health             = localis_cim_admin_static_health( $inventory, $renderer_inventory );

	echo '<div class="wrap">';
	echo '<h1>Code in Motion</h1>';
	echo '<p>Read-only deployment inventory and static artifact health.</p>';

	echo '<h2>System</h2>';
	echo '<table class="widefat striped"><tbody>';
	localis_cim_admin_info_row( 'Plugin version', LOCALIS_CIM_PLUGIN_VERSION );
	localis_cim_admin_info_row( 'WordPress version', get_bloginfo( 'version' ) );
	localis_cim_admin_info_row( 'PHP version', PHP_VERSION );
	localis_cim_admin_info_row( 'WordPress support floor', $support['requires_wordpress'] ?? '' );
	localis_cim_admin_info_row( 'PHP support floor', $support['requires_php'] ?? '' );
	localis_cim_admin_info_row(
		'Registry schema',
		'available' === $inventory['status'] ? $inventory['schema'] : 'Unavailable'
	);
	localis_cim_admin_info_row(
		'Registered Experiences',
		'available' === $inventory['status'] ? (string) count( $inventory['experiences'] ) : 'Unavailable'
	);
	echo '</tbody></table>';

	echo '<h2>Static health</h2>';
	echo '<table class="widefat striped"><tbody>';
	localis_cim_admin_info_row( 'Deployment mode', localis_cim_admin_status_label( $health['deployment_mode'] ) );
	localis_cim_admin_info_row( 'Active module root', localis_cim_admin_status_label( $health['active_module_root'] ) );
	localis_cim_admin_info_row( 'Bootstrap module', localis_cim_admin_status_label( $health['bootstrap'] ) );
	localis_cim_admin_info_row( 'Experience registry', localis_cim_admin_status_label( $health['experience_registry'] ) );
	localis_cim_admin_info_row( 'Renderer inventory', localis_cim_admin_status_label( $health['renderer_inventory'] ) );
	localis_cim_admin_info_row(
		'Registered renderers',
		null === $health['renderer_count'] ? 'Unavailable' : (string) $health['renderer_count']
	);
	localis_cim_admin_info_row( 'Plugin version consistency', localis_cim_admin_status_label( $health['version_consistency'] ) );
	echo '</tbody></table>';

	echo '<h2>Experience inventory</h2>';
	if ( 'available' !== $inventory['status'] ) {
		echo '<div class="notice notice-error inline"><p>Experience registry unavailable.</p></div>';
	} else {
		echo '<table class="widefat striped">';
		echo '<thead><tr><th>Experience ID</th><th>Asset</th><th>Deployment status</th><th>Shortcode</th></tr></thead>';
		echo '<tbody>';
		foreach ( $inventory['experiences'] as $experience ) {
			$status = $experience['present']
				? 'Present (' . $experience['source'] . ')'
				: 'Missing';

			printf(
				'<tr><td><code>%1$s</code></td><td><code>%2$s</code></td><td>%3$s</td><td><code>%4$s</code></td></tr>',
				esc_html( $experience['id'] ),
				esc_html( $experience['asset'] ),
				esc_html( $status ),
				esc_html( $experience['shortcode'] )
			);
		}
		echo '</tbody></table>';
	}

	echo '<h2>Renderer inventory</h2>';
	if ( 'available' !== $renderer_inventory['status'] ) {
		echo '<div class="notice notice-error inline"><p>Renderer inventory unavailable.</p></div>';
	} else {
		echo '<table class="widefat striped">';
		echo '<thead><tr><th>Renderer ID</th><th>Registration status</th></tr></thead>';
		echo '<tbody>';
		foreach ( $renderer_inventory['renderers'] as $renderer ) {
			printf(
				'<tr><td><code>%1$s</code></td><td>%2$s</td></tr>',
				esc_html( $renderer['id'] ),
				esc_html( localis_cim_admin_status_label( $renderer['status'] ) )
			);
		}
		echo '</tbody></table>';
	}

	echo '</div>';
}
