# ADR 0043: Site Reduced-Motion Floor Policy

Status: Proposed for R34 Commit B

## Context

CiM already has an accepted reduced-motion architecture:

- ADR 0031 observes the learner's browser `prefers-reduced-motion` preference;
- ADR 0032 gives Host composition authority over the boolean passed into Runtime;
- ADR 0034 lets Runtime adopt later reduced-motion changes without changing semantic state;
- ADR 0035 composes live browser preference changes through Host lifecycle authority.

The existing browser preference is learner-owned. A site configuration must not be able to force animation when the learner requests reduced motion.

Issue #6 also calls for host-level WordPress configuration. R34 now has a live lifecycle differential capable of guarding the first persistent setting.

## Decision

R34 introduces one canonical site policy:

`motion policy`

with exactly two values:

- `system`;
- `reduce`.

The effective motion rule is:

`effectiveReducedMotion = browserReducedMotion || siteMotionPolicy === "reduce"`

There is no `motion`, `full`, `ignore-system`, or equivalent value.

The WordPress setting can therefore reduce motion beyond the learner's browser preference, but can never re-enable motion against that preference.

## Platform-neutral ownership

The policy is a Host presentation-policy input.

WordPress owns persistence and management UI for its deployment.

Runtime continues to receive only the effective boolean `reducedMotion`.

Accessibility continues to own browser preference observation.

Renderers continue to receive the existing Runtime renderer-context boolean.

WordPress does not move option-reading authority into Runtime, Accessibility, or renderers.

## WordPress persistence contract

The production option name is:

`localis_cim_motion_policy`

Allowed stored values are exactly:

- `system`;
- `reduce`.

Absence of the option means `system`.

The option is site-scoped and non-autoloaded when written.

Malformed stored values fail closed to `system`, which still preserves the learner's browser preference.

## Commit B negative-control contract

Commit B introduces the production option write and management surface but deliberately omits uninstall cleanup.

The lifecycle test will exercise the production write surface with:

`reduce`

before deactivation.

The predicted Commit B finding is exactly:

- scope: `database`;
- locator: `options:localis_cim_motion_policy`;
- kind: `added`;
- final value: `reduce`;
- present in the CiM lifecycle delta;
- absent from the inert-control differential.

The exact locator is absent from Commit A's six control-derived exclusions.

A different lifecycle finding does not satisfy the negative-control requirement.

## Deactivation semantics

Motion policy is configuration.

Deactivation preserves:

`localis_cim_motion_policy = reduce`

so reactivation restores the administrator's choice.

The R34 workflow must capture a post-deactivation snapshot and assert the exact option/value is still present.

## Uninstall semantics

Uninstall/delete removes the motion-policy option.

Commit B intentionally omits this cleanup.

Commit C will add the uninstall cleanup and must prove:

- the option survives deactivation;
- the option is absent after delete;
- the final broad differential returns green.

## Management write surface

The only approved production persistence call in Commit B is an `update_option()` call in:

`wordpress/admin-console.php`

The call writes only:

`localis_cim_motion_policy`

through the canonical motion-policy update function.

Static verification must continue to reject `update_option()` everywhere else and all other persistent write families.

Commit B does not add `register_setting()`, activation-time initialization, transient writes, metadata writes, custom tables, or filesystem persistence.

## Runtime projection sequencing

Commit B establishes and persists the canonical policy plus its management surface and negative-control evidence.

The final R34 implementation must project the policy into Host composition without creating a second Runtime or renderer policy.

A release may not close with a stored motion policy that is disconnected from Host behavior.

## Release designation

The production setting changes release bytes.

R34 stateful release work therefore designates:

`0.1.6`

Commit B is intentionally non-mergeable evidence because uninstall cleanup is absent and the lifecycle differential must be red.

## Security

The management update surface requires:

- `manage_options`;
- a WordPress nonce;
- exact allowed-value validation;
- safe redirect back to the CiM Admin Console.

No REST or AJAX mutation endpoint is introduced.

## Consequences

- WordPress gains one real host-level configuration with a platform-neutral policy owner.
- The policy can only reduce motion, never defeat a learner accessibility preference.
- The first persistent state has a precise namespace and uninstall contract.
- Commit B can provide a predicted red lifecycle proof before cleanup is added.

## Verification

Commit B must prove:

- the option name is exactly `localis_cim_motion_policy`;
- only `system` and `reduce` are accepted;
- absence reads as `system`;
- the write is site-scoped and non-autoloaded;
- the Admin Console update path requires `manage_options` and nonce verification;
- static persistence permission is limited to the exact approved write surface;
- the lifecycle workflow writes `reduce` through production code;
- the option remains `reduce` after deactivation;
- the final lifecycle differential fails at exactly `options:localis_cim_motion_policy`, `kind: added`;
- Commit B includes no uninstall cleanup;
- the red workflow evidence is retained for Commit C.
