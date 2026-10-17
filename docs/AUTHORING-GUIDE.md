# Write your first Code in Motion lesson

This guide is for teachers who can edit JSON and run a terminal command. You do not need to fork CiM, install its development dependencies, or build the CiM plugin. The first public release and its packaging are **v1.0**, represented as `1.0.0` in machine-readable versions.

## Get the authoring tool

Install Node.js 22 or later; release reproducibility is tested with the pinned version in `.nvmrc`. Download and verify `cim-authoring-1.0.0.zip` from the [GitHub release](https://github.com/johnwinstondarby/Code-in-Motion/releases), extract it, and open a terminal in the extracted `cim-authoring-1.0.0` folder. There is no `npm install` step and no dependency on a checkout of the repository.

```text
node tools/cim-author.mjs init my-lesson.json
```

This creates an editable copy of the three-beat Python starter. Keep your `.authoring.json` or `.json` source outside WordPress and under your own version control. The tool's supporting folders are `tools/`, `authoring/`, `src/` and `experiences/starter/`; keep them together when moving the extracted tool.

## Preview while editing

After creating your source, run:

```text
node tools/cim-author.mjs preview my-lesson.json
```

Open the printed localhost URL in a desktop browser. Edit/save your JSON and refresh to see the production Player and validation errors. This runs locally and compiles in memory; you do not need to build or install a pack for each edit. Stop with Ctrl+C. Use `--port 8088` if you prefer a fixed port. The final WordPress draft preview still checks the host/theme integration.

## 1. Plan the beats

Open `my-lesson.json`. Set a unique lowercase, hyphenated `id`, such as `my-python-introduction`, and write a useful title and opening description. Increment the lesson's own `version` when publishing a revision. Do not reuse `python-first-steps` or any other bundled ID. A pack contains one lesson, and its folder name is derived from that lesson's ID.

The starter teaches expressions, assignment and reuse in three beats. Each beat has an ID, Console example and Explanation. One beat should teach one idea. Start with three beats; avoid turning a long lecture into one uninterrupted command stream.

## 2. Write the Console lines

`console.prompt` is the visible prompt, not part of what Copy copies. A beat supplies `command` and an `output` array. Output entries have one `text` line and a `tone`: `normal`, `dim`, `accent`, `added`, `removed` or `warning`.

```json
"console": {
  "command": "count * 2",
  "output": [{ "id": "product", "text": "10", "tone": "normal" }]
}
```

Use an empty output array for a command that prints nothing. Use separate output entries for separate lines; tabs and embedded line breaks are rejected. CiM displays authored examples and never executes them. Check every command and output yourself. `copy`, when supplied, is the exact replacement text for the Copy button; otherwise it copies the command. Optional `typing: false` displays a command immediately.

## 3. Explain the command and result

An Explanation segment has `at` (`command`, `output` or `response`) and plain `text`. The last segment must correspond to the last Console phase. If the command has output, finish with an output explanation. A command-only beat finishes with a command segment. `console.response` is an authored response to a simulated prompt, not an input box for the learner.

```json
"explanation": {
  "heading": "Use the value again",
  "segments": [
    { "at": "command", "text": "Python looks up count and multiplies its value by two." },
    { "at": "output", "text": "The result is ten.", "focus": ["product"] }
  ],
  "references": [{ "label": "Python tutorial: numbers", "url": "https://docs.python.org/3/tutorial/introduction.html#numbers" }]
}
```

Write text rather than HTML. References use descriptive labels and absolute **HTTPS** URLs. The frozen authored format is stricter than a general http/https allowance: do not loosen it. Labels such as “click here” are rejected. Links open separately; they are never interpreted as markup.

## 4. Choose the limn through evidence

Give an output line an `id` and name it in an output segment's `focus` array. The Player's **Show in Console** control then points to the relevant evidence. Command segments already identify their command. Focus must refer to output in the same beat that has appeared by that segment.

There is **no `limn` JSON field in AUTHORING-JSON v2**. The Player supplies whole-line cues. Per-phrase limn is deferred to a future format and is outside this release. Do not change colors or animation to encode a temporary relationship; use focus.

## 5. Describe risk where it matters

The Python starter has no destructive action and needs no risk label. For a lesson that changes or discards work, use a beat-level risk object as defined in the [frozen format reference](AUTHORING-JSON-v1.md#18-risk): `level` is `free-to-undo`, `leaves-a-trace` or `cannot-be-undone`; add practical `guidance`. The Player supplies the label. Do not invent a `label` property or use colors instead of explaining the consequence. Put essential precautions in the command explanation **before** the learner sees Copy, as the bundled Git reset examples do.

## 6. Validate and compile

```text
node tools/cim-author.mjs validate my-lesson.json
node tools/cim-author.mjs compile my-lesson.json --out my-lesson.compiled.json
```

Validation errors identify the rule and JSON path. The compiler is the same frozen compiler used by CiM's repository tool; the same input produces byte-identical compiled JSON. Compilation is useful for inspection; you do not need to edit or upload the compiled file separately.

## 7. Make a pack, install and preview

```text
node tools/cim-author.mjs pack my-lesson.json --out my-lesson-pack.zip
```

The tool creates a companion WordPress plugin ZIP and checksum. It contains compiled JSON, fixed integration code, a license and insertion instructions. Authored text never becomes PHP code. Only a compiler-validated lesson ID and content hash enter the fixed integration code. Inputs and compiled lessons are limited to 2 MiB; split a lesson that exceeds the limit.

Follow the [install guide](INSTALL.md) to install and activate the pack alongside CiM. Copy its shortcode from the Admin Console to a **draft** page, then use WordPress Preview. This is the preview path: check the actual Player, commands, Copy, explanations, focus, references, risk guidance and all three themes in WordPress. Play must stop at each completed beat. Publish only after checking these yourself.

To replace a lesson, keep its ID, increment its version, build a new ZIP to a new output path, and use WordPress's explicit **Replace current with uploaded** action. Content-hashed JSON filenames avoid reusing stale lesson URLs. To keep two lessons, use different IDs. The tool refuses to overwrite output files; choose a fresh filename or move your previous artifact yourself.

## Common errors

| Error | Fix |
| --- | --- |
| Invalid JSON / unknown field | Check commas and quotation marks; remove properties not in the frozen reference. |
| Duplicate or bundled ID | Give your lesson and beats unique lowercase-hyphenated IDs. |
| Final anchor incomplete | End the explanations at output or response when the Console has that phase. |
| Unknown/future focus target | Focus an ID on output in the same beat, after that output is revealed. |
| Invalid reference | Use an absolute HTTPS URL and descriptive label. |
| Tabs or line breaks in Console text | Replace tabs with spaces; split output into separate entries. |
| Output file already exists | Pick a new artifact filename; source and earlier builds are preserved. |
| Pack present but Player falls back | Check the browser's `CIM-*` diagnostic; fix schema/engine errors and rebuild. |
| Pack disappears after rollback | CiM 0.2.6 predates pack support; files remain and return with v1.0. |

The [v2 reference](AUTHORING-JSON-v2.md) inherits the [v1 field rules](AUTHORING-JSON-v1.md); both remain frozen. The tool bundle includes these references. For a maintained fork rather than ordinary lesson authoring, see [the public repository](https://github.com/johnwinstondarby/Code-in-Motion) and the README's build instructions. Fork maintainers support their own versions. The compiler and generated PHP integration are GPLv3; authors retain rights in their original lesson content.

## Pack agreement and conflicts

The tool writes the fixed PHP template and a `cim.lesson-pack/v1` manifest declaring compatibility with CiM >=1.0.0 and <2.0.0. Keep generated files together; do not edit PHP, manifest paths or compiled JSON. Only active packs' own local JSON is read. Admin Console → Lesson packs checks every eligible lesson and shows each rejection reason before you create a page. Copy a shortcode only after its lesson says Ready. If two active packs use the same lesson ID, neither wins; rename the ID in authored source and rebuild. Display titles may match when IDs differ. See [the declared agreement](LESSON-PACKS-v1.md).
