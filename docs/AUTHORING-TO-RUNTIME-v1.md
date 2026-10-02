# Code in Motion Authoring-to-Runtime Compilation Contract v1

Status: R42 normative candidate

## 1. Purpose and boundary

This specification defines deterministic compilation from `localis.cim/authoring/v1` source documents into the versioned Code in Motion runtime experience contract consumed by validation and Runtime.

The compiler is a build-time boundary. WordPress and Runtime consume compiled, validated runtime JSON. They do not compile authoring documents during page load or runtime initialization.

The authoring document remains the human-maintained instructional source. The compiled runtime document is a generated release input and must not require Runtime, Core, Commentary, Transport, or a renderer to understand the authoring schema.

## 2. Normative principles

1. Compilation is deterministic and fail-closed.
2. One authored Explanation segment produces one canonical runtime semantic boundary.
3. Runtime boundaries use absolute renderer state sufficient to reproduce the destination independently of navigation history.
4. Authored beats remain the learner-facing navigation coordinate even when compilation expands one beat into several runtime boundaries.
5. The compiler generates only boundaries required by authored Explanation segments. It does not manufacture a separate settled boundary.
6. The final segment boundary of a beat is that beat's settled destination.
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

## 4. Beat grouping and learner coordinates

Every generated boundary carries immutable grouping metadata identifying:

- the authored beat ID;
- the authored beat ordinal;
- the segment ordinal within the beat;
- the number of generated segment boundaries in the beat;
- whether the boundary is the beat's final boundary.

The runtime schema revision defines the exact field names and shapes for this metadata.

Transport presents beats rather than generated segment boundaries as the primary learner coordinate:

- the visible counter uses beat ordinal and total beat count;
- the rail exposes one marker per beat;
- Previous and Next move by beat;
- Previous and Next resolve to the destination beat's final boundary;
- Commentary entry activation may seek to an individual generated segment boundary;
- scrub may resolve an underlying semantic boundary while the visible progress coordinate remains beat-oriented.

Generated segment boundaries remain canonical Runtime/Core positions and remain available to replay, evidence, deterministic seek, and Commentary navigation.

## 5. Final boundary and settled state

The final Explanation segment in a beat compiles as the beat's settled destination.

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

`initial` is reserved and may not be used as an authored beat ID.

The authoring contract must restrict beat IDs so the compiler can generate IDs unambiguously. An authored beat ID that would collide with another generated identifier, a reserved identifier, or another compiler-owned namespace causes compilation failure.

The compiler must perform collision detection against the complete generated runtime identifier set before emitting output.

Generated IDs are compiler-owned implementation identifiers. Public authoring and learner-facing links use beat IDs as defined in §12.

## 7. Version and engine compatibility mapping

The authoring document `version` must be a valid Semantic Versioning version string.

The authoring schema version identifies the authoring language and remains `localis.cim/authoring/v1` for this contract.

The compiler emits the runtime schema identifier required by the runtime schema revision and supplies `engine_min` from compiler/release configuration rather than asking the author to duplicate engine compatibility metadata.

The compiler must reject a source document whose authoring schema identifier is unsupported.

Authoring version, compiler version, runtime schema version, and engine compatibility are separate identities and must remain independently observable in build provenance.

## 8. Absolute Console renderer state

Each generated runtime boundary contains complete absolute state for the subject-neutral Console renderer at that semantic position.

The state includes, as applicable:

- Console title;
- effective prompt;
- command text;
- command copy value;
- all Console output revealed through that boundary;
- output IDs;
- output tones;
- interactive prompt state;
- response text when revealed;
- transient focus IDs for the active Explanation segment;
- risk presentation data required for already revealed command history;
- beat and presentation state required to reproduce the destination without prior rendering history.

The state must contain the accumulated visible Console transcript required at the destination. A renderer must not need to replay earlier boundaries to construct it.

`copy`, when absent in authoring, resolves to the authored command. When present, the authored copy value is preserved exactly subject to authoring validation.

Tone and focus remain separate channels. Tone is persistent semantic styling. Focus is transient semantic emphasis associated with the active segment boundary.

## 9. Commentary mapping and instructional metadata

Each authored Explanation segment maps one-to-one to the commentary entry for its generated runtime boundary.

The compiler preserves:

- segment text;
- segment anchor;
- focus relationship;
- authored order.

Beat-level risk guidance and structured references attach to the final generated boundary for that beat.

Risk labels are derived from the normative risk level by the Player/runtime presentation contract. Authors do not supply independent risk labels.

References remain structured data. Authored prose does not acquire inline HTML or executable content during compilation.

The compiler must preserve the ordering rule for final instructional material:

1. final Explanation segment content;
2. risk guidance, when present;
3. references, when present.

## 10. Opening title and description

Experience title, Console title, subject metadata, and opening description are experience-level metadata rather than synthetic authored commentary.

The runtime schema revision must provide a home for the learner-facing title and opening description outside `initial` commentary.

`initial` remains the stable pre-instruction semantic boundary and does not receive an invented authored commentary entry.

On initialization, the Player may present the opening description in the Explanation pane before the first beat is entered. This presentation does not create a new semantic boundary.

`subject` is descriptive metadata and does not select renderer behavior.

## 11. Timing and playback rate

The compiler owns authored pacing constants used to populate runtime dwell values. v1 defines:

- intra-beat segment dwell: 900 ms;
- final beat-boundary dwell: 1600 ms.

For every non-final generated boundary in a beat, the compiler emits `dwell_ms: 900`.

For the final generated boundary in a beat, the compiler emits `dwell_ms: 1600`.

These values describe authored semantic dwell at 1.0× playback rate. They do not encode renderer transition duration.

`defaultPlaybackRate` remains experience-level playback configuration. Runtime owns effective playback rate and applies it to Runtime-owned semantic scheduling through the injected CiM clock/scheduler. The renderer contract does not change to implement playback rate.

The supported v1 effective range is 0.5× through 2.0×. A valid authored `defaultPlaybackRate` is already constrained to that range; Runtime clamps externally supplied effective values to the nearest supported endpoint.

Reduced motion may suppress renderer animation but does not remove semantic dwell.

## 12. Renderer selection, navigation, and deep links

`presentation.layout: "console-explanation"` selects the subject-neutral Console renderer through the compiler's fixed renderer mapping.

The compiler, not the author, writes the corresponding runtime renderer identifier. `subject` remains descriptive metadata and must not alter renderer selection.

Public deep links use authored beat identity rather than compiler-generated segment IDs:

`#cim/{experience-id}/{beat-id}`

A beat deep link resolves deterministically to that beat's final generated boundary.

The initial boundary remains:

`#cim/{experience-id}/initial`

Compiler-generated segment IDs may appear in runtime evidence and internal Commentary navigation but are not stable public authoring identifiers for v1.

Previous and Next resolve by beat as defined in §4. Direct Commentary-entry navigation may resolve to a generated segment boundary. Deliberate navigation overrides viewport suspension for semantic position but does not grant presentation components authority over Core.

## 13. Deterministic compilation and canonical output

Compilation is a pure build transformation over:

- validated authoring input bytes after JSON parsing;
- compiler version;
- runtime-schema target version;
- engine compatibility configuration;
- the normative compilation constants defined by this specification.

For identical inputs above, the compiler must emit byte-equivalent canonical runtime JSON.

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
- generated identifier collision;
- collision with a reserved/compiler-owned identifier;
- unknown presentation layout;
- missing renderer mapping;
- Explanation structure that cannot produce the required semantic boundary sequence;
- focus reference that cannot be represented at its generated boundary;
- unsupported runtime-schema target;
- generated output that fails runtime validation.

The compiler must not silently rename authored IDs, discard source content, reorder authored instructional content, repair invalid references, or substitute a fallback renderer.

Diagnostics must identify the authoring location and the violated compilation rule when source-location information is available.

## 15. Build, validation, and WordPress boundary

The v1 release pipeline is:

```text
localis.cim/authoring/v1 source
        |
        v
validate authoring
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

Scrolling away establishes learner ownership of that pane's viewport. Pointer presence, focus, and active selection add temporary holds. New reveals do not move a learner-owned or held viewport. Following resumes through explicit learner action.

These behaviors may observe canonical semantic state but do not mutate it directly.

## 17. Required follow-on contracts

This specification deliberately exposes the requirements for the next contracts rather than defining them indirectly.

Before Authoring v1.0 is frozen, the project must complete:

1. a versioned runtime-schema revision that can represent beat grouping and required experience-level presentation metadata without weakening the opaque-state boundary;
2. an ADR for playback-rate ownership and injected-clock scaling;
3. an ADR for Commentary reference activation and pause capability;
4. an ADR or equivalent normative Player contract for clipboard and viewport authority;
5. authoring-spec corrections required by this compiler contract, including reserved `initial`, Semantic Versioning for authoring `version`, and generated-ID collision safety;
6. compilation of the reference Git specimen followed by runtime validation, replay, and harness evidence.

Authoring v1.0 freezes only after these compilation-driven authoring invariants are incorporated and the complete authoring validation suite passes with no unresolved contract question.

## 18. R42 acceptance criteria

R42 is complete when:

- all fifteen compilation decisions in §§3–15 are represented by normative text;
- the runtime-schema revision can be designed directly from this contract without inventing additional authoring semantics;
- the compiler can be implemented without subject-specific Git logic;
- the Git reference specimen can compile without authoring workarounds;
- generated output remains compatible with Core's absolute-state and canonical-boundary model;
- deterministic output can be proven byte-for-byte across supported build environments;
- no Player-only behavior has leaked into Core authority or renderer contract responsibilities.
