// Capability identity is independent of the WordPress/package release version.
// 1.0.1 adds optional Player CLI identity metadata and command clipboard behavior.
export const ENGINE_IDENTITY = Object.freeze({
  id: 'localis.cim/engine',
  version: '1.0.1',
  schemas: Object.freeze(['localis.cim/v1', 'localis.cim/v2'])
});
