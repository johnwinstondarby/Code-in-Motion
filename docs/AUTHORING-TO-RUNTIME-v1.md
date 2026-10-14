# Code in Motion Authoring-to-Runtime Compilation Contract v1

Status: R42 normative candidate, peer-review corrections incorporated

## 1. Purpose and boundary

This specification defines deterministic compilation from `localis.cim/authoring/v1` source documents into the versioned Code in Motion runtime experience contract consumed by validation and Runtime.

The compiler is a build-time boundary. WordPress and Runtime consume compiled, validated runtime JSON. They do not compile authoring documents during page load or runtime initialization.

The authoring document remains the human-maintained instructional source. The compiled runtime document is a generated release input and must not require Runtime, Core, Commentary, Transport, or a renderer to understand the authoring schema.

Compiler diagnostics use a compiler-specific `CIM-COMP-*` namespace. Authoring diagnostics use `CIM-AUTH-*`; runtime-experience diagnostics retain `CIM-EXP-*`. Compatibility aliases for pre-v1 authoring diagnostic names may exist during migration but are not the v1 normative names.

## 2. Normative principles

1. Compilation is deterministic and fail-closed.
2. One authored Explanation segment produces one canonical runtime semantic boundary.
3. Runtime boundaries use absolute renderer state sufficient to reproduce the destination independently of navigation history.
4. Authored beats remain the learner-facing navigation coordinate even when compilation expands one beat into several runtime boundaries.
5. The compiler generates only boundaries required by authored Explanation segments. It does not manufacture a separate settled boundary.
6. The final segment boundary of a beat is that beat's settled destination and must represent the beat's complete Console activity.
7. `initial` remains the reserved runtime boundary before authored instruction begins.
8. Subject-specific Console data remains opaque renderer state. Core does not interpret it.
9. Presentation behavior that does not define canonical semantic position remains outside the compiled semantic contract.
10. Invalid or ambiguous source input causes compilation failure rather than repair, guessing, or silent normalization.

## 3. Compilation unit: Explanation segment to semantic boundary

For every beat, the compiler traverses `explanation.segments` in authored order. Each segment produces exactly one runtime semantic boundary.

Given a beat containing segments anchored to `command`, `output`, `output`, and `response`, compilation produces four ordered runtime boundaries for that beat.

A beat with one Explanation segment produces one runtime boundary.

A beat never receives a boundary solely because it has reached a conceptual settled phase. The final generated segment boundary is the canonical settled destination for the beat.

The compiler must preserve the distinction between semantic position and subject-state identity. Consecutive generated boundaries may contain equivalent Console state while retaining distinct commentary, focus, or instructional position.

The Console state at a generated boundary contains all prior beats' complete Console activity plus the current beat's activity through the current segment anchor. A first segment anchored to `output`, for example, reaches a boundary where the command and output have both appeared.

The authoring contract must require the final segment anchor to equal the beat's last Console phase: `response` when the beat has a response; otherwise `output` when output is non-empty; otherwise `command`. This guarantees that the final generated boundary is complete without compiler inference.

## 4. Beat grouping and learner coordinates

Every generated boundary carries immutable grouping metadata identifying:

- the authored beat ID;
- the authored beat heading;
- the authored beat ordinal, one-based;
- the segment ordinal within the beat, one-based;
- the number of generated segment boundaries in the beat;
- whether the boundary is the beat's final boundary.

Every generated runtime step uses the authored beat heading as its required runtime `label`.

The runtime schema revision defines the exact field names and shapes for grouping metadata.

Transport presents beats rather than generated segment boundaries as the primary learner coordinate:

- the visible counter uses one-based beat ordinal and total beat count;
- the rail exposes one marker per beat;
- Previous and Next move by beat;
- Previous and Next resolve to the destination beat's final boundary;
- Home resolves to `initial`;
- End resolves to the final boundary of the final beat;
- Restart resolves to `initial` and restarts according to the Player transport contract;
- Commentary entry activation may seek to an individual generated segment boundary;
- scrub may resolve an underlying semantic boundary while the visible progress coordinate remains beat-oriented.

Generated segment boundaries remain canonical Runtime/Core positions and remain available to replay, evidence, deterministic seek, and Commentary navigation.

## 5. Final boundary and settled state

The final Explanation segment in a beat compiles as the beat's settled destination. The authoring final-anchor rule in §3 guarantees that this boundary contains the beat's complete Console activity.

No synthetic `settled` segment or commentary entry is generated.

Risk guidance and references associated with the beat attach to the final generated boundary. If transient focus is present on the final segment, that focus belongs to the final boundary state and persists until semantic position changes.

The compiler must not invent commentary text to create a settlement boundary.

## 6. Generated boundary identifiers

Generated runtime step IDs use the deterministic form:

`{beat-id}--s{segment-number}`

where `segment-number` is a one-based, zero-padded two-digit ordinal within the beat, beginning with `01`.

Examples:

- `inspect-status--s01`
- `stage-hunk--s01`
- `stage-hunk--s02`
- `stage-hunk--s03`

The runtime schema revision must permit authored-style identifiers and compiler-generated step identifiers with exactly one `--sNN` suffix. The generated suffix is compiler-owned. Authoring beat IDs may not contain `--`.

A beat containing more than 99 Explanation segments is a compilation failure in v1.

`initial` is reserved and may not be used as an authored beat ID.

The compiler must still verify uniqueness of the complete generated runtime identifier set before emission. It must fail on any collision with a reserved or compiler-owned identifier.

Generated IDs are compiler-owned implementation identifiers. Public authoring and learner-facing links use beat IDs as defined in §12.

## 7. Version and engine compatibility mapping

The authoring document `version` must be a valid Semantic Versioning version string.

The authoring schema version identifies the authoring language and remains `localis.cim/authoring/v1` for this contract.

The compiler emits the runtime schema identifier required by the runtime schema revision and supplies `engine_min` from compiler configuration rather than asking the author to duplicate engine compatibility metadata.

`engine_min` is the minimum compatible CiM engine version: the earliest engine whose Runtime, Core, and consumers implement every runtime-contract feature the compiled document relies on. It is independent of package and release identity. A release version may advance without changing `engine_min`, and `engine_min` names an engine capability level rather than a shipped artifact. For `localis.cim/v2` output, compiler v1 emits `engine_min: "0.2.0"`.

Engine compatibility is enforced at the experience-loading boundary, before Runtime receives the document: the loader compares `engine_min` against the running engine's version and rejects an incompatible document through the experience fault path. Runtime and Core never receive an incompatible document. While production registration of `localis.cim/v2` remains gated, implementation of this enforcement may accompany the beat-aware consumer work, provided it lands before the gate opens.

The compiler must reject a source document whose authoring schema identifier is unsupported.

Authoring version, compiler version, runtime schema version, and engine compatibility are separate identities and must remain independently observable in build provenance.

## 8. Experience configuration, initial state, and absolute Console state

Experience-level renderer configuration contains the Console title and other renderer configuration that is invariant across boundaries. The Console title is not repeated in every boundary state.

The compiler emits the runtime-required `initial_state`. For the Console renderer, `initial_state` contains an empty transcript, no active command, no response, no focus, and no risk state. The experience-level prompt and Console title remain available through renderer configuration.

Each generated runtime boundary contains complete absolute state for the subject-neutral Console renderer at that semantic position.

The state includes, as applicable:

- effective prompt when overridden by the beat;
- accumulated command transcript;
- command copy values;
- all Console output revealed through that boundary;
- output IDs;
- output tones;
- interactive prompt state;
- response text when revealed;
- transient focus IDs for the active Explanation segment;
- risk presentation data required for already revealed command history;
- beat and presentation state required to reproduce the destination without prior rendering history.

The state must contain the accumulated visible Console transcript required at the destination. A renderer must not need to replay earlier boundaries to construct it.

The normative state shape, field meanings, and invariants are defined by `docs/renderers/CONSOLE-RENDERER-v1.md`. Absolute state repeats the accumulated transcript at every boundary; the resulting quadratic growth with lesson length is a documented post-v1 consideration (CONSOLE-RENDERER-v1 §7), and v1 introduces no structural sharing.

`copy`, when absent in authoring, resolves to the authored command. When present, the authored copy value is preserved exactly subject to authoring validation.

Tone and focus remain separate channels. Tone is persistent semantic styling. Focus is transient semantic emphasis associated with the active segment boundary.

## 9. Commentary mapping and instructional metadata

Each authored Explanation segment maps one-to-one to the commentary entry for its generated runtime boundary.

The compiler preserves:

- segment text;
- segment anchor;
- focus relationship;
- authored order.

The field mapping into the runtime commentary object (EXPERIENCE-SCHEMA-v2 §9) is:

| Authoring source | Runtime commentary field | Boundary |
|---|---|---|
| `segment.text` | `text` | every generated boundary |
| `segment.at` | `anchor` | every generated boundary |
| `segment.focus` | `evidence`, omitted when the segment has no focus | every generated boundary |
| `beat.risk.level`, `beat.risk.guidance` | `risk.level`, `risk.guidance` | final boundary only; omitted when the beat has no risk |
| `explanation.references[]` | `links[]` with `ref-NN` ids | final boundary only |

The compiler must also write renderer-owned focus state into each boundary's opaque `state` so that it corresponds exactly to that boundary's `commentary.evidence`. Runtime validation cannot verify this correspondence, by design, so compiler conformance tests must prove it for every emitted boundary.

Beat-level risk guidance and structured references attach to the final generated boundary for that beat.

Risk labels are derived from the normative risk level by the Player/runtime presentation contract. Authors do not supply independent risk labels.

References remain structured data. Authored prose does not acquire inline HTML or executable content during compilation.

Because runtime commentary links require identifiers and authoring references do not, the compiler generates deterministic reference IDs `ref-01`, `ref-02`, and so on in authored reference order within each commentary entry. Generated reference IDs must satisfy the runtime link-identifier rule and be unique within that entry.

The compiler must preserve the ordering rule for final instructional material:

1. final Explanation segment content;
2. risk guidance, when present;
3. references, when present.

## 10. Opening title and description

Experience title, Console title, subject metadata, opening description, experience prompt, and default playback rate are experience-level metadata or configuration rather than synthetic authored commentary.

The runtime schema revision must provide a home for the learner-facing title and opening description outside `initial` commentary and a renderer-configuration home for invariant Console configuration.

`initial` remains the stable pre-instruction semantic boundary and does not receive an invented authored commentary entry.

On initialization, the Player may present the opening description in the Explanation pane before the first beat is entered. This presentation does not create a new semantic boundary.

`subject` is descriptive metadata and does not select renderer behavior.

## 11. Timing and playback rate

The compiler owns the intra-beat pacing default and preserves authored post-settle dwell.

v1 defines:

- intra-beat segment dwell: 900 ms;
- default final beat-boundary dwell when authored `dwell` is absent: 1600 ms.

For every non-final generated boundary in a beat, the compiler emits `dwell_ms: 900`.

For the final generated boundary in a beat, the compiler emits the authored beat `dwell` when present; otherwise it emits `dwell_ms: 1600`.

These values describe authored semantic dwell at 1.0× playback rate. They do not encode renderer transition duration.

`defaultPlaybackRate` remains experience-level playback configuration. Authoring v1 constrains it to the inclusive range 0.5× through 2.0×. Values outside that range are authoring-validation errors.

Runtime owns the effective playback rate. One dilated CiM clock/scheduler facade governs Runtime semantic scheduling and renderer-owned timed presentation, including typing, output reveal, scrolling transitions that use the CiM clock, and other renderer transitions. Playback rate therefore changes pacing coherently rather than accelerating semantic boundaries while leaving renderer typing at a different rate.

Externally supplied effective playback values are clamped to the supported 0.5× through 2.0× range by the Player/Runtime boundary.

Reduced motion may suppress renderer animation but does not remove semantic dwell.

## 12. Renderer selection, navigation, and deep links

`presentation.layout: "console-explanation"` selects the subject-neutral Console renderer through the compiler's fixed renderer mapping. The canonical renderer identifier is `console/v1`, whose renderer-owned state contract is `docs/renderers/CONSOLE-RENDERER-v1.md`.

The compiler, not the author, writes the corresponding runtime renderer identifier. `subject` remains descriptive metadata and must not alter renderer selection.

Public deep links use authored beat identity rather than compiler-generated segment IDs:

`#cim/{experience-id}/{beat-id}`

A beat deep link resolves deterministically to that beat's final generated boundary.

The initial boundary remains:

`#cim/{experience-id}/initial`

Compiler-generated segment IDs may appear in runtime evidence and internal Commentary navigation but are not stable public authoring identifiers for v1.

Host deep-link resolution must support both forms during the runtime-schema transition: beat IDs resolve through beat-grouping metadata when present; existing experiences without beat grouping continue to resolve direct runtime step IDs. `wordpress-deep-link.mjs` therefore requires an additive host update rather than replacement of legacy step-ID behavior.

Previous and Next resolve by beat as defined in §4. Direct Commentary-entry navigation may resolve to a generated segment boundary. Deliberate navigation overrides viewport suspension for semantic position but does not grant presentation components authority over Core.

## 13. Deterministic compilation and canonical output

Compilation is a pure build transformation over:

- the validated parsed authoring value;
- compiler version;
- runtime-schema target version;
- engine compatibility configuration;
- the normative compilation constants defined by this specification.

Source formatting and source object-key order do not affect compiled output. Authored array order remains semantic where the authoring contract defines it as such.

Duplicate JSON object keys are invalid authoring input and must be detected before ordinary JSON parsing can discard an earlier value. A duplicate-key document fails authoring validation and never reaches compilation.

For identical semantic inputs above, the compiler must emit byte-equivalent canonical runtime JSON.

Canonical emission requires:

- deterministic object-field ordering defined by the compiler;
- authored array order preserved where order is semantic;
- generated arrays emitted in deterministic traversal order;
- UTF-8 encoding;
- LF line endings;
- one terminal newline;
- no timestamps, host paths, random values, environment-specific separators, or other nondeterministic data in the compiled document.

Build evidence must record at least:

- authoring source digest;
- compiler version or commit identity;
- target runtime schema identifier;
- generated runtime document digest.

A cross-environment reproducibility test must be able to compare compiled output byte-for-byte.

## 14. Compilation failures

The compiler fails without emitting a usable runtime document when any required mapping is impossible or ambiguous.

Compilation failures include at least:

- unsupported authoring schema;
- authoring validation failure;
- authored beat ID `initial`;
- invalid authoring SemVer;
- more than 99 Explanation segments in one beat;
- generated identifier collision;
- collision with a reserved/compiler-owned identifier;
- unknown presentation layout;
- missing renderer mapping;
- Explanation structure that cannot produce the required semantic boundary sequence;
- a final Explanation segment whose anchor is not the beat's last Console phase;
- focus reference that cannot be represented at its generated boundary;
- unsupported runtime-schema target;
- generated output that fails runtime validation.

The compiler must not silently rename authored IDs, discard source content, reorder authored instructional content, repair invalid references, or substitute a fallback renderer.

Diagnostics must identify the authoring location and the violated compilation rule when source-location information is available.

## 15. Build, validation, and WordPress boundary

The v1 release pipeline is:

```text
localis.cim/authoring/v1 source bytes
        |
        v
duplicate-key / syntax check
        |
        v
parse + validate authoring
        |
        v
compile deterministically
        |
        v
versioned runtime JSON
        |
        v
validate runtime contract
        |
        +--> replay / harness / conformance evidence
        |
        v
WordPress release packaging
        |
        v
WordPress resolves and serves compiled runtime experience
```

WordPress receives compiled runtime experiences as release assets. It does not contain an authoring compiler and does not reinterpret authoring semantics.

A compiled specimen is eligible for packaging only after:

1. authoring validation passes;
2. compilation succeeds;
3. runtime-schema validation passes;
4. deterministic replay/harness checks applicable to the experience pass;
5. the generated runtime artifact is included in release provenance.

The authoring source may be retained in the repository for review and provenance, but it is not the runtime input served to the Player.

## 16. Presentation behavior outside compilation

The following remain Player/presentation behavior and do not create new runtime semantic boundaries by themselves:

- viewport ownership;
- scroll-follow suspension;
- pointer/focus/selection temporary holds;
- pending-content labels;
- copy-button interaction and clipboard fallback;
- copy confirmation presentation;
- link activation mechanics;
- transient visual animation of focus;
- reduced-motion styling of focus;
- responsive pane layout.

Scrolling away establishes learner ownership of that pane's viewport. Pointer presence, focus, and active selection add temporary holds. New reveals do not move a learner-owned or held viewport. Following resumes through explicit learner action. Home, End, Restart, Previous, Next, seek, scrub, and Commentary-entry activation are deliberate navigation and may reposition semantic state according to their navigation contracts.

These behaviors may observe canonical semantic state but do not mutate it directly.

## 17. Required follow-on contracts and authoring corrections

This specification deliberately exposes the requirements for the next contracts rather than defining them indirectly.

Before Authoring v1.0 is frozen, the project must complete:

1. a versioned runtime-schema revision that can represent beat grouping, the generated step-ID form, required labels, `initial_state`, and required experience-level presentation metadata without weakening the opaque-state boundary;
2. an ADR for playback-rate ownership and the single dilated CiM clock facade shared by Runtime scheduling and renderer timed presentation;
3. an ADR for Commentary reference activation and pause capability;
4. an ADR or equivalent normative Player contract for clipboard and viewport authority;
5. authoring-spec corrections required by this compiler contract: reserved `initial`; Semantic Versioning for authoring `version`; generated-ID namespace safety; final-segment anchor completeness; inclusive 0.5×–2.0× `defaultPlaybackRate`; duplicate-key rejection before ordinary JSON parsing; final-segment focus persistence until semantic position changes; explicit-resume scroll-follow policy with pointer/focus/selection holds; and Home, End, and Restart navigation behavior;
6. a host deep-link update that resolves beat IDs through grouping metadata while preserving direct step-ID resolution for experiences without grouping;
7. distinct stable diagnostic namespaces for authoring (`CIM-AUTH-*`), compiler (`CIM-COMP-*`), and runtime experience validation (`CIM-EXP-*`);
8. compilation of the reference Git specimen followed by runtime validation, replay, and harness evidence.

Authoring v1.0 freezes only after these compilation-driven authoring invariants are incorporated and the complete authoring validation suite passes with no unresolved contract question.

## 18. R42 acceptance criteria

R42 is complete when:

- all fifteen compilation decisions in §§3–15 are represented by normative text;
- the peer-review schema blockers A1–A4 are closed in this contract;
- the semantic corrections B1–B6 are closed or mapped explicitly to authoring/runtime follow-on work;
- the runtime-schema revision can be designed directly from this contract without inventing additional authoring semantics;
- the compiler can be implemented without subject-specific Git logic;
- the Git reference specimen can compile without authoring workarounds;
- generated output remains compatible with Core's absolute-state and canonical-boundary model;
- deterministic output can be proven byte-for-byte across supported build environments;
- no Player-only behavior has leaked into Core authority or renderer contract responsibilities.
