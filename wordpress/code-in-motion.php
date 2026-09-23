<?php
/**
 * WordPress implementation for Code in Motion.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LOCALIS_CIM_PLUGIN_VERSION', '0.1.7' );
define( 'LOCALIS_CIM_SCRIPT_HANDLE', 'localis-cim-wordpress' );
define( 'LOCALIS_CIM_STYLE_HANDLE', 'localis-cim-wordpress' );
define( 'LOCALIS_CIM_MOTION_POLICY_OPTION', 'localis_cim_motion_policy' );
define( 'LOCALIS_CIM_MOTION_POLICY_SYSTEM', 'system' );
define( 'LOCALIS_CIM_MOTION_POLICY_REDUCE', 'reduce' );

/**
 * Validate the site motion policy.
 *
 * @param mixed $value Candidate policy.
 * @return bool
 */
function localis_cim_is_motion_policy( $value ) {
	return LOCALIS_CIM_MOTION_POLICY_SYSTEM === $value
		|| LOCALIS_CIM_MOTION_POLICY_REDUCE === $value;
}

/**
 * Read the site motion policy.
 *
 * Absence and malformed stored values both resolve to system behavior.
 *
 * @return string
 */
function localis_cim_get_motion_policy() {
	$value = get_option(
		LOCALIS_CIM_MOTION_POLICY_OPTION,
		LOCALIS_CIM_MOTION_POLICY_SYSTEM
	);

	return localis_cim_is_motion_policy( $value )
		? $value
		: LOCALIS_CIM_MOTION_POLICY_SYSTEM;
}

/**
 * Enqueue the external CiM browser entry and stylesheet.
 */
function localis_cim_enqueue_assets() {
	wp_enqueue_script(
		LOCALIS_CIM_SCRIPT_HANDLE,
		plugin_dir_url( __FILE__ ) . 'assets/bootstrap.js',
		array(),
		LOCALIS_CIM_PLUGIN_VERSION,
		array(
			'strategy'  => 'defer',
			'in_footer' => true,
		)
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
 * Project the site motion policy onto CiM's external bootstrap script.
 *
 * @param string $tag    Script element HTML.
 * @param string $handle WordPress script handle.
 * @return string
 */
function localis_cim_project_motion_policy_script_tag( $tag, $handle ) {
	if ( LOCALIS_CIM_SCRIPT_HANDLE !== $handle ) {
		return $tag;
	}

	$attribute = sprintf(
		' data-cim-motion-policy="%s" src=',
		esc_attr( localis_cim_get_motion_policy() )
	);
	$projected = preg_replace( '/\ssrc=/', $attribute, $tag, 1 );

	return is_string( $projected ) ? $projected : $tag;
}
add_filter(
	'script_loader_tag',
	'localis_cim_project_motion_policy_script_tag',
	10,
	2
);

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

require_once __DIR__ . '/admin-console.php';
