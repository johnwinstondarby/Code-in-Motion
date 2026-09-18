import assert from 'node:assert/strict';
import test from 'node:test';

import {
  R22_METADATA,
  parsePluginHeader,
  parseReadme,
  validateReleaseMetadataTexts
} from '../tools/check-wordpress-release-metadata.mjs';

const packageJson = {
  name: 'code-in-motion',
  version: '0.1.0',
  description: 'Reusable Localis platform for learner-controlled technical process experiences.',
  license: 'GPL-3.0-only',
  homepage: R22_METADATA.pluginUri,
  repository: { type: 'git', url: R22_METADATA.pluginUri + '.git' },
  bugs: { url: R22_METADATA.supportUri }
};

const packageLock = {
  name: 'code-in-motion',
  version: '0.1.0',
  packages: {
    '': {
      name: 'code-in-motion',
      version: '0.1.0',
      license: 'GPL-3.0-only'
    }
  }
};

const rootPlugin = `<?php
/**
 * Plugin Name: Code in Motion
 * Plugin URI: ${R22_METADATA.pluginUri}
 * Description: ${R22_METADATA.description}
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Localis
 * Author URI: ${R22_METADATA.authorUri}
 * License: GPLv3
 * License URI: ${R22_METADATA.licenseUri}
 */
`;

const implementationPlugin = `<?php
/**
 * WordPress implementation for Code in Motion.
 */
define( 'LOCALIS_CIM_PLUGIN_VERSION', '0.1.0' );
`;

const readme = `=== Code in Motion ===
Tags: interactive, experience, runtime
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv3
License URI: ${R22_METADATA.licenseUri}

${R22_METADATA.description}

== Description ==
Description.

== Installation ==
Installation.

== Support ==
${R22_METADATA.supportUri}

== Changelog ==
= 0.1.0 =
* Initial release.
`;

const license = 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n';

test('R22 parses the canonical plugin header', () => {
  const fields = parsePluginHeader(rootPlugin);
  assert.equal(fields.get('Plugin Name'), 'Code in Motion');
  assert.equal(fields.get('Version'), '0.1.0');
  assert.equal(fields.get('License'), 'GPLv3');
});

test('R22 parses WordPress readme metadata and short description', () => {
  const parsed = parseReadme(readme);
  assert.equal(parsed.fields.get('Stable tag'), '0.1.0');
  assert.equal(parsed.fields.get('Tested up to'), '7.1');
  assert.equal(parsed.shortDescription, R22_METADATA.description);
});

test('R22 accepts one consistent release metadata set', () => {
  assert.doesNotThrow(() => validateReleaseMetadataTexts({
    packageJson,
    packageLock,
    rootPlugin,
    implementationPlugin,
    readme,
    license
  }));
});

test('R22 rejects a second WordPress plugin header', () => {
  const duplicate = implementationPlugin.replace(
    ' * WordPress implementation for Code in Motion.',
    ' * Plugin Name: Code in Motion'
  );
  assert.throws(
    () => validateReleaseMetadataTexts({ packageJson, rootPlugin, implementationPlugin: duplicate, readme, license }),
    /exactly one Plugin Name header/
  );
});

test('R22 rejects version drift between package and readme stable tag', () => {
  assert.throws(
    () => validateReleaseMetadataTexts({
      packageJson,
      rootPlugin,
      implementationPlugin,
      readme: readme.replace('Stable tag: 0.1.0', 'Stable tag: 0.1.1'),
      license
    }),
    /Stable tag must be "0.1.0"/
  );
});

test('R22 rejects a missing current changelog entry', () => {
  assert.throws(
    () => validateReleaseMetadataTexts({
      packageJson,
      rootPlugin,
      implementationPlugin,
      readme: readme.replace('= 0.1.0 =', '= 0.0.9 ='),
      license
    }),
    /Changelog must contain the current version/
  );
});


test('R22 rejects package-lock version drift', () => {
  assert.throws(
    () => validateReleaseMetadataTexts({
      packageJson,
      packageLock: { ...packageLock, version: '0.1.1' },
      rootPlugin,
      implementationPlugin,
      readme,
      license
    }),
    /package-lock root version must match package version/
  );
});

test('R22 rejects support-route drift', () => {
  assert.throws(
    () => validateReleaseMetadataTexts({
      packageJson: { ...packageJson, bugs: { url: 'https://example.invalid/issues' } },
      packageLock,
      rootPlugin,
      implementationPlugin,
      readme,
      license
    }),
    /package bugs URL must match the support route/
  );
});
