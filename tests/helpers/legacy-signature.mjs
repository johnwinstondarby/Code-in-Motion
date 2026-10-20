import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');

// Normalize only the V8-owned suffix of this specific parse diagnostic. Keep
// every rule, path, compiler message and other diagnostic field byte-exact.
export function normalizeLegacyDiagnostics(value) {
  if (Array.isArray(value)) return value.map(normalizeLegacyDiagnostics);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    key === 'message' && value.id === 'CIM-AUTH-PARSE' && typeof child === 'string' && child.startsWith('Document is not valid JSON: ')
      ? 'Document is not valid JSON: <engine parse error>' : normalizeLegacyDiagnostics(child)]));
  return value;
}
export function legacySignature(compile, text) {
  try { const r = compile(text); return { accepted: true, text: hash(r.text), provenance: hash(r.provenanceText) }; }
  catch (e) { return { accepted: false, diagnostics: hash(JSON.stringify(normalizeLegacyDiagnostics({ message: e.message, diagnostics: e.diagnostics, causes: e.causes }))) }; }
}
