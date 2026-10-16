# 0.2.5 GA candidate — beat-paced reading and Console polish

Hold merge, tag and installation until Daisy reviews the exact head and ZIP. Live remains 0.2.4. Johann approved a reading stop after each beat.

V2 Play animates every segment through the current beat and stops at its final boundary, before another dwell or transition. Play continues through the following beat; mid-beat Pause/resume remains available. Next retains incomplete-beat completion before advancing. Legacy v1 stays continuous. ADR 0058 supersedes only ADR 0051's continuous-v2 policy; no schema or frozen authoring-format change.

Scope is limited to Johann�s approved GA punch list: badge clearance, beat-end reading stops, themed scrollbars, completed-command Copy timing and placement, final-prompt gutter alignment, and a 12ch continuation cap. Transport placement and navigation retain 0.2.4 behavior. Git-in-Motion remains Bash-only; Console state and Copy values are unchanged. No PowerShell variants or notes are added.

Headless tests cover every beat and both Play and Next. Browser tests repeat all eight beat stops, resume with both controls, and verify unchanged progress while waiting, with normal and reduced motion. Badge geometry is tested against an actually overflowing Console in all three themes and all three risk states. New guards remove badge clearance and beat stopping independently and must fail.

Release: plugin 0.2.5; engine localis.cim/engine@1.0.1. Build twice on pinned Node 22.23.2; compare ZIP bytes and record SHA-256. Full verification, Player browser cases and mutation guards must pass. All four protected workflows and sub-jobs must be green on the exact candidate head. Installed-ZIP and every upgrade ZIP must match delivery byte-for-byte.

Upgrade origins include 0.1.10, 0.2.0, 0.2.1, 0.2.2, 0.2.3 and live 0.2.4. Primary rollback is exact 0.2.4 ZIP SHA-256 ef5ffa0675214359fca09a89021ce1a180b129e3000280510d5cec3ea85019e4. The kit also contains a fresh page 3227 capture with git-repository-practice, checksums, restore/capture helpers and the original 0.1.10 hosting backup as secondary fallback. None enters the plugin ZIP. Normal rollback is uploading 0.2.4 through wp-admin and clearing WordPress.com caches; restore page content only if edited. CI rollback timing excludes hosting-cache clearing. Re-check page content immediately before installing.

After review and separate installation, clear hosting caches and make a fresh desktop run: all eight beat stops, Play/Pause, Next/Previous, markers and replay; Copy, whole-line cue, pane follow/holds, all themes, site fonts, keyboard access and risk-label clearance. Verify the mobile notice and zero CiM requests on home, journey-of-a-token and localis-articles. Production acceptance and GA declaration remain pending that run.

Deferred: per-phrase limn, author palettes, Match device and SSH. Browser screenshots are local production-component previews, not live evidence.

Approved scope exception: preserve unchanged Explanation text and link-label nodes during refresh. This prevents Firefox from clearing a learner selection and releasing its scroll hold. Both full-suite Firefox regressions and a destructive-refresh mutation guard cover it. No navigation or lesson-content change.

Second approved scope exception: preserve the unchanged Resume indicator label. Rebuilding it on each refresh cancels native button clicks in Linux WebKit. The same label is retained until its value changes; scrolling and navigation semantics are unchanged. The complete Linux WebKit browser suite and a destructive-label mutation guard cover the fix.

Johann subsequently approved keeping the two reviewed “Before copying:” sentences and fixed pane height min(32rem, 45vh). These additions are included alongside the approved selection and Resume preservation fixes. Transport placement retains 0.2.4 behavior. End catches up to the transcript bottom with the shorter panes.
