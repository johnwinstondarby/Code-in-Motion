# PR 102: authenticated WebKit .deb cache review packet

Infrastructure only. Current package-cache design supersedes the no-APT-cache policy tested at 935a90a, following Johann's request. Main remains 3304428, version 1.0.1. No application code, environment/image, package target, test command/deadline, install-attempt limit, retry count, signature rule, tag, release or installation changes. Chromium and Firefox remain unchanged. Draft still requires independent review and Johann approval; Part B remains held.

## Implementation and integrity

The cache key includes Playwright 1.63.0, WebKit's exact 61 direct tools+WebKit packages, their canonical SHA-256 list hash, runner OS/architecture and ImageOS/ImageVersion. The package list is compared with the installed pinned Playwright bundle before a key is issued; unknown formats/versions/platforms fail. Only Ubuntu 24.04 x64 is admitted for this experiment. Exact keys only, no restore prefixes.

Cache only complete *.deb files in a runner-owned temporary stage. Locks, partial downloads, indexes, installed system files and metadata sidecars are excluded. Root handling validates regular files, paths, counts and bytes before copying to /var/cache/apt/archives. This staging avoids changing permissions/ownership of APT directories. APT and its signed-index update still run on every fresh runner, including warm hits. Existing bounded npx playwright install-deps webkit attempts are untouched. Browser cache remains separate.

**Important correction to the proposal:** existing APT archives are not necessarily rehashed. Source inspection and an actual Ubuntu APT 2.8.3 download-only experiment show that a same-size wrong-hash file can be accepted unchanged. No package was installed in that experiment. Therefore this implementation adds an explicit pre-install hook. It compares every selected archive's SHA-256/size/identity to Ubuntu package records from an APT index marked trusted, after the normal index update and before dpkg. It does not trust cache-supplied fingerprints or install arbitrary local files. The hook preserves existing APT hooks/keys and is read back from root's effective configuration before proceeding. Selected verified bytes are staged before any normal cleanup removes them.

A restored file is also checked against currently trusted metadata before admission; bad/stale content is discarded and normal downloading is used. Unexpected paths/types fail closed. Save occurs only on an exact cache miss after dependency success **and** positive current-job pre-install verification evidence. A missing/no-op hook cannot create an apparently valid cache proof. Images with no actual archive capture fail this experiment's proof rather than claim a warm-cache improvement. No cache is saved after failed installation; no test step is retried.

Fresh Ubuntu package versions can still require downloads on a warm key, since the image/list key does not pin repository versions and an existing cache entry is immutable. Old versions are never forced to install. Record actual fetched bytes; do not promise zero downloads from a cache-hit flag alone. If cold misses or warm version misses remain unreliable, the container proposal remains the fallback.

## Tests-first record and later test edits

- 39700de commits two Node tests, ten Python tests and inert helpers before implementation. Initial red: Node 0/2 pass; Python nine assertion failures plus one expected-valid case error from the stub's missing result. No import/setup failure.
- 0b7f6de corrects a mutation that changed an earlier platform's xvfb list instead of Ubuntu 24.04; it now targets the selected platform. It also makes the symlink test's identity match so identity rejection cannot mask a missing no-follow check, and adds hook-command/count cases. Re-recorded against stubs: Node one failure (the workflow had already been implemented in the working tree), Python eleven failures/one stub-result error across twelve cases. These revised scenarios are not represented by the original red run.
- A thirteenth Python case independently checks a regular archive outside its allowed directory; it was added after red so a symlink error cannot mask that boundary. All previous assertions remain.
- b328c75 implements cache key, staged restore, fresh trusted-index hook and workflow wiring. The nine combined Node CI-helper tests and thirteen Python cases pass.
- 536f8d4 adds the capture-proof requirement with an inert result and tests before 56bead9 implements it. Red: two of three new cache tests fail for missing evidence/step; green: all ten combined CI-helper Node tests pass. No old assertion was loosened.
- 65c925f adds nine deliberate mutation probes. Each fails an intended assertion, with zero setup/runtime errors. 5f582cc bounds selected bytes before allocation and checks package-record lookup success; the current probes and real-package integration were rerun.

## Rule-to-proof map

| Rule | Proof |
|---|---|
| Exact package/version/image key, pinned-list drift rejected | ci-webkit-apt-cache.test.mjs first test |
| No install skipped on cache hit; save only after success/capture; unchanged other jobs/tests | New workflow test plus existing whole-workflow comparison against base fixture |
| Fresh current-job capture required | Node capture validator tests; mandatory pre-save proof step |
| Same-size corruption, size/identity/trust rejection | Python archive tests; actual APT bypass experiment; authenticated real-package probe |
| Symlink/outside paths, unknown names, count/byte limits, duplicate selection | Python archive tests; nine mutation probes |
| Fixed hook command, no unsafe path interpolation | Python hook test; root effective hook read-back |
| Real trusted metadata and exact staged bytes | Root cold/warm download-only experiment: 2 Ubuntu packages, 77,198 bytes; warm run fetches no package; corrupt copy rejected; actual APT parses hook |

A clean npm-ci checkout revealed that the new unit test initially assumed the optional Playwright package was installed. That ENOENT failure is retained. 144885b switches the unit parser test to a recorded 1.63.0 reference excerpt; the real key command still compares the actual installed pinned package on every WebKit job, with no skip. Both full Node verifies then pass in the clean checkout without Playwright. This is a post-red portability correction, not removal of the runtime agreement check.

Local Node verify: **1,076 tests on Node 20.20.2 and 22.23.2, zero skips**, including existing mutation runners. Python: **13 tests**, **9 mutations caught**. v1 differential: **41 identical, zero differences**. New Python tests/probes run explicitly in WebKit CI; the Node-only authoring tool gains no Python dependency. The CI uses system Python in isolated mode and system python3-apt; a missing dependency fails setup rather than silently bypassing verification.

## Artifacts and preservation

Two clean checkouts of 5f582cc on Node 22.23.2 reproduce both base artifacts exactly:

- Plugin, 99 files: d23af3410cbbe0217931826b0bfe8dbe5f4b8a9d16e125c502c661cc451f876a
- Authoring candidate, 128 files: b84bfc2164fe56274033ca6bb618a000e0ae3d0bf61876ece13a87a90bcdc1cc

CI helpers/tests are excluded from both fixed release file lists. Published 1.0.1 ZIP, page 3227 capture and rollback kit hashes are unchanged (rollback.json). No production state is touched.

## Exact-head gate, still pending

Freeze the final head after this packet. Require all CI checks and three consecutive complete green WebKit jobs: one genuine cold package-cache miss, then two warm restores. Record both APT attempts/results, cold/hit state, archive counts/bytes, cache restore/save timings, root 30/30/3 values, actual package downloads and complete browser/mutation results. Retain the existing browser-download stall proof (two bounded attempts, one retry) from the preceding packet. A recovered green run counts, but repeated dependence on retries must be explicit. Stop on failure; do not manufacture a green streak or count prior heads. Record final runs in a PR comment and external evidence kit to avoid changing the head being proved.

The container fallback is not implemented. Its separate review now explicitly requires bounded measured image-pull timing and genuine H.264 Motion/composition decoding, not only fallback tests. Merge stays held; main must have a green post-merge run before Part B starts. Feature decisions remain 1.1.0-dev, pack-local media for 1.1.0, attachments deferred to 1.2.
