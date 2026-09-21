<?php
/**
 * Plugin Name: Code in Motion
 * Plugin URI: https://github.com/johnwinstondarby/Code-in-Motion
 * Description: WordPress host, runtime bindings, and controls for Code in Motion experiences.
 * Version: 0.1.5
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Localis
 * Author URI: https://localis.services/
 * License: GPLv3
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/wordpress/code-in-motion.php';
