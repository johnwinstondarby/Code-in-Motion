import { freezeValidatedExperience } from '../../src/experience/freeze-validated-experience.mjs';

const EXPERIENCE_REGISTRY = Object.freeze({
  'code-in-motion-demo': 'code-in-motion-demo.json'
});

function fail(message) {
  throw new TypeError(message);
}

function assertBaseUrl(baseUrl) {
  if (!(baseUrl instanceof URL)) fail('packaged Experience baseUrl must be a URL.');
}

export function createPackagedExperienceLoader({ baseUrl, fetch }) {
  assertBaseUrl(baseUrl);
  if (typeof fetch !== 'function') fail('packaged Experience fetch must be a function.');

  async function load(experienceId) {
    if (typeof experienceId !== 'string' || experienceId.length === 0) {
      fail('packaged Experience id must be a non-empty string.');
    }

    const filename = EXPERIENCE_REGISTRY[experienceId];
    if (!filename) throw new Error(`Unknown packaged Experience: ${experienceId}.`);

    const url = new URL(filename, baseUrl);
    const response = await fetch(url.href, { credentials: 'same-origin' });
    if (!response || response.ok !== true || typeof response.json !== 'function') {
      const status = response && 'status' in response ? ` (${String(response.status)})` : '';
      throw new Error(`Unable to load packaged Experience ${experienceId}${status}.`);
    }

    const value = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(`Packaged Experience ${experienceId} must decode to an object.`);
    }
    if (value.schema !== 'localis.cim/v1') {
      fail(`Packaged Experience ${experienceId} must use localis.cim/v1.`);
    }
    if (value.id !== experienceId) {
      fail(`Packaged Experience identity mismatch: expected ${experienceId}.`);
    }

    return freezeValidatedExperience(value);
  }

  return Object.freeze({ load });
}

export const PACKAGED_EXPERIENCE_IDS = Object.freeze(Object.keys(EXPERIENCE_REGISTRY));
