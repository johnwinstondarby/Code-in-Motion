import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const php = spawnSync('php', ['-v']);
const implementation = fileURLToPath(new URL('../wordpress/code-in-motion.php', import.meta.url)).replaceAll('\\','/');

test('PHP asset lifecycle registers inertly, predicts queried content, honors filters and catches late embeds', {skip:php.error?.code === 'ENOENT' ? 'PHP unavailable; real WordPress matrix remains required' : false}, () => {
  const result = spawnSync('php', ['-r', `
    define('ABSPATH', __DIR__);
    class WP_Post { public $post_content = ''; }
    $queued = array(); $registered = array(); $hooks = array(); $singular = true; $override = null;
    $post = new WP_Post();
    function add_action($hook,$callback,$priority=10) {global $hooks; $hooks[$hook][$priority][]=$callback;}
    function add_filter() {} function add_shortcode() {}
    function plugin_dir_url($file) {return 'https://test/plugin/';}
    function wp_register_script($handle,$src,$deps,$version,$args) {global $registered; $registered['script']=array($handle,$src,$version,$args);}
    function wp_register_style($handle,$src,$deps,$version) {global $registered; $registered['style']=array($handle,$src,$version);}
    function wp_enqueue_script($handle) {global $queued; $queued['script']=$handle;}
    function wp_enqueue_style($handle) {global $queued; $queued['style']=$handle;}
    function is_singular() {global $singular; return $singular;}
    function get_queried_object() {global $post; return $post;}
    function has_shortcode($content,$tag) {return false !== strpos($content,'[cim ');}
    function apply_filters($name,$value,$post) {global $override; return null === $override ? $value : $override;}
    function shortcode_atts($defaults,$atts) {return array_merge($defaults,$atts);}
    function esc_attr($text) {return htmlspecialchars($text);}
    function do_shortcode($text) {return $text;}
    function wp_kses_allowed_html() {return array();}
    function wp_kses($markup,$allowed) {return $markup;}
    function check($condition,$message) {if (!$condition) {throw new Exception($message);}}
    require '${implementation}';
    foreach ($hooks['wp_enqueue_scripts'][10] as $callback) {$callback();}
    check(empty($queued),'registration must not enqueue');
    check($registered['script'][3] === array('strategy'=>'defer','in_footer'=>true),'deferred footer script changed');
    localis_cim_maybe_enqueue_assets(); check(empty($queued),'empty page enqueued');
    $post->post_content='[cim experience="synthetic-wordpress"]';
    localis_cim_maybe_enqueue_assets(); check(count($queued)===2,'shortcode page omitted');
    $queued=array(); $singular=false;
    localis_cim_maybe_enqueue_assets(); check(empty($queued),'archive predicted shortcode from unrelated post');
    localis_cim_shortcode(array('experience'=>'synthetic-wordpress')); check(count($queued)===2,'late archive embed omitted');
    $queued=array(); $override=false;
    localis_cim_maybe_enqueue_assets(); localis_cim_shortcode(array('experience'=>'synthetic-wordpress'));
    check(empty($queued),'explicit suppression overridden');
    $override=true; localis_cim_maybe_enqueue_assets(); check(count($queued)===2,'explicit opt-in omitted');
    $override=null; $queued=array();
    check(localis_cim_shortcode(array('experience'=>'INVALID'))==='','invalid shortcode accepted');
    check(empty($queued),'invalid shortcode enqueued');
    echo 'PASS';
  `], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout, 'PASS');
});
