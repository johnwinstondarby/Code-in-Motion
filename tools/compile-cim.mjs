import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CimAuthoringError,
  compileCimSource
} from '../authoring/cim/compiler.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_CIM_SOURCE = resolve(
  ROOT,
  'authoring',
  'cim',
  'fixtures',
  'valid',
  'synthetic-authored.cim'
);
export const DEFAULT_CIM_OUTPUT = resolve(
  ROOT,
  'authoring',
  'generated',
  'synthetic-authored.json'
);

function parseArgs(argv) {
  let sourcePath = null;
  let outputPath = null;
  let check = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      check = true;
      continue;
    }
    if (arg === '--out') {
      outputPath = argv[index + 1];
      if (!outputPath) throw new TypeError('--out requires a path.');
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new TypeError('Unknown compile-cim option: ' + arg);
    }
    if (sourcePath !== null) {
      throw new TypeError('compile-cim accepts at most one source path.');
    }
    sourcePath = arg;
  }

  return {
    sourcePath: sourcePath ? resolve(process.cwd(), sourcePath) : DEFAULT_CIM_SOURCE,
    outputPath: outputPath
      ? resolve(process.cwd(), outputPath)
      : sourcePath
        ? null
        : DEFAULT_CIM_OUTPUT,
    check
  };
}

export function formatCimDiagnostics(error) {
  if (!(error instanceof CimAuthoringError)) return error.stack ?? error.message;

  return error.diagnostics.map((diagnostic) =>
    diagnostic.sourceId + ':' + diagnostic.line + ':' + diagnostic.column +
    ' [' + diagnostic.code + '] ' +
    diagnostic.path + ' ' + diagnostic.message
  ).join('\n');
}

export async function compileCimFile({
  sourcePath = DEFAULT_CIM_SOURCE,
  outputPath = DEFAULT_CIM_OUTPUT,
  check = false
} = {}) {
  const source = await readFile(sourcePath, 'utf8');
  const compiled = compileCimSource(source, { sourceId: sourcePath });
  const output = JSON.stringify(compiled.experience, null, 2) + '\n';

  if (check) {
    if (!outputPath) {
      throw new TypeError('check mode requires an output path.');
    }
    const current = await readFile(outputPath, 'utf8');
    if (current !== output) {
      throw new Error(
        'R29 .cim generated output is stale: ' + outputPath +
        '. Run npm run generate:cim-fixture.'
      );
    }
    console.log('PASS: R29 .cim authored fixture is current.');
    return Object.freeze({ output, compiled });
  }

  if (outputPath) {
    await writeFile(outputPath, output, 'utf8');
    console.log('Generated ' + outputPath + '.');
  } else {
    process.stdout.write(output);
  }

  return Object.freeze({ output, compiled });
}

const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  const args = parseArgs(process.argv.slice(2));
  compileCimFile(args).catch((error) => {
    console.error(formatCimDiagnostics(error));
    process.exitCode = 1;
  });
}
