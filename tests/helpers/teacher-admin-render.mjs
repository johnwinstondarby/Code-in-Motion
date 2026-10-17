import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Execute the production render function with inert WordPress service fixtures.
export function renderTeacherAdmin() {
  const source = readFileSync(new URL('../../wordpress/admin-console.php', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('function localis_cim_render_admin_console()'));
  const fixtures = `
  define('LOCALIS_CIM_PLUGIN_VERSION','1.0.1');
  define('LOCALIS_CIM_MOTION_POLICY_SYSTEM','system');
  define('LOCALIS_CIM_MOTION_POLICY_REDUCE','reduce');
  function localis_cim_admin_can_view(){return true;}
  function localis_cim_admin_support_metadata(){return array();}
  function localis_cim_read_admin_inventory(){return array('status'=>'available','schema'=>'fixture','experiences'=>array(array('id'=>'<lesson>','asset'=>'lesson.json','present'=>true,'source'=>'release','shortcode'=>'[cim experience="lesson"]')));}
  function localis_cim_read_admin_renderer_inventory(){return array('status'=>'available','renderers'=>array());}
  function localis_cim_read_admin_release_info(){return array('status'=>'available','stable_tag'=>'1.0.1','tested_up_to'=>'7.1','current_release'=>array('version'=>'1.0.1','notes'=>array()),'support_uri'=>'https://github.com/johnwinstondarby/Code-in-Motion/issues');}
  function localis_cim_admin_static_health(){return array('deployment_mode'=>'release','active_module_root'=>'present','bootstrap'=>'present','experience_registry'=>'available','renderer_inventory'=>'available','renderer_count'=>0,'version_consistency'=>'consistent');}
  function localis_cim_get_motion_policy(){return 'system';}
  function localis_cim_admin_info_row($a,$b){echo '<tr><th>'.esc_html($a).'</th><td>'.esc_html($b).'</td></tr>';}
  function localis_cim_admin_status_label($a){return $a;}
  function get_bloginfo(){return 'fixture';}
  function esc_html($a){return htmlspecialchars((string)$a,ENT_QUOTES,'UTF-8');}
  function esc_attr($a){return esc_html($a);}
  function esc_url($a){return esc_html($a);}
  function admin_url($a){return '/wp-admin/'.$a;}
  function wp_nonce_field(){echo '<input type="hidden" name="_wpnonce" value="fixture">';}
  function selected($a,$b){return $a===$b?' selected':'';}
  function submit_button($a){echo '<button>'.esc_html($a).'</button>';}
  function localis_cim_read_lesson_packs(){return array('errors'=>array());}
  function localis_cim_render_pack_inventory(){echo '<h2>Lesson packs</h2><h3>Pack lessons</h3>';}
  `;
  const result = spawnSync('php', ['-r', fixtures + render + '\nlocalis_cim_render_admin_console();'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'PHP rendering failed');
  return result.stdout;
}
