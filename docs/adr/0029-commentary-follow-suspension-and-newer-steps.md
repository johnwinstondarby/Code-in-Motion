# ADR 0029: Commentary Follow Suspension and Newer-Steps Policy

Status: Accepted

Date: 2026-09-16

## Context

Commentary checkpoints 1 through 3 establish canonical reveal projection, Commentary-local selection, native presentation, and fixed-provenance entry navigation. The remaining learner-facing behavior includes following newly revealed commentary, allowing the learner to suspend that following behavior, and indicating when newer commentary arrives while following is suspended.

Browser scroll geometry is a separate concern from semantic reveal policy. A headless policy layer can determine whether Commentary is following and whether newer revealed entries are waiting without reading scroll offsets, installing listeners, writing the DOM, or acquiring navigation authority.

## Decision

1. Commentary checkpoint 4 is a headless local follow-policy controller.

2. Construction receives exactly the frozen checkpoint 3 Commentary presentation capability:

```text
read
```

No Runtime, Transport, command, event, renderer, DOM, or complete Commentary binding surface is granted.

3. The public checkpoint 4 surface contains exactly:

```text
read
suspend
resume
```

4. Follow mode begins enabled.

5. The projected state contains exactly:

```text
following
newerStepsAvailable
latestVisibleStepId
```

`latestVisibleStepId` is the final entry in the fresh validated Commentary presentation, or `null` when no authored commentary is visible.

6. While `following` is true, each valid fresh projection acknowledges the current reveal frontier. `newerStepsAvailable` is therefore false.

7. `suspend()` changes only Commentary-local follow policy. The first transition from following to suspended acknowledges the current reveal frontier as the learner's suspension baseline. Repeated `suspend()` calls while already suspended do not acknowledge later reveals.

8. While suspended, a fresh reveal frontier beyond the suspension baseline sets `newerStepsAvailable` to true. Backward canonical navigation does not create a newer-step signal because high-water reveal history remains unchanged.

9. `resume()` re-enables following, acknowledges the current reveal frontier, and clears `newerStepsAvailable`.

10. A Restart-shaped reveal contraction rebases the acknowledged frontier to the newly contracted visible prefix without forcing `following` back to true. If new commentary is then revealed while still suspended, it can raise `newerStepsAvailable` again from that rebased frontier.

11. Malformed fresh presentation state fails closed before local follow state is mutated.

12. Checkpoint 4 does not calculate browser scroll position, infer whether the learner has scrolled away, issue `scrollIntoView`, own scroll listeners, or choose smooth-scroll behavior. Those mechanics belong to a later DOM checkpoint.

13. Checkpoint 4 does not perform semantic navigation, emit semantic events, or normalize Runtime command outcomes.

## Consequences

Autoscroll eligibility and newer-step signaling are deterministic and testable without a browser geometry model.

The future DOM layer may translate learner scroll position into `suspend()` or `resume()` calls and may scroll to `latestVisibleStepId` while following, but it cannot redefine the follow policy.

Restart does not silently override an explicit learner suspension choice. Instead, its reveal contraction establishes a fresh baseline for subsequent newer-step detection.

## Verification

Checkpoint 4 verification pins:

- exact frozen controller and state surfaces;
- following enabled by default;
- newest visible Commentary identity derived from fresh checkpoint 3 presentation;
- first suspension acknowledging the current reveal frontier;
- later reveal advancement raising newer-step indication while suspended;
- repeated suspension preserving pending newer-step indication;
- resume clearing the indication and acknowledging the current frontier;
- backward canonical movement producing no false newer-step indication;
- Restart-shaped reveal contraction rebasing suspended acknowledgement without forcing follow mode;
- suspension before the first read establishing the current frontier as the baseline;
- exact frozen checkpoint 3 presentation authority;
- malformed fresh presentation failing closed without advancing acknowledgement;
- absence of DOM, scrolling, navigation, Runtime, Transport, event, or renderer authority;
- repository schema, architecture, Core-authority, and full Node 20/22 verification gates.
