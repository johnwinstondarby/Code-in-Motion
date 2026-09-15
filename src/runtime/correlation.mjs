export function createRuntimeCorrelation() {
  let commandSequence = 0;
  let transitionSequence = 0;

  const nextCommandId = () => `cmd-${++commandSequence}`;
  const nextTransitionId = () => `txn-${++transitionSequence}`;

  const snapshot = () => Object.freeze({
    commandSequence,
    transitionSequence
  });

  return Object.freeze({
    nextCommandId,
    nextTransitionId,
    snapshot
  });
}
