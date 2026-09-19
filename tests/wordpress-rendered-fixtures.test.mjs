import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FIXTURE_ROOT = new URL('./fixtures/wordpress/', import.meta.url);

async function fixture(name) {
  return readFile(new URL(name, FIXTURE_ROOT), 'utf8');
}

function assertCanonicalRoot(html, { instanceId = null, fallback }) {
  assert.equal(html.endsWith('\n'), true, 'authoritative fixture must end with one newline');
  assert.match(html, /^<div class="cim" data-cim-experience="synthetic-wordpress"/);
  assert.match(html, /<div data-cim-renderer-root><\/div>/);
  assert.match(html, new RegExp(`<div class="cim-fallback">${fallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/div>`));
  assert.doesNotMatch(html, /<script\b/i);

  const rootClose = html.lastIndexOf('</div>');
  const rendererRoot = html.indexOf('<div data-cim-renderer-root></div>');
  assert.ok(rendererRoot > 0 && rendererRoot < rootClose, 'renderer root must remain a descendant of the canonical root');

  if (instanceId === null) {
    assert.doesNotMatch(html, /\sdata-cim-instance=/);
  } else {
    assert.match(html, new RegExp(`\\sdata-cim-instance="${instanceId}"`));
  }
}

test('authoritative basic WordPress fixture preserves canonical invocation markup', async () => {
  const html = await fixture('basic.html');
  assertCanonicalRoot(html, {
    fallback: 'CiM authoritative fallback.'
  });
});

test('authoritative instance WordPress fixture preserves optional instance identity', async () => {
  const html = await fixture('instance.html');
  assertCanonicalRoot(html, {
    instanceId: 'qa-instance',
    fallback: 'CiM authoritative instance fallback.'
  });
});

test('authoritative fixture provenance records the Docker wp-env source', async () => {
  const provenance = JSON.parse(await fixture('provenance.json'));
  assert.equal(provenance.authority, 'docker-wp-env');
  assert.equal(provenance.wordpress, '6.5.10');
  assert.match(provenance.php, /^7\.4\./);
  assert.equal(provenance.plugin_version, '0.1.0');
  assert.equal(provenance.wp_env, '11.15.0');
  assert.match(provenance.pr_head_sha, /^[0-9a-f]{40}$/);
  assert.match(provenance.github_merge_sha, /^[0-9a-f]{40}$/);
  assert.deepEqual(provenance.fixtures, ['basic.html', 'instance.html']);
  assert.equal(provenance.source, 'WordPress do_shortcode() inside Docker-backed wp-env');
});
