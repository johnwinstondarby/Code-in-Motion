# Step 7 Part A review packet

Draft only. Base main 7bba6c2, version 1.0.1. No merge, tag, release, installation or placeholder-pack/capture content. Independent review by Daisy and approval by Johann remain required.

## Design and scope

Design commit c29e9eb precedes implementation; see PART-A-DIAGRAM-CAPACITY.md. Limits: 12 locations, four artifacts per location, four wrapped lines per header/artifact/footer label, and 190px computed height at a 620px drawing width. Text is 12px monospace, 14px line spacing; it never shrinks to fit. Rows and box heights grow; any exceeded limit selects complete text with a visible accessible note. The same pure geometry decides the outcome and supplies the renderer. SVG and full text descriptions share complete capture-backed data, with flows/evidence kept. Arrows/tokens follow empty row lanes and an outside vertical gutter. The 160ms frame plan is untouched.

Only the fixture Engineering implementation and its composition CSS change shipped candidate source. Production WordPress, Core, Runtime, host, renderer/contract, frozen formats, session/model and bundled lessons remain untouched. The old composition ID mutation is retargeted to the relocated edge expression; its rule is unchanged. New tests/mutations are added to verify and the three-engine CI matrix. No download workflow change is made.

## Tests-first record

- c29e9eb: design before implementation.
- a0b6339: new unit/browser tests and validated generated capture fixtures before implementation.
- fa28630: recorded seven unit assertion failures and the browser assertion for the missing capacity note. Original fixtures remained unchanged.
- 99b8d2f: geometry/renderer implementation after recorded reds.

The original browser red covers the fallback-note case at 1366 in Chromium; it does not claim every added scenario failed in every browser. Unit red contains seven assertion failures, not missing-import crashes.

## Every test edit after those red runs

| Change | Reason |
|---|---|
| 95c5af4: scope role=status to the Engineering pane | The transport's output also has an implicit status role. Counting page-wide statuses confused the transport with the new capacity note. The expectation of one pane note is unchanged. |
| 95c5af4: use a failed relocation rather than published in the multi-row positive fixture | The longer published label legitimately wraps onto a second artifact line and makes the three-row canvas exceed 190px. The route test needs an example within capacity. All old assertions remain. |
| 0b36121: assert the exact Artifact ID: status prefix in full descriptions | A flow may mention an artifact whose state entry was omitted. This stronger assertion separately proves the complete state list. |
| 0b36121: synchronous counts for outcome SVG/note presence | Make deliberate-break detections immediate assertions, rather than relying on a missing-locator assertion retry deadline. Expected counts are unchanged. |
| 2f111e6: truncation unit probe selects CAP-06 | Its first unit probe mistakenly selected the boundary-only CAP-04 test, which does not check characters. CAP-06 already checked line preservation; no test was relaxed. Browser truncation remains checked by CAP-04's wrapped-label scenario. |
| 7ee4bde: add a unit assertion that tokens avoid node boxes as well as text | The initially unrouted token missed short label glyphs but would be hidden by their box. The existing browser hit test caught that visibility defect; the unit rule is now stronger too. |

Fixture setup before the original red also learned the existing semantic limits: services max64 and records-per-beat max32, despite the wider structural capture allowance. The largest valid fixture therefore uses 64 locations and 128 artifacts, split into batches of 32 records, without altering validators. These are simulation-only generated fixtures, never edits to frozen lessons.

## Rule map and probes

CAP-01: nine locations / three rows / complete bounds. CAP-02: five artifacts fallback, four graphical. CAP-03: 100-character IDs preserved in labels and full text. CAP-04: within-capacity graphs, 12-location and wrapped-label boundaries, one-over fallbacks, and existing Run Custody. CAP-05: complete locations, hosts, artifact states (including absent), flows and SVG/text equivalence. CAP-06: character preservation and growing box bounds. CAP-07: multi-row routes, computed token bounds and actual on-screen mid-transfer hit test.

Eight failure modes are covered by nine browser probes: restore fixed geometry; remove capacity gate; omit note; truncate labels; omit artifact descriptions; always fall back; hide slot overflow; hide SVG overflow; bypass routed token geometry. Six of these also run as unit probes. Each mutation run first requires passing unit/browser baselines. Only assertion failures count; crashes, test timeouts, signals and syntax/reference/type errors are refused. Initial surviving probe logs are retained, with the corrections above disclosed.

## Verification and artifacts

Final counts, per-engine logs, screenshots, builds, frozen-scope comparison, v1 differential and rollback preservation will be added after all gates finish. Exact final-head CI belongs in the draft PR to avoid changing the reviewed tree merely to record its own CI status. Two clean pinned builds must match, with plugin SHA-256 d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a. The authoring candidate changes for the geometry/rendering/CSS source; no release is made.

Deferred: animation pacing, codec declarations, bounded coordinator trace, placeholder pack/real capture content, WordPress admission and download-retry/caching workflow changes. Diagram capacity must merge before capture content enters the placeholder pack.
