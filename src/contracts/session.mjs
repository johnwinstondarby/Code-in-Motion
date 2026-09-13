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
