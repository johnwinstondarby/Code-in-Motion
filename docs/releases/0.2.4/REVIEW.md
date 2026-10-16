# 0.2.4 candidate — wrapped lines and conditional loading

Hold the combined release merge, tag and installation for Daisy's review of the exact candidate head and ZIP. PR #86 is already reviewed and merged; the wrap-fix commits from PR #85 are included in this candidate, without separately merging that PR.

Console continuations start two character widths beyond authored leading spaces. Text, Copy values and the 0.2.3 whole-line cue remain intact. WordPress registers assets inertly, enqueues them for actual use or explicit opt-in, and honors explicit suppression. A bootstrap guard prevents module imports on pages without embeds. Template/builder shortcodes have a late enqueue safety net. ADRs 0056/0057 and R39 record these changes.

Plugin version 0.2.4; engine localis.cim/engine@1.0.1. No lesson, authoring-format, theme, mobile rule, page content or legacy Player change. The wrap collision is fixed and its former expected failure must pass.

Build twice using pinned Node 22.23.2, compare exact ZIP bytes and record SHA-256. All four protected workflows and their sub-jobs must pass on the exact head. Compare the installed and all upgrade CI ZIPs to delivery. Upgrade origins: 0.1.10, 0.2.0, 0.2.1, 0.2.2 and live 0.2.3. Each rehearsal rolls back to exact 0.2.3, SHA-256 d84b6bae3f8c98b434944ce419ebd26d51b1e01fdbed43be253eef1605183ff8, and restores the captured page. Hosting cache clearing is outside CI rollback timing.

The recovery bundle contains that exact 0.2.3 ZIP, its checksum, a fresh page 3227 JSON/raw-content capture and checksums, restore/capture helpers, optional authenticated rollback script, and the original 0.1.10 hosting backup as secondary fallback. Private captures and rollback files must not enter the plugin ZIP. No page edit is required. Normal rollback is uploading the inner 0.2.3 ZIP through wp-admin, then clearing WordPress.com caches; restore page content only if edited. Re-check capture against live immediately before any later installation.

After installation and cache clearing, verify zero CiM requests on /journey-of-a-token/, /localis-articles/ and the home page; page 3227 must retain desktop playback, themes, Copy, fonts, the readable cue and corrected wrapping, and show the approved notice on phones. Record before/after request counts in release evidence. Production acceptance remains pending installation.

Deferred: per-phrase limn (18-phrase draft retained; authoring/v3), author palettes, optional Match device, and authenticated SSH access for scripted rollback.
