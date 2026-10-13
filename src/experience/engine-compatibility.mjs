import { ENGINE_IDENTITY } from '../contracts/engine-identity.mjs';
import { ExperienceValidationError } from './ingest-experience.mjs';

function versionParts(version) {
  const match = typeof version === 'string' && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) throw new TypeError('Engine versions must be semantic version text.');
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some(id => /^[0-9]+$/.test(id) && id.length > 1 && id[0] === '0')) {
    throw new TypeError('Numeric prerelease identifiers must not have leading zeroes.');
  }
  return { numbers: match.slice(1,4).map(BigInt), prerelease };
}
export function compareEngineVersions(left, right) {
  const a=versionParts(left); const b=versionParts(right);
  for(let i=0;i<3;i++) if(a.numbers[i]!==b.numbers[i]) return a.numbers[i]>b.numbers[i]?1:-1;
  if(!a.prerelease.length || !b.prerelease.length) return a.prerelease.length ? -1 : b.prerelease.length ? 1 : 0;
  for(let i=0;i<Math.max(a.prerelease.length,b.prerelease.length);i++) {
    const x=a.prerelease[i];const y=b.prerelease[i];
    if(x===y) continue;
    if(x===undefined || y===undefined) return x===undefined?-1:1;
    const xn=/^[0-9]+$/.test(x); const yn=/^[0-9]+$/.test(y);
    if(xn && yn) return BigInt(x)>BigInt(y)?1:-1;
    if(xn!==yn) return xn?-1:1;
    return x>y?1:-1;
  }
  return 0;
}
export function assertEngineCompatibility(experience) {
  let reason;
  if (!ENGINE_IDENTITY.schemas.includes(experience.schema)) reason='unsupported runtime schema';
  else {
    try {
      if (compareEngineVersions(ENGINE_IDENTITY.version, experience.engine_min) < 0) reason='engine_min is not satisfied';
    } catch { reason='engine_min is not valid semantic version text'; }
  }
  if (reason) throw new ExperienceValidationError([{
    code:'CIM-EXP-015', path:'$.engine_min', phase:'compatibility',
    message:`${ENGINE_IDENTITY.id}@${ENGINE_IDENTITY.version}: ${reason} (${String(experience.engine_min)}).`
  }]);
  return experience;
}
