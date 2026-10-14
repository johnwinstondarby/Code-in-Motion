<?php
// Real WP-CLI read-only page capture, without CLI formatting/newline changes.
if ( ! isset( $args[0], $args[1] ) ) { WP_CLI::error( 'Output file and page ID are required.' ); }
$page_id = (int) $args[1];
if ( $page_id < 1 || 'page' !== get_post_type( $page_id ) ) { WP_CLI::error( 'Invalid page.' ); }
$content = get_post_field( 'post_content', $page_id, 'raw' );
if ( false === file_put_contents( $args[0], $content ) ) { WP_CLI::error( 'Could not save captured content.' ); }
WP_CLI::success( 'Captured page ' . $page_id . '; SHA-256 ' . hash( 'sha256', $content ) );
