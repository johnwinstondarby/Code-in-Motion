# v1.0 documentation and Admin simplicity review

Date: 2026-10-17. Scope: Johann's release approval and three documentation needs. This is a maintainer review of actual source, labels and task paths, supported by existing installed-WordPress/browser checks; it is not an outsider usability study. No participant run has occurred.

| Need | Finding | Change / evaluation |
| --- | --- | --- |
| Public GitHub information and file locations | The structural tree omitted wordpress/ and did not guide teachers to assets vs source or template vs compiled JSON. | README now has a task-to-file map, Releases/Issues/tag/main guidance and explicit source/artifact distinctions. |
| Simple plugin Admin use | One page begins with System, Host configuration, Static health and Release information before lessons. “Experience” is technical vocabulary. Arrow notation in the guides implied nonexistent submenus. | INSTALL explains one-page navigation, maps teacher tasks to sections, translates statuses and distinguishes Present from Ready. It says editing/building happens locally, ZIP installation in Plugins and page creation in Pages. |
| Locate the JSON template | The guide said init created a copy, but did not prominently identify the exact supplied file or neighboring compiled file. | Both authoring entry points name experiences/starter/python-first-steps.authoring.json and the resulting editable file. |
| Edit the JSON for use | Existing field details lacked a short practical editing sequence. | AUTHORING-GUIDE adds UTF-8/JSON syntax advice, a field table, own-content guidance and a command/output/explanation example. Frozen references remain unchanged. |
| Apply it to the website/page | The guide jumped from building a ZIP to an install-guide reference. | Explicit Plugins → activate both plugins → Ready → copy shortcode → Pages/Shortcode block → Preview → Publish sequence. It identifies lesson ID vs filename and explains that local preview can stop. |
| Node wording | Tool README required exactly 22.23.2 while the guide allowed 22+. | Tool README now says Node.js 22 or later. Build reproducibility still requires the pinned version. |
| Release policy | Docs still made an outsider run a pre-publication gate. | README/ADR record Johann's decision: publish with external validation pending, with no claimed human timing result. |

The archive-link audit also found that the bundled v2 authoring reference linked to compiler specifications absent from the ZIPs. Both existing AUTHORING-TO-RUNTIME v1/v2 files are now included unchanged, with exact static-file allowlist entries; offline reference links resolve without changing a frozen specification.

## Admin assessment

The Admin Console supports the necessary v1 tasks with the guide: identify a bundled lesson, copy a shortcode, see every installed pack and rejected lesson, and inspect an installation failure. One site-wide motion selector keeps configuration small; no change is needed for normal lesson use. Empty pack tables are a valid state. Ready/rejection reasons are useful, and a rejected lesson does not remove other valid lessons.

It is not yet self-explanatory for a new teacher. Primary lesson actions are below technical sections; “Experience,” “Renderer,” “module root” and “schema” need translation. It does not offer JSON editing, upload or a lesson builder, so those expectations must be set before opening Admin. Documentation addresses those gaps for v1; it does not prove the screen is easy for a first-time user.

Possible later UI work: put a small teacher-task summary and lesson inventory first, label technical details as support information, and link directly to the authoring/install guide. These are follow-up recommendations, not code shipped by this documentation PR. Do not claim the outsider run or the 15/30-minute targets passed.

## Verification and release scope

Review actual labels/order against wordpress/admin-console.php and wordpress/lesson-packs.php. Exercise the documented init/edit/preview/validate/pack sequence using the extracted tool, including a command/output/explanation edit; inspect included guide links and both reproducible ZIPs. Keep technical CI and release packaging gates. Preserve all approved code, lesson files, frozen formats and rollback data byte-for-byte.

Release authorization is recorded in ADR 0060. Publish the final verified main commit with both ZIPs, checksums and upgrade/rollback notes. External evaluation is post-release follow-up. Localis installation and live acceptance remain separate; this review changes no live site.
