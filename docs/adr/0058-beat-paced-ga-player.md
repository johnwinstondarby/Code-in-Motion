# ADR 0058: Beat-paced desktop learner Player

Status: Accepted for the 0.2.5 candidate, 2026-10-16. Johann chose pause after each beat.

Supersedes ADR 0051's continuous v2 playback policy. The semantic boundaries, Core navigation, frozen authoring formats and legacy v1 playback remain unchanged.

Runtime completes every generated segment in the current v2 beat, then clears playback intent at its final settled boundary before scheduling any further dwell or transition. The stable session is idle, with Play offered again; this is a reading stop, distinct from pausing an in-flight animation. Play starts the next beat. Pausing mid-beat and resuming still completes only that beat. The final beat stops at_end. Other reading stops emit playback.stopped with reason beat_end and existing command/source correlation. Reduced motion uses the same boundaries. Next retains completion-before-advance behavior; markers and End are deliberate seeks.

Start, End, Restart, Previous, seeks, markers, deep links, Show in Console, pane geometry and transport placement retain their 0.2.4 behavior.

The Console reserves scrollbar and Copy space, wraps its sticky titlebar when necessary, and uses neutral themed scrollbar colors. Copy is omitted from partial command typing frames; the exact stable renderer output and authored Copy value remain unchanged. The final ready prompt shares the line gutter. Continuation indent is capped at 12ch without changing authored text.

Git-in-Motion remains Bash-only. The authored lesson, compiled content, frozen formats and Copy values are unchanged. No new shell variants or notes are added.

Acceptance: every-beat stop/resume including reduced motion; legacy playback; manual navigation; all three risk labels clear of overflowing scrollers in all themes; Copy hidden while partial, present when complete; continued pane follow/holds; exact release ZIP installed and upgraded from the live 0.2.4, with exact 0.2.4 rollback. Merge, tag and production installation remain held for Daisy's review.

Approved scope exception: preserve unchanged Explanation text and link-label nodes during refresh. This prevents Firefox from clearing a learner selection and releasing its scroll hold. Both full-suite Firefox regressions and a destructive-refresh mutation guard cover it. No navigation or lesson-content change.

Second approved scope exception: preserve the unchanged Resume indicator label. Rebuilding it on each refresh cancels native button clicks in Linux WebKit. The same label is retained until its value changes; scrolling and navigation semantics are unchanged. The complete Linux WebKit browser suite and a destructive-label mutation guard cover the fix.
