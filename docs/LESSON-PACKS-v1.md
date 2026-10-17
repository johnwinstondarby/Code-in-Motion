# Companion lesson packs v1

This is CiM's versioned discovery agreement, `cim.lesson-pack/v1`. It is separate from the frozen authoring and runtime formats. The official authoring tool generates the complete pack. A teacher edits authored JSON, never the PHP template or compiled JSON.

## Discovery and compatibility

WordPress must recognize the pack as an installed plugin with a `CiM Lesson Pack: cim.lesson-pack/v1` header. CiM inspects installed plugin headers, including inactive packs for inventory. Only active (or network-active) packs supply lesson data. The plugin must have its own directory directly inside `wp-content/plugins`. Its PHP comes from the tool's fixed template: plugin metadata and an ABSPATH guard, with no registration callback or authored executable text.

CiM reads `cim-lesson-pack.json` from that same real directory. Example:

```json
{
  "schema": "cim.lesson-pack/v1",
  "cim_min": "1.0.0",
  "cim_max_exclusive": "2.0.0",
  "lessons": [{ "id": "my-first-lesson", "file": "lesson-contenthash.json" }]
}
```

Both bounds are release semantic versions: minimum inclusive, maximum exclusive. The tool declares compatibility with CiM 1.x. An unsupported header/manifest agreement, invalid bound or incompatible installed CiM version rejects the pack with the reason and installed/required versions in the Admin Console. Future agreement versions require explicit host support, not guessing.

The manifest is at most 64 KiB. There may be at most 100 installed packs and 100 declared lessons across accepted active manifests. Unknown manifest fields are inert and ignored. Required fields, bounds and lesson entries are checked. Each lesson has a canonical lowercase hyphenated ID, at most 100 characters, and a JSON basename. Generated files are named by their compiled content hash.

## File confinement and data checks

Only basenames ending `.json` are allowed: no path separators, `../`, absolute paths or remote URLs. Resolving the manifest or lesson file must leave it in its pack's own real directory. Symlinks escaping that directory are rejected, including links to a sibling plugin. Lesson files are readable local JSON of at most 2 MiB. Deactivated packs' manifests and lessons are not read or fetched.

PHP checks size, JSON syntax, matching lesson ID and Console v2 metadata. The Admin Console then validates every eligible active lesson using the same bounded reader, schema ingestion, identity, engine/renderer admission and the Console renderer’s own validation of every state as the Player. Links in external lessons must be absolute HTTP(S); frozen authored v2 remains stricter and allows HTTPS references only. The tool runs that compiler and the same schema/engine admission before preview or packing. No code examples or lesson text are executed.

## Duplicate IDs and rejection

No pack wins a duplicate lesson ID. All active entries with that ID are rejected, regardless of plugin order. Built-in IDs also cannot be replaced. Inactive packs do not participate in conflicts. Two lessons may have the same display title if their IDs differ; the shortcode uses the ID. Rename the ID in the authored source, rebuild and replace the affected pack to resolve a conflict.

Admin Console → Lesson packs lists every installed pack, its plugin path, status and reason. Pack lessons lists each readable active manifest's declared lessons, their owning pack, status and rejection reason. Ready lessons get a copyable shortcode. Rejected lessons do not. A malformed manifest is reported at pack level because no reliable lesson list can be recovered from it. Inactive packs are listed without opening lesson files. Checking means validation has not finished; it never means Ready. A failed lesson is skipped while independent lessons and the rest of the site continue. Public loading repeats validation and never trusts a previous Admin result.

## Local preview and lifecycle

`node tools/cim-author.mjs preview my-lesson.json` starts a read-only server bound to `127.0.0.1`. Open the printed URL, edit/save JSON and refresh. It compiles in memory and uses the production Player, showing validation errors locally. No ZIP build, WordPress installation, cache clearing or source upload is needed. The preview uses a temporary runtime identity to avoid built-in ID collisions; the authored source and eventual pack ID are unchanged. Only production assets and the compiled preview response are served; arbitrary local files are unavailable. Stop with Ctrl+C.

Packs are separate plugins. CiM upgrades, downgrade to 0.2.6 and CiM uninstall leave their files and activation untouched. CiM 0.2.6 cannot display them. Restoring a compatible CiM makes active packs available again. Only a deliberate pack replacement/deletion changes pack files. Install only generated packs you trust: CiM's JSON boundary cannot make an arbitrary PHP plugin safe.


## Discovery cost and cache invalidation

Bundled lessons do not discover packs. External lessons share one inventory per page request. Between requests, CiM reuses a disposable inventory cache for up to 24 hours, checking plugin activation, manifest content and resolved file metadata before reuse. A changed manifest or active-plugin list rebuilds the inventory. Resolved paths are checked again, so replacing a lesson with an escaping symlink invalidates acceptance. A warm request reads bounded manifests, not lesson bodies. Inactive packs' JSON is never read.

Use the authoring tool to rebuild and replace a complete pack; its content-hashed lesson filename and manifest change together. Editing installed JSON in place is unsupported. Pack files are never modified by this cache. Cache data expires automatically and contains derived inventory metadata, not lesson content or learner data.

The cache also retains plugin discovery metadata: warm public requests do not call WordPress’s header-enumerating `get_plugins()`. Activation options trigger fresh discovery. Opening the Admin Console refreshes installed-plugin discovery so newly installed inactive packs appear immediately.
