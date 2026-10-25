<?php
/** Read-only discovery of installed companion packs using cim.lesson-pack/v1 and, for multi-pane lessons, cim.lesson-pack/v2. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * ADR 0061 step 7 Part C development admission. Only the exact wp-config constant
 * enables it, and only while CiM itself is below 1.1.0; after the 1.1.0 release the
 * real version decides. Pack data, content and URLs cannot enable it.
 */
function localis_cim_development_admission_active() {
	return defined( 'LOCALIS_CIM_DEVELOPMENT_ADMISSION' ) && '1.1.0-dev' === LOCALIS_CIM_DEVELOPMENT_ADMISSION && version_compare( LOCALIS_CIM_PLUGIN_VERSION, '1.1.0', '<' );
}

/** Host version used for the v2 interval: the real version, or exactly the tested 1.1.0 target in development admission. */
function localis_cim_v2_host_version() {
	return localis_cim_development_admission_active() ? '1.1.0' : LOCALIS_CIM_PLUGIN_VERSION;
}

/** Confined regular payload file of a v2 pack: realpath must stay inside the pack directory. */
function localis_cim_v2_pack_path( $directory, $path ) {
	if ( ! is_string( $path ) || strlen( $path ) > 200 || ! preg_match( '/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/D', $path ) ) { return false; }
	$file = realpath( $directory . DIRECTORY_SEPARATOR . str_replace( '/', DIRECTORY_SEPARATOR, $path ) );
	if ( ! $file || 0 !== strpos( $file, $directory . DIRECTORY_SEPARATOR ) || ! is_file( $file ) || ! is_readable( $file ) ) { return false; }
	return $file;
}

/** Validate a v2 manifest and every listed file. Returns the decoded manifest, or a reason string. */
function localis_cim_v2_check_pack( $directory ) {
	$raw = localis_cim_pack_file( $directory, 'cim-lesson-pack.json', 262144 );
	$manifest = is_string( $raw ) ? json_decode( $raw, true ) : null;
	if ( ! is_array( $manifest ) || ( $manifest['schema'] ?? '' ) !== 'cim.lesson-pack/v2' || ! isset( $manifest['cim_min'], $manifest['cim_max_exclusive'], $manifest['lessons'], $manifest['files'] ) || ! is_array( $manifest['lessons'] ) || count( $manifest['lessons'] ) < 1 || count( $manifest['lessons'] ) > 100 || ! is_array( $manifest['files'] ) || count( $manifest['files'] ) < 1 || count( $manifest['files'] ) > 256 ) { return 'Invalid or oversized cim-lesson-pack.json v2 manifest.'; }
	foreach ( array( 'cim_min', 'cim_max_exclusive' ) as $field ) {
		if ( ! is_string( $manifest[ $field ] ) || ! preg_match( '/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/D', $manifest[ $field ] ) ) { return 'CiM compatibility bounds must be release semantic versions.'; }
	}
	$host = localis_cim_v2_host_version();
	if ( version_compare( $host, $manifest['cim_min'], '<' ) || version_compare( $host, $manifest['cim_max_exclusive'], '>=' ) || version_compare( $manifest['cim_min'], $manifest['cim_max_exclusive'], '>=' ) ) { return 'Incompatible pack: needs CiM >= ' . $manifest['cim_min'] . ' and < ' . $manifest['cim_max_exclusive'] . '; installed ' . LOCALIS_CIM_PLUGIN_VERSION . '.'; }
	if ( true !== ( $manifest['placeholder'] ?? null ) ) { return 'Only placeholder multi-pane packs are accepted in 1.1.0; real-capture verification is not available yet.'; }
	$seen = array(); $total = 0; $hashes = array();
	foreach ( $manifest['files'] as $entry ) {
		$path = is_array( $entry ) ? ( $entry['path'] ?? null ) : null;
		$size = is_array( $entry ) ? ( $entry['size'] ?? null ) : null;
		$sha = is_array( $entry ) ? ( $entry['sha256'] ?? null ) : null;
		if ( ! is_int( $size ) || $size < 0 || $size > 33554432 || ! is_string( $sha ) || ! preg_match( '/^[a-f0-9]{64}$/D', $sha ) ) { return 'Every listed pack file needs an exact byte size and SHA-256.'; }
		$file = localis_cim_v2_pack_path( $directory, $path );
		if ( false === $file ) { return 'Listed pack file is missing or escapes the pack folder: ' . ( is_string( $path ) ? substr( $path, 0, 200 ) : '(invalid)' ) . '.'; }
		$folded = strtolower( $path );
		if ( isset( $seen[ $folded ] ) ) { return 'Duplicate or case-colliding pack file path.'; }
		$seen[ $folded ] = true; $total += $size;
		if ( $total > 33554432 ) { return 'Pack payload exceeds 32 MiB.'; }
		clearstatcache( true, $file );
		if ( filesize( $file ) !== $size || ! hash_equals( $sha, (string) hash_file( 'sha256', $file ) ) ) { return 'Pack file differs from its manifest size or fingerprint: ' . $path . '.'; }
		$hashes[ $path ] = $sha;
	}
	$manifest['hashes'] = $hashes;
	return $manifest;
}

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
	$identity = array( LOCALIS_CIM_PLUGIN_VERSION, realpath( WP_PLUGIN_DIR ), plugins_url( '' ), hash_file( 'sha256', __DIR__ . '/experiences/registry.json' ), localis_cim_development_admission_active() );
	foreach ( $plugins as $plugin => $metadata ) {
		$file = WP_PLUGIN_DIR . '/' . $plugin;
		$active = is_plugin_active( $plugin ) || is_plugin_active_for_network( $plugin );
		$directory = realpath( dirname( $file ) );
		clearstatcache( true, $file );
		$item = array( $plugin, $metadata, $active, realpath( $file ), localis_cim_pack_stat( $file ) );
		if ( $active && $directory && dirname( $directory ) === realpath( WP_PLUGIN_DIR ) ) {
			$raw = localis_cim_pack_file( $directory, 'cim-lesson-pack.json', 65536 );
			if ( false === $raw ) { $raw = localis_cim_pack_file( $directory, 'cim-lesson-pack.json', 262144 ); }
			$item[] = $raw;
			$manifest = is_string( $raw ) ? json_decode( $raw, true ) : null;
			// v2 acceptance depends on every listed payload file, so any replacement invalidates it.
			if ( ( $manifest['schema'] ?? '' ) === 'cim.lesson-pack/v2' ) {
				foreach ( array_slice( is_array( $manifest['files'] ?? null ) ? $manifest['files'] : array(), 0, 256 ) as $entry ) {
					$name = is_array( $entry ) ? ( $entry['path'] ?? null ) : null;
					if ( ! is_string( $name ) || ! preg_match( '/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/D', $name ) ) { continue; }
					$path = $directory . '/' . $name;
					clearstatcache( true, $path );
					$item[] = array( $name, realpath( $path ), localis_cim_pack_stat( $path ) );
				}
			}
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
		if ( $index < 100 && 'cim.lesson-pack/v2' === $header['contract'] ) {
			localis_cim_scan_v2_pack( $index, $directory, $plugins_root, $metadata, $bundled, $packs, $lessons, $rows, $errors, $seen );
			continue;
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
	return array( 'lessons' => $lessons, 'rows' => $rows, 'packs' => $packs, 'errors' => $errors, 'development_admission' => localis_cim_development_admission_active() );
}

/** cim.lesson-pack/v2: placeholder multi-pane lessons, verified file by file before any URL is offered. */
function localis_cim_scan_v2_pack( $index, $directory, $plugins_root, $metadata, $bundled, &$packs, &$lessons, &$rows, &$errors, &$seen ) {
	$fail = '';
	if ( ! $directory || ! $plugins_root || dirname( $directory ) !== $plugins_root ) { $fail = 'Pack must have its own directory directly inside plugins.'; }
	$manifest = $fail ? null : localis_cim_v2_check_pack( $directory );
	if ( ! $fail && is_string( $manifest ) ) { $fail = $manifest; }
	if ( ! $fail && count( $rows ) + count( $manifest['lessons'] ) > 100 ) { $fail = 'At most 100 lessons are supported across active packs.'; }
	if ( $fail ) { $packs[ $index ]['reason'] = $fail; $errors[] = $metadata['Name'] . ': ' . $fail; return; }
	$packs[ $index ]['status'] = 'Checking'; $packs[ $index ]['reason'] = 'Lesson checks appear below.';
	foreach ( $manifest['lessons'] as $entry ) {
		$id = is_array( $entry ) ? ( $entry['id'] ?? '' ) : '';
		$row = array( 'pack' => $index, 'id' => is_string( $id ) ? substr( $id, 0, 200 ) : '(invalid)', 'status' => 'Rejected', 'reason' => '', 'url' => '', 'capture_url' => '', 'agreement' => 'cim.lesson-pack/v2' );
		$fail = '';
		$file = is_array( $entry ) ? ( $entry['file'] ?? null ) : null;
		$capture = is_array( $entry ) ? ( $entry['capture'] ?? null ) : null;
		if ( ! is_string( $id ) || strlen( $id ) > 100 || ! preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $id ) ) { $fail = 'Invalid lesson ID.'; }
		elseif ( in_array( $id, $bundled, true ) || isset( $seen[ $id ] ) ) {
			$fail = 'Conflicting lesson ID: no pack wins. Rename the lesson ID and rebuild.';
			unset( $lessons[ $id ] );
			foreach ( $rows as &$prior ) { if ( $prior['id'] === $id ) { $prior['status'] = 'Rejected'; $prior['reason'] = $fail; $prior['url'] = ''; } } unset( $prior );
		}
		if ( is_string( $id ) ) { $seen[ $id ] = true; }
		if ( ! $fail && ( ! is_string( $file ) || ! is_string( $capture ) || ! isset( $manifest['hashes'][ $file ], $manifest['hashes'][ $capture ] ) || ! preg_match( '/^[a-zA-Z0-9_-]+\.json$/D', $file ) || ! preg_match( '/^[a-zA-Z0-9_-]+\.json$/D', $capture ) ) ) { $fail = 'Lesson and capture must be manifest-listed JSON files in the pack folder.'; }
		$raw = $fail ? false : localis_cim_pack_file( $directory, $file, 2097152 );
		$raw_capture = $fail ? false : localis_cim_pack_file( $directory, $capture, 2097152 );
		if ( ! $fail && ( false === $raw || false === $raw_capture ) ) { $fail = 'Lesson and capture must be JSON of at most 2 MiB in their own pack folder.'; }
		$data = is_string( $raw ) ? json_decode( $raw, true ) : null;
		$capture_data = is_string( $raw_capture ) ? json_decode( $raw_capture, true ) : null;
		if ( ! $fail && ( ! is_array( $data ) || ( $data['id'] ?? null ) !== $id || ( $data['schema'] ?? null ) !== 'localis.cim/v2' || ( $data['renderer'] ?? null ) !== 'panes/v1' || true !== ( $data['renderer_config']['placeholder']['enabled'] ?? null ) ) ) { $fail = 'Expected matching compiled placeholder panes/v1 lesson JSON.'; }
		if ( ! $fail && ( ! is_array( $capture_data ) || ( $capture_data['schema'] ?? null ) !== 'localis.cim/engineering-capture/v1' || true !== ( $capture_data['placeholder'] ?? null ) ) ) { $fail = 'Expected a matching placeholder engineering capture.'; }
		if ( $fail ) { $row['reason'] = $fail; $errors[] = $metadata['Name'] . ' / ' . $row['id'] . ': ' . $fail; }
		else {
			$base = basename( $directory );
			$url = plugins_url( '/' . rawurlencode( $base ) . '/' . rawurlencode( $file ) ) . '?cim-sha256=' . $manifest['hashes'][ $file ];
			$capture_url = plugins_url( '/' . rawurlencode( $base ) . '/' . rawurlencode( $capture ) ) . '?cim-sha256=' . $manifest['hashes'][ $capture ];
			$row['status'] = 'Checking'; $row['reason'] = 'Waiting for the same admission checks used by the Player.'; $row['url'] = $url; $row['capture_url'] = $capture_url;
			$lessons[ $id ] = array( 'id' => $id, 'asset' => $file, 'url' => $url, 'capture_url' => $capture_url, 'agreement' => 'cim.lesson-pack/v2', 'present' => true, 'source' => 'lesson pack', 'shortcode' => '[cim experience="' . $id . '"]' );
		}
		$rows[] = $row;
	}
}

/** Capability-protected Admin Console calls this to expose every installed pack and lesson. */
function localis_cim_render_pack_inventory() {
	$inventory = localis_cim_read_lesson_packs( true );
	echo '<h2>Lesson packs</h2><p>Inactive packs are listed without reading their lesson data. Active lessons are checked here using the same validator as the Player. Checking is not acceptance; allow scripts to finish.</p>';
	if ( ! empty( $inventory['development_admission'] ) ) {
		echo '<div class="notice notice-warning inline" data-cim-development-admission-notice><p><strong>Development admission is on.</strong> LOCALIS_CIM_DEVELOPMENT_ADMISSION lets this pre-1.1.0 build accept multi-pane 1.1.0 placeholder packs for testing. Remove it from wp-config.php on production sites.</p></div>';
	}
	echo '<table class="widefat striped"><thead><tr><th>Pack</th><th>Status</th><th>Reason</th></tr></thead><tbody>';
	foreach ( $inventory['packs'] as $index => $pack ) {
		printf( '<tr data-cim-pack-index="%1$s"><td>%2$s<br><code>%3$s</code></td><td data-cim-pack-status>%4$s</td><td data-cim-pack-reason>%5$s</td></tr>', esc_attr( $index ), esc_html( $pack['name'] ), esc_html( $pack['plugin'] ), esc_html( $pack['status'] ), esc_html( $pack['reason'] ) );
	}
	echo '</tbody></table><h3>Pack lessons</h3><table class="widefat striped"><thead><tr><th>Lesson ID</th><th>Pack</th><th>Status</th><th>Reason</th><th>Shortcode</th></tr></thead><tbody>';
	foreach ( $inventory['rows'] as $row ) {
		$v2 = 'cim.lesson-pack/v2' === ( $row['agreement'] ?? '' ) ? sprintf( ' data-cim-pack-agreement="cim.lesson-pack/v2" data-cim-pack-capture-url="%s"', esc_url( $row['capture_url'] ) ) : '';
		printf( '<tr data-cim-pack-lesson="%1$s" data-cim-pack-owner="%2$s" data-cim-pack-check-url="%3$s"%8$s><td><code>%4$s</code></td><td>%5$s</td><td data-cim-pack-status>%6$s</td><td data-cim-pack-reason>%7$s</td><td><code data-cim-pack-shortcode>Unavailable until validated</code></td></tr>', esc_attr( $row['id'] ), esc_attr( $row['pack'] ), esc_url( $row['url'] ), esc_html( $row['id'] ), esc_html( $inventory['packs'][ $row['pack'] ]['name'] ), esc_html( $row['status'] ), esc_html( $row['reason'] ), $v2 );
	}
	echo '</tbody></table>';
}

/** Load validation only on the authorized CiM administration screen. */
function localis_cim_enqueue_pack_health( $hook ) {
	if ( 'toplevel_page_code-in-motion' !== $hook || ! current_user_can( 'manage_options' ) ) { return; }
	$release = 'assets/modules/' . LOCALIS_CIM_PLUGIN_VERSION . '/wordpress/assets/lesson-pack-admin.mjs';
	$asset = is_file( __DIR__ . '/' . $release ) ? $release : 'assets/lesson-pack-admin.mjs';
	$src = plugin_dir_url( __FILE__ ) . $asset;
	if ( localis_cim_development_admission_active() ) { $src = add_query_arg( 'cim-admission', 'development', $src ); }
	wp_enqueue_script( 'localis-cim-pack-health', $src, array(), LOCALIS_CIM_PLUGIN_VERSION, true );
}
add_action( 'admin_enqueue_scripts', 'localis_cim_enqueue_pack_health' );
function localis_cim_pack_health_script_tag( $tag, $handle, $src ) {
	return 'localis-cim-pack-health' === $handle ? wp_get_script_tag( array( 'type' => 'module', 'src' => $src, 'id' => 'localis-cim-pack-health-js' ) ) : $tag;
}
add_filter( 'script_loader_tag', 'localis_cim_pack_health_script_tag', 10, 3 );
