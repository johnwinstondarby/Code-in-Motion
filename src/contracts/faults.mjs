export const FAULT_RECOVERY_CLASS = Object.freeze({
  RECOVER: 'recover',
  FALLBACK: 'fallback'
});

export const FAULT_RECOVERY_CLASS_VALUES = Object.freeze(Object.values(FAULT_RECOVERY_CLASS));

export const FAULT_COMPONENT = Object.freeze({
  HOST: 'host',
  EXPERIENCE: 'experience',
  CORE: 'core',
  RUNTIME: 'runtime',
  RENDERER: 'renderer',
  COMMENTARY: 'commentary',
  TRANSPORT: 'transport',
  TELEMETRY: 'telemetry'
});

export const FAULT_COMPONENT_VALUES = Object.freeze(Object.values(FAULT_COMPONENT));
