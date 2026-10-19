import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateV3File, readBoundedFile, decodeJSON } from '../authoring/v3/files.mjs';
import { proveEnvelope } from '../authoring/v3/prove-envelope.mjs';
import { formatAuthoringError } from './authoring-diagnostics.mjs';

export async function main(args) {
  if (args.length !== 3 || args[1] !== '--out') throw new Error('Usage: node tools/prove-v3-envelope.mjs lesson.json --out proof.json');
  const file = resolve(args[0]);
  // validateV3File supplies the bounded, confined and hash-checked bundle. The
  // public authoring compile/pack/preview paths remain unchanged for v3.
  const { bundle } = await validateV3File(file, decodeJSON(await readBoundedFile(file)));
  if (!bundle) throw new Error('Envelope proof needs an authored v3 lesson and its capture.');
  const result = proveEnvelope(bundle.lesson, bundle.capture);
  await writeFile(resolve(args[2]), result.text, { flag: 'wx' });
  console.log(`PASS: ${result.document.steps.length} beats fit frozen localis.cim/v2 as panes/v1. Structural feasibility only; no runtime or WordPress admission.`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch(e => { console.error(formatAuthoringError(e)); process.exitCode = 1; });
