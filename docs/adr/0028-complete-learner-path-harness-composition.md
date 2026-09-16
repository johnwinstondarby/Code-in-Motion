# ADR 0028: Complete Learner Path Harness Composition

Status: Accepted

Date: 2026-09-16

## Context

Runtime, Transport, and Commentary now expose independently verified public seams. Unit and component tests prove each authority boundary in isolation, but the platform also needs deterministic evidence that those seams compose into one learner path without creating a broader cross-component authority surface.

The synthetic operations harness already owns deterministic scenarios, independent expected outcomes, evidence capture, and production-module composition through documented public seams. Production code is prohibited from importing harness code.

A composition test can therefore prove cross-component behavior without adding a production composition controller or granting Transport or Commentary a complete `CiMInstance`.

## Decision

1. The complete learner path is verified in the harness and integration-test layer. No new production authority surface is introduced for the purpose of testing composition.

2. The scenario instantiates the real Runtime and composes existing narrow production capabilities:

   - the exact Transport command-only port;
   - Runtime read observation through the documented Transport and Commentary projections;
   - Transport semantic timeline and scrub gesture;
   - Commentary reveal projection, local selection, presentation, and fixed-provenance navigation adapter.

3. Expected outcomes are stated independently in the scenario and integration assertions. The harness does not call production policy code to calculate expected semantic positions, reveal state, provenance, or no-change outcomes.

4. The primary learner path covers:

   - initialization at `initial`;
   - Transport button-style forward navigation;
   - marker navigation with `source: marker`;
   - scrub preview that leaves canonical state unchanged;
   - release-only scrub commit with `source: scrub`;
   - backward navigation while reveal history remains at its high-water frontier;
   - Commentary-local selection independent from canonical active state;
   - Commentary semantic navigation with fixed `source: commentary`;
   - same-boundary Commentary navigation resolving `no_change / already_at_boundary` without renderer work;
   - Restart returning position and reveal frontier to `initial` and reconciling hidden Commentary selection;
   - terminal Runtime disposal and rejection of later Transport commands.

5. A companion playback path covers Transport play, pause, resume, renderer settlement, final-boundary arrival, reveal advancement, and disposal through the same exact command-only port.

6. Command provenance is asserted from Runtime command evidence. The harness does not normalize or invent semantic events on behalf of Transport or Commentary.

7. Native DOM mechanics remain covered by their dedicated Transport and Commentary component tests. The integration scenario exercises the semantic learner path behind those native controls rather than constructing a parallel fake browser policy.

8. Commentary autoscroll, learner scroll suspension, newer-steps indication, and Commentary-specific semantic event emission remain outside this composition checkpoint. Their absence does not broaden existing components or alter the learner-path authority proof.

## Consequences

The repository gains one executable proof that Runtime, Transport, and Commentary cooperate without authority leakage.

Failures in the scenario identify a composed proposition. Diagnosis must distinguish a production defect from an incorrect harness expectation before implementation changes are made.

The harness remains downstream of production modules. Production architecture stays unchanged.

Future Commentary scroll-policy work can extend the scenario after that contract is independently established.

## Verification

The checkpoint must pass:

- the complete learner-path integration scenario;
- Transport, Commentary, Runtime, renderer, schema, and architecture regression suites;
- the production-to-harness import prohibition;
- the Core-authority gate;
- Node 20 and Node 22 CI;
- the exact post-merge `main` workflow.
