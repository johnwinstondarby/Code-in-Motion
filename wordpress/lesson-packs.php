<?php
/** Code in Motion companion lesson-pack metadata. Lesson data is gated again by the browser loader. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Read only JSON files belonging to installed plugins; never fetch a remote URL or execute lesson text. */
function cim_read_lesson_packs() {
	$registry_file = __DIR__ . '/experiences/registry.json';
	$registry = is_readable( $registry_file ) ? json_decode( file_get_contents( $registry_file ), true ) : array();
	$bundled = array_column( $registry['experiences'] ?? array(), 'id' );
	$lessons = array();
	$errors = array();
	$seen = array();
	$candidates = apply_filters( 'cim_lesson_packs', array() );
	if ( ! is_array( $candidates ) || count( $candidates ) > 100 ) {
		return array( 'lessons' => array(), 'errors' => array( 'Lesson-pack registry must be an array of at most 100 lessons.' ) );
	}
	foreach ( $candidates as $entry ) {
		$id = is_array( $entry ) ? ( $entry['id'] ?? '' ) : '';
		if ( ! is_string( $id ) || strlen( $id ) > 100 || ! preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $id ) ) {
			$errors[] = 'A lesson pack has an invalid lesson ID.';
			continue;
		}
		if ( in_array( $id, $bundled, true ) || isset( $seen[ $id ] ) ) {
			unset( $lessons[ $id ] );
			$seen[ $id ] = true;
			$errors[] = 'Duplicate or bundled lesson ID rejected: ' . $id;
			continue;
		}
		$seen[ $id ] = true;
		$file = isset( $entry['file'] ) && is_string( $entry['file'] ) ? realpath( $entry['file'] ) : false;
		$plugins = realpath( WP_PLUGIN_DIR );
		$prefix = $plugins ? $plugins . DIRECTORY_SEPARATOR : '';
		if ( ! $file || ! $prefix || 0 !== strpos( $file, $prefix ) || ! is_file( $file ) || ! is_readable( $file ) || '.json' !== substr( $file, -5 ) || filesize( $file ) > 2097152 ) {
			$errors[] = 'Lesson JSON must be a readable file of at most 2 MiB inside the plugins directory: ' . $id;
			continue;
		}
		$raw = file_get_contents( $file, false, null, 0, 2097153 );
		if ( ! is_string( $raw ) || strlen( $raw ) > 2097152 ) {
			$errors[] = 'Lesson JSON exceeds 2 MiB: ' . $id;
			continue;
		}
		$data = is_string( $raw ) ? json_decode( $raw, true, 512 ) : null;
		if ( ! is_array( $data ) || ( $data['id'] ?? null ) !== $id || ( $data['schema'] ?? null ) !== 'localis.cim/v2' || ( $data['renderer'] ?? null ) !== 'console/v1' ) {
			$errors[] = 'Lesson pack must contain matching compiled Console v2 JSON: ' . $id;
			continue;
		}
		// Derive the URL from the verified local file, never from pack-supplied URL metadata.
		$relative = str_replace( DIRECTORY_SEPARATOR, '/', substr( $file, strlen( $prefix ) ) );
		$url = plugins_url( '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $relative ) ) ) );
		$lessons[ $id ] = array( 'id' => $id, 'asset' => basename( $file ), 'url' => $url . '?cim-sha256=' . hash( 'sha256', $raw ), 'present' => true, 'source' => 'lesson pack', 'shortcode' => '[cim experience="' . $id . '"]' );
	}
	return array( 'lessons' => $lessons, 'errors' => $errors );
}
