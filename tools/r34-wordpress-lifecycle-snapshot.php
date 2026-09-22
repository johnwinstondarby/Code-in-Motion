<?php
/**
 * R34 lifecycle snapshot helper.
 *
 * Development/CI tooling only. This file is never staged in the plugin release.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

/**
 * Normalize WordPress values into deterministic JSON-safe structures.
 *
 * @param mixed $value Value to normalize.
 * @return mixed
 */
function localis_cim_r34_normalize_value( $value ) {
	if ( is_null( $value ) || is_bool( $value ) || is_int( $value ) || is_float( $value ) || is_string( $value ) ) {
		return $value;
	}

	if ( is_array( $value ) ) {
		$keys = array_keys( $value );
		$is_list = $keys === range( 0, count( $value ) - 1 );
		if ( $is_list ) {
			return array_map( 'localis_cim_r34_normalize_value', $value );
		}

		ksort( $value, SORT_STRING );
		$normalized = array();
		foreach ( $value as $key => $item ) {
			$normalized[ (string) $key ] = localis_cim_r34_normalize_value( $item );
		}
		return $normalized;
	}

	if ( is_object( $value ) ) {
		return array(
			'__class' => get_class( $value ),
			'__vars'  => localis_cim_r34_normalize_value( get_object_vars( $value ) ),
		);
	}

	return (string) $value;
}

/**
 * Read one key/value table into deterministic locator records.
 *
 * @param wpdb   $wpdb      WordPress database object.
 * @param string $label     Snapshot table label.
 * @param string $table     SQL table name.
 * @param string $id_column Primary key column, or empty string for options.
 * @param string $key_column Key/name column.
 * @param string $value_column Value column.
 * @return array
 */
function localis_cim_r34_table_records( $wpdb, $label, $table, $id_column, $key_column, $value_column ) {
	$order = '' === $id_column ? $key_column : $id_column;
	$rows = $wpdb->get_results(
		"SELECT * FROM {$table} ORDER BY {$order} ASC",
		ARRAY_A
	);

	$records = array();
	foreach ( $rows as $row ) {
		$key = (string) $row[ $key_column ];
		$locator = $label . ':';
		if ( '' !== $id_column ) {
			$locator .= (string) $row[ $id_column ] . ':';
		}
		$locator .= $key;

		$records[] = array(
			'locator' => $locator,
			'value'   => localis_cim_r34_normalize_value(
				maybe_unserialize( $row[ $value_column ] )
			),
		);
	}

	return $records;
}

/**
 * Snapshot wp-content regular files outside the plugin directory.
 *
 * @return array
 */
function localis_cim_r34_filesystem_snapshot() {
	$root = wp_normalize_path( WP_CONTENT_DIR );
	$plugin_root = $root . '/plugins/code-in-motion';
	$files = array();

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator(
			$root,
			FilesystemIterator::SKIP_DOTS
		),
		RecursiveIteratorIterator::LEAVES_ONLY
	);

	foreach ( $iterator as $file ) {
		$path = wp_normalize_path( $file->getPathname() );
		if ( $path === $plugin_root || 0 === strpos( $path, $plugin_root . '/' ) ) {
			continue;
		}
		if ( $file->isLink() ) {
			throw new RuntimeException( 'R34 lifecycle snapshot does not permit symlinks under wp-content: ' . $path );
		}
		if ( ! $file->isFile() ) {
			continue;
		}

		$relative = ltrim( substr( $path, strlen( $root ) ), '/' );
		$files[] = array(
			'path'   => $relative,
			'sha256' => hash_file( 'sha256', $path ),
		);
	}

	usort(
		$files,
		static function ( $left, $right ) {
			return strcmp( $left['path'], $right['path'] );
		}
	);

	return $files;
}

global $wpdb;

$records = array_merge(
	localis_cim_r34_table_records( $wpdb, 'options', $wpdb->options, '', 'option_name', 'option_value' ),
	localis_cim_r34_table_records( $wpdb, 'postmeta', $wpdb->postmeta, 'meta_id', 'meta_key', 'meta_value' ),
	localis_cim_r34_table_records( $wpdb, 'usermeta', $wpdb->usermeta, 'umeta_id', 'meta_key', 'meta_value' ),
	localis_cim_r34_table_records( $wpdb, 'termmeta', $wpdb->termmeta, 'meta_id', 'meta_key', 'meta_value' ),
	localis_cim_r34_table_records( $wpdb, 'commentmeta', $wpdb->commentmeta, 'meta_id', 'meta_key', 'meta_value' )
);

usort(
	$records,
	static function ( $left, $right ) {
		return strcmp( $left['locator'], $right['locator'] );
	}
);

$tables = $wpdb->get_col( 'SHOW TABLES' );
sort( $tables, SORT_STRING );

$snapshot = array(
	'schema'     => 'localis.cim/r34-lifecycle-snapshot/v1',
	'database'   => array(
		'records' => $records,
		'tables'  => array_values( $tables ),
	),
	'filesystem' => localis_cim_r34_filesystem_snapshot(),
);

echo wp_json_encode( $snapshot, JSON_UNESCAPED_SLASHES ) . PHP_EOL;
