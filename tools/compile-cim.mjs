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
  const sourcePaths = [];
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

    sourcePaths.push(resolve(process.cwd(), arg));
  }

  if (!check && sourcePaths.length > 1) {
    throw new TypeError(
      'compile mode accepts one source path; use --check for multiple sources.'
    );
  }

  if (check && outputPath !== null) {
    throw new TypeError('--out cannot be used with --check.');
  }

  return Object.freeze({
    check,
    outputPath: outputPath ? resolve(process.cwd(), outputPath) : null,
    sourcePaths: Object.freeze(sourcePaths)
  });
}

export function formatCimDiagnostics(error) {
  if (!(error instanceof CimAuthoringError)) return error.stack ?? error.message;

  return error.diagnostics.map((diagnostic) =>
    diagnostic.sourceId + ':' + diagnostic.line + ':' + diagnostic.column +
    ' [' + diagnostic.code + '] ' +
    diagnostic.path + ' ' + diagnostic.message
  ).join('\n');
}

export async function compileCimPath(sourcePath) {
  const source = await readFile(sourcePath, 'utf8');
  const compiled = compileCimSource(source, { sourceId: sourcePath });
  const output = JSON.stringify(compiled.experience, null, 2) + '\n';
  return Object.freeze({ sourcePath, output, compiled });
}

export async function compileCimFile({
  sourcePath = DEFAULT_CIM_SOURCE,
  outputPath = DEFAULT_CIM_OUTPUT,
  check = false
} = {}) {
  const result = await compileCimPath(sourcePath);

  if (check) {
    if (!outputPath) {
      throw new TypeError('freshness check requires an output path.');
    }

    const current = await readFile(outputPath, 'utf8');
    if (current !== result.output) {
      throw new Error(
        'R29 .cim generated output is stale: ' + outputPath +
        '. Run npm run generate:cim-fixture.'
      );
    }

    console.log('PASS: R29 .cim authored fixture is current.');
    return result;
  }

  if (outputPath) {
    await writeFile(outputPath, result.output, 'utf8');
    console.log('Generated ' + outputPath + '.');
  } else {
    process.stdout.write(result.output);
  }

  return result;
}

export async function checkCimFiles(sourcePaths) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
    throw new TypeError('checkCimFiles requires at least one source path.');
  }

  const results = [];
  for (const sourcePath of sourcePaths) {
    const result = await compileCimPath(sourcePath);
    results.push(result);
    console.log('PASS: valid .cim source ' + sourcePath + '.');
  }

  return Object.freeze(results);
}

async function runCli(argv) {
  const args = parseArgs(argv);

  if (args.check) {
    if (args.sourcePaths.length === 0) {
      await compileCimFile({
        sourcePath: DEFAULT_CIM_SOURCE,
        outputPath: DEFAULT_CIM_OUTPUT,
        check: true
      });
      return;
    }

    await checkCimFiles(args.sourcePaths);
    return;
  }

  const sourcePath = args.sourcePaths[0] ?? DEFAULT_CIM_SOURCE;
  const outputPath = args.outputPath ??
    (args.sourcePaths.length === 0 ? DEFAULT_CIM_OUTPUT : null);

  await compileCimFile({ sourcePath, outputPath });
}

const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(formatCimDiagnostics(error));
    process.exitCode = 1;
  });
}
