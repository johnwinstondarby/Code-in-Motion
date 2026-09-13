import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const FORBIDDEN_IMPORTS = [
  {
    id: 'core-to-runtime',
    from: 'src/core/',
    to: 'src/runtime/',
    message: 'Core cannot import Runtime; Runtime orchestrates Core through the public Core interface.'
  },
  {
    id: 'core-to-transport',
    from: 'src/core/',
    to: 'src/transport/',
    message: 'Core cannot depend on learner-facing transport.'
  },
  {
    id: 'core-to-commentary',
    from: 'src/core/',
    to: 'src/commentary/',
    message: 'Core cannot depend on commentary presentation.'
  },
  {
    id: 'core-to-renderers',
    from: 'src/core/',
    to: 'src/renderers/',
    message: 'Core cannot depend on renderer implementation or renderer DOM.'
  },
  {
    id: 'core-to-host',
    from: 'src/core/',
    to: 'src/host/',
    message: 'Core cannot depend on a host adapter.'
  },
  {
    id: 'transport-to-core',
    from: 'src/transport/',
    to: 'src/core/',
    message: 'Transport consumes runtime projections and cannot reach Core directly.'
  },
  {
    id: 'transport-to-renderers',
    from: 'src/transport/',
    to: 'src/renderers/',
    message: 'Transport cannot call or import renderers.'
  },
  {
    id: 'transport-to-commentary',
    from: 'src/transport/',
    to: 'src/commentary/',
    message: 'Transport cannot advance or import commentary.'
  },
  {
    id: 'commentary-to-core',
    from: 'src/commentary/',
    to: 'src/core/',
    message: 'Commentary receives runtime-controlled projections and cannot reach Core directly.'
  },
  {
    id: 'commentary-to-transport',
    from: 'src/commentary/',
    to: 'src/transport/',
    message: 'Commentary cannot move transport laterally.'
  },
  {
    id: 'commentary-to-renderers',
    from: 'src/commentary/',
    to: 'src/renderers/',
    message: 'Commentary cannot depend on renderer internals.'
  },
  {
    id: 'subject-renderer-to-transport',
    from: 'src/renderers/subjects/',
    to: 'src/transport/',
    message: 'Subject renderers cannot depend on transport.'
  },
  {
    id: 'subject-renderer-to-commentary',
    from: 'src/renderers/subjects/',
    to: 'src/commentary/',
    message: 'Subject renderers cannot depend on commentary.'
  },
  {
    id: 'subject-renderer-to-host',
    from: 'src/renderers/subjects/',
    to: 'src/host/',
    message: 'Subject renderers cannot depend on host adapters.'
  }
];

function posixPath(path) {
  return path.split(sep).join('/');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }

  return files;
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }

  return [...specifiers];
}

function resolveRepoImport(rootDir, sourceFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  return posixPath(relative(rootDir, resolve(dirname(sourceFile), specifier)));
}

function importViolation(sourceRel, targetRel) {
  if (sourceRel.startsWith('src/') && (targetRel === 'harness' || targetRel.startsWith('harness/'))) {
    return {
      id: 'production-to-harness',
      message: 'Production code under src/ cannot import harness code.'
    };
  }

  return FORBIDDEN_IMPORTS.find((rule) => sourceRel.startsWith(rule.from) && targetRel.startsWith(rule.to)) ?? null;
}

function findSetStatusCalls(source) {
  const callPattern = /(?:\.\s*setStatus|\[\s*['"]setStatus['"]\s*\])\s*\(/g;
  return [...source.matchAll(callPattern)].map((match) => match.index ?? 0);
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

export async function checkArchitectureBoundaries(rootDir = ROOT) {
  const srcDir = resolve(rootDir, 'src');
  let files = [];

  try {
    files = await walk(srcDir);
  } catch (error) {
    if (error.code === 'ENOENT') return { filesChecked: 0, violations: [] };
    throw error;
  }

  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sourceRel = posixPath(relative(rootDir, file));

    for (const specifier of extractImportSpecifiers(source)) {
      const targetRel = resolveRepoImport(rootDir, file, specifier);
      if (!targetRel) continue;

      const rule = importViolation(sourceRel, targetRel);
      if (rule) {
        violations.push({
          rule: rule.id,
          file: sourceRel,
          target: targetRel,
          message: rule.message
        });
      }
    }

    if (!sourceRel.startsWith('src/runtime/')) {
      for (const offset of findSetStatusCalls(source)) {
        violations.push({
          rule: 'runtime-only-set-status',
          file: sourceRel,
          line: lineForOffset(source, offset),
          target: 'Core.setStatus(nextStatus)',
          message: 'Only production code under src/runtime/ may call Core.setStatus(nextStatus).'
        });
      }
    }
  }

  return { filesChecked: files.length, violations };
}

async function run() {
  const result = await checkArchitectureBoundaries(ROOT);

  if (result.violations.length > 0) {
    console.error(`FAIL: ${result.violations.length} architecture-boundary violation(s)`);
    for (const violation of result.violations) {
      const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
      console.error(`- [${violation.rule}] ${location}: ${violation.message} (${violation.target})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`PASS: architecture boundaries (${result.filesChecked} production source file(s) checked)`);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  run().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
