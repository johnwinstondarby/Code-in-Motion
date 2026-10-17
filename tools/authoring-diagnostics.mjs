/** Keep frozen compiler diagnostics intact; present nested causes once, as plain text. */
export function formatAuthoringError(error) {
  const lines = new Set([error.message]);
  function visit(diagnostic) {
    if (diagnostic.message) lines.add(`${diagnostic.id ?? diagnostic.code ?? 'Validation'} ${diagnostic.path ?? '$'}: ${diagnostic.message}`);
    for (const cause of diagnostic.causes ?? []) visit(cause);
  }
  for (const diagnostic of error.diagnostics ?? []) visit(diagnostic);
  for (const cause of error.causes ?? []) visit(cause);
  return [...lines].join('\n');
}
