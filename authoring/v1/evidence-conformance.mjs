// Compiler-conformance check for commentary evidence (EXPERIENCE-SCHEMA-v2 §9; A2R §9).
//
// The runtime validator deliberately treats step state as opaque and cannot prove that
// commentary.evidence corresponds to renderer focus state. This check is the enforcement
// point. It reads compiled Console state, which is legitimate only here: on the compiler side
// of the authority boundary, where the state format is the compiler's own output contract.
//
// For every boundary it proves:
//   1. state.focus deep-equals commentary.evidence as an ordered list (both directions, and order);
//   2. a boundary without commentary.evidence has an empty state.focus;
//   3. every focus id names an output line that is present in that same boundary's transcript.

function revealedOutputIds(state) {
  const ids = new Set();
  for (const entry of state.transcript ?? []) {
    for (const line of entry.output ?? []) if (line.id !== undefined) ids.add(line.id);
  }
  return ids;
}

export function evidenceCorrespondenceViolations(document) {
  const violations = [];
  const steps = Array.isArray(document?.steps) ? document.steps : [];
  steps.forEach((step, index) => {
    const at = `$.steps[${index}] (${step.id})`;
    const evidence = step.commentary?.evidence;
    const focus = step.state?.focus;
    if (!Array.isArray(focus)) {
      violations.push({ rule: 'focus-shape', at, message: 'state.focus must be an array.' });
      return;
    }
    if (evidence === undefined) {
      if (focus.length !== 0) violations.push({ rule: 'empty-without-evidence', at, message: `no commentary.evidence, but state.focus is ${JSON.stringify(focus)}.` });
    } else if (JSON.stringify(focus) !== JSON.stringify(evidence)) {
      const missing = evidence.filter((id) => !focus.includes(id));
      const extra = focus.filter((id) => !evidence.includes(id));
      const detail = missing.length || extra.length
        ? `evidence not in focus ${JSON.stringify(missing)}; focus not in evidence ${JSON.stringify(extra)}`
        : 'same ids in a different order';
      violations.push({ rule: 'ordered-equality', at, message: `state.focus ${JSON.stringify(focus)} != commentary.evidence ${JSON.stringify(evidence)} (${detail}).` });
    }
    const visible = revealedOutputIds(step.state);
    for (const id of focus) {
      if (!visible.has(id)) violations.push({ rule: 'focus-names-visible-line', at, message: `focus id "${id}" is not an output line in this boundary's transcript.` });
    }
  });
  return violations;
}
