# ADR 0044: WordPress Production Surface Composition

Status: Accepted

Date: 2026-09-22

R36 amendment: 2026-09-23

## Context

The first controlled production deployment of Code in Motion 0.1.6 on Localis exposed a verification gap between component conformance and deployed composition.

The repository independently verifies Transport playback, keyboard playback integration, buttons, semantic rail behavior, marker activation, scrub interaction, Runtime reduced-motion behavior, renderer behavior, and complete learner-path harness composition. WordPress production composition requires separate evidence for the subset that is reachable by a learner.

Production inspection of 0.1.6 established that `wordpress/assets/transport-binding.mjs` installed only timeline keyboard navigation through the Transport controller. ArrowLeft, ArrowRight, Home, and End were reachable. Playback keyboard integration, Transport buttons, semantic rail, marker activation, and scrub interaction were not composed.

This distinction was material during reduced-motion verification. Both registered renderers were available and reduced-motion policy was computed and delivered correctly, but the deployed WordPress surface exposed no learner action capable of requesting continuous playback. Renderer `context.animate` therefore remained false on the production surface.

R35 established the executable production-composition gate and an explicit Git renderer presentation boundary. The 0.1.7 production contract uses a fixed light instrument-panel surface rather than host-theme color inheritance.

R36 changes the WordPress production Transport subset. The page Host now exposes a root-scoped snapshot-only observation projection alongside the existing command-only projection. The WordPress Transport binding uses those two narrow capabilities to compose the existing playback presentation and playback keyboard binding. Space can therefore request continuous playback through the real production composition.

## Decision

1. WordPress production composition is a separately verified contract. Component availability, registry membership, harness coverage, and conformance coverage do not establish learner-facing production reachability.

2. The R35 production-composition gate records the 0.1.7 timeline-only entering state. R36 updates that gate for 0.1.8 to include playback keyboard integration.

3. The 0.1.8 learner-facing keyboard subset is ArrowLeft, ArrowRight, Home, End, and Space. Space selects play or pause from a fresh Runtime-derived playback presentation. Space repeat remains ignored and protected native interaction targets retain native behavior.

4. Transport buttons, semantic rail, marker activation, scrub interaction, and Commentary UI remain outside the WordPress production composition.

5. `bootstrap-module.mjs` remains the WordPress outer composition root. Transport authority arrives through the root-scoped command-only Host projection. Playback presentation observation arrives through a separate root-scoped snapshot-only Host projection. Host imports no Transport implementation.

6. A production-composition change must update executable composition evidence in the same checkpoint. Existing component tests alone are insufficient.

7. R36 browser E2E must prove normal-motion and effective reduced-motion behavior through the same learner-facing Space path. The synthetic renderer is the behavioral evidence surface because its animated settlement is deterministic.

8. Renderer registration and Transport reachability remain separate facts. Registry membership does not imply that every Transport mode capable of driving a renderer is reachable from WordPress.

9. The fixed Git renderer presentation remains the current production default in 0.1.8: text `#171b22`, panel `#f4f6f8`, lane background `#ffffff`, and border/focus `#323a4a`. No supported renderer-theming override or custom-property API is introduced by R36.

## Consequences

The WordPress surface now exposes continuous playback without widening Host into Transport ownership.

The new Host observation capability is independently scoped from command authority. Root disposal removes both projections before Runtime disposal proceeds.

R36 satisfies the repository production-composition and behavioral evidence required to resolve the F4 reachability gap. The historical Localis production finding remains operationally open until the 0.1.8 artifact is deployed there and the same normal-motion and reduced-motion behavior is confirmed on the live site.

The visual/theming pass remains deferred until after R36 so that it evaluates the complete learner-facing keyboard surface.

## Verification

R35 established that:

- the WordPress Transport binding imported the exact timeline-only production subset;
- ArrowRight reached Transport with source `transport`;
- Space remained outside the 0.1.7 production binding;
- `git/v1` computed colors were protected by Browser E2E.

R36 implementation head `d0b04c423fdbf81e97ea18319fc76a948bec83d6` establishes that:

- the WordPress Host exposes one exact frozen root-scoped observation port with only `snapshot`;
- Space invokes play or pause from Runtime-derived playback presentation;
- normal motion remains at `initial` until controlled animation frames are released, then advances through the playback path;
- effective reduced motion reaches the same stable final state without releasing animation frames;
- timeline keyboard navigation remains green;
- detached-root lifecycle and instance isolation remain green;
- Verify CiM contracts run `35906015648` passes, including Node 20 and Node 22;
- WordPress Floor QA run `35906015646` passes;
- WordPress Browser E2E run `35906015670` passes across the supported WordPress, PHP, and browser matrices;
- WordPress Playground PR Preview run `35906015667` passes.
