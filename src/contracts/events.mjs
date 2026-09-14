export const EVENT_SCHEMA = 'localis.cim.event/v1';

export const EVENT_RESULT = Object.freeze({
  SUCCESS: 'success',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  RECOVERED: 'recovered',
  NO_CHANGE: 'no_change'
});

export const EVENT_RESULT_VALUES = Object.freeze(Object.values(EVENT_RESULT));

export const EVENT_COMPONENT = Object.freeze({
  HOST: 'host',
  RUNTIME: 'runtime',
  CORE: 'core',
  TRANSPORT: 'transport',
  COMMENTARY: 'commentary',
  RENDERER: 'renderer',
  ACCESSIBILITY: 'accessibility',
  EXPERIENCE: 'experience',
  TELEMETRY: 'telemetry'
});

export const EVENT_COMPONENT_VALUES = Object.freeze(Object.values(EVENT_COMPONENT));

export const COMMAND_SOURCE = Object.freeze({
  TRANSPORT: 'transport',
  MARKER: 'marker',
  COMMENTARY: 'commentary',
  SCRUB: 'scrub',
  DEEP_LINK: 'deep_link',
  HOST: 'host',
  REPLAY: 'replay'
});

export const COMMAND_SOURCE_VALUES = Object.freeze(Object.values(COMMAND_SOURCE));

export const EVENT_NAME = Object.freeze({
  COMMAND_RECEIVED: 'command.received',
  COMMAND_ACCEPTED: 'command.accepted',
  COMMAND_REJECTED: 'command.rejected',
  PLAYBACK_STARTED: 'playback.started',
  PLAYBACK_PAUSED: 'playback.paused',
  PLAYBACK_RESUMED: 'playback.resumed',
  PLAYBACK_STOPPED: 'playback.stopped',
  DWELL_STARTED: 'dwell.started',
  DWELL_COMPLETED: 'dwell.completed',
  DWELL_CANCELLED: 'dwell.cancelled',
  TRANSITION_STARTED: 'transition.started',
  TRANSITION_CANCELLED: 'transition.cancelled',
  TRANSITION_SETTLED: 'transition.settled',
  TRANSITION_FAILED: 'transition.failed',
  STEP_CHANGED: 'step.changed',
  STEP_INITIAL: 'step.initial',
  COMMENTARY_ACTIVE_CHANGED: 'commentary.active.changed',
  COMMENTARY_FRONTIER_CHANGED: 'commentary.frontier.changed',
  COMMENTARY_AUTOFOLLOW_CHANGED: 'commentary.autofollow.changed',
  RENDERER_MOUNTED: 'renderer.mounted',
  RENDERER_SETTLED: 'renderer.settled',
  RENDERER_CANCELLED: 'renderer.cancelled',
  RENDERER_ERROR: 'renderer.error',
  RENDERER_DISPOSED: 'renderer.disposed',
  RECOVERY_STARTED: 'recovery.started',
  RECOVERY_SUCCEEDED: 'recovery.succeeded',
  RECOVERY_FAILED: 'recovery.failed',
  INSTANCE_FAULTED: 'instance.faulted',
  HOST_FALLBACK_SHOWN: 'host.fallback.shown',
  EXPERIENCE_VALIDATION_SUCCEEDED: 'experience.validation.succeeded',
  EXPERIENCE_VALIDATION_FAILED: 'experience.validation.failed',
  RENDERER_RESOLVE_FAILED: 'renderer.resolve.failed',
  EXPERIENCE_LOAD_FAILED: 'experience.load.failed',
  HOST_DEEPLINK_INVALID: 'host.deeplink.invalid',
  ACCESSIBILITY_FOCUS_CHANGED: 'accessibility.focus.changed',
  ACCESSIBILITY_ANNOUNCEMENT: 'accessibility.announcement',
  ACCESSIBILITY_REDUCED_MOTION_APPLIED: 'accessibility.reduced_motion.applied'
});

export const EVENT_NAME_VALUES = Object.freeze(Object.values(EVENT_NAME));
