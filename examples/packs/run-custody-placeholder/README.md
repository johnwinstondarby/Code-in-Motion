# Run Custody placeholder source

This is **Placeholder · simulated** content, not lab evidence. It needs the future CiM 1.1 route; published WordPress 1.0.1 refuses this pack. The local authoring preview identifies as 1.1.0-dev through an explicit development capability. No WordPress installation is needed for preview.

From the authoring tool root:

```
node tools/cim-author.mjs init my-lesson --format v3
node tools/cim-author.mjs validate my-lesson/lesson.json
node tools/cim-author.mjs preview my-lesson/lesson.json
node tools/cim-author.mjs compile my-lesson/lesson.json --out compiled.json
node tools/cim-author.mjs pack my-lesson/lesson.json --out my-lesson.zip
```

Edit lesson.json for the lesson ID, title, actions and Explanation. capture.json supplies the modeled Diagram records and their raw/ evidence references. media.json declares each media/ clip, its codec, byte count, SHA-256 and its own captions/ track. Keep placeholder flags and labels honest. Validate after editing. Save and refresh the local preview; no reinstall or cache clear is needed.

`pack --upload-limit BYTES` checks a known target upload limit against the whole ZIP. Without it, preflight explicitly reports that the site's limit is unknown. Passing each clip's limit does not guarantee installation. Pack-local media only; Media Library attachments arrive in 1.2.

Normal builds use the committed MP4, WebM and VTT bytes. Optional generate-media.py requires Python and the exact FFmpeg/font environment recorded in MEDIA-TOOLS.json. Another encoder or font version is not promised to reproduce those bytes. The generator and this editable source are not PHP payload code: generated packs contain only the fixed inert PHP template, compiled/capture data, verified media/evidence, license and generated readme.
