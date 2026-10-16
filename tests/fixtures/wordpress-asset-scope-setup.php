// Test-only setup executed by WP-CLI in the isolated R20 environment.
// This file and the resulting MU plugin are never part of the delivery ZIP.
$pages = array(
    'cim-assets-plain' => 'A page without an interactive lesson.',
    'cim-assets-block' => '<!-- wp:shortcode -->[cim experience="synthetic-wordpress"]Fallback.[/cim]<!-- /wp:shortcode -->',
    'cim-assets-late' => 'The template adds a lesson after the page content.',
    'cim-assets-force' => 'Assets explicitly requested without an embed.',
    'cim-assets-suppress' => '[cim experience="synthetic-wordpress"]Suppressed fallback.[/cim]',
);
foreach ( $pages as $slug => $content ) {
    $existing = get_page_by_path( $slug );
    $id = wp_insert_post( array( 'ID' => $existing ? $existing->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $slug, 'post_content' => $content ), true );
    if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); }
}
$fixture = <<<'PHP'
<?php
add_filter( 'localis_cim_should_enqueue', function ( $needs, $post ) {
    if ( $post instanceof WP_Post && 'cim-assets-force' === $post->post_name ) { return true; }
    if ( $post instanceof WP_Post && 'cim-assets-suppress' === $post->post_name ) { return false; }
    return $needs;
}, 10, 2 );
add_action( 'wp_footer', function () {
    if ( is_page( 'cim-assets-late' ) ) {
        echo do_shortcode( '[cim experience="synthetic-wordpress" instance="late-one"]Late fallback.[/cim][cim experience="synthetic-wordpress" instance="late-two"]Second fallback.[/cim]' );
    }
}, 1 );
PHP;
wp_mkdir_p( WPMU_PLUGIN_DIR );
if ( false === file_put_contents( WPMU_PLUGIN_DIR . '/cim-asset-scope-fixture.php', $fixture ) ) {
    throw new RuntimeException( 'Cannot install isolated asset-scope fixture.' );
}
