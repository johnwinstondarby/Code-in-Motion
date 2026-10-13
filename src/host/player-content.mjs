// ADR 0049: instructional data only; renderer state never crosses this seam.
import { readExperienceBeats } from '../experience/beat-groups.mjs';
export function createPlayerContent(experience, canonicalBoundaryIds) {
  const boundaryIds = Object.freeze([...canonicalBoundaryIds]);
  const entries = Object.freeze(experience.steps.map((step) => Object.freeze({
    stepId: step.id,
    text: step.commentary.text,
    links: Object.freeze(step.commentary.links.map(({ id, label, href }) =>
      Object.freeze({ id, label, href })))
  })));
  if (boundaryIds[0] !== 'initial' || entries.length !== boundaryIds.length - 1 ||
      entries.some((entry, i) => entry.stepId !== boundaryIds[i + 1])) {
    throw new TypeError('Player content must align exactly with canonical Runtime boundaries.');
  }
  return Object.freeze({
    rendererId: experience.renderer,
    title: experience.presentation?.title ?? null,
    description: experience.presentation?.description ?? null,
    boundaryIds,
    entries,
    beats: readExperienceBeats(experience),
    ...(experience.schema === 'localis.cim/v2' ? { instructions: Object.freeze(experience.steps.map(step =>
      Object.freeze({
        anchor: step.commentary.anchor ?? null,
        evidence: Object.freeze([...(step.commentary.evidence ?? [])]),
        risk: step.commentary.risk ? Object.freeze({level:step.commentary.risk.level,
          guidance:step.commentary.risk.guidance ?? null}) : null
      }))) } : {})
  });
}
