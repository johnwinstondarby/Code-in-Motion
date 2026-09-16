# Complete Learner Path Scenario

Scenario ID: `complete-learner-path/v1`

## Purpose

Prove deterministic composition of Runtime, Transport, and Commentary through their documented public seams without introducing a cross-component production controller.

## Initial conditions

- Runtime starts uninitialized with canonical boundary order `initial`, `step-01`, `step-02`, `step-03`.
- The synthetic renderer settles absolute renders immediately.
- Commentary entries align one-for-one with authored boundaries.
- No Commentary entry is selected.
- Expected outcomes below are declared independently from production policy code.

## Primary command sequence and expected outcomes

1. Initialize at `initial`.
   - canonical position: `initial`
   - reveal frontier: `initial`
   - visible Commentary entries: none

2. Submit Transport `next`.
   - source evidence: `transport`
   - canonical position: `step-01`
   - reveal frontier: `step-01`
   - visible Commentary prefix: `step-01`

3. Activate semantic marker `step-02`.
   - source evidence: `marker`
   - canonical position: `step-02`
   - reveal frontier: `step-02`

4. Begin scrub at the final semantic ordinal.
   - local preview: `step-03`
   - canonical position remains `step-02`
   - reveal frontier remains `step-02`
   - no semantic command occurs before commit

5. Commit scrub.
   - source evidence: `scrub`
   - canonical position: `step-03`
   - reveal frontier: `step-03`
   - every authored rail marker is revealed

6. Submit Transport `previous`.
   - source evidence: `transport`
   - canonical position: `step-02`
   - reveal frontier remains `step-03`

7. Select Commentary `step-01` locally.
   - selected entry: `step-01`
   - canonical active entry remains `step-02`
   - no semantic command is implied by local selection

8. Submit Commentary navigation to `step-01`.
   - source evidence: `commentary`
   - canonical position: `step-01`
   - selected entry remains `step-01`
   - canonical active entry: `step-01`
   - reveal frontier remains `step-03`

9. Submit Commentary navigation to current `step-01` again.
   - accepted result: `no_change`
   - reason: `already_at_boundary`
   - renderer call count does not change
   - source evidence remains `commentary`

10. Submit Transport Restart.
    - source evidence: `transport`
    - canonical position: `initial`
    - reveal frontier: `initial`
    - visible Commentary entries: none
    - hidden local Commentary selection reconciles to `null`

11. Dispose Runtime.
    - canonical status: `disposed`
    - renderer disposal occurs once
    - later Transport command is rejected and canonical status remains `disposed`

## Playback companion path

A one-step experience verifies the same Transport command-only port under continuous playback:

1. Initialize at `initial`.
2. Submit Transport Play.
   - source evidence: `transport`
   - animated target: `step-01`
   - playback intent: active
3. Submit Transport Pause while the transition is pending.
   - source evidence: `transport`
   - canonical status: `paused`
4. Submit Transport Play again.
   - source evidence: `transport`
   - the preserved transition resumes rather than allocating a second renderer transition
5. Settle the renderer transition.
   - canonical position: `step-01`
   - reveal frontier: `step-01`
   - playback intent stops at the final boundary
6. Dispose Runtime.
   - canonical status: `disposed`
   - renderer disposal occurs once

## Authority assertions

- Transport receives only the exact command port and documented read projection.
- Commentary receives snapshot-only observation plus its separate one-function navigation adapter.
- Commentary navigation provenance is fixed to `commentary` by the adapter.
- Transport marker and scrub provenance remain distinct.
- Local scrub preview and Commentary selection cannot mutate canonical Runtime state directly.
- Production code does not import harness code.
