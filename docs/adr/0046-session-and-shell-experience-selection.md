# ADR 0046: Session and Shell Experience Selection

Status: Accepted (decision). Implementation deferred until after RC#2.

Date: 2026-10-02

## Context

Localis will host multiple Code in Motion instances across its site. Some pages should let a learner choose which command session to view, such as Git repository practice or service diagnosis, and which shell dialect to view it in, initially Bash or PowerShell. The proposed interaction is two native selects and a Go button above the Console and Explanation panes:

```text
Session ▾   Shell ▾   Go
Console Pane | Explanation Pane
```

The R42 work established boundaries this feature must not disturb:
- frozen Authoring JSON v1.0;
- the deterministic compiler to `localis.cim/v2`;
- the subject-neutral `console/v1` renderer with its protected canonical evidence;
- Runtime state semantics.

The architecture already provides the needed seams:
- multiple CiM instances on one page remain isolated (CIM-ARCHITECTURE, item 19);
- the Host resolves experience identity and deep links before Runtime initialization (CIM-SPEC §15);
- production experiences are deployment data in a reviewed registry (ADR 0038).

This ADR records the selection design now, so that the RC#2 work does not close any of its options. RC#2 remains the proof of one authored v2 experience crossing the production-registration boundary. Selection needs several production experiences, so it is post-RC#2 work.

## Decision

1. **Composition layer.** Selector chrome is Host/Player composition above the CiM instance. It lies outside `console/v1`, outside renderer state, and outside canonical renderer evidence. The renderer never branches on a shell.
2. **Resolution.** A Session and Shell pair resolves to one explicitly declared Experience ID. Shell variants are authored experiences, not renderer modes: commands, prompts, output, risk, explanation, and copy values remain ordinary authored content. Renderer-owned presentation timing remains renderer behavior and does not vary by shell.
3. **Declared variants only.** Sessions and shells do not form an assumed Cartesian product. A combination exists only if the selection manifest declares it. The UI omits or disables undeclared combinations and never fabricates one.
4. **Go is the sole commit action.** Changing either select changes no active CiM instance. Only Go replaces the active instance with the resolved experience.
5. **Deep links.** A deep link selects an experience first. The claiming selector Host resolves the exact Experience ID back to its Session and Shell pair and reflects them in its selects. Claiming is a selector-layer responsibility; position within the experience remains the existing deep-link subsystem's responsibility (CIM-SPEC §15), including beat-level deep links. The two responsibilities stay separate.
6. **Claiming among several selectors.** The claimant is the first eligible selector Host in document composition order whose manifest contains the exact Experience ID. Only that claimant acts. When more than one manifest could claim the same ID, a development diagnostic reports the duplicate; duplicates remain valid.
7. **Alignment.** Alignment is declared in the manifest by alignment group and verified at the deployment gate. Aligned variants contain the same beat IDs in the same semantic order. Segment counts and generated step IDs may differ, because two shells may legitimately need different numbers of explanation segments within one beat.
8. **Aligned switching.** When Go switches between variants in the same Session alignment group:
   - `initial` maps to `initial`;
   - an active authored beat maps to the *final boundary* of the same beat in the target variant, consistent with beat-oriented navigation (AUTHORING-JSON-v1 §16.1).
9. **Unaligned switching.** Any other switch starts at `initial`. The consequence is exposed *before* Go: a pre-commit status such as "This selection starts at the beginning."
10. **Manifest ownership.** The selection manifest is its own deployment artifact, not part of the Experience registry. Its gate cross-checks the production Experience registry and proves four things:
    - every manifest variant names a registered experience;
    - every Session and Shell combination is explicitly declared;
    - every declared alignment group satisfies the identical ordered beat-ID invariant;
    - no selector can produce an undeclared combination.

    Within one selection manifest, each Experience ID MUST identify exactly one Session/Shell pair. The same Experience ID may appear in another manifest, where document composition order resolves claiming as defined above.
11. **Accessibility.**
    - Selects are labeled native selects, and Go is a native button.
    - After Go, keyboard focus stays on the Go control rather than moving into the new Player.
    - A polite status region announces the load, for example "Loaded Git repository practice, PowerShell".
12. **Authoring.** Authoring JSON v1 is unchanged. Separate variant files are the v1 mechanism. The gate enforces structural alignment only; there is no prose-equality gate, because explanations may legitimately differ between shells.
13. **Timing.** Implementation begins after RC#2.

Selection on a page is optional. An embedded CiM instance with one fixed experience shows no selector chrome.

### Illustrative manifest shape (non-normative)

```json
{
  "schema": "localis.cim/selection-manifest/v1",
  "sessions": [
    {
      "id": "git-repository-practice",
      "label": "Git repository practice",
      "alignment_group": "git-repository-practice",
      "variants": {
        "bash": "git-repository-practice-bash",
        "powershell": "git-repository-practice-powershell"
      }
    }
  ],
  "shells": [
    { "id": "bash", "label": "Bash" },
    { "id": "powershell", "label": "PowerShell" }
  ]
}
```

The normative schema is defined when implementation begins. The schema identifier follows the existing `localis.cim/<artifact>/v1` family.

## Consequences

- `console/v1`, its 19-digest settlement oracle, slice 3 animation, Playback Rate, Runtime state semantics, and Authoring JSON v1 are unaffected.
- Replacing a CiM instance on Go reuses existing lifecycle paths: dispose, then create. It needs no new Runtime capability.
- Prose drift between variants is an authoring-process risk the gate does not catch. Shared explanation with shell-specific Console blocks remains a post-v1 authoring consideration.
- Shells beyond Bash and PowerShell (`cmd`, `zsh`, Azure Cloud Shell, network-device CLIs) need only manifest entries and authored variants.

## Verification

When implemented, the following must be executable proofs:

- **Isolation.** Changing either select alone leaves the active instance, its semantic position, and its renderer evidence unchanged. Only Go replaces the instance.
- **Resolution.** Every declared pair resolves to its declared Experience ID. Undeclared pairs cannot be selected.
- **Manifest gate.** It rejects a variant naming an unregistered experience, an undeclared combination, and an alignment group whose variants differ in beat IDs or beat order. It accepts aligned variants whose segment counts differ. It rejects duplicate Experience-ID bindings within one manifest. This does not prohibit the same Experience ID appearing in a different manifest on the same page.
- **Aligned switching.** `initial` lands at `initial`, and each authored beat lands on the target's final boundary for that beat. Unaligned switching lands at `initial`, with the pre-Go notice shown.
- **Deep links.** An exact Experience ID is claimed by the first eligible selector Host in composition order. That Host reflects the resolved Session and Shell. Position resolves through the existing deep-link subsystem. Duplicate claim eligibility emits the development diagnostic.
- **Accessibility.** Focus remains on Go after activation, and the polite status region announces the loaded Session and Shell.
- **Evidence boundary.** Selector chrome never appears beneath any renderer root, and `console/v1` canonical evidence is identical with and without selector chrome.
