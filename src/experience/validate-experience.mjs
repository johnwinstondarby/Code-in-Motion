const EXPERIENCE_SCHEMA_ID = 'localis.cim/v1';
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RENDERER_PATTERN = /^[a-z0-9][a-z0-9-]*\/v[1-9][0-9]*$/;
const LINK_PREFIX_PATTERN = /^(?:https?:\/\/|mailto:|\/|#)/i;
const ASCII_SPACE_OR_CONTROL = /[\u0000-\u0020\u007f]/g;

const EXPERIENCE_KEYS = new Set([
  'schema',
  'engine_min',
  'experience_version',
  'id',
  'renderer',
  'renderer_config',
  'initial_state',
  'steps'
]);
const EXPERIENCE_REQUIRED_KEYS = Object.freeze([
  'schema',
  'engine_min',
  'experience_version',
  'id',
  'renderer',
  'initial_state',
  'steps'
]);

const STEP_KEYS = new Set([
  'id',
  'label',
  'marker',
  'commentary',
  'state',
  'renderer_config',
  'dwell_ms'
]);
const STEP_REQUIRED_KEYS = Object.freeze(['id', 'label', 'commentary', 'state']);

const COMMENTARY_KEYS = new Set(['text', 'links']);
const COMMENTARY_REQUIRED_KEYS = Object.freeze(['text', 'links']);

const LINK_KEYS = new Set(['id', 'label', 'href']);
const LINK_REQUIRED_KEYS = Object.freeze(['id', 'label', 'href']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addError(errors, code, path, message, source = 'schema') {
  errors.push(Object.freeze({ code, path, message, source }));
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireKeys(value, requiredKeys, path, errors, code = 'CIM-EXP-002') {
  for (const key of requiredKeys) {
    if (!own(value, key)) addError(errors, code, `${path}.${key}`, 'required property is missing.');
  }
}

function rejectAdditionalKeys(value, allowedKeys, path, errors, code = 'CIM-EXP-002') {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) addError(errors, code, `${path}.${key}`, 'additional property is not allowed.');
  }
}

function requireNonEmptyString(value, path, errors, code = 'CIM-EXP-002') {
  if (typeof value !== 'string' || value.length === 0) {
    addError(errors, code, path, 'must be a non-empty string.');
    return false;
  }
  return true;
}

function validateRendererConfig(value, path, errors) {
  if (!isObject(value)) addError(errors, 'CIM-EXP-002', path, 'must be an object.');
}

function validateCommentaryLink(link, stepIndex, linkIndex, errors) {
  const path = `$.steps[${stepIndex}].commentary.links[${linkIndex}]`;
  if (!isObject(link)) {
    addError(errors, 'CIM-EXP-006', path, 'must be an object.');
    return;
  }

  requireKeys(link, LINK_REQUIRED_KEYS, path, errors, 'CIM-EXP-006');
  rejectAdditionalKeys(link, LINK_KEYS, path, errors, 'CIM-EXP-006');

  if (own(link, 'id')) {
    if (requireNonEmptyString(link.id, `${path}.id`, errors, 'CIM-EXP-006') && !IDENTIFIER_PATTERN.test(link.id)) {
      addError(errors, 'CIM-EXP-006', `${path}.id`, 'must be a canonical identifier.');
    }
  }

  if (own(link, 'label')) requireNonEmptyString(link.label, `${path}.label`, errors, 'CIM-EXP-006');

  if (own(link, 'href')) {
    if (requireNonEmptyString(link.href, `${path}.href`, errors, 'CIM-EXP-006') && !LINK_PREFIX_PATTERN.test(link.href)) {
      addError(errors, 'CIM-EXP-006', `${path}.href`, 'must use an allowed link prefix.');
    }
  }
}

function validateCommentary(commentary, stepIndex, errors) {
  const path = `$.steps[${stepIndex}].commentary`;
  if (!isObject(commentary)) {
    addError(errors, 'CIM-EXP-002', path, 'must be an object.');
    return;
  }

  requireKeys(commentary, COMMENTARY_REQUIRED_KEYS, path, errors);
  rejectAdditionalKeys(commentary, COMMENTARY_KEYS, path, errors);

  if (own(commentary, 'text')) requireNonEmptyString(commentary.text, `${path}.text`, errors);
  if (own(commentary, 'links')) {
    if (!Array.isArray(commentary.links)) {
      addError(errors, 'CIM-EXP-002', `${path}.links`, 'must be an array.');
    } else {
      commentary.links.forEach((link, linkIndex) => validateCommentaryLink(link, stepIndex, linkIndex, errors));
    }
  }
}

function validateStep(step, stepIndex, errors) {
  const path = `$.steps[${stepIndex}]`;
  if (!isObject(step)) {
    addError(errors, 'CIM-EXP-002', path, 'must be an object.');
    return;
  }

  requireKeys(step, STEP_REQUIRED_KEYS, path, errors);
  rejectAdditionalKeys(step, STEP_KEYS, path, errors);

  if (own(step, 'id')) {
    if (typeof step.id !== 'string' || !IDENTIFIER_PATTERN.test(step.id)) {
      addError(errors, 'CIM-EXP-002', `${path}.id`, 'must be a canonical step identifier.');
    } else if (step.id === 'initial') {
      addError(errors, 'CIM-EXP-004', `${path}.id`, 'initial is reserved and cannot be an authored step id.');
    }
  }

  if (own(step, 'label')) requireNonEmptyString(step.label, `${path}.label`, errors);
  if (own(step, 'marker')) requireNonEmptyString(step.marker, `${path}.marker`, errors);
  if (own(step, 'commentary')) validateCommentary(step.commentary, stepIndex, errors);
  if (own(step, 'state') && step.state === null) {
    addError(errors, 'CIM-EXP-002', `${path}.state`, 'must not be null.');
  }
  if (own(step, 'renderer_config')) validateRendererConfig(step.renderer_config, `${path}.renderer_config`, errors);
  if (own(step, 'dwell_ms') && (!Number.isInteger(step.dwell_ms) || step.dwell_ms < 0)) {
    addError(errors, 'CIM-EXP-005', `${path}.dwell_ms`, 'must be a non-negative integer.');
  }
}

function structuralErrorsFor(experience) {
  const errors = [];
  if (!isObject(experience)) {
    addError(errors, 'CIM-EXP-002', '$', 'experience must be an object.');
    return errors;
  }

  requireKeys(experience, EXPERIENCE_REQUIRED_KEYS, '$', errors);
  rejectAdditionalKeys(experience, EXPERIENCE_KEYS, '$', errors);

  if (own(experience, 'schema') && experience.schema !== EXPERIENCE_SCHEMA_ID) {
    addError(errors, 'CIM-EXP-001', '$.schema', `must equal ${EXPERIENCE_SCHEMA_ID}.`);
  }

  if (own(experience, 'engine_min')) {
    if (typeof experience.engine_min !== 'string' || !SEMVER_PATTERN.test(experience.engine_min)) {
      addError(errors, 'CIM-EXP-002', '$.engine_min', 'must be semantic version text.');
    }
  }

  if (own(experience, 'experience_version')) {
    if (typeof experience.experience_version !== 'string' || !SEMVER_PATTERN.test(experience.experience_version)) {
      addError(errors, 'CIM-EXP-002', '$.experience_version', 'must be semantic version text.');
    }
  }

  if (own(experience, 'id')) {
    if (typeof experience.id !== 'string' || !IDENTIFIER_PATTERN.test(experience.id)) {
      addError(errors, 'CIM-EXP-002', '$.id', 'must be a canonical experience identifier.');
    }
  }

  if (own(experience, 'renderer')) {
    if (typeof experience.renderer !== 'string' || !RENDERER_PATTERN.test(experience.renderer)) {
      addError(errors, 'CIM-EXP-002', '$.renderer', 'must be a canonical renderer identifier.');
    }
  }

  if (own(experience, 'renderer_config')) validateRendererConfig(experience.renderer_config, '$.renderer_config', errors);
  if (own(experience, 'initial_state') && experience.initial_state === null) {
    addError(errors, 'CIM-EXP-002', '$.initial_state', 'must not be null.');
  }

  if (own(experience, 'steps')) {
    if (!Array.isArray(experience.steps) || experience.steps.length === 0) {
      addError(errors, 'CIM-EXP-002', '$.steps', 'must be a non-empty array.');
    } else {
      experience.steps.forEach((step, stepIndex) => validateStep(step, stepIndex, errors));
    }
  }

  return errors;
}

function normalizedHref(value) {
  return value.replace(ASCII_SPACE_OR_CONTROL, '');
}

function semanticErrorsFor(experience) {
  const errors = [];
  if (!isObject(experience) || !Array.isArray(experience.steps)) return errors;

  const seenStepIds = new Set();
  experience.steps.forEach((step, stepIndex) => {
    if (!isObject(step)) return;
    const stepPath = `$.steps[${stepIndex}]`;

    if (typeof step.id === 'string') {
      if (seenStepIds.has(step.id)) {
        addError(errors, 'CIM-EXP-003', `${stepPath}.id`, `Duplicate step id: ${step.id}`, 'semantic');
      } else {
        seenStepIds.add(step.id);
      }
    }

    const links = step.commentary?.links;
    if (!Array.isArray(links)) return;

    const seenLinkIds = new Set();
    links.forEach((link, linkIndex) => {
      if (!isObject(link)) return;
      const linkPath = `${stepPath}.commentary.links[${linkIndex}]`;

      if (typeof link.id === 'string') {
        if (seenLinkIds.has(link.id)) {
          addError(
            errors,
            'CIM-EXP-006',
            `${linkPath}.id`,
            'Link ids must be unique within one commentary entry.',
            'semantic'
          );
        } else {
          seenLinkIds.add(link.id);
        }
      }

      if (typeof link.href === 'string' && !LINK_PREFIX_PATTERN.test(normalizedHref(link.href))) {
        addError(
          errors,
          'CIM-EXP-006',
          `${linkPath}.href`,
          'Link href must resolve to http, https, mailto, root-relative, or fragment navigation.',
          'semantic'
        );
      }
    });
  });

  return errors;
}

export function validateExperience(experience) {
  return Object.freeze([...structuralErrorsFor(experience), ...semanticErrorsFor(experience)]);
}
