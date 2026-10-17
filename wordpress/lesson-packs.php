<?php
/** Read-only discovery of installed companion packs using cim.lesson-pack/v1. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Restrict an inert JSON basename to its pack's real directory, including symlinks. */
function localis_cim_pack_file( $directory, $name, $limit ) {
	if ( ! is_string( $name ) || ! preg_match( '/^[a-zA-Z0-9_-]+\.json$/D', $name ) ) { return false; }
	$file = realpath( $directory . DIRECTORY_SEPARATOR . $name );
	if ( ! $file || dirname( $file ) !== $directory || ! is_file( $file ) || ! is_readable( $file ) || filesize( $file ) > $limit ) { return false; }
	$raw = file_get_contents( $file, false, null, 0, $limit + 1 );
	return is_string( $raw ) && strlen( $raw ) <= $limit ? $raw : false;
}

/** Exclude access time: reading a lesson must not invalidate its own cache. */
function localis_cim_pack_stat( $path ) {
	$stat = @stat( $path );
	return $stat ? array_intersect_key( $stat, array_flip( array( 'dev', 'ino', 'mode', 'size', 'mtime', 'ctime' ) ) ) : false;
}

/** Cheap cache identity: manifests are bounded; lesson bodies are never read on a hit.
 * Include resolved paths and file metadata so replacing a file with an escaping symlink
 * invalidates acceptance too. Inactive plugins never have their JSON opened.
 */
function localis_cim_pack_fingerprint( $plugins ) {
	$identity = array( LOCALIS_CIM_PLUGIN_VERSION, realpath( WP_PLUGIN_DIR ), plugins_url( '' ), hash_file( 'sha256', __DIR__ . '/experiences/registry.json' ) );
	foreach ( $plugins as $plugin => $metadata ) {
		$file = WP_PLUGIN_DIR . '/' . $plugin;
		$active = is_plugin_active( $plugin ) || is_plugin_active_for_network( $plugin );
		$directory = realpath( dirname( $file ) );
		clearstatcache( true, $file );
		$item = array( $plugin, $metadata, $active, realpath( $file ), localis_cim_pack_stat( $file ) );
		if ( $active && $directory && dirname( $directory ) === realpath( WP_PLUGIN_DIR ) ) {
			$raw = localis_cim_pack_file( $directory, 'cim-lesson-pack.json', 65536 );
			$item[] = $raw;
			$manifest = is_string( $raw ) ? json_decode( $raw, true ) : null;
			foreach ( array_slice( is_array( $manifest['lessons'] ?? null ) ? $manifest['lessons'] : array(), 0, 100 ) as $entry ) {
				$name = is_array( $entry ) ? ( $entry['file'] ?? null ) : null;
				if ( ! is_string( $name ) || ! preg_match( '/^[a-zA-Z0-9_-]+\.json$/D', $name ) ) { continue; }
				$path = $directory . '/' . $name;
				clearstatcache( true, $path );
				$item[] = array( $name, realpath( $path ), localis_cim_pack_stat( $path ) );
			}
		}
		$identity[] = $item;
	}
	return hash( 'sha256', serialize( $identity ) );
}

/** Once per request, with an expiring cross-request cache on ordinary WordPress too. */
function localis_cim_read_lesson_packs( $refresh = false ) {
	static $inventory = null;
	if ( null !== $inventory ) { return $inventory; }
	if ( ! function_exists( 'get_plugins' ) ) { require_once ABSPATH . 'wp-admin/includes/plugin.php'; }
	$cached = function_exists( 'get_transient' ) ? get_transient( 'localis_cim_pack_inventory_v1' ) : false;
	$activation = function_exists( 'get_option' ) ? array( get_option( 'active_plugins', array() ), function_exists( 'get_site_option' ) ? get_site_option( 'active_sitewide_plugins', array() ) : array() ) : null;
	// WordPress's default object cache lasts one request: calling get_plugins() on
	// every cache hit would still reread every plugin header. Retain its metadata too.
	$reuse_plugins = ! $refresh && null !== $activation && is_array( $cached ) && ( $cached['activation'] ?? null ) === $activation && is_array( $cached['plugins'] ?? null );
	$plugins = $reuse_plugins ? $cached['plugins'] : get_plugins();
	$fingerprint = localis_cim_pack_fingerprint( $plugins );
	if ( is_array( $cached ) && ( $cached['fingerprint'] ?? '' ) === $fingerprint && is_array( $cached['inventory'] ?? null ) ) {
		$inventory = $cached['inventory']; return $inventory;
	}
	if ( $reuse_plugins ) { $plugins = get_plugins(); $fingerprint = localis_cim_pack_fingerprint( $plugins ); }
	$inventory = localis_cim_scan_lesson_packs( $plugins );
	if ( function_exists( 'set_transient' ) ) { set_transient( 'localis_cim_pack_inventory_v1', array( 'fingerprint' => $fingerprint, 'inventory' => $inventory, 'plugins' => $plugins, 'activation' => $activation ), 86400 ); }
	return $inventory;
}

/** Installed header marker is discovery only. Inactive packs never supply lesson data. */
function localis_cim_scan_lesson_packs( $plugins ) {
	if ( ! function_exists( 'get_plugins' ) ) { require_once ABSPATH . 'wp-admin/includes/plugin.php'; }
	$registry_file = __DIR__ . '/experiences/registry.json';
	$registry = is_readable( $registry_file ) ? json_decode( file_get_contents( $registry_file ), true ) : array();
	$bundled = array_column( $registry['experiences'] ?? array(), 'id' );
	$lessons = array(); $rows = array(); $packs = array(); $errors = array(); $seen = array();
	$plugins_root = realpath( WP_PLUGIN_DIR );
	foreach ( $plugins as $plugin => $metadata ) {
		$plugin_file = WP_PLUGIN_DIR . '/' . $plugin;
		$header = get_file_data( $plugin_file, array( 'contract' => 'CiM Lesson Pack' ) );
		if ( empty( $header['contract'] ) ) { continue; }
		$index = count( $packs );
		$packs[] = array( 'plugin' => $plugin, 'name' => $metadata['Name'], 'status' => 'Rejected', 'reason' => '' );
		$fail = '';
		$directory = realpath( dirname( $plugin_file ) );
		$active = is_plugin_active( $plugin ) || is_plugin_active_for_network( $plugin );
		if ( ! $active ) {
			$packs[ $index ]['status'] = 'Inactive'; $packs[ $index ]['reason'] = 'Activate this pack to read its lessons.'; continue;
		}
		if ( $index >= 100 ) { $fail = 'At most 100 packs are supported.'; }
		elseif ( 'cim.lesson-pack/v1' !== $header['contract'] ) { $fail = 'Unsupported lesson-pack agreement; expected cim.lesson-pack/v1.'; }
		elseif ( ! $directory || ! $plugins_root || dirname( $directory ) !== $plugins_root ) { $fail = 'Pack must have its own directory directly inside plugins.'; }
		$raw = $fail ? false : localis_cim_pack_file( $directory, 'cim-lesson-pack.json', 65536 );
		$manifest = is_string( $raw ) ? json_decode( $raw, true ) : null;
		if ( ! $fail && ( ! is_array( $manifest ) || ( $manifest['schema'] ?? '' ) !== 'cim.lesson-pack/v1' || ! isset( $manifest['cim_min'], $manifest['cim_max_exclusive'], $manifest['lessons'] ) || ! is_array( $manifest['lessons'] ) || count( $manifest['lessons'] ) < 1 || count( $manifest['lessons'] ) > 100 ) ) { $fail = 'Invalid or oversized cim-lesson-pack.json manifest.'; }
		if ( ! $fail ) {
			foreach ( array( 'cim_min', 'cim_max_exclusive' ) as $field ) {
				if ( ! is_string( $manifest[ $field ] ) || ! preg_match( '/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/D', $manifest[ $field ] ) ) { $fail = 'CiM compatibility bounds must be release semantic versions.'; }
			}
		}
		if ( ! $fail && ( version_compare( LOCALIS_CIM_PLUGIN_VERSION, $manifest['cim_min'], '<' ) || version_compare( LOCALIS_CIM_PLUGIN_VERSION, $manifest['cim_max_exclusive'], '>=' ) || version_compare( $manifest['cim_min'], $manifest['cim_max_exclusive'], '>=' ) ) ) { $fail = 'Incompatible pack: needs CiM >= ' . $manifest['cim_min'] . ' and < ' . $manifest['cim_max_exclusive'] . '; installed ' . LOCALIS_CIM_PLUGIN_VERSION . '.'; }
		if ( ! $fail && count( $rows ) + count( $manifest['lessons'] ) > 100 ) { $fail = 'At most 100 lessons are supported across active packs.'; }
		if ( $fail ) { $packs[ $index ]['reason'] = $fail; $errors[] = $metadata['Name'] . ': ' . $fail; continue; }
		$packs[ $index ]['status'] = 'Checking'; $packs[ $index ]['reason'] = 'Lesson checks appear below.';
		foreach ( $manifest['lessons'] as $entry ) {
			$id = is_array( $entry ) ? ( $entry['id'] ?? '' ) : '';
			$row = array( 'pack' => $index, 'id' => is_string( $id ) ? substr( $id, 0, 200 ) : '(invalid)', 'status' => 'Rejected', 'reason' => '', 'url' => '' );
			$fail = '';
			if ( ! is_string( $id ) || strlen( $id ) > 100 || ! preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $id ) ) { $fail = 'Invalid lesson ID.'; }
			elseif ( in_array( $id, $bundled, true ) || isset( $seen[ $id ] ) ) {
				$fail = 'Conflicting lesson ID: no pack wins. Rename the lesson ID and rebuild.';
				unset( $lessons[ $id ] );
				foreach ( $rows as &$prior ) { if ( $prior['id'] === $id ) { $prior['status'] = 'Rejected'; $prior['reason'] = $fail; $prior['url'] = ''; } } unset( $prior );
			}
			if ( is_string( $id ) ) { $seen[ $id ] = true; }
			$raw = $fail ? false : localis_cim_pack_file( $directory, $entry['file'] ?? null, 2097152 );
			if ( ! $fail && false === $raw ) { $fail = 'Lesson must be JSON of at most 2 MiB in its own pack folder; paths and escaping symlinks are refused.'; }
			$data = is_string( $raw ) ? json_decode( $raw, true ) : null;
			if ( ! $fail && ( ! is_array( $data ) || ( $data['id'] ?? null ) !== $id || ( $data['schema'] ?? null ) !== 'localis.cim/v2' || ( $data['renderer'] ?? null ) !== 'console/v1' ) ) { $fail = 'Expected matching compiled Console v2 JSON.'; }
			if ( $fail ) { $row['reason'] = $fail; $errors[] = $metadata['Name'] . ' / ' . $row['id'] . ': ' . $fail; }
			else {
				$relative = basename( $directory ) . '/' . $entry['file'];
				$url = plugins_url( '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $relative ) ) ) ) . '?cim-sha256=' . hash( 'sha256', $raw );
				$row['status'] = 'Checking'; $row['reason'] = 'Waiting for the same schema and engine checks used by the Player.'; $row['url'] = $url;
				$lessons[ $id ] = array( 'id' => $id, 'asset' => $entry['file'], 'url' => $url, 'present' => true, 'source' => 'lesson pack', 'shortcode' => '[cim experience="' . $id . '"]' );
			}
			$rows[] = $row;
		}
	}
	return array( 'lessons' => $lessons, 'rows' => $rows, 'packs' => $packs, 'errors' => $errors );
}

/** Capability-protected Admin Console calls this to expose every installed pack and lesson. */
function localis_cim_render_pack_inventory() {
	$inventory = localis_cim_read_lesson_packs( true );
	echo '<h2>Lesson packs</h2><p>Inactive packs are listed without reading their lesson data. Active lessons are checked here using the same validator as the Player. Checking is not acceptance; allow scripts to finish.</p>';
	echo '<table class="widefat striped"><thead><tr><th>Pack</th><th>Status</th><th>Reason</th></tr></thead><tbody>';
	foreach ( $inventory['packs'] as $index => $pack ) {
		printf( '<tr data-cim-pack-index="%1$s"><td>%2$s<br><code>%3$s</code></td><td data-cim-pack-status>%4$s</td><td data-cim-pack-reason>%5$s</td></tr>', esc_attr( $index ), esc_html( $pack['name'] ), esc_html( $pack['plugin'] ), esc_html( $pack['status'] ), esc_html( $pack['reason'] ) );
	}
	echo '</tbody></table><h3>Pack lessons</h3><table class="widefat striped"><thead><tr><th>Lesson ID</th><th>Pack</th><th>Status</th><th>Reason</th><th>Shortcode</th></tr></thead><tbody>';
	foreach ( $inventory['rows'] as $row ) {
		printf( '<tr data-cim-pack-lesson="%1$s" data-cim-pack-owner="%2$s" data-cim-pack-check-url="%3$s"><td><code>%4$s</code></td><td>%5$s</td><td data-cim-pack-status>%6$s</td><td data-cim-pack-reason>%7$s</td><td><code data-cim-pack-shortcode>Unavailable until validated</code></td></tr>', esc_attr( $row['id'] ), esc_attr( $row['pack'] ), esc_url( $row['url'] ), esc_html( $row['id'] ), esc_html( $inventory['packs'][ $row['pack'] ]['name'] ), esc_html( $row['status'] ), esc_html( $row['reason'] ) );
	}
	echo '</tbody></table>';
}

/** Load validation only on the authorized CiM administration screen. */
function localis_cim_enqueue_pack_health( $hook ) {
	if ( 'toplevel_page_code-in-motion' !== $hook || ! current_user_can( 'manage_options' ) ) { return; }
	$release = 'assets/modules/' . LOCALIS_CIM_PLUGIN_VERSION . '/wordpress/assets/lesson-pack-admin.mjs';
	$asset = is_file( __DIR__ . '/' . $release ) ? $release : 'assets/lesson-pack-admin.mjs';
	wp_enqueue_script( 'localis-cim-pack-health', plugin_dir_url( __FILE__ ) . $asset, array(), LOCALIS_CIM_PLUGIN_VERSION, true );
}
add_action( 'admin_enqueue_scripts', 'localis_cim_enqueue_pack_health' );
function localis_cim_pack_health_script_tag( $tag, $handle, $src ) {
	return 'localis-cim-pack-health' === $handle ? wp_get_script_tag( array( 'type' => 'module', 'src' => $src, 'id' => 'localis-cim-pack-health-js' ) ) : $tag;
}
add_filter( 'script_loader_tag', 'localis_cim_pack_health_script_tag', 10, 3 );
