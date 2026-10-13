// Capability identity is independent of the WordPress/package release version.
// 1.0.0 preserves the existing v1 minimum; it also includes the v2 0.2.0 contract.
export const ENGINE_IDENTITY = Object.freeze({
  id: 'localis.cim/engine',
  version: '1.0.0',
  schemas: Object.freeze(['localis.cim/v1', 'localis.cim/v2'])
});
