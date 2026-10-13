import { assertEngineCompatibility } from '../experience/engine-compatibility.mjs';
import { ExperienceValidationError } from '../experience/ingest-experience.mjs';

// Other renderer modes remain v1-only until their complete v2 consumers exist.
export const WORDPRESS_V2_RENDERERS = Object.freeze(['console/v1']);
export function assertWordPressExperienceAdmission(experience) {
  assertEngineCompatibility(experience);
  if (experience.schema === 'localis.cim/v2' && !WORDPRESS_V2_RENDERERS.includes(experience.renderer)) {
    throw new ExperienceValidationError([{code:'CIM-EXP-016',path:'$.renderer',phase:'compatibility',
      message:`WordPress v2 Player consumers are unavailable for ${experience.renderer}.`}]);
  }
  return experience;
}
