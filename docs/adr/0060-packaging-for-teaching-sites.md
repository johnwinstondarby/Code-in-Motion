# ADR 0060: Packaging Code in Motion for teaching sites

Status: Proposed for v1.0, 2026-10-16. Incorporates Daisy's v2 draft and Johann's selected companion-pack path. Public product and packaging version: **v1.0**; SemVer metadata and repository tag: **1.0.0**. This supersedes the draft's 0.3.0 release label, not a frozen format.

## Audience and the two answers

1. The primary audience is teachers who build their own WordPress learning sites and write their own lessons. They can edit JSON, run a terminal command and edit pages. They should not have to fork CiM, install its development dependencies or understand its ADRs.
2. First distribution is GitHub Releases. WordPress.org is a separate decision, not a prerequisite or an authorized submission. A directory submission would add Plugin Check remediation, slug verification, compliant metadata, an icon/banner and review/SVN release work. Plan a separate review cycle; no reliable approval time can be promised before directory review.

## Scope and practical ease of use

A stranger should install the named plugin ZIP and put the bundled Python lesson on a fresh WordPress page in **under 15 minutes**, using only the release and install guide. A teacher unfamiliar with CiM should create and publish their own three-beat lesson in **about 30 minutes**, using only the authoring tool and guides. These are acceptance targets, not measured claims until a genuine outsider completes the dry run. Every snag is recorded and fixed before publication.

In scope: current public docs; GPLv3 consistency; a neutral new-lesson default; a non-Git starter; a standalone compiler/lesson-pack tool; a local pack registration path; safe loading, inventory, tests and destructive guards; reproducible plugin/tool artifacts; upgrade/rollback evidence; fresh-site rehearsal and a human outsider run.

## Authoring path: B, a downloadable standalone command-line tool

Johann chose companion lesson packs. Distribute `cim-authoring-1.0.0.zip` beside the plugin rather than require a repository clone or an npm registry account. It contains the unchanged frozen v2 compiler and its transitive source dependencies, starter JSON, guides, references and GPLv3 license. Node 22+ is required; no npm installation is needed. Release builds use pinned Node 22.23.2.

The tool initializes a source file, validates, compiles, and builds a one-lesson companion plugin ZIP. Compiled output is byte-identical to `tools/compile-authoring.mjs` for the same input; the Git fixture checks this. Preview uses a draft WordPress page, so teachers check the actual Player on the site that will host it.

Compared with compiling on upload, this keeps Node and a second PHP compiler out of the runtime plugin and avoids introducing a privileged upload/store/delete API. The tradeoff is a terminal step and a second plugin installation, both already within the audience's stated skills. A visual editor and on-server compilation are excluded.

## Lesson registration and trust boundary

Generated companion plugins register `id` and local `file` through the neutral `cim_lesson_packs` filter. The file must be JSON, at most 2 MiB, readable and inside the installed plugins directory after realpath resolution. It must declare the matching ID and Console v2 metadata. URLs are derived from that verified local file, never supplied by lesson authors. Content hashes version URLs. Bundled IDs cannot be overridden; duplicate pack IDs are all rejected. Admin inventory shows the source, shortcode and metadata errors.

The metadata check is not a substitute for runtime validation. The existing browser loader still calls `ingestExperience`, schema validation, engine/renderer admission and the requested-ID check before constructing a Player. Streaming limits bound the response even without Content-Length; malformed JSON or invalid UTF-8 fails closed. External origins, non-http(s) URLs and non-JSON paths are rejected. A pack cannot alter the bundled resolution order. Lesson text remains textContent and references remain schema-gated links. Frozen authoring/v2 allows HTTPS references only; this stricter rule is preserved.

The generated PHP contains only fixed code, a compiler-validated ID, semantic version and content hash; arbitrary authored text is never interpolated into PHP. Installing any other third-party plugin is a separate trust decision. The CLI and runtime tests include hostile markup, unsafe links, malformed schemas, identity mismatches, incompatible engines, oversized bodies and conflicting registrations. Mutation guards must catch removal of these protections.

No new write endpoint is added. Installing, explicitly replacing, deactivating and deleting a pack use WordPress's existing plugin capability/nonce checks. Packs survive CiM upgrade, rollback and uninstall because they are separate plugins; a deliberate pack deletion removes that pack. Rolling back to 0.2.6 preserves files but hides packs until a pack-capable CiM is restored. That limitation is documented rather than presented as old-version compatibility.

## Branding and compatibility

Keep existing `localis_` functions, handles, filters/options, frozen schema/compiler IDs and the optional Localis preset as compatibility/vendor names. New extension entry points and public onboarding use neutral CiM terminology. New lessons and the Python starter default to Light, without adding a preset or changing the color grammar. Legacy bundled lessons keep their exact old shortcode markup and default; existing learner choices and accessibility preferences take precedence. An optional shortcode `theme` sets the initial preference only. Players on a page share one learner preference.

No domain sniffing, stored preference migration or new database state is required. No live changes to localis.services are part of preparation. The existing Git lesson and frozen authoring files remain byte-identical to 0.2.6; installation on Localis requires separate approval and live acceptance.

## Documentation and license

README describes the current Player and quick start; INSTALL.md covers health checks, pack lifecycle, upgrades and rollback; AUTHORING-GUIDE.md walks through the three-beat Python starter, explanations, references, focus/whole-line limn, risk, compilation, draft-page preview and common errors. Per-phrase limn is explicitly unavailable in frozen v2. Fork instructions name the public repository, pinned build, registry locations, collision/renaming responsibilities and maintainer support.

GPLv3 is represented by SPDX `GPL-3.0-only` in package metadata and GPLv3 with the same GNU license URI in WordPress metadata. The exact repository LICENSE and required notices must be in plugin, tool and generated integration artifacts. No “or later” grant is introduced. Teachers retain rights in their authored lesson content.

## Release gates

Prepare plugin and authoring-tool ZIPs twice from the same clean commit using pinned Node; compare bytes and hashes. Verify the Git compiler fixture, bundled Python starter, fresh-site installation of a separately generated lesson, malicious-input tests, full unit/browser/mutation suites, Plugin Check and all required CI. Test upgrading from 0.2.6 and rollback to the exact reviewed 0.2.6 ZIP while retaining the separate lesson pack. Preserve that ZIP and fresh page 3227 capture in a private rollback kit. Never package private captures in public artifacts.

An agent's technical rehearsal can find defects but cannot satisfy the requirement for an outsider unfamiliar with CiM. Keep a timed dry-run worksheet and require a real participant's results. The release remains a candidate until that acceptance, fixes, Daisy's independent rebuild/review and Johann's approval. Then publish a GitHub Release with both reproducible ZIPs, checksums, guides, notes and explicit upgrade/rollback sections, from that exact reviewed commit. No WordPress.org submission is implied.

## Out of scope

Per-phrase limn, author palettes, Match device, SSH rollback, a visual editor, WordPress.org submission, and AI-in-Motion. AI-in-Motion follows the packaged v1.0 release.
