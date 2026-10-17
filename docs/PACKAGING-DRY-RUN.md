# v1.0 outsider dry run — not yet performed

Use a fresh WordPress site and a participant who has never used CiM. Give them only the named candidate ZIPs, their checksums, INSTALL.md and AUTHORING-GUIDE.md. Do not coach them. Record every question or wrong turn as a defect; fix it and repeat the affected steps before accepting packaging.

Candidate commit:
Plugin SHA-256:
Authoring-tool SHA-256:
Participant / date:
WordPress / PHP / operating system:

| Task | Start / finish | Result / friction |
| --- | --- | --- |
| Find the correct plugin ZIP and verify its checksum | | |
| Install and activate on the fresh site | | |
| Use Static health to confirm a sound installation | | |
| Put the Python starter on a draft page; Play, Next, Previous, End, Copy | | |
| Download/extract the standalone authoring tool; confirm Node | | |
| Init a lesson, change its ID/title and three beats using only the guide | | |
| Preview locally; save a typo fix and refresh without installing anything | | |
| Validate, compile and build the companion plugin ZIP | | |
| Install/activate it; wait for Admin Lesson packs Ready, then copy its shortcode | | |
| Confirm content, references, evidence cue and risk label | | |
| Revise the lesson version, replace its plugin, see the revision | | |
| Deactivate/reactivate pack; confirm files and page survive | | |
| Restore the previous CiM ZIP; confirm pack remains on disk | | |
| Restore the candidate; confirm the pack works again | | |

Targets: working bundled starter in under 15 minutes; own three-beat lesson in about 30 minutes. Record actual elapsed time and all assistance. A maintainer's automated rehearsal does not satisfy this gate.

Open defects and fixes:
Retest results:
Participant outcome:
Maintainer acceptance:
Daisy independent rebuild/review:
Johann release approval:

Only after acceptance and the other release gates pass: publish the GitHub Release with both exact ZIPs, hashes, notes and upgrade/rollback instructions. WordPress.org submission is separate.
