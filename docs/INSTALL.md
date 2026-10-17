# Install Code in Motion v1.0

Use WordPress 6.5 or later and PHP 7.4 or later. Learners need a desktop or laptop with a window at least 768 pixels wide. On phones the Player displays a notice; keep useful surrounding lesson text on the page.

## Have a lesson on a page in under 15 minutes

1. Download `code-in-motion-1.0.0.zip` and its `.sha256` file from the [GitHub release](https://github.com/johnwinstondarby/Code-in-Motion/releases). Use the named plugin ZIP, not GitHub's automatically generated source archive. Until v1.0 is published, use the reviewed candidate supplied for the dry run.
2. Verify the ZIP's SHA-256 against its companion file. On Windows use `Get-FileHash`; on macOS use `shasum -a 256`; on Linux use `sha256sum`.
3. In WordPress, open **Plugins → Add Plugin → Upload Plugin**, choose the ZIP, install and activate it.
4. Open **Code in Motion** in the administration menu. Static health should show Release deployment, present module root and bootstrap, available Experience/renderer inventories, and consistent plugin version.
5. Add a page. Insert a **Shortcode block**, paste `[cim experience="python-first-steps"]`, and select Preview.
6. Press Play. Read the first completed beat, then press Play or Next to continue. Check Previous, End and Copy. Publish the page when satisfied.

The Python starter is a simulated Console demonstration, not a Python interpreter. CiM never runs the commands it displays. Explain this to learners before asking them to copy commands to their own terminal.

## Install your own lesson pack

Follow the [authoring guide](AUTHORING-GUIDE.md) to create a companion lesson-pack ZIP. Install and activate it through the same WordPress plugin screen while CiM is active. The pack appears in **Code in Motion → Experience inventory**, with its source marked **lesson pack** and a shortcode to copy. A pack is a plugin: install only packs you made with the official tool or obtained from an author you trust. CiM treats the lesson JSON as untrusted data; it does not make arbitrary third-party PHP plugins safe.

Preview the lesson on a draft page before publishing. If a pack uses an existing bundled ID, has a conflicting ID, has invalid JSON, or points outside the plugins directory, the Admin Console reports the problem. Fix the source and rebuild; do not edit generated PHP. Full schema and engine compatibility checks occur when the Player loads. A metadata inventory entry alone is not a complete runtime validation result.

## Themes and existing sites

New lessons and the Python starter default to the neutral **Light** theme. Learners can select Light, High Contrast or the optional Localis palette. A remembered learner choice takes precedence, and a page's Players share that choice. To give a page an explicit initial preference, use `[cim experience="my-first-lesson" theme="light"]`; it still respects the learner's saved selection and accessibility settings.

The three legacy bundled lessons retain their existing default and shortcode markup. Upgrading an active Localis installation does not change its Git lesson, palette, controls or page content. Existing `localis_` PHP identifiers and frozen `localis.cim/...` schema IDs are compatibility names, not a requirement to host at Localis.

## If the Player does not appear

Keep the fallback text and check **Code in Motion**:

| Check | Expected result | What to do if it differs |
| --- | --- | --- |
| Deployment mode | Release | Install the named release ZIP rather than source files. |
| Active module root / Bootstrap module | Present | Replace the plugin with the intact release ZIP. |
| Experience registry / Renderer inventory | Available | Reinstall the intact ZIP; report the failed check and version. |
| Plugin version consistency | Consistent | Clear hosting caches and replace the complete plugin ZIP. |
| Experience inventory | Present (release) or Present (lesson pack) | Activate the pack; copy the exact shortcode shown. |
| Pack errors | None | Correct the reported ID, file location, size or JSON problem, then rebuild. |
| Renderer | Registered | Pack lessons must use the compiled Console v2 format. |

A phone or narrow window intentionally gets the desktop notice. Widen the window and reload. A valid-looking inventory entry with fallback on the page may mean schema validation or engine compatibility failed; check the browser console for a `CIM-*` diagnostic and include it with your report. Do not paste executable scripts to bypass validation. For a shortcode placed by a template or page builder, see the documented `localis_cim_should_enqueue` filter; ordinary Shortcode blocks require no configuration.

## Upgrade, rollback and removal

Back up your site and retain the previous exact ZIP and its checksum. Replace only the CiM plugin ZIP through WordPress, keep the lesson-pack plugins active, clear hosting edge/object caches, and preview the lesson page again. Check both reminders in Git beats 6 and 8 if you use that lesson.

Rollback is the same replacement process with the previous exact CiM ZIP, followed by cache clearing. A pack's files survive upgrading, rolling back or uninstalling CiM because each pack is a separate plugin. **CiM 0.2.6 cannot display companion packs**; they remain on disk and reappear when a compatible CiM version is restored. Bundled lessons remain available on the older version. Remove a pack through WordPress only when you intend to remove its lesson data. Deactivating a pack hides its lesson; it does not erase pages containing its shortcode. CiM uninstall removes only its own motion-policy option and leaves pack plugins untouched.

Source and supported fork instructions: [johnwinstondarby/Code-in-Motion](https://github.com/johnwinstondarby/Code-in-Motion). Report official-release issues there with plugin, WordPress and PHP versions, the failed health check and a minimal reproducible lesson. Fork maintainers support their own versions.
