import { formatAuthoringError } from './authoring-diagnostics.mjs';
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileLesson, MAX_AUTHORING_BYTES } from './lesson-pack-archive.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

/** Local, read-only Player preview; no build, installation, command execution or source upload. */
export async function startLessonPreview(source, { port = 0 } = {}) {
  const assets = new Map();
  async function collect(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await collect(resolve(directory, entry.name), prefix + entry.name + '/');
      else if (entry.isFile() && ['.mjs', '.js', '.css'].includes(extname(entry.name))) assets.set('/' + prefix + entry.name, resolve(directory, entry.name));
    }
  }
  await collect(resolve(root, 'src'), 'src/');
  await collect(resolve(root, 'wordpress/assets'), 'wordpress/assets/');
  assets.set('/preview-client.mjs', resolve(root, 'tools/lesson-preview-client.mjs'));
  const server = createServer(async (request, response) => {
    const origin = 'http://127.0.0.1:' + server.address().port;
    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) { response.writeHead(403); response.end('Local preview only.'); return; }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    const path = new URL(request.url, origin).pathname;
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    try {
      if (path === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CiM local lesson preview</title><link rel="stylesheet" href="/wordpress/assets/cim.css"><h1>Local lesson preview</h1><p>Save your JSON, then refresh this page. Nothing is installed or uploaded. Commands are displayed, never executed.</p><pre id="preview-error" role="status"></pre><div class="cim" data-cim-experience="cim-local-preview" data-cim-default-theme="light" data-cim-pack-url="/lesson.json"><div data-cim-renderer-root></div><div class="cim-fallback">Preview unavailable. Check the validation message above.</div></div><script type="module" src="/preview-client.mjs"></script><script defer src="/wordpress/assets/bootstrap.js"></script></html>'); return;
      }
      if (path === '/lesson.json') {
        if ((await stat(source)).size > MAX_AUTHORING_BYTES) throw new RangeError('Authored lesson exceeds 2 MiB.');
        const result = compileLesson(await readFile(source, 'utf8'));
        // Preview identity avoids bundled-ID resolution; the source and eventual pack retain their original ID.
        const lesson = { ...result.document, id: 'cim-local-preview' };
        response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(lesson)); return;
      }
      const file = assets.get(path);
      if (!file) { response.writeHead(404); response.end('Not found.'); return; }
      response.setHeader('content-type', extname(file) === '.css' ? 'text/css' : 'text/javascript');
      response.end(await readFile(file));
    } catch (error) {
      response.writeHead(422, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: formatAuthoringError(error) }));
    }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}
