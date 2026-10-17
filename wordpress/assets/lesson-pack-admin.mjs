import { createWordPressExperienceLoader } from '../../src/host/wordpress-browser-bindings.mjs';
import { readBoundedLesson } from './lesson-pack-loading.mjs';

/** Admin and Player use the identical ingestion/admission boundary. No lesson is executed. */
export async function checkPackLesson({ id, url, baseURI, fetch }) {
  try {
    const target = new URL(url, baseURI);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== new URL(baseURI).origin || !target.pathname.endsWith('.json')) throw new Error('Lesson URL must be same-origin JSON.');
    const loader = createWordPressExperienceLoader({
      experienceUrlFor: () => target.href,
      fetch: async href => {
        const response = await fetch(href, { credentials: 'same-origin' });
        return { ok: response.ok, status: response.status, json: () => readBoundedLesson(response, true) };
      }
    });
    await loader.load(id);
    return { status: 'Ready', reason: 'Schema, identity, engine, renderer, size and links passed.' };
  } catch (error) { return { status: 'Rejected', reason: error.message }; }
}

export async function checkPackInventory(document, fetch) {
  const rows = [...document.querySelectorAll('[data-cim-pack-lesson]')];
  // Four bounded requests at a time. PHP caps the complete inventory at 100 lessons.
  for (let offset = 0; offset < rows.length; offset += 4) {
    await Promise.all(rows.slice(offset, offset + 4).map(async row => {
      const url = row.getAttribute('data-cim-pack-check-url');
      if (!url) return;
      const result = await checkPackLesson({ id: row.getAttribute('data-cim-pack-lesson'), url, baseURI: document.baseURI, fetch });
      row.querySelector('[data-cim-pack-status]').textContent = result.status;
      row.querySelector('[data-cim-pack-reason]').textContent = result.reason;
      const shortcode = row.querySelector('[data-cim-pack-shortcode]');
      if(shortcode) shortcode.textContent = result.status === 'Ready' ? '[cim experience="' + row.getAttribute('data-cim-pack-lesson') + '"]' : 'Unavailable: rejected lesson';
    }));
  }
  for (const pack of document.querySelectorAll('[data-cim-pack-index]')) {
    const own = rows.filter(row => row.getAttribute('data-cim-pack-owner') === pack.getAttribute('data-cim-pack-index'));
    if (!own.length) continue;
    const rejected = own.filter(row => row.querySelector('[data-cim-pack-status]').textContent === 'Rejected').length;
    pack.querySelector('[data-cim-pack-status]').textContent = rejected === own.length ? 'Rejected' : rejected ? 'Partly rejected' : 'Ready';
    pack.querySelector('[data-cim-pack-reason]').textContent = `${own.length - rejected} ready, ${rejected} rejected. See lesson reasons below.`;
  }
}
if (typeof document !== 'undefined') checkPackInventory(document, globalThis.fetch.bind(globalThis));
