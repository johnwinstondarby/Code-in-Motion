# RC1 Step 4 Production Visual QA

## Scope

RC#1 Step 4 records the production visual and surface-contract review for the learner-facing Code in Motion Git experience.

Production target:

- `https://localis.services/git-repository-practice/`
- experience: `git-basic-cycle`
- renderer: `git/v1`

The review used the live Localis page in Chrome, including DevTools inspection, desktop interaction, and narrow/mobile interaction. No product-code change was made as part of this review.

## Production readiness baseline

The live page exposed exactly one `.cim` root for `git-basic-cycle`.

Observed initial state:

- `data-cim-state="ready"`
- root width during the initial narrow DevTools probe: 330 px
- root height: 854 px
- renderer: `git/v1`
- renderer step: `initial`
- renderer width: 297 px
- renderer height: 655 px
- root background: `rgb(244, 246, 248)`
- root text color: `rgb(23, 27, 34)`

The root reached `ready` before the production composition was assessed.

## Learner-facing control composition

The live root exposed exactly five visible learner controls in this order:

1. Start
2. Previous
3. Play
4. Next
5. End

All five controls were visible and enabled in the initial state.

Restart was absent from the learner-facing row. This confirms the RC#1 disposition: Restart remains available through Transport but is intentionally omitted from the primary learner control row.

## Desktop visual review

The desktop production composition passed visual review.

Observed properties:

- The light CiM instrument panel remains visually distinct within the dark Localis page without appearing disconnected from the surrounding content.
- Git repository state has clear visual priority.
- Working Tree, Index, Local Repository, and Remote lanes have balanced visual weight at desktop width.
- Reflog evidence is separated clearly from the four repository lanes.
- The five transport controls read as one coherent functional group.
- Play has sufficient primary-action emphasis without overpowering the surrounding controls.
- Start is coherent as the learner-facing label; no visual evidence supports changing it to Home for RC#1.
- No host-theme collision, clipping, or desktop layout instability was observed.
- Borders, spacing, hierarchy, and contrast showed no RC-blocking defect.

Result: **PASS**.

## Playback and focus review

Production playback was exercised from the learner-facing Play control and observed through continuous playback and subsequent manual navigation.

Observed properties:

- During active playback the control changes from Play to Pause.
- Pause uses a visibly darker filled state, so playback state is communicated by both label and visual treatment.
- When playback stops, the control returns to Play.
- Focus remains clearly visible after control interaction.
- Manual Start, Previous, Play/Pause, Next, and End interaction did not disturb panel geometry.
- Repository state changes rendered without visible layout jumping.
- The authored dwell interval provided sufficient time to perceive state changes during continuous playback.

RC#1 Play/Pause state contract: **label plus visual state**. No additional RC styling is required.

Result: **PASS**.

## Narrow/mobile visual review

The production surface was exercised at a narrow/mobile viewport after the initial 330 px structural probe.

Observed properties:

- The four Git lanes collapse into a single vertical sequence rather than compressing horizontally.
- Lane content remains readable without observed clipping or horizontal overflow.
- Reflog follows the repository cards naturally.
- Transport reorganizes into two columns: Start/Previous, Play/Next, with End spanning the final row.
- Control targets remain substantial and separated.
- Focus indication remains visible on interacted controls.
- The light CiM panel retains a clear boundary against the dark Localis page.
- State transitions did not produce visible width changes, overflow, or layout instability.
- Surrounding Localis mobile navigation remained independent of the CiM surface; no host CSS collision was observed.

A floating Acrobat/PDF control was visible at the page edge during the mobile recording. It belongs to the browser/site environment and did not materially obstruct CiM operation in the observed session.

Result: **PASS**.

## RC#1 surface-contract decisions

The production review confirms the following Step 4 decisions:

1. **Presentation ownership:** RC#1 retains the fixed CiM instrument-panel presentation.
2. **Host override tokens:** RC#1 exposes no public `--cim-*` retheming contract. A future public theming interface requires separate governed design and evidence.
3. **Play/Pause legibility:** the learner-facing control communicates playback state through both its Play/Pause label and its visual state. No RC change is required.
4. **Restart:** Restart remains a Transport capability and is intentionally absent from the five-control learner row for RC#1.
5. **Localis integration:** the light CiM panel is acceptable within the dark Localis page at desktop and narrow/mobile widths.
6. **Responsive behavior:** the production Git experience is usable at the observed narrow/mobile width with no RC-blocking visual defect.

## Step 4 disposition

No RC-blocking visual or surface-contract finding was observed during the production review. Step 4 requires no product-code change.

**RC#1 Step 4 production visual QA: PASS.**
