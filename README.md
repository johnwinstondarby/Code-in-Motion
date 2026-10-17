# Code in Motion (CiM)

Code in Motion is a WordPress teaching plugin for people who teach coding through step-by-step demonstrations. A learner controls a Console and running Explanation: Play pauses at each completed beat, Next finishes the current beat before advancing, and Copy provides the authored command. Examples are displayed, never executed.

Git lessons and a Python starter are included. Teachers can create demonstrations for other coding subjects with the companion lesson-pack tool.

The v1.0 Player supports beat-paced reading, three themes, evidence cues, risk guidance, Copy and keyboard navigation. Teachers can create lessons with the standalone authoring tool and install companion lesson packs without rebuilding CiM. External evaluation is planned.

Read the [install guide](docs/INSTALL.md) and [write-your-first-lesson guide](docs/AUTHORING-GUIDE.md).

## Quick start

1. Download and verify the named Code in Motion plugin ZIP from [GitHub Releases](https://github.com/johnwinstondarby/Code-in-Motion/releases). Use the named release asset; GitHub’s automatically generated source archive is not the installable plugin.
2. In WordPress 6.5+ (PHP 7.4+), install and activate the ZIP through **Plugins → Add Plugin → Upload Plugin**.
3. Add a Shortcode block to a draft page: `[cim experience="python-first-steps"]`. Preview on a desktop or laptop, then press Play.
4. Open **Code in Motion** in the WordPress sidebar, expand **Support information**, and find **Static health** if fallback text appears. The install guide explains each check.
5. To write your own lesson, download the separate authoring-tool ZIP, run `node tools/cim-author.mjs init my-lesson.json`, edit it, use `node tools/cim-author.mjs preview my-lesson.json` to see the Player locally, then follow the guide to validate, pack and install it.

Acceptance targets: a working starter on a fresh site in under 15 minutes; an unfamiliar teacher's own three-beat lesson in about 30 minutes. These targets have not been measured with a new teacher. Automated checks do not establish how long a new teacher takes.

## Using the public GitHub repository

The public home is [johnwinstondarby/Code-in-Motion](https://github.com/johnwinstondarby/Code-in-Motion). You can read the files without cloning the repository. Teachers normally need the two named assets under [Releases](https://github.com/johnwinstondarby/Code-in-Motion/releases), not a fork or Git checkout. Use tag `1.0.1` to inspect the published v1.0 source; `main` can include later work. Use [Issues](https://github.com/johnwinstondarby/Code-in-Motion/issues) for a reproducible problem, with your CiM, WordPress and PHP versions and the exact error.

| What you want | Where to go | What it is for |
| --- | --- | --- |
| Install CiM on a site | Release asset `code-in-motion-1.0.1.zip`; [install guide](docs/INSTALL.md) | Upload through WordPress Plugins. |
| Write your own lesson | Release asset `cim-authoring-1.0.1.zip`; [authoring guide](docs/AUTHORING-GUIDE.md) | Run the local tool; no repository build required. |
| Find the editable template | [Python authoring JSON](experiences/starter/python-first-steps.authoring.json) | Read the template; use `init` to make your own editable copy. |
| Find the authoring commands | [tools/cim-author.mjs](tools/cim-author.mjs) | `init`, `preview`, `validate`, `compile`, `pack`. |
| Understand the Admin screen | [Admin walkthrough](docs/INSTALL.md#use-the-admin-console) | Find a lesson's shortcode and understand its status. |
| Check allowed JSON fields | [v2 format](docs/AUTHORING-JSON-v2.md), [v1 field rules](docs/AUTHORING-JSON-v1.md) | References for authors, not files to edit. |
| Understand companion packs | [pack agreement](docs/LESSON-PACKS-v1.md) | Compatibility, validation, conflicts and pack lifecycle. |
| Work on WordPress integration | [wordpress/](wordpress/), root [plugin entry](code-in-motion.php), [plugin readme](readme.txt) | Maintainer implementation and metadata. |
| Work on the engine or tests | [src/](src/), [tests/](tests/), [.github/workflows/](.github/workflows/) | Developer source and verification. |
| Understand release decisions | [ADR 0060](docs/adr/0060-packaging-for-teaching-sites.md) | Scope, safety boundary and current release policy. |

An `.authoring.json` file is editable lesson source. The neighboring compiled `.json` and copies under `wordpress/experiences/` are generated runtime data. Ordinary lesson authors edit their own source file, build a separate pack, and leave those repository copies alone. The commands and three file stages are explained in the [authoring guide](docs/AUTHORING-GUIDE.md).

## Building your own version

Fork [johnwinstondarby/Code-in-Motion](https://github.com/johnwinstondarby/Code-in-Motion), check out the exact release tag and use the Node version in `.nvmrc` (22.23.2 for this release). Run `npm ci --ignore-scripts`, `npm run verify`, then `npm run build:wordpress` and `npm run build:authoring` from a clean committed checkout. The named ZIPs and checksums appear in `dist/`. Repeating the build on the same pinned Node version must produce identical bytes.

Bundled authored sources are in `experiences/`; registered compile jobs are in `tools/compile-authoring.mjs`; the WordPress registry is `wordpress/experiences/registry.json`. Run `npm run compile:authoring` and the registry projection generators after a deliberate bundled-lesson change. Ordinary teachers should use a companion pack instead.

A separately installable fork must rename the plugin directory, header/name and identifiers/handles/hooks that could collide, and update the packaging gates/build paths consistently. Merely changing the title does not allow two copies to coexist. Keep required copyright/license notices. Fork maintainers support their own versions; Localis supports the official release.

## License

CiM and the authoring tool are GPLv3-only (SPDX `GPL-3.0-only`), with the exact [LICENSE](LICENSE) included in the plugin, authoring-tool and generated integration ZIPs. WordPress headers/readme use the matching GPLv3 declaration and GNU license URI. No new “or later” grant is made. Teachers retain rights in their original lesson content.

Developer architecture, repository layout and verification: [Contributing](CONTRIBUTING.md).
