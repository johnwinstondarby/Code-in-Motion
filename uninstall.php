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
delete_transient( 'localis_cim_pack_inventory_v1' );

// Companion lesson packs are separate plugins. CiM uninstall does not delete them or their lesson JSON.
