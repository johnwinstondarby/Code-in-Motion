<?php
// CI-only large-page fixture. Never operate on a real content page.
$page_id = isset( $args[0] ) ? (int) $args[0] : 0;
if ( 'cim-e2e-r16' !== get_post_field( 'post_name', $page_id, 'raw' ) ) { WP_CLI::error( 'Requires the isolated R16 fixture page.' ); }
$content = get_post_field( 'post_content', $page_id, 'raw' ) . str_repeat( '<!-- RC2 rollback "quoted" backslash \\ and unicode → -->' . "\n", 8000 );
$result = wp_update_post( wp_slash( array( 'ID' => $page_id, 'post_content' => $content ) ), true );
if ( is_wp_error( $result ) || get_post_field( 'post_content', $page_id, 'raw' ) !== $content ) { WP_CLI::error( 'Large-page fixture did not preserve bytes.' ); }
WP_CLI::success( 'Prepared ' . strlen( $content ) . '-byte rollback page (larger than captured page 3227).' );
