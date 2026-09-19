import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTION_PATH = resolve(ROOT, 'authoring', 'generated', 'page-3227-git-reference.json');
const OUTPUT_PATH = resolve(ROOT, 'authoring', 'generated', 'page-3227-git-adapter.js');

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function titleCaseVerb(value) {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

export function buildPage3227GitAdapter(projection) {
  if (projection?.source_schema !== 'localis.page-3227-git-reference/v1') {
    throw new Error('R27 page-3227 adapter: unsupported projection schema.');
  }
  if (projection.page_id !== 3227) {
    throw new Error('R27 page-3227 adapter: projection must identify page 3227.');
  }
  if (!Array.isArray(projection.anchors) || projection.anchors.length !== 8) {
    throw new Error('R27 page-3227 adapter: projection must contain exactly eight anchors.');
  }

  const payload = {
    source_schema: projection.source_schema,
    source_version: projection.source_version,
    page_id: projection.page_id,
    experience_id: projection.experience_id,
    anchors: projection.anchors.map((anchor) => ({
      id: anchor.id,
      command: anchor.command,
      verb: anchor.verb,
      displayVerb: titleCaseVerb(anchor.verb),
      description: anchor.description,
      stateEffect: anchor.stateEffect,
      references: anchor.references,
      cim_step_id: anchor.cim_step_id,
      cim_fragment: '#cim/' + projection.experience_id + '/' + anchor.cim_step_id
    }))
  };

  return [
    '/* @cim-shared-source page-3227 v1 */',
    'const CIM_GIT = ' + stableJson(payload) + ';',
    'if (AF.mode === "git") {',
    '  const cimByCommand = new Map(CIM_GIT.anchors.map(function(anchor){ return [anchor.command, anchor]; }));',
    '  C.bands.forEach(function(band){',
    '    band.rows.forEach(function(row){',
    '      const anchor = cimByCommand.get(row.from);',
    '      if (!anchor) return;',
    '      row.from = anchor.command;',
    '      row.chip = anchor.displayVerb;',
    '      row.to = anchor.description;',
    '      row.cim_step_id = anchor.cim_step_id;',
    '      row.cim_fragment = anchor.cim_fragment;',
    '      row.stateEffect = anchor.stateEffect;',
    '      row.references = anchor.references;',
    '    });',
    '  });',
    '}',
    '/* /@cim-shared-source page-3227 v1 */',
    ''
  ].join('\n');
}

export async function generatePage3227GitAdapter({ check = false } = {}) {
  const projection = JSON.parse(await readFile(PROJECTION_PATH, 'utf8'));
  const output = buildPage3227GitAdapter(projection);

  if (check) {
    const actual = await readFile(OUTPUT_PATH, 'utf8');
    if (actual !== output) {
      throw new Error('R27 page-3227 adapter is stale; run npm run generate:page-3227.');
    }
    console.log('PASS: R27 page 3227 Git adapter is current.');
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, output, 'utf8');
  console.log('Generated page 3227 Git shared-source adapter.');
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  generatePage3227GitAdapter({ check: process.argv.includes('--check') }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
