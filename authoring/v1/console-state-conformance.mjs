// Producer-side conformance to docs/renderers/CONSOLE-RENDERER-v1.md §§2–3 for compiled output.
// Like evidence-conformance, this reads Console state legitimately: on the compiler side of the
// authority boundary. Core and the shared runtime validator never perform these checks.

const CONFIG_KEYS = ['title', 'prompt'];
const STATE_KEYS = ['transcript', 'focus'];
const ENTRY_KEYS = ['beat', 'prompt', 'command', 'copy', 'typing', 'risk', 'output', 'awaiting_response', 'response'];
const LINE_KEYS = ['id', 'text', 'tone'];
const TONES = ['normal', 'dim', 'accent', 'added', 'removed', 'warning'];
const RISKS = ['free-to-undo', 'leaves-a-trace', 'cannot-be-undone'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isLine = (v) => typeof v === 'string' && v.length > 0 && !/[\t\r\n\u2028\u2029]/.test(v);

export function consoleStateViolations(document) {
  const out = [];
  const v = (at, message) => out.push({ at, message });
  const exact = (obj, allowed, required, at) => {
    if (!isObj(obj)) { v(at, 'must be an object'); return false; }
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) v(`${at}.${k}`, 'not permitted by CONSOLE-RENDERER-v1');
    for (const k of required) if (!(k in obj)) v(`${at}.${k}`, 'required by CONSOLE-RENDERER-v1');
    return true;
  };
  if (document?.renderer !== 'console/v1') v('$.renderer', 'must be console/v1');
  const config = document?.renderer_config ?? {};
  exact(config, CONFIG_KEYS, [], '$.renderer_config');
  if ('title' in config && typeof config.title !== 'string') v('$.renderer_config.title', 'must be a string');
  if ('prompt' in config && !isLine(config.prompt)) v('$.renderer_config.prompt', 'must be a non-empty single line');

  const checkState = (state, at) => {
    if (!exact(state, STATE_KEYS, STATE_KEYS, at)) return;
    if (!Array.isArray(state.transcript) || !Array.isArray(state.focus)) { v(at, 'transcript and focus must be arrays'); return; }
    const ids = new Set();
    state.transcript.forEach((entry, ei) => {
      const ea = `${at}.transcript[${ei}]`;
      if (!exact(entry, ENTRY_KEYS, ['beat', 'command', 'copy'], ea)) return;
      if (!ID.test(entry.beat)) v(`${ea}.beat`, 'must be a canonical identifier');
      for (const k of ['command', 'copy']) if (!isLine(entry[k])) v(`${ea}.${k}`, 'must be a non-empty single line');
      if ('prompt' in entry && !isLine(entry.prompt)) v(`${ea}.prompt`, 'must be a non-empty single line');
      if (!('prompt' in entry) && typeof config.prompt !== 'string') v(`${ea}.prompt`, 'no entry prompt and no renderer_config.prompt');
      if ('typing' in entry && entry.typing !== false) v(`${ea}.typing`, 'may only be false');
      if ('risk' in entry && !RISKS.includes(entry.risk)) v(`${ea}.risk`, 'unknown risk level');
      if ('awaiting_response' in entry && entry.awaiting_response !== true) v(`${ea}.awaiting_response`, 'may only be true');
      if ('response' in entry && !isLine(entry.response)) v(`${ea}.response`, 'must be a non-empty single line');
      if (entry.awaiting_response && 'response' in entry) v(ea, 'awaiting_response and response are mutually exclusive');
      if ((entry.awaiting_response || 'response' in entry) && !(Array.isArray(entry.output) && entry.output.length > 0)) v(ea, 'an interactive prompt requires non-empty output');
      if ('output' in entry) {
        if (!Array.isArray(entry.output) || entry.output.length === 0) { v(`${ea}.output`, 'must be a non-empty array when present'); return; }
        entry.output.forEach((line, li) => {
          const la = `${ea}.output[${li}]`;
          if (!exact(line, LINE_KEYS, ['text', 'tone'], la)) return;
          if (typeof line.text !== 'string' || /[\t\r\n\u2028\u2029]/.test(line.text)) v(`${la}.text`, 'must be a single tab-free line');
          if (!TONES.includes(line.tone)) v(`${la}.tone`, 'unknown tone');
          if ('id' in line) {
            if (!ID.test(line.id)) v(`${la}.id`, 'must be a canonical identifier');
            else if (ids.has(line.id)) v(`${la}.id`, 'output ids must be unique across the state');
            else ids.add(line.id);
          }
        });
      }
    });
    const seen = new Set();
    state.focus.forEach((id, fi) => {
      if (seen.has(id)) v(`${at}.focus[${fi}]`, 'duplicate focus id');
      seen.add(id);
      if (!ids.has(id)) v(`${at}.focus[${fi}]`, `focus id "${id}" names no output line in this state`);
    });
  };

  checkState(document?.initial_state, '$.initial_state');
  (document?.steps ?? []).forEach((step, si) => {
    if ('renderer_config' in step) v(`$.steps[${si}].renderer_config`, 'console/v1 defines no step-level renderer configuration');
    checkState(step.state, `$.steps[${si}].state`);
  });
  return out;
}
