import { validatePackLesson } from './lesson-pack-validation.mjs';
export const MAX_LESSON_BYTES = 2 * 1024 * 1024;

// A pack cannot replace a bundled lesson. PHP supplies local plugin-file URLs only.
export function lessonPackUrlFor(document, id) {
  const roots = [...document.querySelectorAll('[data-cim-experience]')].filter(root => root.getAttribute('data-cim-experience') === id);
  const urls = new Set(roots.map(root => root.getAttribute('data-cim-pack-url')).filter(Boolean));
  if (urls.size !== 1) return '';
  try {
    const url = new URL([...urls][0], document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== new URL(document.baseURI).origin || !url.pathname.endsWith('.json')) return '';
    return url.href;
  } catch { return ''; }
}

export async function readBoundedLesson(response, external = false) {
  if (Number(response.headers?.get('content-length')) > MAX_LESSON_BYTES) throw new RangeError('Lesson exceeds the 2 MiB limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new TypeError('Lesson response must support bounded streaming.');
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_LESSON_BYTES) throw new RangeError('Lesson exceeds the 2 MiB limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  const lesson = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
  if (external) return validatePackLesson(lesson);
  return lesson;
}
