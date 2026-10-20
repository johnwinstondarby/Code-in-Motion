# Committee brief v8: Next and context-only beats

Approved by Johann on 2026-10-20 in response to Daisy's step-5 review. This Markdown amendment replaces v7's navigation wording where it groups Next with direct jumps. The v6/v7 Word documents and frozen prototype evidence remain unchanged; this is not a revised DOCX or a claim that the live prototype was updated.

**Next is normal forward progression.** If a beat is in progress, Next first completes it without resetting the learner's selected tab. A subsequent Next advances to the following beat and waits. When that destination is context-only, it preserves the learner's selected tab, including across consecutive context-only beats. Play progression follows the same tab rule. The next beat with a CLI or GUI action automatically selects its authored action tab once at beat start.

**Direct navigation reconstructs the destination.** Previous, End, choosing a beat in the Beats panel and deep links rebuild every pane's absolute state and select the destination's active tab, or the most recent action's tab for a context-only destination. If no action precedes that destination, select Console in its authored initial state.

Manual switching remains available while playing or paused. It changes the view only; pause/resume preserve the learner's choice. No simultaneous CLI/GUI action is introduced.

This resolves the brief/ADR wording conflict in favor of the existing ADR 0061 and step-5 code. No code change, release, production installation or merge approval is implied.
