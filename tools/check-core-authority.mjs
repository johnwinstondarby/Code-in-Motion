import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const PRIVILEGED_NAMES = Object.freeze([
  'semanticControl',
  'faultControl',
  'statusControl',
  'acquireRuntimeCoreControls'
]);

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

function stripCommentsAndStrings(source) {
  let result = '';
  let mode = 'code';
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (mode === 'line-comment') {
      if (char === '\n') {
        result += '\n';
        mode = 'code';
      } else result += ' ';
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        i += 1;
        mode = 'code';
      } else result += char === '\n' ? '\n' : ' ';
      continue;
    }

    if (mode === 'string') {
      if (char === '\\') {
        result += ' ';
        if (next !== undefined) {
          result += ' ';
          i += 1;
        }
      } else if (char === quote) {
        result += ' ';
        mode = 'code';
        quote = null;
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      result += '  ';
      i += 1;
      mode = 'line-comment';
    } else if (char === '/' && next === '*') {
      result += '  ';
      i += 1;
      mode = 'block-comment';
    } else if (char === '\'' || char === '"' || char === '`') {
      result += ' ';
      mode = 'string';
      quote = char;
    } else {
      result += char;
    }
  }

  return result;
}

function stripComments(source) {
  let result = '';
  let mode = 'code';
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (mode === 'line-comment') {
      if (char === '\n') {
        result += '\n';
        mode = 'code';
      } else result += ' ';
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        i += 1;
        mode = 'code';
      } else result += char === '\n' ? '\n' : ' ';
      continue;
    }

    if (mode === 'string') {
      result += char;
      if (char === '\\') {
        if (next !== undefined) {
          result += next;
          i += 1;
        }
      } else if (char === quote) {
        mode = 'code';
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      result += '  ';
      i += 1;
      mode = 'line-comment';
    } else if (char === '/' && next === '*') {
      result += '  ';
      i += 1;
      mode = 'block-comment';
    } else if (char === '\'' || char === '"' || char === '`') {
      result += char;
      mode = 'string';
      quote = char;
    } else result += char;
  }

  return result;
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const uncommented = stripComments(source);
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of uncommented.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveImportsAlias(specifier, imports) {
  if (!imports || typeof imports !== 'object') return null;
  if (typeof imports[specifier] === 'string') return imports[specifier];

  for (const [key, target] of Object.entries(imports)) {
    if (!key.includes('*') || typeof target !== 'string' || !target.includes('*')) continue;
    const [prefix, suffix = ''] = key.split('*');
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const middle = specifier.slice(prefix.length, specifier.length - suffix.length);
    return target.replace('*', middle);
  }
  return null;
}

function resolveRepoTarget(rootDir, sourceFile, specifier, imports) {
  if (specifier.startsWith('.')) {
    return posixPath(relative(rootDir, resolve(dirname(sourceFile), specifier)));
  }
  if (specifier.startsWith('#')) {
    const target = resolveImportsAlias(specifier, imports);
    if (typeof target === 'string' && target.startsWith('./')) return posixPath(target.slice(2));
  }
  return null;
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

async function readImports(rootDir) {
  try {
    const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
    return packageJson.imports ?? {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function checkCoreAuthority(rootDir = ROOT) {
  const srcDir = resolve(rootDir, 'src');
  let files = [];
  try {
    files = await walk(srcDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        filesChecked: 0,
        violations: [{
          rule: 'core-authority-no-production-sources',
          file: 'src/',
          message: 'Core authority verification requires production source files.'
        }]
      };
    }
    throw error;
  }

  const imports = await readImports(rootDir);
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sourceRel = posixPath(relative(rootDir, file));
    const isCore = sourceRel.startsWith('src/core/');
    const isRuntime = sourceRel.startsWith('src/runtime/');

    for (const specifier of extractImportSpecifiers(source)) {
      const targetRel = resolveRepoTarget(rootDir, file, specifier, imports);
      if (!targetRel) continue;

      if (!isCore && !isRuntime && targetRel.startsWith('src/core/')) {
        violations.push({
          rule: 'runtime-only-core-import',
          file: sourceRel,
          target: targetRel,
          message: 'Only Runtime production code may import Core.'
        });
      }

      if (!isRuntime && targetRel === 'src/runtime/core-session.mjs') {
        violations.push({
          rule: 'runtime-core-session-private',
          file: sourceRel,
          target: targetRel,
          message: 'The Runtime Core-session composition seam is private to Runtime.'
        });
      }
    }

    if (!isCore && !isRuntime) {
      const searchable = stripCommentsAndStrings(source);
      for (const name of PRIVILEGED_NAMES) {
        const pattern = new RegExp(`\\b${name}\\b`, 'g');
        for (const match of searchable.matchAll(pattern)) {
          violations.push({
            rule: 'runtime-only-core-control',
            file: sourceRel,
            line: lineForOffset(searchable, match.index ?? 0),
            target: name,
            message: 'Privileged Core mutation capability references are reserved to Core and Runtime.'
          });
        }
      }
    }
  }

  return { filesChecked: files.length, violations };
}

async function run() {
  const result = await checkCoreAuthority(ROOT);
  if (result.violations.length > 0) {
    console.error(`FAIL: ${result.violations.length} Core authority violation(s)`);
    for (const violation of result.violations) {
      const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
      console.error(`- [${violation.rule}] ${location}: ${violation.message} (${violation.target ?? 'n/a'})`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: Core authority (${result.filesChecked} production source file(s) checked)`);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  run().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
