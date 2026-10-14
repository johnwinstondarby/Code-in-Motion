# 0.2.2 whole-line learner cue

Review checkpoint; merge, tag and live installation require final review. Live 0.2.1 stays installed during development.

Show in Console seeks its segment, completes existing repositioning, scrolls the first target below the pinned title, and then begins a single bright outline fading over 1,200 wall-clock milliseconds. Learner-action time is independent of the paused/scaled playback clock. Repeat clicks restart it. Command entries target their beat's whole command line; output entries target all linked output lines; response entries target the output/prompt line containing the response. Afterward, a quiet band remains until navigation changes the current segment. Reduced motion receives a steady outline with no animation. Site-forced reduced motion is honored too.

Limn uses white in Localis/High Contrast and black in Light; focus rings use distinct neutral theme colors. Canonical renderer DOM, lessons, schemas, authored metadata, frozen authoring/v1 and v2, and engine 1.0.1 remain unchanged. The existing cue-free playback path stays unchanged. Per-phrase authored limn is deferred, not cancelled.

Browser evidence covers all 18 entries (including eight command and one response entries without evidence IDs), paused decay, repeat clicks, all themes, reduced motion, current-boundary cleanup and sibling/disposal isolation. Mutation guards probe target omissions, early decay, reduced-motion bypass and missing cleanup. The protected CI upgrade matrix retains both legacy upgrade origins and reviewed 0.2.0 fallback proof; production rollback for this patch is the reviewed live 0.2.1 ZIP, without page edits.

Known follow-ups: wrap continuation collision; per-phrase authoring/v3 limn; author palettes; optional Match device; authenticated hosting access for scripted rollback. Site fonts were confirmed by the user on live 0.2.1. Mobile remains gated.
