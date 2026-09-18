import test from 'node:test';
import assert from 'node:assert/strict';

import {
  priorReleaseData,
  priorReleasePath,
  R16_CURRENT_VERSION,
  R16_PRIOR_VERSION
} from '../tools/build-wordpress-upgrade-fixture.mjs';

test('R16 fixture remaps only the version-bearing production module subtree', () => {
  assert.equal(
    priorReleasePath(`wordpress/assets/modules/${R16_CURRENT_VERSION}/src/core/example.mjs`),
    `wordpress/assets/modules/${R16_PRIOR_VERSION}/src/core/example.mjs`
  );
  assert.equal(priorReleasePath('wordpress/assets/bootstrap.js'), 'wordpress/assets/bootstrap.js');
});

test('R16 fixture rewrites plugin identity, readme metadata, and bootstrap handoff to N', () => {
  const root = priorReleaseData(
    'code-in-motion.php',
    Buffer.from(`<?php\n/**\n * Version: ${R16_CURRENT_VERSION}\n */\n`, 'utf8')
  ).toString('utf8');
  assert.match(root, new RegExp(`Version: ${R16_PRIOR_VERSION.replace(/\./g, '\\\.')}`));
  assert.doesNotMatch(root, new RegExp(`Version: ${R16_CURRENT_VERSION.replace(/\./g, '\\\.')}`));

  const wordpress = priorReleaseData(
    'wordpress/code-in-motion.php',
    Buffer.from(
      `<?php\n/**\n * WordPress implementation for Code in Motion.\n */\ndefine( 'LOCALIS_CIM_PLUGIN_VERSION', '${R16_CURRENT_VERSION}' );\n`,
      'utf8'
    )
  ).toString('utf8');
  assert.doesNotMatch(wordpress, /Plugin Name:/);
  assert.doesNotMatch(wordpress, /^\s*\* Version:/m);
  assert.match(
    wordpress,
    new RegExp(`LOCALIS_CIM_PLUGIN_VERSION', '${R16_PRIOR_VERSION.replace(/\./g, '\\\.')}'`)
  );

  const readme = priorReleaseData(
    'readme.txt',
    Buffer.from(
      `=== Code in Motion ===\nStable tag: ${R16_CURRENT_VERSION}\n\n== Changelog ==\n= ${R16_CURRENT_VERSION} =\n* Current release.\n`,
      'utf8'
    )
  ).toString('utf8');
  assert.match(readme, new RegExp(`Stable tag: ${R16_PRIOR_VERSION.replace(/\./g, '\\\.')}`));
  assert.match(readme, new RegExp(`= ${R16_PRIOR_VERSION.replace(/\./g, '\\\.')} =`));
  assert.doesNotMatch(readme, new RegExp(`Stable tag: ${R16_CURRENT_VERSION.replace(/\./g, '\\\.')}`));

  const bootstrap = priorReleaseData(
    'wordpress/assets/bootstrap.js',
    Buffer.from(`const u = './modules/${R16_CURRENT_VERSION}/wordpress/assets/bootstrap-module.mjs';\n`, 'utf8')
  ).toString('utf8');
  assert.equal(
    bootstrap,
    `const u = './modules/${R16_PRIOR_VERSION}/wordpress/assets/bootstrap-module.mjs';\n`
  );
});

test('R16 fixture marks the prior Experience distinctly for browser-generation evidence', () => {
  const path = `wordpress/assets/modules/${R16_CURRENT_VERSION}/wordpress/experiences/synthetic-wordpress.json`;
  const source = Buffer.from(JSON.stringify({
    engine_min: R16_CURRENT_VERSION,
    renderer_config: { prefix: 'Node ' }
  }), 'utf8');
  const output = JSON.parse(priorReleaseData(path, source).toString('utf8'));

  assert.equal(output.engine_min, R16_PRIOR_VERSION);
  assert.equal(output.renderer_config.prefix, 'R16 N ');
});
