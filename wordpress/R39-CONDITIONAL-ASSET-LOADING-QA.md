# R39 — Load CiM only where used

Scope: WordPress asset loading, ADR 0057. Separate from the wrap-fix PR. Plugin and engine versions are unchanged at this implementation checkpoint.

WordPress registers existing handles at priority 10 and predicts shortcode use in the queried singular post at priority 20. The `localis_cim_should_enqueue` filter can opt in or suppress both prediction and actual shortcode rendering. Valid shortcodes enqueue defensively, including when rendered before the normal hook or late in a template. Invalid identifiers return without the shortcode safety net. The deferred bootstrap returns before reading its module entry when no invocation root exists; mobile behavior and its late-embed observer remain intact.

## Evidence required

- Unit: empty desktop page cannot read `currentScript`; an embed preserves URL version and motion-policy handoff; mobile admission remains unchanged.
- Protected real WordPress/browser matrix: no plugin requests on empty pages at desktop and phone widths; a shortcode block mounts; two footer-rendered template embeds mount with one script and one stylesheet; explicit force loads only bootstrap/CSS without modules; suppression retains fallback markup with zero plugin requests.
- Mutation: removing the empty-page bootstrap guard must fail its unit test. The WordPress request-count cases reject unconditional enqueueing.
- Existing installed-artifact, shortcode, legacy, motion policy, mobile and Player suites remain required.

## Production request-count record

Daisy's 15 October 2026 measurement on live 0.2.3: `/journey-of-a-token/` and `/localis-articles/` each fetched 65 CiM files (113 KB encoded), despite containing no Player. This is supplied review evidence, not a new measurement from this checkpoint.

After the separately reviewed release is installed, record desktop and phone request counts for both URLs and the home page; each must fetch zero CiM files. Record page 3227's desktop mount/playback and mobile notice, with CSS/bootstrap versions. Production after-counts are pending installation; this change does not alter the live site.

Local Docker is unavailable on INSPIRE, so real WordPress proofs run in protected CI rather than being claimed from a local simulation. R21's historical site-wide enqueue exceptions describe old releases; they are superseded by this policy for the upcoming release.
