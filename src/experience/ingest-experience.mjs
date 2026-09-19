import { FAULT_COMPONENT, FAULT_RECOVERY_CLASS } from '../contracts/faults.mjs';
import { freezeValidatedExperience } from './freeze-validated-experience.mjs';
import { validateExperience } from './validate-experience.mjs';

function freezeValidationErrors(errors) {
  return Object.freeze(errors.map((error) => Object.freeze({ ...error })));
}

export class ExperienceValidationError extends TypeError {
  constructor(errors) {
    const frozenErrors = freezeValidationErrors(errors);
    const first = frozenErrors[0];
    super(first ? `${first.code} ${first.path}: ${first.message}` : 'Experience validation failed.');
    this.name = 'ExperienceValidationError';
    this.code = first?.code ?? 'CIM-EXP-002';
    this.errors = frozenErrors;
    this.fault = Object.freeze({
      code: this.code,
      component: FAULT_COMPONENT.EXPERIENCE,
      recoveryClass: FAULT_RECOVERY_CLASS.FALLBACK
    });
  }
}

/**
 * Validates raw experience JSON against the production localis.cim/v1 rules,
 * rebuilds it into inert JSON data, and deep-freezes the rebuilt graph.
 *
 * A successful return is suitable for Runtime consumption. Callers must not
 * bypass this function by freezing or forwarding fetched JSON directly.
 */
export function ingestExperience(experience) {
  const errors = validateExperience(experience);
  if (errors.length > 0) throw new ExperienceValidationError(errors);
  return freezeValidatedExperience(experience);
}
