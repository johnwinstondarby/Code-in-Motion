<?php
/**
 * Plugin Name: Code in Motion
 * Description: Minimal WordPress host packaging for Code in Motion checkpoint #1.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Localis
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LOCALIS_CIM_PLUGIN_VERSION', '0.1.0' );
define( 'LOCALIS_CIM_SCRIPT_HANDLE', 'localis-cim-wordpress' );
define( 'LOCALIS_CIM_STYLE_HANDLE', 'localis-cim-wordpress' );

/**
 * Enqueue the external CiM browser entry and stylesheet.
 */
function localis_cim_enqueue_assets() {
	wp_enqueue_script(
		LOCALIS_CIM_SCRIPT_HANDLE,
		plugin_dir_url( __FILE__ ) . 'assets/bootstrap.js',
		array(),
		LOCALIS_CIM_PLUGIN_VERSION,
		true
	);

	wp_enqueue_style(
		LOCALIS_CIM_STYLE_HANDLE,
		plugin_dir_url( __FILE__ ) . 'assets/cim.css',
		array(),
		LOCALIS_CIM_PLUGIN_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'localis_cim_enqueue_assets' );

/**
 * Validate canonical CiM identifiers accepted by the shortcode edge.
 *
 * @param mixed $value Candidate identifier.
 * @return bool
 */
function localis_cim_is_identifier( $value ) {
	return is_string( $value ) && 1 === preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $value );
}

/**
 * Render one canonical CiM invocation root.
 *
 * Supported form:
 * [cim experience="synthetic-wordpress" instance="optional-id"]fallback[/cim]
 *
 * @param array|string $atts Shortcode attributes.
 * @param string|null  $content Optional static fallback content.
 * @return string
 */
function localis_cim_shortcode( $atts, $content = null ) {
	$atts = shortcode_atts(
		array(
			'experience' => '',
			'instance'   => '',
		),
		$atts,
		'cim'
	);

	$experience_id = is_string( $atts['experience'] ) ? trim( $atts['experience'] ) : '';
	$instance_id   = is_string( $atts['instance'] ) ? trim( $atts['instance'] ) : '';

	if ( ! localis_cim_is_identifier( $experience_id ) ) {
		return '';
	}
	if ( '' !== $instance_id && ! localis_cim_is_identifier( $instance_id ) ) {
		return '';
	}

	$instance_attribute = '';
	if ( '' !== $instance_id ) {
		$instance_attribute = sprintf( ' data-cim-instance="%s"', esc_attr( $instance_id ) );
	}

	$fallback_content = '';
	if ( null !== $content && '' !== trim( $content ) ) {
		$fallback_content = do_shortcode( $content );
	} else {
		$fallback_content = 'Code in Motion experience unavailable.';
	}

	$markup = sprintf(
		'<div class="cim" data-cim-experience="%1$s"%2$s><div data-cim-renderer-root></div><div class="cim-fallback">%3$s</div></div>',
		esc_attr( $experience_id ),
		$instance_attribute,
		$fallback_content
	);

	$allowed_html = wp_kses_allowed_html( 'post' );
	if ( ! isset( $allowed_html['div'] ) ) {
		$allowed_html['div'] = array();
	}
	$allowed_html['div']['class']  = true;
	$allowed_html['div']['data-*'] = true;

	return wp_kses( $markup, $allowed_html );
}
add_shortcode( 'cim', 'localis_cim_shortcode' );
