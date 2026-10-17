import { compileAuthoringSource } from '../authoring/v2/compile-authoring.mjs';
import { ingestExperience } from '../src/experience/ingest-experience.mjs';
import { assertWordPressExperienceAdmission } from '../src/host/wordpress-admission-policy.mjs';
import { createHash } from 'node:crypto';

export const MAX_AUTHORING_BYTES = 2 * 1024 * 1024;

// Stored ZIP entries, fixed epoch/modes, sorted paths: no platform-specific archive metadata.
export function createPortableArchive(entries) {
  const locals = [], centrals = [], seen = new Set();
  let offset = 0;
  if (!entries.length || entries.length > 65535) throw new Error('Invalid archive entry count.');
  for (const { path, data } of [...entries].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(path) || path.startsWith('/') || path.split('/').some(p=>p==='..'||p==='') || seen.has(path)) throw new Error('Unsafe or duplicate archive path.');
    seen.add(path);
    const bytes = Buffer.from(data), name = Buffer.from(path);
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6);
    local.writeUInt16LE(33,12); local.writeUInt32LE(crc,14); local.writeUInt32LE(bytes.length,18); local.writeUInt32LE(bytes.length,22); local.writeUInt16LE(name.length,26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(0x314,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0x800,8);
    central.writeUInt16LE(33,14); central.writeUInt32LE(crc,16); central.writeUInt32LE(bytes.length,20); central.writeUInt32LE(bytes.length,24); central.writeUInt16LE(name.length,28); central.writeUInt32LE((0o100644<<16)>>>0,38); central.writeUInt32LE(offset,42);
    locals.push(local,name,bytes); centrals.push(central,name); offset += local.length+name.length+bytes.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}

export function compileLesson(source) {
  if (Buffer.byteLength(source,'utf8') > MAX_AUTHORING_BYTES) throw new RangeError('Authored lesson exceeds 2 MiB.');
  const result = compileAuthoringSource(source);
  if (result.document.id.length > 100) throw new RangeError('Lesson ID must be at most 100 characters.');
  if (Buffer.byteLength(result.text,'utf8') > MAX_AUTHORING_BYTES) throw new RangeError('Compiled lesson exceeds 2 MiB; split it into smaller lessons.');
  assertWordPressExperienceAdmission(ingestExperience(result.document));
  return result;
}

export function createLessonPack(source, license) {
  const result = compileLesson(source), id = result.document.id;
  if (['git-basic-cycle','git-repository-practice','synthetic-wordpress','python-first-steps'].includes(id)) throw new Error('Choose your own lesson ID; bundled lesson IDs cannot be replaced.');
  const digest = createHash('sha256').update(result.text).digest('hex');
  const asset = 'lesson-' + digest + '.json', root = 'cim-lesson-' + id;
  // Only the compiler-validated ID and content hash enter PHP; authored text never enters code.
  const php = `<?php\n/**\n * Plugin Name: Code in Motion lesson - ${id}\n * Description: Companion lesson data for Code in Motion.\n * Version: ${result.document.experience_version}\n * CiM Lesson Pack: cim.lesson-pack/v1\n * Requires at least: 6.5\n * Requires PHP: 7.4\n * License: GPLv3\n * License URI: https://www.gnu.org/licenses/gpl-3.0.html\n */\nif ( ! defined( 'ABSPATH' ) ) { exit; }\n`;
  const zip = createPortableArchive([
    { path: root + '/lesson-pack.php', data: php },
    { path: root + '/' + asset, data: result.text },
    { path: root + '/cim-lesson-pack.json', data: JSON.stringify({schema:'cim.lesson-pack/v1',cim_min:'1.0.0',cim_max_exclusive:'2.0.0',lessons:[{id,file:asset}]},null,2)+'\n' },
    { path: root + '/LICENSE', data: license },
    { path: root + '/README.txt', data: `Activate alongside Code in Motion v1.0 or later.\nUse [cim experience="${id}"].\nThis pack survives CiM upgrades, rollbacks and uninstall. Delete this separate plugin only when you want to remove its lesson.\nThe PHP integration is GPLv3. Lesson authors retain rights in their original lesson content.\n` }
  ]);
  return { zip, id, compiled: result.text, sha256: createHash('sha256').update(zip).digest('hex') };
}
