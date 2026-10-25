# Step 7 Part C: WordPress admission and the production panes renderer

Status: design committed before tests and implementation. Base: main 7bc0ce6. Author: Daisy (implementation while Pilgrim is offline); Pilgrim reviews independently before Johann approves. No version bump, tag, release, media serving (Part D), lesson page, small-screen GIF or upgrade/rollback rehearsal (Part E).

## Decisions taken for this part (Johann may redirect)

1. **Development admission in WordPress.** CiM stays 1.0.1 until step 8, so `cim_min: 1.1.0` packs need the agreed `1.1.0-dev` route. In WordPress it is enabled only by the exact wp-config constant `LOCALIS_CIM_DEVELOPMENT_ADMISSION === '1.1.0-dev'`, and only while the plugin's own version is below 1.1.0. Pack data, page content, shortcode attributes and URLs cannot enable it. The Admin Console shows a visible notice whenever it is active. Without it, the v2 interval check runs against the real version and refuses the pack with its Admin reason.
2. **Placeholder packs only in 1.1.0.** No real-capture verification exists, so a `panes/v1` pack whose lesson, capture or media is not in placeholder mode is refused, both in PHP discovery and in the browser admission. The authentic "Recorded in the lab" label therefore cannot appear.
3. **Motion falls back in WordPress until Part D.** This part registers no media route. The Motion pane receives a verified-media service with no bindings, so every clip resolves to the standard "GUI recording unavailable" fallback with its text alternative. Console, Explanation and Engineering render fully. Local preview keeps real playback.
4. **The plugin ZIP changes.** It gains the opt-in multi-pane modules and stylesheets, the production admission module and the WordPress panes binding. Legacy Console lessons, bundled lessons, page 3227 and v1 packs keep identical behavior and diagnostics.

## PHP discovery (`wordpress/lesson-packs.php`)

- Header contract `cim.lesson-pack/v1` keeps its exact path, messages and cache key. `cim.lesson-pack/v2` is a separate, explicit branch; any other contract keeps the existing refusal.
- v2 manifest: `schema: cim.lesson-pack/v2`; release semantic versions; interval checked against the host identity (real version, or 1.1.0 under the development rule above); `placeholder === true`; exactly the declared `lessons` (1–100) whose `file`/`capture` are JSON basenames; `files` listing every payload path with size and SHA-256.
- Every manifest-listed file must be a regular file inside the pack directory (realpath confinement, no escaping symlinks), with matching size and SHA-256, within the Part B limits (256 files, 32 MiB). Lesson JSON must be compiled `localis.cim/v2`, renderer `panes/v1`, matching ID, placeholder enabled. Capture JSON must be `localis.cim/engineering-capture/v1`.
- Per-file hashing happens only on a cache miss; the fingerprint extends to every manifest-listed file's resolved path and stat identity, so a replaced or re-linked file invalidates acceptance.
- Lesson and capture URLs carry their SHA-256; the browser verifies bytes against it. Media files are listed for Admin but not served (Part D).
- The shortcode marks a v2 root with `data-cim-pack-agreement="cim.lesson-pack/v2"`, `data-cim-pack-url` and `data-cim-pack-capture-url`. Pack and lesson rejection reasons remain visible in Admin; an independent lesson keeps working when another is rejected.

## Browser admission (`src/multipane/admission.mjs`)

- `admitPanesLesson({experience, capture, identity})` validates the frozen v2 envelope, `panes/v1`, `engine_min: 1.1.0` against the host identity, placeholder mode across lesson/capture/media, the pack media form, and builds the Engineering configuration from capture records. It returns an unforgeable admission token (module-private WeakSet) bound to the exact admitted experience text.
- Host identity comes from `createProductionIdentity({developmentAdmission})`: the real `ENGINE_IDENTITY.version`, or the `1.1.0-dev` development identity only when the bootstrap script tag carries the PHP-projected development flag. The numeric interval is never widened; a plain `1.1.0-dev` string remains refused.
- Admin lesson checks and the public Player use this same function.

## Production session path

- `createMultiPaneModel` accepts either the existing `testFixture: true` or an admission token whose bound text equals the supplied experience. `createEngineeringPane` accepts `fixtureOnly` data or the token at its factory. Fixture behavior is unchanged.
- `src/multipane/production-driver.mjs` provides the real-time transition driver (host `performance.now`, timers, animation frames) without importing harness or tools code.
- Architecture check: `wordpress/` and non-fixture `src/` modules must not import `authoring/v3/admission.mjs`, harness or tools modules, and must not pass `testFixture: true`.

## Media form and codec selection

- `validateMediaMap` accepts the production `status: pack` form with a declared codec on every video copy (MP4: `avc1`/`avc3`/`hev1`/`hvc1`/`av01`; WebM: `vp8`/`vp09`/`av01`), keeping the fixture form and its diagnostics unchanged.
- Motion chooses copies by `canPlayType('<type>; codecs="<declared codec>"')` when a codec is declared, and keeps the existing probe for codec-less fixture maps. Preview stops stripping codec declarations.

## Follow-ups carried into this part

- The coordinator's clock trace is opt-in (`traceClock: true`, set only by the fixture harness) and bounded to 256 entries.
- The diagram capacity note is created as a live region only once per beat; frame redraws reuse plain text, so screen readers hear it once.
- Transfer pacing: Engineering transfer frames span 1,200 ms (eight frames of 150 ms) so the token's travel is readable. Reduced motion stays a still. Johann reviews the timing at true size in Part E.

## Evidence

Tests and red runs before implementation; every later test edit disclosed in REVIEW-PART-C.md. Mutation guards: v2 interval widened, development rule widened (plain string, missing constant, version ≥ 1.1.0), non-placeholder admitted, unlisted/oversized/hash-mismatched/escaping file accepted, legacy v1 path altered, token forged or unbound, codec ignored, fixture guard removed, note re-announced. Verify on Node 20.20.2 and 22.23.2, full browser matrix, two clean pinned builds (plugin hash changes; legacy outputs unchanged), WordPress e2e in CI for v2 admission and refusal.
