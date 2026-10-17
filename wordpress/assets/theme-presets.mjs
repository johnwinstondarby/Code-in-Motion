// Fixed presentation roles. This is not an author palette or public CSS API.
const common = {
  'console-background': '#000000', 'console-text': '#7CB7FF', 'console-quiet': '#6F93C2',
  'limn': '#FFFFFF', 'risk-free': '#7BD88F', 'risk-trace': '#F2B35B', 'risk-final': '#FF7A7A',
  'explanation-background': '#171B22', 'explanation-prose': '#A8B3C2', 'explanation-heading': '#E8ECF2',
  'wayfinding': '#5AC4C8', 'explanation-control': '#A9B1BD', 'structural-border': '#323A4A',
  'frame-background': '#171B22', 'frame-text': '#A8B3C2', 'control-text': '#E8ECF2',
  'control-border': '#A8B3C2', 'control-hover': '#323A4A', 'focus': '#A8B3C2', 'pane-focus': '#A8B3C2'
};
export const THEME_PRESETS = Object.freeze({
  localis: Object.freeze({ label: 'Localis', colors: Object.freeze(common) }),
  'high-contrast': Object.freeze({ label: 'High Contrast', colors: Object.freeze({
    ...common, 'console-text': '#82C4FF', 'console-quiet': '#8DB4E2',
    'risk-free': '#8CFFA0', 'risk-trace': '#FF9F43', 'risk-final': '#FF8A8A',
    'explanation-background': '#000000', 'explanation-prose': '#FFFFFF', 'explanation-heading': '#FFFFFF',
    'wayfinding': '#7FECEF', 'explanation-control': '#FFFFFF', 'structural-border': '#A9B1BD',
    'frame-background': '#000000', 'frame-text': '#FFFFFF', 'control-text': '#FFFFFF',
    'control-border': '#FFFFFF', 'control-hover': '#171B22', 'focus': '#8DB4E2', 'pane-focus': '#8DB4E2'
  }) }),
  light: Object.freeze({ label: 'Light', colors: Object.freeze({
      'console-background': '#F6F8FB', 'console-text': '#1A4B8C', 'console-quiet': '#4A6890',
    'limn': '#000000', 'risk-free': '#1E6E35', 'risk-trace': '#7A4E00', 'risk-final': '#A8231C',
    'explanation-background': '#FFFFFF', 'explanation-prose': '#344050', 'explanation-heading': '#111827',
    'wayfinding': '#0B6B6F', 'explanation-control': '#3F4A5A', 'structural-border': '#C9D2DE',
    'frame-background': '#EEF2F7', 'frame-text': '#1F2937', 'control-text': '#1F2937',
    'control-border': '#6E7A8C', 'control-hover': '#DCE3ED', 'focus': '#3F4A5A', 'pane-focus': '#1F2937'
  }) })
});
export const isThemeId = value => typeof value === 'string' && Object.hasOwn(THEME_PRESETS, value);

export function resolveLearnerTheme({ explicit, contrast = false, light = false, defaultTheme = 'localis' }) {
  if (isThemeId(explicit)) return explicit;
  return contrast ? 'high-contrast' : light ? 'light' : isThemeId(defaultTheme) ? defaultTheme : 'localis';
}

export function generateThemeCSS() {
  const root = '.cim:has(> [data-cim-player="console-explanation"])';
  const presets = Object.entries(THEME_PRESETS).map(([id, { colors }]) => {
    const selector = id === 'localis' ? root : `.cim[data-cim-theme="${id}"]:has(> [data-cim-player="console-explanation"])`;
    return selector + ' {\n' + Object.entries(colors).map(([role, value]) => `  --cim-${role}: ${value};`).join('\n') + '\n}';
  }).join('\n\n');
  const system = Object.keys(common).map(role => {
    const value = role.endsWith('background') || role === 'control-hover' ? 'Canvas'
      : ['focus', 'pane-focus', 'limn'].includes(role) ? 'Highlight'
      : role === 'wayfinding' ? 'LinkText' : 'CanvasText';
    return `    --cim-${role}: ${value};`;
  }).join('\n');
  return presets + '\n\n@media (forced-colors: active) {\n  ' + root + ',\n  .cim[data-cim-theme]:has(> [data-cim-player="console-explanation"]) {\n' + system + '\n  }\n}';
}
