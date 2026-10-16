# ADR 0058: Beat-paced desktop learner Player

Status: Accepted for the 0.2.5 candidate, 2026-10-16. Johann chose pause after each beat.

Supersedes ADR 0051's continuous v2 playback policy. The semantic boundaries, Core navigation, frozen authoring formats and legacy v1 playback remain unchanged.

Runtime completes every generated segment in the current v2 beat, then clears playback intent at its final settled boundary before scheduling any further dwell or transition. The stable session is idle, with Play offered again; this is a reading stop, distinct from pausing an in-flight animation. Play starts the next beat. Pausing mid-beat and resuming still completes only that beat. The final beat stops at_end. Other reading stops emit playback.stopped with reason beat_end and existing command/source correlation. Reduced motion uses the same boundaries. Next retains completion-before-advance behavior; markers and End are deliberate seeks.

WordPress places transport before the panes in both DOM and visual order. Pane height is reserved and bounded by the viewport. End deliberately reveals the bottom of the Explanation even when the final entry exceeds the reading area's height. Ordinary pane holds and scroll ownership remain in effect.

The Console reserves scrollbar and Copy space, wraps its sticky titlebar when necessary, and uses neutral themed scrollbar colors. Copy is omitted from partial command typing frames; the exact stable renderer output and authored Copy value remain unchanged. The final ready prompt shares the line gutter. Continuation indent is capped at 12ch without changing authored text.

The Git lesson's destructive command explanations include preservation advice before copying. No schema, compiler or frozen authoring contract changes are required. Generated lesson copies and provenance are rebuilt from source.

Acceptance: every-beat stop/resume including reduced motion; legacy playback; manual navigation; stable geometry and unclipped badges in all themes; Copy hidden while partial, present when complete; continued pane follow/holds; exact release ZIP installed and upgraded from the live 0.2.4, with exact 0.2.4 rollback. Merge, tag and production installation remain held for Daisy's review.
