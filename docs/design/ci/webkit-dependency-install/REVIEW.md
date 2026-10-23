# CI repair review packet

This is an infrastructure draft from main `3304428`, not Part B. The original merge remains at 31 successful checks, one cancelled WebKit check and the failed dependent summary after two attempts. No test ran in either WebKit attempt: dependency downloads exhausted the 30-minute job budget. Logs and GitHub's explicit timeout annotation are retained.

## Change and proof

- Only WebKit receives a pre-install APT-source helper. It substitutes the exact observed Azure Ubuntu archive root with Ubuntu's HTTPS main archive in standard source files. Suites, components, Signed-By keys, comments and unrelated hosts remain unchanged. The original Playwright install invocation follows it.
- No OS/Node/browser version, job deadline, test timeout, assertion, mutation command, required gate or failure policy changes.
- Four trust-boundary unit tests preceded implementation. The inert stub produces three assertion failures and one pass; the implementation passes all four. **No test was edited after its red run.**
- The first local full-verify attempts stopped at the existing workflow parser because the edited YAML checkout had CRLF endings. The checkout was normalized to the canonical Git LF bytes; no parser or assertion was changed. Both initial logs are retained. This was local setup, not evidence of a CI or product failure.
- Full verify passes on Node 20.20.2 and 22.23.2: **1,070 tests each, zero skips**. Existing mutation runners inside verify pass. The v1 differential is **41 identical, zero differences**.
- Two clean builds on pinned Node 22.23.2 match main's artifacts exactly: plugin 99 files; authoring candidate 128 files. See builds.json and the four build logs. Source build commit is `5f9e77d`; later commits add review records only.

Plugin SHA-256: `d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a`

Authoring SHA-256: `b84bfc2164fe56274033ca6bb618a000e0ae3d0bf61876ece13a87a90bcdc1cc`

No source under src/, wordpress/, authoring/, experiences/, schemas/ or contracts/ changed. Package, lock, plugin header and readme metadata are unchanged. The separate CI helper is not a dependency of either artifact. The published rollback ZIP, page 3227 capture and rollback kit match their existing full hashes (rollback.json).

## CI and remaining gate

Exact final-head CI and all three existing browser/mutation jobs must pass; their status is tracked in this draft PR. No independent local browser rerun is claimed for this infrastructure-only change. The CI WebKit install is the direct experiment for this proposed remedy; until it passes, this is not called fixed. The same 30-minute job limit remains in force, so continued slow installs still fail visibly.

Review and Johann's merge approval remain required. A successful draft run does not retroactively turn the historical main check green. After an approved CI repair merge, its post-merge CI must be green before Part B starts. The Part B design draft is held outside the repository. Johann's 1.1.0-dev and pack-local-only 1.1.0 decisions are retained for that work; attachments are deferred to 1.2. No release or installation is performed here.
