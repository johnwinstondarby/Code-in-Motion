# Code in Motion (CiM) Git Experience Specification

Status: Normative Git reference-experience specification

## 1. Scope

This specification defines the subject-specific presentation, interaction, copy, accessibility, and visual-conformance requirements for the Git in Motion reference experience.

`CIM-SPEC.md` remains authoritative for shared runtime semantics. `RENDERER-CONTRACT.md` remains authoritative for the shared renderer lifecycle and capability contract. This document supplies the Git-specific visual meaning that those shared specifications intentionally leave to the Git experience and renderer.

Git in Motion is the first real Code in Motion experience and the reference implementation for subject-specific rendering.

## 2. Product intent

The original Git terminal animation is the visual reference for Git in Motion. The production experience must rebuild that presentation as an interactive terminal experience rather than translate the underlying Git state into a dashboard, card grid, state table, or other explanatory interface.

The reference animation defines how the experience should look and move. Code in Motion adds learner agency to that presentation through semantic navigation, playback control, selectable content, copy actions, accessibility, and authored instructional context.

The Git terminal remains the primary experience surface while the learner moves through authored repository states.

A conforming implementation therefore preserves this relationship:

```text
animated Git terminal reference
        +
learner-controlled time
        +
semantic, selectable, copyable terminal content
        =
Git in Motion
```

A repository-state dashboard may be useful as a diagnostic or secondary teaching surface, but it does not satisfy the Git in Motion primary-renderer requirement.

## 3. Reference presentation authority

The approved original Git terminal animation and its accepted reference frames are normative visual-conformance artifacts for the Git renderer.

The renderer must preserve the recognizable visual language of that reference, including, where present in the authored sequence:

- terminal-window composition;
- repository identity and path treatment;
- branch treatment;
- prompt and cursor treatment;
- command and output hierarchy;
- typography and line spacing;
- dark terminal surface and reference color relationships;
- risk or reversibility badge treatment;
- command-entry, output, scrolling, and state-transition motion;
- spatial relationship among terminal content, status indicators, and integrated controls.

The renderer may adapt responsively for available width, zoom, reduced motion, and accessibility without changing the experience into a different visual model.

The Git experience must be recognizably the interactive form of the reference animation when viewed side by side with the approved reference frames.

## 4. Real text requirement

Terminal content must be rendered as real browser text in semantic HTML. The primary terminal presentation must not be implemented as a GIF, video, rasterized text image, or canvas-only text surface.

This requirement exists so terminal content can support ordinary browser and assistive behavior, including:

- text selection;
- command copy;
- screen-reader access;
- browser find;
- clean scaling and zoom;
- responsive reflow where the authored presentation permits it;
- crisp rendering independent of display density.

Prompts, commands, output, annotations, badges, and other terminal roles should remain distinguishable in the document structure even when they compose visually into one terminal session.

## 5. Command selection and copy

Copyability is a required learner capability for the Git experience.

### 5.1 Ordinary selection

Visible terminal text must remain selectable through normal browser text selection. Presentation styling must not globally disable selection on terminal content.

Prompt decoration may be excluded from command-specific selection or copy behavior when doing so produces a cleaner command value.

### 5.2 Command-specific copy

Each authored command intended for learner reuse must provide an easy copy action.

The command-specific copy action must copy the command itself rather than the rendered prompt plus command. For example, a learner should receive:

```text
git add -p -- src/HeaderFix.jsx
```

rather than:

```text
~/localis/handbook (main) $ git add -p -- src/HeaderFix.jsx
```

The copy affordance must fit the terminal composition and must not force the primary experience into a conventional dashboard or toolbar layout.

### 5.3 Authored copy authority

Command copy must use the complete authored command value rather than reconstructing text from the current DOM or animation frame.

A command remains fully copyable while it is typing, partially revealed, scrolled out of view, or otherwise visually incomplete.

Experience data may therefore distinguish display text from copy text.

Conceptually:

```text
display.prompt
 display.command
 copy.text
 copy.guidance
 risk.class
 risk.label
```

The exact schema keys are governed by `EXPERIENCE-SCHEMA.md` and any later schema ADR. This section defines the required behavior, not the final field spelling.

### 5.4 Context-specific values

Story-specific identifiers must not silently become unsafe or misleading learner commands.

When the displayed command contains a value that belongs only to the authored narrative, such as a commit SHA, the experience may provide a learner-safe copy form. For example:

```text
Displayed:
git reset --hard 7a3c91d

Copied:
git reset --hard <sha-from-your-reflog>
```

The displayed narrative remains faithful to the authored session while the copied command communicates which value the learner must supply.

Context-dependent expressions such as `HEAD~1` may remain literal when appropriate, but the experience may attach guidance explaining the context in which the command operates.

## 6. Risk and copy safety

The existing command risk or reversibility classification is part of the learner interaction contract.

When a command carries a warning such as `CANNOT BE UNDONE`, that classification must remain associated with the command's copy interaction. Copying a destructive or otherwise high-risk command should surface a brief inline reminder using the authored risk information.

The reminder informs without preventing an intentional copy action.

Risk presentation and copy guidance must come from authored or validated experience data rather than renderer inference from command strings.

## 7. Clipboard behavior and accessibility

Command copy must work from an HTTPS production origin through the browser clipboard capability when available and provide a functional fallback when direct clipboard access is unavailable or denied.

The copy action must:

- be keyboard reachable and operable;
- preserve visible focus;
- announce successful copy through an accessible live region or equivalent semantic mechanism;
- expose an accessible name identifying the command being copied;
- avoid stealing semantic playback focus or changing the current CiM boundary;
- preserve ordinary text selection as a fallback path.

A copy action is an interaction with terminal content, not a semantic navigation command. It must not advance, rewind, seek, restart, or otherwise change the canonical CiM session position.

## 8. Learner-controlled time

The Git terminal presentation must operate through the shared CiM semantic navigation and playback model.

The learner must be able to use the established controls for:

- play and pause;
- previous and next semantic boundary;
- start and end navigation;
- semantic scrub or equivalent committed seeking where exposed;
- keyboard navigation;
- reduced-motion operation.

These controls operate on the terminal composition. They must not require replacement of the terminal with a separate state dashboard.

Pausing must leave the current terminal state available for reading, selecting, copying, and inspection.

## 9. Authored experience responsibilities

The Git experience definition is the source of subject-specific instructional truth. It should carry the information required to render and interact with the terminal without asking the renderer to reverse-engineer Git semantics from displayed strings.

Where applicable, authored data should distinguish:

- prompt text;
- displayed command text;
- command copy text;
- output text;
- terminal annotations;
- repository/path/branch presentation data;
- risk or reversibility classification;
- copy guidance;
- semantic step identity;
- renderer state required to reproduce the reference frame;
- commentary and reference links.

The renderer owns presentation and animation. It does not invent command safety, substitute learner-specific values without authored instruction, or infer repository semantics from terminal text.

## 10. Three acceptance pillars

A Git in Motion implementation is conforming only when all three pillars pass.

### 10.1 Visual fidelity

The live experience must be recognizably the interactive form of the approved Git terminal reference.

Acceptance review compares approved reference frames with corresponding live semantic states and checks at least:

- overall geometry and terminal framing;
- typography, line spacing, and hierarchy;
- repository/path and branch presentation;
- prompt and cursor presentation;
- colors and emphasis relationships;
- badge placement and appearance;
- terminal scrolling and content placement;
- authored transition behavior;
- responsive behavior at defined test widths.

A functionally correct repository dashboard does not pass this pillar.

### 10.2 Interactive temporal control

The learner can control progression through the authored Git sequence using the shared CiM transport and semantic-boundary model. Playback, pause, previous, next, direct navigation where exposed, keyboard operation, and reduced-motion behavior must preserve the terminal as the experience surface.

### 10.3 Operational usefulness

Commands and terminal content must remain useful outside passive viewing.

Acceptance checks must prove that:

- terminal text is selectable;
- reusable commands expose an easy copy action;
- command copy excludes prompt decoration;
- copy returns the complete authored command even during partial visual reveal;
- authored learner-safe substitutions are honored;
- risk guidance remains associated with copy where applicable;
- keyboard copy operation works;
- successful copy is announced accessibly;
- copy does not change semantic playback position.

Visual fidelity without operational usefulness does not satisfy the Git reference-experience contract.

## 11. Visual-conformance evidence

Git renderer changes that affect the reference presentation require visual-conformance evidence before release acceptance.

Evidence should include:

1. the approved reference frame or frame identifier;
2. the corresponding live Git in Motion state;
3. viewport and browser context;
4. the semantic boundary or authored beat represented;
5. confirmation of selectable terminal text;
6. confirmation of command-specific copy for commands present in that state;
7. keyboard and reduced-motion checks where applicable;
8. identified deviations and their disposition.

Side-by-side comparison is the preferred review form because it exposes presentation drift that functional state assertions do not detect.

## 12. Relationship to the current 0.1.10 Git renderer

The production 0.1.10 release established and validated the CiM runtime, transport, renderer contract, WordPress integration, versioned module delivery, release reproducibility, and production deployment path.

The repository-state dashboard presentation delivered by the current Git renderer is not the visual acceptance target defined here. Its existence does not invalidate the shared runtime architecture or release evidence. The Git subject presentation must be brought into conformance with this specification while preserving the established shared contracts unless a separately reviewed contract change is required.

This distinction keeps the correction scoped: the original terminal reference remains the product presentation authority, while the proven CiM machinery remains the platform underneath it.

## 13. Supersession and interpretation

Earlier working material that describes the Git primary visual as a four-place repository-state dashboard, or describes a bright instrument-panel shell as the required Git presentation, must not be used to override this specification.

Those concepts may remain available for diagnostics, secondary explanation, or other CiM experiences. For Git in Motion, the approved terminal reference and this specification control the primary visual and interaction acceptance criteria.

Where a shared CiM requirement and this Git-specific specification address different layers, both apply. If a future implementation reveals a direct conflict, the conflict must be resolved explicitly through the repository's specification or ADR process rather than by silently changing the Git presentation target.
