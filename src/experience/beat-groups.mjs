// Shared structural metadata only. Never inspect opaque state or renderer configuration.
export function readExperienceBeats(experience) {
  if (experience.schema === 'localis.cim/v1') return Object.freeze([]);
  if (experience.schema !== 'localis.cim/v2') throw new TypeError('Beat grouping requires a known experience schema.');
  const groups = [];
  const seen = new Set();
  let group = null;
  for (const step of experience.steps) {
    const descriptor = Object.getOwnPropertyDescriptor(step, 'beat');
    const beat = descriptor?.value;
    const keys = ['id','ordinal','heading','segment_ordinal','segment_count','final'];
    if (!descriptor?.enumerable || !beat || Object.getPrototypeOf(beat) !== Object.prototype || !Object.isFrozen(beat) ||
        Reflect.ownKeys(beat).length !== keys.length || keys.some(key => {
          const value = Object.getOwnPropertyDescriptor(beat, key);
          return !value?.enumerable || !('value' in value);
        })) throw new TypeError('Beat metadata must be an exact frozen data object.');
    if (typeof beat.id !== 'string' || beat.id.length === 0 || beat.id === 'initial' ||
        typeof beat.heading !== 'string' || beat.heading.length === 0 ||
        !Number.isSafeInteger(beat.segment_count) || beat.segment_count < 1 || beat.segment_count > 99 ||
        typeof beat.final !== 'boolean') throw new TypeError('Invalid beat grouping metadata.');
    if (group === null || beat.id !== group.id) {
      if (group !== null && group.finalStepId === null) throw new TypeError('Beat must end at its final boundary.');
      if (seen.has(beat.id) || beat.ordinal !== groups.length + 1) throw new TypeError('Beats must be contiguous and ordinally aligned.');
      group = {id:beat.id, ordinal:beat.ordinal, heading:beat.heading, finalStepId:null, boundaryIds:[], segmentCount:beat.segment_count};
      groups.push(group); seen.add(beat.id);
    }
    if (group.finalStepId !== null || beat.ordinal !== group.ordinal || beat.heading !== group.heading ||
        beat.segment_count !== group.segmentCount || beat.segment_ordinal !== group.boundaryIds.length + 1 ||
        beat.final !== (beat.segment_ordinal === beat.segment_count)) throw new TypeError('Beat segments must align with one final boundary.');
    group.boundaryIds.push(step.id);
    if (beat.final) group.finalStepId = step.id;
  }
  if (group === null || group.finalStepId === null || groups.length !== experience.presentation.beat_count) {
    throw new TypeError('Beat count and final boundaries must align with presentation.');
  }
  return Object.freeze(groups.map(({id,ordinal,heading,finalStepId,boundaryIds}) => Object.freeze({
    id, ordinal, heading, finalStepId, boundaryIds:Object.freeze(boundaryIds)
  })));
}
