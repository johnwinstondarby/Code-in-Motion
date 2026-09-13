import { readFile, readdir } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

const FORBIDDEN_IMPORTS = [
  ['core-to-runtime', 'src/core/', 'src/runtime/', 'Core cannot import Runtime.'],
  ['core-to-transport', 'src/core/', 'src/transport/', 'Core cannot depend on learner-facing transport.'],
  ['core-to-commentary', 'src/core/', 'src/commentary/', 'Core cannot depend on commentary presentation.'],
  ['core-to-renderers', 'src/core/', 'src/renderers/', 'Core cannot depend on renderers.'],
  ['core-to-host', 'src/core/', 'src/host/', 'Core cannot depend on a host adapter.'],
  ['core-to-telemetry', 'src/core/', 'src/telemetry/', 'Core cannot depend on telemetry sinks.'],

  ['transport-to-core', 'src/transport/', 'src/core/', 'Transport consumes Runtime projections and cannot reach Core directly.'],
  ['transport-to-renderers', 'src/transport/', 'src/renderers/', 'Transport cannot call or import renderers.'],
  ['transport-to-commentary', 'src/transport/', 'src/commentary/', 'Transport cannot advance or import commentary.'],

  ['commentary-to-core', 'src/commentary/', 'src/core/', 'Commentary cannot reach Core directly.'],
  ['commentary-to-transport', 'src/commentary/', 'src/transport/', 'Commentary cannot move transport laterally.'],
  ['commentary-to-renderers', 'src/commentary/', 'src/renderers/', 'Commentary cannot depend on renderer internals.'],

  ['renderer-to-core', 'src/renderers/', 'src/core/', 'Renderers cannot depend on canonical Core state.'],
  ['renderer-to-runtime', 'src/renderers/', 'src/runtime/', 'Renderers cannot command or depend on Runtime.'],
  ['renderer-to-transport', 'src/renderers/', 'src/transport/', 'Renderers cannot depend on transport.'],
  ['renderer-to-commentary', 'src/renderers/', 'src/commentary/', 'Renderers cannot depend on commentary.'],
  ['renderer-to-host', 'src/renderers/', 'src/host/', 'Renderers cannot depend on host adapters.'],

  ['host-to-core', 'src/host/', 'src/core/', 'Host reaches semantic behavior through Runtime, not Core.'],
  ['host-to-transport', 'src/host/', 'src/transport/', 'Host cannot control Transport directly.'],
  ['host-to-commentary', 'src/host/', 'src/commentary/', 'Host cannot control Commentary directly.'],
  ['host-to-renderers', 'src/host/', 'src/renderers/', 'Host cannot control Renderers directly.'],

  ['telemetry-to-core', 'src/telemetry/', 'src/core/', 'Telemetry is observational and cannot depend on Core control.'],
  ['telemetry-to-runtime', 'src/telemetry/', 'src/runtime/', 'Telemetry is observational and cannot depend on Runtime control.'],
  ['telemetry-to-transport', 'src/telemetry/', 'src/transport/', 'Telemetry cannot depend on Transport.'],
  ['telemetry-to-commentary', 'src/telemetry/', 'src/commentary/', 'Telemetry cannot depend on Commentary.'],
  ['telemetry-to-renderers', 'src/telemetry/', 'src/renderers/', 'Telemetry cannot depend on Renderers.'],

  ['accessibility-to-core', 'src/accessibility/', 'src/core/', 'Accessibility helpers cannot own or reach Core control.'],
  ['accessibility-to-runtime', 'src/accessibility/', 'src/runtime/', 'Accessibility helpers cannot own or reach Runtime control.'],

  ['experience-to-core', 'src/experience/', 'src/core/', 'Experience loading/validation cannot depend on Core.'],
  ['experience-to-runtime', 'src/experience/', 'src/runtime/', 'Experience loading/validation cannot depend on Runtime.']
].map(([id, from, to, message]) => ({ id, from, to, message }));

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
      } else {
        result += ' ';
      }
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        i += 1;
        mode = 'code';
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
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
    } else {
      result += char;
    }
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

function packageNameFor(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
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

function resolveRepoImport(rootDir, sourceFile, specifier, packagePolicy) {
  if (specifier.startsWith('.')) {
    return { targetRel: posixPath(relative(rootDir, resolve(dirname(sourceFile), specifier))) };
  }

  if (specifier.startsWith('#')) {
    const target = resolveImportsAlias(specifier, packagePolicy.imports);
    if (!target || !target.startsWith('./')) {
      return { violation: {
        id: 'unresolved-package-import',
        message: `Package import alias ${specifier} is not resolved by a simple package.json imports mapping.`
      }};
    }
    return { targetRel: posixPath(target.slice(2)) };
  }

  if (NODE_BUILTINS.has(specifier)) return { external: true };

  const packageName = packageNameFor(specifier);
  if (packagePolicy.runtimeDependencies.has(packageName)) return { external: true };

  return { violation: {
    id: 'unapproved-bare-import',
    message: `Production bare import ${specifier} is not a declared runtime dependency.`
  }};
}

function importViolation(sourceRel, targetRel) {
  if (sourceRel.startsWith('src/') && (targetRel === 'harness' || targetRel.startsWith('harness/'))) {
    return {
      id: 'production-to-harness',
      message: 'Production code under src/ cannot import harness code.'
    };
  }

  if (sourceRel.startsWith('src/contracts/') && targetRel.startsWith('src/') && !targetRel.startsWith('src/contracts/')) {
    return {
      id: 'contracts-to-component',
      message: 'Shared contracts are dependency-free and cannot import production components.'
    };
  }

  return FORBIDDEN_IMPORTS.find((rule) => sourceRel.startsWith(rule.from) && targetRel.startsWith(rule.to)) ?? null;
}

function isCoreSetStatusDeclaration(source, offset) {
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  const lineEnd = source.indexOf('\n', offset);
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
  return /^\s*(?:async\s+)?setStatus\s*\(/.test(line);
}

function findSetStatusReferences(source, sourceRel) {
  const uncommented = stripComments(source);
  const references = [];

  for (const match of uncommented.matchAll(/\bsetStatus\b/g)) {
    const offset = match.index ?? 0;
    if (sourceRel.startsWith('src/core/') && isCoreSetStatusDeclaration(uncommented, offset)) continue;
    references.push(offset);
  }

  return references;
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

async function readPackagePolicy(rootDir) {
  try {
    const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
    return {
      imports: packageJson.imports ?? {},
      runtimeDependencies: new Set(Object.keys(packageJson.dependencies ?? {}))
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { imports: {}, runtimeDependencies: new Set() };
    throw error;
  }
}

function noProductionSourcesViolation() {
  return {
    rule: 'no-production-sources',
    file: 'src/',
    target: 'production source discovery',
    message: 'Architecture verification requires at least one production source file under src/; zero files means the source walker cannot prove the dependency graph.'
  };
}

export async function checkArchitectureBoundaries(rootDir = ROOT) {
  const srcDir = resolve(rootDir, 'src');
  let files = [];

  try {
    files = await walk(srcDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { filesChecked: 0, violations: [noProductionSourcesViolation()] };
    }
    throw error;
  }

  if (files.length === 0) {
    return { filesChecked: 0, violations: [noProductionSourcesViolation()] };
  }

  const packagePolicy = await readPackagePolicy(rootDir);
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sourceRel = posixPath(relative(rootDir, file));

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveRepoImport(rootDir, file, specifier, packagePolicy);

      if (resolved.violation) {
        violations.push({
          rule: resolved.violation.id,
          file: sourceRel,
          target: specifier,
          message: resolved.violation.message
        });
        continue;
      }

      if (!resolved.targetRel) continue;

      const rule = importViolation(sourceRel, resolved.targetRel);
      if (rule) {
        violations.push({
          rule: rule.id,
          file: sourceRel,
          target: resolved.targetRel,
          message: rule.message
        });
      }
    }

    if (!sourceRel.startsWith('src/runtime/')) {
      for (const offset of findSetStatusReferences(source, sourceRel)) {
        violations.push({
          rule: 'runtime-only-set-status',
          file: sourceRel,
          line: lineForOffset(stripComments(source), offset),
          target: 'privileged Core status control',
          message: 'Only production code under src/runtime/ may reference the privileged setStatus seam; Core may only declare it.'
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
