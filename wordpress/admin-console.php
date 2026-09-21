<?php
/**
 * Read-only WordPress administration inventory for Code in Motion.
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
 * Read support-floor metadata from the canonical root plugin header.
 *
 * @return array
 */
function localis_cim_admin_support_metadata() {
	$root_plugin = dirname( __DIR__ ) . '/code-in-motion.php';

	return get_file_data(
		$root_plugin,
		array(
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
 * Return a fail-closed unavailable inventory.
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
 * Resolve one registry asset against the installed release tree or source tree.
 *
 * @param string $asset Safe registry asset file name.
 * @return array
 */
function localis_cim_admin_asset_status( $asset ) {
	if ( ! localis_cim_admin_is_safe_asset_name( $asset ) ) {
		return array(
			'present' => false,
			'source'  => 'unavailable',
		);
	}

	$release_path = __DIR__
		. '/assets/modules/'
		. LOCALIS_CIM_PLUGIN_VERSION
		. '/wordpress/experiences/'
		. $asset;

	if ( is_readable( $release_path ) ) {
		return array(
			'present' => true,
			'source'  => 'release',
		);
	}

	$source_path = __DIR__ . '/experiences/' . $asset;
	if ( is_readable( $source_path ) ) {
		return array(
			'present' => true,
			'source'  => 'source',
		);
	}

	return array(
		'present' => false,
		'source'  => 'missing',
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

		$deployment = localis_cim_admin_asset_status( $entry['asset'] );
		$experiences[] = array(
			'id'         => $entry['id'],
			'asset'      => $entry['asset'],
			'present'    => $deployment['present'],
			'source'     => $deployment['source'],
			'shortcode'  => '[cim experience="' . $entry['id'] . '"]',
		);
	}

	return array(
		'status'      => 'available',
		'schema'      => $registry['schema'],
		'experiences' => $experiences,
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

	$support   = localis_cim_admin_support_metadata();
	$inventory = localis_cim_read_admin_inventory();

	echo '<div class="wrap">';
	echo '<h1>Code in Motion</h1>';
	echo '<p>Read-only deployment inventory and environment status.</p>';

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

	echo '<h2>Experience inventory</h2>';
	if ( 'available' !== $inventory['status'] ) {
		echo '<div class="notice notice-error inline"><p>Experience registry unavailable.</p></div>';
		echo '</div>';
		return;
	}

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
	echo '</div>';
}
