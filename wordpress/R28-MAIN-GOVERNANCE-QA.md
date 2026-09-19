# R28 Main Governance QA

## Scope

R28 moves Code in Motion repository discipline from convention into enforceable GitHub repository policy.

R26 and R27 established that exact historical commit identity is part of the release-evidence model. R28 therefore governs how changes enter `main`, how CI is represented to branch protection, and which merge methods are permitted.

R28 begins from integrated `main`:

`0ae1161787e4d36eeffd19732075374a66ff7ace`

That commit is the true merge commit for PR #39.

Its parents are:

- PR #38 integration merge: `f081fb33315eb2e2d08073e0a1e61228e4b7bbb3`;
- R27 closure head: `e4742892338be0840029d53af218d2e2402113db`.

The frozen R26 candidate remains reachable from `main`:

`0c3aedb8732a50af645fc427bc17230e70018efc`

The R27 closure head also remains reachable from `main`.

## Opening repository audit

At R28 opening, GitHub reports:

- default branch: `main`;
- `main` protected: false;
- required status checks: none;
- repository rulesets: none;
- merge commits allowed: true;
- squash merges allowed: true;
- rebase merges allowed: true;
- auto-merge enabled: false;
- automatic branch deletion after merge: false.

The current state therefore relies on maintainer procedure rather than repository enforcement.

## Governance design

### Stable required checks

Branch protection should depend on four stable terminal checks rather than the current individual job and matrix names.

The required checks are:

1. `CiM / Verify`
2. `CiM / Floor QA`
3. `CiM / Browser E2E`
4. `CiM / Playground`

Each terminal gate runs with `if: always()` and fails unless every owned job family succeeds.

#### CiM / Verify

Depends on:

- `verify` matrix;
- `release-build`;
- `release-reproducibility`.

#### CiM / Floor QA

Depends on:

- `wordpress-floor`;
- `plugin-check`.

#### CiM / Browser E2E

Depends on:

- `synthetic-mount`;
- `zip-install-e2e`;
- `upgrade-e2e`;
- `compatibility-matrix`;
- `php-matrix`;
- `browser-family-matrix`.

The matrix jobs continue to expand into their WordPress, PHP, and browser check runs underneath the stable terminal gate.

#### CiM / Playground

Depends on:

- `preview`.

### Machine contract

`tools/check-required-workflow-gates.mjs` owns the repository-side contract for the four protected check names and their required dependency sets.

`npm run check:workflow-gates` is part of `npm run verify`.

The gate fails if:

- a required terminal job is removed;
- a protected check name changes;
- `if: always()` is removed;
- a required dependency is removed or reordered;
- a gate references a job that no longer exists.

Unit coverage includes plausible near-miss failures for renamed checks, dropped dependencies, and conditional gate execution.

This prevents branch-protection configuration from silently drifting away from workflow structure.

## Target GitHub settings

R28 acceptance requires the following repository settings.

### Pull-request path

For `main`:

- require a pull request before merging;
- required approving reviews: 0 under the current single-maintainer model;
- require conversation resolution before merging;
- require branches to be up to date before merging;
- require the four stable CiM status checks;
- apply the rules to administrators / do not allow bypass of the protected path;
- force pushes disabled;
- branch deletion disabled.

Required status checks:

- `CiM / Verify`;
- `CiM / Floor QA`;
- `CiM / Browser E2E`;
- `CiM / Playground`.

### Merge methods

Repository merge-method policy:

- merge commits: enabled;
- squash merging: disabled;
- rebase merging: disabled.

This policy preserves exact PR-head commits in `main` history.

### Linear history

Required linear history must remain disabled.

A linear-history requirement conflicts with the true merge-commit policy used to preserve evidence-bearing commit identity.

### Branch retention

Automatic deletion of merged branches remains disabled for the current evidence model.

Evidence-bearing branches may be deleted later only through an explicit disposition that confirms all required commits remain reachable from a retained branch or tag.

## Why terminal gates are required

The final R27 head produced 22 individual GitHub Actions check runs.

Protecting `main` by those 22 names would couple repository policy to:

- WordPress matrix membership;
- PHP matrix membership;
- browser matrix membership;
- internal job naming;
- later matrix expansion.

The four terminal gates preserve the full underlying work while giving branch protection a stable external contract.

A newly added matrix member is automatically covered because the terminal gate waits for the matrix job family, rather than requiring repository settings to learn another check name.

## Merge identity policy

Evidence-bearing integration uses true merge commits.

Squash and rebase merge are prohibited because they rewrite the PR-head identity.

For a protected PR head `H`, integration acceptance requires:

1. CI passes on `H`;
2. merge uses method `merge`;
3. resulting merge commit has `H` as a parent;
4. `git merge-base --is-ancestor H origin/main` succeeds.

Where an earlier release or closure identity also requires preservation, the same ancestry proof is repeated for that commit.

## R28 bootstrap sequence

R28 itself should be the first pull request merged under the new governance policy.

Sequence:

1. Create R28 branch from integrated `main`.
2. Add the four stable terminal workflow gates.
3. Add and run the machine workflow-gate contract.
4. Open the R28 PR against `main`.
5. Wait for all four new terminal checks to appear and pass.
6. Configure repository merge methods:
   - merge commit enabled;
   - squash disabled;
   - rebase disabled.
7. Protect `main` and require the four stable CiM checks.
8. Require the branch to be up to date and require conversation resolution.
9. Disable force pushes and protected-branch deletion.
10. Confirm the R28 PR is mergeable under the active policy.
11. Merge R28 using a true merge commit with expected-head protection.
12. Verify the R28 head is reachable from `main`.
13. Re-read repository settings and record the active protection state.

The connected GitHub App can read repository and ruleset state but does not have administration write permission. Steps 6 through 9 therefore require a maintainer action in GitHub settings.

## R28 acceptance

R28 closes when:

- four stable workflow gate checks exist and pass;
- the workflow-gate contract is part of normal verification;
- `main` is protected;
- the four stable checks are required;
- pull-request integration is required;
- branches must be current before merge;
- conversation resolution is required;
- force pushes and protected-branch deletion are disabled;
- repository merge methods permit only true merge commits;
- R28 itself is merged under the active governance policy;
- the R28 head remains reachable from `main`;
- the final settings are re-read and recorded.

## Boundary

R28 governs repository integration.

It does not alter the Code in Motion 0.1.1 release artifact or designate a new release candidate.

The R27 0.1.1 artifact identity remains:

`55caaa141214dd5fb36960a210d42d28278739777e0d7468abeb3f1cf967a533`

Any artifact movement during R28 would be unexpected and must be investigated before governance closure.
