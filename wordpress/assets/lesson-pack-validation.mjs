import { ingestExperience } from '../../src/experience/ingest-experience.mjs';
import { assertWordPressExperienceAdmission } from '../../src/host/wordpress-admission-policy.mjs';
import { assertConsoleRendererInput } from '../../src/renderers/subjects/console/validate-console-input.mjs';

/** One pack boundary shared by the authoring tool, Admin preflight and public loading. */
export function validatePackLesson(raw) {
  const experience = ingestExperience(raw);
  assertWordPressExperienceAdmission(experience);
  if (experience.schema !== 'localis.cim/v2' || experience.renderer !== 'console/v1') throw new TypeError('Packs require compiled Console v2 lessons.');
  assertConsoleRendererInput(experience.initial_state, experience.renderer_config ?? null, null);
  for (const step of experience.steps) {
    assertConsoleRendererInput(step.state, experience.renderer_config ?? null, step.renderer_config ?? null);
    for (const link of step.commentary.links) {
      let url;
      try { url = new URL(link.href); } catch { throw new TypeError('Lesson-pack links must be absolute HTTP or HTTPS URLs.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Lesson-pack links must use HTTP or HTTPS.');
    }
  }
  return experience;
}
