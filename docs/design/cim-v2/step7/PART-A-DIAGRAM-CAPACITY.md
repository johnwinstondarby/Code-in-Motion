# Step 7 Part A: diagram capacity

Base main 7bba6c2, version 1.0.1. Design committed before implementation. Fixture-only; no pack, real capture content, WordPress admission, version change, release or install. Daisy reviews and Johann approves a later merge.

## One layout decision

`diagramGeometry(snapshot)` returns either `graph` with the complete drawing plan, or `text` with a reason. The renderer consumes that result; it does not make a second capacity decision. The existing capture validator remains the authority for records. All new examples are generated simulated records validated through the existing authoring/capture bundle checker; frozen examples remain unchanged.

The graph has four columns at 150px pitch, 132px boxes, a 620px drawing width, 20px top routing margin, and 20px gutters between rows. Rows grow from one through three. Each box height is 8px padding plus 14px for every header/artifact label line, including an explicit idle line in empty boxes. Each row takes its tallest box. The footer grows to contain the complete absent-artifact label. No label is truncated. Graph labels use 12px monospace, wrapping by exactly 14 characters per box line; whitespace is preserved. The full-width footer wraps by 74 characters. An 8px conservative character budget leaves room for status-symbol fallback glyphs.

## Exact limits and readability

All conditions must pass to draw:

| Limit | Maximum | Why |
|---|---:|---|
| Locations | 12 | At most three readable rows of four in the laptop slot. |
| Artifacts at any one location | 4 | Bound label density; additional artifacts remain fully available in text. |
| Wrapped lines in any single header, artifact label or footer | 4 | Prevent a long identifier turning a box into a wall of tiny text. |
| Total computed canvas height | 190px | The smallest supported context row also has the pane heading, four current-flow rows and the evidence disclosure. |
| Canvas width | 620px | Fits the half-width context slot at 1366x768 without scaling text down. |

The font is never reduced to satisfy a limit. The SVG uses the computed height (up to 190px) and a 620px width; its viewBox has those same dimensions. At 1366x768, 1536x864 and 1920x1080 it therefore renders labels at a minimum of 12 on-screen pixels. Below 1366 the existing desktop minimum width/page scroll remains; no phone layout is introduced. Row height and footer height can force text fallback even below the count limits. For example, 12 short locations/artifacts fit exactly at 190px, while 13 locations always fall back. Four short artifacts can fit in one box; five always fall back. A 100-character location/host label requires more than four wrapped lines and falls back.

## Routes and containment

Only capture-backed transfers receive edges. Same-row paths use the empty lane above the row. Multi-row paths use that lane, a right-hand gutter at x=610, the destination row's lane, then its top port. Tokens move by arc length along that exact polyline, including vertical segments, and never through boxes/labels. Arrowheads and token radii are included in computed bounds. The old 0.1/0.5 frame positions and 160ms frame plan remain unchanged: animation pacing is a separate follow-up.

Every rect, label, polyline, arrowhead, token position and footer has explicit computed bounds. Unit tests check them; browsers independently measure actual SVG boxes and ancestor clipping, plus the SVG rectangle inside its slot. CSS overflow may not conceal a bad plan. No horizontal page scroll is permitted at supported widths.

## Complete alternatives

Flows and Show evidence retain their full record-backed text. A pure description function lists every location and host, every artifact and status (including absent artifacts), and every current flow. The same complete description is available in the full text view and SVG description; the SVG title identifies the modeled diagram. When graphical mode fits, a Full text view disclosure retains the text instead of replacing it with the SVG. When capacity fails, no partial SVG is emitted: a visible, screen-reader-readable status note appears before the flow text, and the full text view is displayed. IDs wrap in text without shortening. Placeholder labeling survives both outcomes.

## Evidence and gates

Commit regression tests and meaningful red runs before implementation. CAP-01 covers nine locations; CAP-02 five artifacts at one place; CAP-03 100-character IDs; CAP-04 insists valid within-capacity graphs are drawn (including 12 short locations, four artifacts and the existing custody example). Boundary/one-over fixtures, maximum schema counts, absent artifacts and multi-row mid-transfer tokens are included. Eight mutation probes cover fixed canvas, missing gate/note, truncation, incomplete description, text-only behavior, CSS concealment and unrouted tokens. Passing baselines precede probes; crashes/timeouts are not catches. List all later test changes in REVIEW.md.

Run pinned Node 20/22 verify, unchanged v1 differential, all existing browser/mutation gates, all three engines and screen sizes, and two clean pinned builds. The plugin stays d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a; report the new authoring candidate checksum. Preserve the published rollback kit. Final exact-head CI must pass; draft PR only. Capacity/overflow is this Part A; transfer pacing, codecs, clock trace, placeholder-pack content and workflow download retries remain deferred.

## Implementation finding (added after the initial design commit)

The existing authoring schema applies a stricter semantic combination than the broad capture allowance: 64 services and 32 capture-record references per beat. The maximum valid generated example uses 64 locations, all 128 artifacts, and batches of 32 records per beat. No validator or frozen fixture is changed. The primary regression boundaries (9, 12/13, 4/5 and 100-character IDs) are all validated authored/capture bundles.
