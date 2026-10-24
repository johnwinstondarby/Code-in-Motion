# Code in Motion v1.0 authoring tool

Use Node.js 22 or later on your computer. No npm install or repository checkout is needed. The [first-lesson guide](docs/AUTHORING-GUIDE.md) explains the fields and complete workflow.

## 1. Find the template and make your copy

The template is [experiences/starter/python-first-steps.authoring.json](experiences/starter/python-first-steps.authoring.json) inside this ZIP. Open a terminal in the extracted tool folder and run:

```text
node tools/cim-author.mjs init my-lesson.json
```

This creates your editable `my-lesson.json`. Leave the shipped template intact. Open your copy in a code/plain-text editor and edit its ID, title and three beats to teach your own content.

## 2. Edit and preview locally

```text
node tools/cim-author.mjs preview my-lesson.json
```

Open the printed URL in a browser. Save your JSON and refresh to see edits. Validation errors show the rule, JSON path and suggested fix. Commands in lessons are displayed, never executed.

Before entering the next commands, stop preview with Ctrl+C or open a second terminal in the same extracted folder.

## 3. Build the pack and put it on a page

```text
node tools/cim-author.mjs validate my-lesson.json
node tools/cim-author.mjs pack my-lesson.json --out my-lesson-pack.zip
```

Install and activate `my-lesson-pack.zip` through WordPress Plugins alongside Code in Motion. Open Code in Motion in the WordPress sidebar, scroll to Pack lessons, wait for Ready, and select/copy its shortcode into a page's Shortcode block. Preview and publish the page. The [install/Admin guide](docs/INSTALL.md) explains each status and troubleshooting.

Your JSON stays on your computer; WordPress gets the generated pack ZIP. The local preview server does not need to run after installation. Keep your source and previous ZIPs for revisions.

The tool and generated plugin integration are GPLv3; see LICENSE. Authors retain rights in their original lesson content.

## Multi-pane development candidate

For the eight-beat simulated Run Custody template, see [Authoring JSON v3](docs/AUTHORING-JSON-v3.md) and `examples/packs/run-custody-placeholder/README.md`. Start with `node tools/cim-author.mjs init my-lesson --format v3`; edit the copied JSON, validate, then preview locally. The candidate also compiles and builds a self-contained pack. Published CiM 1.0.1 cannot install this format; WordPress admission waits for Part C. Media Library attachments wait for 1.2.
