# Code in Motion v1.0 authoring tool

Start with [Write your first lesson](docs/AUTHORING-GUIDE.md). Install Node.js 22 or later, then open a terminal in this extracted folder:

```text
node tools/cim-author.mjs init lesson.json
node tools/cim-author.mjs preview lesson.json
node tools/cim-author.mjs validate lesson.json
node tools/cim-author.mjs pack lesson.json --out my-lesson.zip
```

The template is `experiences/starter/python-first-steps.authoring.json` in this ZIP. `init` makes your editable `lesson.json` copy; leave the shipped template intact. Edit your copy’s ID, title and three beats. Save and refresh the local preview to see changes. Validation errors show the rule, JSON path and suggested fix. Stop preview with Ctrl+C before entering the validate/pack commands, or run those commands in a second terminal in this folder.

Install and activate `my-lesson.zip` through WordPress Plugins alongside Code in Motion. Open Code in Motion in the WordPress sidebar, find Pack lessons, wait for Ready, then copy its shortcode into a page’s Shortcode block. Preview and publish the page. The [install guide](docs/INSTALL.md) explains placing the shortcode and checking the Admin Console. No repository checkout, npm install or CiM rebuild is needed. Commands in lessons are displayed, never executed.

The tool and generated plugin integration are GPLv3; see LICENSE. Authors retain rights in their original lesson content.
