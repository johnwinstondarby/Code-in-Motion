import {validateMediaFiles} from './media-files.mjs';
import { open, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { LIMITS, RULES, V3ValidationError, assertValid, jsonBasename, safePath, validateBundle, validateDocument } from './validate.mjs';

const fail = (id, path, message) => { throw new V3ValidationError([{ id, path, message: `${message} Fix: ${RULES[id]}`, fix: RULES[id] }]); };
const inside = (root, file) => { const rel = relative(root, file); return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')); };

export async function readBoundedFile(path, max = LIMITS.bytes, diagnosticPath = '$') {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) fail('CIM-V3-ARCHIVE-PATH', diagnosticPath, 'Expected a regular file.');
    if (info.size > max) fail('CIM-V3-LIMIT', diagnosticPath, 'File exceeds its byte limit.');
    const buffer = Buffer.alloc(max + 1); let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    if (count > max) fail('CIM-V3-LIMIT', diagnosticPath, 'File grew beyond its byte limit.');
    return buffer.subarray(0, count);
  } finally { await handle.close(); }
}

async function confined(root, candidate, path) {
  let file;
  try { file = await realpath(candidate); }
  catch { fail('CIM-V3-EVIDENCE', path, 'Referenced file or archive does not exist.'); }
  if (!inside(root, file)) fail('CIM-V3-ARCHIVE-PATH', path, 'Resolved path escapes its declared folder.');
  return file;
}

export async function validateArchiveFiles(capture, directory) {
  assertValid(validateDocument(capture, 'capture'));
  const base = await realpath(directory);
  if (!safePath(capture.archive.root)) fail('CIM-V3-ARCHIVE-PATH', '$capture.archive.root', 'Unsafe archive root.');
  const root = await confined(base, resolve(base, capture.archive.root), '$capture.archive.root');
  if (!(await stat(root)).isDirectory()) fail('CIM-V3-ARCHIVE-PATH', '$capture.archive.root', 'Archive root is not a directory.');
  let total = 0;
  for (const [i, entry] of capture.archive.files.entries()) {
    const path = `$capture.archive.files[${i}]`;
    if (!safePath(entry.path)) fail('CIM-V3-ARCHIVE-PATH', path + '.path', 'Unsafe evidence path.');
    const file = await confined(root, resolve(root, entry.path), path + '.path');
    const bytes = await readBoundedFile(file, LIMITS.evidenceBytes, path);
    total += bytes.length;
    if (total > LIMITS.archiveBytes) fail('CIM-V3-LIMIT', '$capture.archive', 'Evidence exceeds 16 MiB in total.');
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) fail('CIM-V3-EVIDENCE', path + '.sha256', 'Raw file checksum does not match.');
  }
}

export function decodeJSON(bytes, path = '$') {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('CIM-V3-PARSE', path, 'JSON file is not valid UTF-8.'); }
}

export async function validateV3File(source, text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail('CIM-V3-PARSE', '$', 'Malformed JSON.'); }
  const kind = { 'localis.cim/authoring/v3': 'authoring', 'localis.cim/engineering-capture/v1': 'capture', 'cim.lesson-pack/v2': 'pack', 'localis.cim/media/v1':'media' }[parsed?.schema];
  if (!kind) fail('CIM-V3-SHAPE', '$.schema', 'Unsupported validation schema.');
  const validated = assertValid(validateDocument(text, kind));
  if(kind==='media'){await validateMediaFiles(validated.value,dirname(source));return{kind,id:validated.value.schema,count:validated.value.assets.length};}
  if(kind==='pack'&&['fixture','pack'].includes(validated.value.media.status))await validateMediaFiles(validated.value.media,dirname(source));
  if(kind==='pack'&&validated.value.media.status==='pack'){const {readPackFile}=await import('./pack.mjs');const root=await realpath(dirname(source));for(const[i,file]of validated.value.files.entries())await readPackFile(root,file.path,{max:33554432,size:file.size,sha256:file.sha256,at:`$.files[${i}]`});}
  if (kind === 'pack') return { kind, id: 'cim.lesson-pack/v2', count: validated.value.lessons.length };
  if (kind === 'capture') {
    await validateArchiveFiles(validated.value, dirname(source));
    return { kind, id: validated.value.id, count: validated.value.records.length };
  }
  const reference = validated.value.capture.file;
  if (!jsonBasename(reference)) fail('CIM-V3-ARCHIVE-PATH', '$.capture.file', 'Capture reference must be a JSON basename.');
  const directory = await realpath(dirname(source));
  const file = await confined(directory, resolve(directory, reference), '$.capture.file');
  const captureText = decodeJSON(await readBoundedFile(file), '$capture');
  const bundle = assertValid(validateBundle(text, captureText));
  await validateArchiveFiles(bundle.capture, dirname(file));
  if(bundle.lesson.media.status==='pack'){const {compileV3Source}=await import('./pack.mjs');await compileV3Source(source);}
  return { kind, id: bundle.lesson.id, count: bundle.lesson.beats.length, bundle };
}
