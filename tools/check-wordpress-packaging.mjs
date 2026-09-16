import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORDPRESS_DIR = resolve(ROOT, 'wordpress');
const ENTRY_PATH = resolve(WORDPRESS_DIR, 'code-in-motion.php');
const REQUIRED_EXTERNAL_ASSETS = Object.freeze([
  resolve(WORDPRESS_DIR, 'assets', 'bootstrap.js'),
  resolve(WORDPRESS_DIR, 'assets', 'bootstrap-module.mjs'),
  resolve(WORDPRESS_DIR, 'assets', 'cim.css')
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function assertContains(source, token, label) {
  if (!source.includes(token)) throw new Error(`WordPress packaging gate: missing ${label}.`);
}

async function run() {
  const entry = await readFile(ENTRY_PATH, 'utf8');
  assertContains(entry, 'wp_enqueue_script(', 'wp_enqueue_script() external JavaScript registration');
  assertContains(entry, 'wp_enqueue_style(', 'wp_enqueue_style() external CSS registration');
  assertContains(entry, "add_shortcode( 'cim'", 'cim shortcode registration');
  assertContains(entry, 'data-cim-experience', 'canonical Experience attribute');
  assertContains(entry, 'data-cim-renderer-root', 'canonical renderer-root attribute');

  for (const assetPath of REQUIRED_EXTERNAL_ASSETS) await readFile(assetPath, 'utf8');

  const files = await walk(WORDPRESS_DIR);
  const phpFiles = files.filter((path) => extname(path) === '.php');
  const forbidden = [
    ['wp_add_inline_script(', 'wp_add_inline_script()'],
    ['wp_add_inline_style(', 'wp_add_inline_style()'],
    ['wp_localize_script(', 'wp_localize_script()'],
    ['<script', 'literal <script> emission']
  ];

  for (const path of phpFiles) {
    const source = await readFile(path, 'utf8');
    const lower = source.toLowerCase();
    for (const [token, label] of forbidden) {
      const haystack = token === '<script' ? lower : source;
      if (haystack.includes(token)) {
        throw new Error(`WordPress packaging gate: ${label} is forbidden in ${path}.`);
      }
    }
  }

  console.log(`PASS: WordPress external-asset packaging gate (${phpFiles.length} PHP file(s), ${REQUIRED_EXTERNAL_ASSETS.length} required external asset(s))`);
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
