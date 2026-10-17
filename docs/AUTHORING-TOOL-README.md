# Code in Motion v1.0 authoring tool

Start with [Write your first lesson](docs/AUTHORING-GUIDE.md). Install Node.js 22.23.2, then open a terminal in this extracted folder:

```text
node tools/cim-author.mjs init lesson.json
node tools/cim-author.mjs preview lesson.json
node tools/cim-author.mjs validate lesson.json
node tools/cim-author.mjs pack lesson.json --out my-lesson.zip
```

Edit the Python starter's ID, title and content. Save and refresh the local preview to see changes. Validation errors show the rule, JSON path and suggested fix. Stop preview with Ctrl+C.

Install and activate `my-lesson.zip` alongside Code in Motion. The [install guide](docs/INSTALL.md) explains placing the shortcode and checking the Admin Console. No repository checkout, npm install or CiM rebuild is needed. Commands in lessons are displayed, never executed.

The tool and generated plugin integration are GPLv3; see LICENSE. Authors retain rights in their original lesson content.
