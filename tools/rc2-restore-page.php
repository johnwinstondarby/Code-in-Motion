<?php
// Run through real WP-CLI eval-file, after the rollback ZIP has been installed.
if ( ! isset( $args[0], $args[1] ) ) { WP_CLI::error( 'Content file and page ID are required.' ); }
$content = file_get_contents( $args[0] );
$page_id = (int) $args[1];
if ( false === $content || $page_id < 1 || 'page' !== get_post_type( $page_id ) ) { WP_CLI::error( 'Invalid rollback content or page.' ); }
if ( ! current_user_can( 'unfiltered_html' ) ) { WP_CLI::error( 'Use an authorized WP-CLI --user with unfiltered_html, so the captured scripts are preserved.' ); }
if ( isset( $args[2] ) && 'check' === $args[2] ) { WP_CLI::success( 'Rollback content, page and editor capability checked.' ); return; }
$result = wp_update_post( wp_slash( array( 'ID' => $page_id, 'post_content' => $content ) ), true );
if ( is_wp_error( $result ) ) { WP_CLI::error( $result->get_error_message() ); }
if ( get_post_field( 'post_content', $page_id, 'raw' ) !== $content ) { WP_CLI::error( 'Restored content differs from the captured bytes.' ); }
WP_CLI::success( 'Restored page ' . $page_id . ' exactly; SHA-256 ' . hash( 'sha256', $content ) );
