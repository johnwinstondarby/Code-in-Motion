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

// Companion lesson packs are separate plugins. CiM uninstall does not delete them or their lesson JSON.
