# Install Code in Motion v1.0

Use WordPress 6.5 or later and PHP 7.4 or later. Learners need a desktop or laptop with a window at least 768 pixels wide. On phones the Player displays a notice; keep useful surrounding lesson text on the page.

## Have a lesson on a page in under 15 minutes

1. Download `code-in-motion-1.0.0.zip` and its `.sha256` file from the [GitHub release](https://github.com/johnwinstondarby/Code-in-Motion/releases). Use the named plugin ZIP, not GitHub's automatically generated source archive.
2. Verify the ZIP's SHA-256 against its companion file. On Windows use `Get-FileHash`; on macOS use `shasum -a 256`; on Linux use `sha256sum`.
3. In WordPress, open **Plugins → Add Plugin → Upload Plugin**, choose the ZIP, install and activate it.
4. Open **Code in Motion** in the administration menu. Static health should show Release deployment, present module root and bootstrap, available Experience/renderer inventories, and consistent plugin version.
5. Add a page. Insert a **Shortcode block**, paste `[cim experience="python-first-steps"]`, and select Preview.
6. Press Play. Read the first completed beat, then press Play or Next to continue. Check Previous, End and Copy. Publish the page when satisfied.

The Python starter is a simulated Console demonstration, not a Python interpreter. CiM never runs the commands it displays. Explain this to learners before asking them to copy commands to their own terminal.

## Install your own lesson pack

Follow the [authoring guide](AUTHORING-GUIDE.md) to create a companion lesson-pack ZIP. Install and activate it through the same WordPress plugin screen while CiM is active. Open **Code in Motion** in the WordPress sidebar and scroll to **Lesson packs**. The pack appears there, with its status and reason. Wait for **Ready**, then copy its shortcode from **Pack lessons**. A pack is a plugin: install only packs you made with the official tool or obtained from an author you trust. CiM treats the lesson JSON as untrusted data; it does not make arbitrary third-party PHP plugins safe.

Preview the lesson on a draft page before publishing. If a pack uses an existing bundled ID, has a conflicting ID, has invalid JSON, or points outside the plugins directory, the Admin Console reports the problem. Fix the source and rebuild; do not edit generated PHP. The Admin Console runs the same schema and engine checks as the Player for every eligible active lesson. Checking is not Ready; rejected lessons show the reason and no shortcode. Public loading repeats validation.

## Use the Admin Console

Log in as a site administrator and choose **Code in Motion** in the WordPress sidebar. This is one page: **Static health**, **Lesson packs**, **Pack lessons** and **Experience inventory** are headings to scroll to, not separate submenu items.

The Admin Console checks the installation and shows shortcodes. It does not edit JSON, accept a JSON upload, build a pack or publish a page. Prepare a lesson on your computer; install its generated ZIP through WordPress **Plugins**; place its shortcode through WordPress **Pages**.

| Your task | Find this section | What to do / what success looks like |
| --- | --- | --- |
| Put an included lesson on a page | Experience inventory | Find `python-first-steps`, check **Present (release)**, then select and copy its Shortcode text. Test it on a draft page. |
| Put your own lesson on a page | Lesson packs, then Pack lessons | Activate its separate plugin under WordPress Plugins. Wait for the lesson to say **Ready**, then select and copy its shortcode. |
| Find why your lesson was refused | Lesson packs / Pack lessons | Read Status and Reason. Fix the authored source, rebuild and replace its pack. |
| Check whether CiM was installed intact | Static health | Expect Release, Present, Available and Consistent as listed in the troubleshooting table below. |
| Check the installed version or report a problem | System / Release information | Record the plugin, WordPress and PHP versions and the exact error; use the support link. |
| Reduce animation across your site | Host configuration | Leave **System preference** for normal use, or select **Force reduced motion** and save. This setting does not add lessons or change their content. |

**Experience** means a lesson in the inventory labels. The **Experience inventory** lists bundled lessons; **Pack lessons** lists lessons installed separately. A site with no packs has empty pack tables; that is normal.

| Pack status | Meaning | Next action |
| --- | --- | --- |
| Inactive | The separate pack plugin is installed but not active; its JSON is not loaded. | Activate it under WordPress Plugins if you want to use it. |
| Checking | Browser validation has not finished. | Wait for Ready or Rejected. If it stays Checking, confirm browser scripts are allowed and reload the Admin page. |
| Ready | The lesson passed the same admission checks used by the Player. | Copy its shortcode and preview a draft page. Ready is not a substitute for checking your teaching content. |
| Rejected | CiM refused this pack or lesson. | Read the reason, fix the source or compatibility issue, and rebuild. Other valid lessons remain available. |

**Present (release)** checks that an included lesson file exists; **Ready** means an external lesson passed the browser's schema and Player checks. These are different checks. **Renderer inventory** describes installed display engines and is normally only needed for support.

For a first lesson, use only the inventory and its shortcode. Most installations do not need a configuration change.

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
| Experience inventory / Lesson packs | Present (release) / Ready | Activate the pack; copy the exact shortcode shown. |
| Pack errors | None | Correct the reported ID, file location, size or JSON problem, then rebuild. |
| Renderer | Registered | Pack lessons must use the compiled Console v2 format. |

A phone or narrow window intentionally gets the desktop notice. Widen the window and reload. A valid-looking inventory entry with fallback on the page may mean schema validation or engine compatibility failed; check the browser console for a `CIM-*` diagnostic and include it with your report. Do not paste executable scripts to bypass validation. For a shortcode placed by a template or page builder, see the documented `localis_cim_should_enqueue` filter; ordinary Shortcode blocks require no configuration.

## Upgrade, rollback and removal

Back up your site and retain the previous exact ZIP and its checksum. Replace only the CiM plugin ZIP through WordPress, keep the lesson-pack plugins active, clear hosting edge/object caches, and preview the lesson page again. Check both reminders in Git beats 6 and 8 if you use that lesson.

Rollback is the same replacement process with the previous exact CiM ZIP, followed by cache clearing. A pack's files survive upgrading, rolling back or uninstalling CiM because each pack is a separate plugin. **CiM 0.2.6 cannot display companion packs**; they remain on disk and reappear when a compatible CiM version is restored. Bundled lessons remain available on the older version. Remove a pack through WordPress only when you intend to remove its lesson data. Deactivating a pack hides its lesson; it does not erase pages containing its shortcode. CiM uninstall removes its own motion-policy option and disposable pack-inventory cache, and leaves pack plugins untouched.

Source and supported fork instructions: [johnwinstondarby/Code-in-Motion](https://github.com/johnwinstondarby/Code-in-Motion). Report official-release issues there with plugin, WordPress and PHP versions, the failed health check and a minimal reproducible lesson. Fork maintainers support their own versions.
