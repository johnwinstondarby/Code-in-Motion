<?php
/**
 * Code in Motion uninstall cleanup.
 *
 * @package CodeInMotion
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'localis_cim_motion_policy' );
