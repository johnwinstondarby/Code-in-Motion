import { COMMAND_SOURCE } from '../contracts/events.mjs';

export const WORDPRESS_DEEP_LINK_RESOLVER_KEYS = Object.freeze(['resolve']);

function fail(message) {
  throw new TypeError(message);
}

function decodeSegment(value, label) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    fail('CiM deep-link ' + label + ' is not valid percent-encoding.');
  }
  if (decoded.length === 0 || decoded.includes('/') || decoded.includes('#')) {
    fail('CiM deep-link ' + label + ' must be a non-empty path segment.');
  }
  return decoded;
}

export function parseCiMDeepLinkFragment(fragment) {
  if (typeof fragment !== 'string') {
    fail('CiM deep-link fragment must be a string.');
  }
  if (fragment.length === 0 || !fragment.startsWith('#cim/')) return null;

  const parts = fragment.split('/');
  if (parts.length !== 4 || parts[0] !== '#cim' || parts[1].length === 0 || parts[2].length === 0 || parts[3].length !== 0) {
    // The canonical grammar has exactly two segments after #cim. split('/') on
    // "#cim/experience/step" yields three entries, so handle that form below.
  }

  const match = /^#cim\/([^/]+)\/([^/]+)$/.exec(fragment);
  if (match === null) {
    fail('CiM deep-link must use #cim/{experience-id}/{step-id}.');
  }

  return Object.freeze({
    experienceId: decodeSegment(match[1], 'experience-id'),
    stepId: decodeSegment(match[2], 'step-id')
  });
}

function readExperienceIdentity(experience) {
  if (experience === null || typeof experience !== 'object' || !Object.isFrozen(experience)) {
    fail('CiM deep-link resolver requires a frozen validated experience.');
  }
  if (typeof experience.id !== 'string' || experience.id.length === 0) {
    fail('CiM deep-link resolver experience.id must be a non-empty string.');
  }
  if (!Array.isArray(experience.steps)) {
    fail('CiM deep-link resolver experience.steps must be an array.');
  }
  return experience.id;
}

export function resolveWordPressDeepLink(fragment, experienceId, experience) {
  if (typeof experienceId !== 'string' || experienceId.length === 0) {
    fail('WordPress deep-link experience ID must be a non-empty string.');
  }

  const loadedExperienceId = readExperienceIdentity(experience);
  if (loadedExperienceId !== experienceId) {
    fail('WordPress deep-link experience identity does not match the loaded experience.');
  }

  const target = parseCiMDeepLinkFragment(fragment);
  if (target === null || target.experienceId !== experienceId) return null;

  const validBoundary = target.stepId === 'initial' ||
    experience.steps.some((step) => step && step.id === target.stepId);
  if (!validBoundary) {
    fail('CiM deep-link target is not a known semantic boundary: ' + target.stepId + '.');
  }

  return Object.freeze({
    stepId: target.stepId,
    source: COMMAND_SOURCE.DEEP_LINK
  });
}

export function createWordPressDeepLinkResolver({ readFragment }) {
  if (typeof readFragment !== 'function') {
    fail('WordPress deep-link resolver readFragment must be a function.');
  }

  return Object.freeze({
    resolve(experienceId, experience) {
      return resolveWordPressDeepLink(readFragment(), experienceId, experience);
    }
  });
}
