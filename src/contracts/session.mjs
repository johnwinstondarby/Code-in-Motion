export const INITIAL_BOUNDARY_ID = 'initial';

export const SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  PLAYING: 'playing',
  TRANSITIONING: 'transitioning',
  PAUSED: 'paused',
  FAULTED: 'faulted',
  DISPOSED: 'disposed'
});

export const SESSION_STATUS_VALUES = Object.freeze(Object.values(SESSION_STATUS));

export const NAVIGATION_COMMAND = Object.freeze({
  NEXT: 'next',
  PREVIOUS: 'previous',
  SEEK: 'seek',
  HOME: 'home',
  END: 'end',
  RESTART: 'restart'
});

export const NAVIGATION_COMMAND_VALUES = Object.freeze(Object.values(NAVIGATION_COMMAND));

export const COMMAND_RESULT = Object.freeze({
  SUCCESS: 'success',
  REJECTED: 'rejected',
  NO_CHANGE: 'no_change'
});

export const NAVIGATION_REASON = Object.freeze({
  AT_START: 'at_start',
  AT_END: 'at_end',
  UNKNOWN_STEP: 'unknown_step',
  FAULTED: 'faulted',
  DISPOSED: 'disposed'
});
