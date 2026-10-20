// Step-3 feasibility projection only. This is deliberately not wired to compile,
// pack, preview, renderer registration or any Player/WordPress admission path.
import { validateExperience } from '../../src/experience/validate-experience.mjs';
import { assertValid, canonicalJSON, validateBundle } from './validate.mjs';

export function proveEnvelope(lesson, capture) {
  const bundle = assertValid(validateBundle(lesson, capture)), doc = bundle.lesson;
  const held = Object.fromEntries(doc.panes.map(p => [p.id, structuredClone(p.initial_state)]));
  let actionTab = doc.panes.find(p => p.type === 'console/v1').id;
  const snapshot = (beat = null) => ({ panes: structuredClone(held), action_tab: actionTab, placeholder: doc.placeholder,
    actions: beat?.actions ?? [], engineering_records: beat ? beat.engineering.records.map(id => bundle.capture.records.find(r => r.id === id)) : [],
    waiting: Object.fromEntries(doc.panes.map(p => [p.id, beat ? p.type !== 'explanation/v1' && !(p.type === 'diagram/v1' ? beat.engineering.records.length : beat.actions.some(a => a.pane === p.id)) : true])) });
  const initial = snapshot();
  const steps = doc.beats.map((b, i) => {
    for (const action of b.actions) {
      held[action.pane] = action.kind === 'cli' ? { lines: [action.command, ...action.output] } : { asset: action.asset, alt: action.alt, label: action.label };
      actionTab = action.pane;
    }
    held[b.explanation.pane] = { text: b.explanation.text };
    held[b.engineering.pane] = bundle.states[i];
    return { id: b.id, label: b.title, beat: { id: b.id, ordinal: i + 1, heading: b.title, segment_ordinal: 1, segment_count: 1, final: true }, commentary: { text: b.explanation.text, links: b.explanation.links }, dwell_ms: 0, state: snapshot(b) };
  });
  const document = { schema: 'localis.cim/v2', engine_min: '1.1.0', experience_version: doc.version, id: doc.id, renderer: 'panes/v1', renderer_config: { layout: 'action-context', panes: doc.panes, architecture: { hosts: doc.hosts, services: doc.services, artifacts: doc.artifacts }, placeholder: { enabled: doc.placeholder, label: doc.placeholder ? 'Placeholder content' : null }, capture_id: bundle.capture.id }, presentation: { title: doc.title, description: doc.description, subject: 'ai-run-custody', beat_count: doc.beats.length, default_playback_rate: 1 }, initial_state: initial, steps };
  const errors = validateExperience(document);
  if (errors.length) throw new Error('STOP: frozen v2 envelope rejected multi-pane projection: ' + JSON.stringify(errors));
  return { document, text: canonicalJSON(document), states: bundle.states };
}
