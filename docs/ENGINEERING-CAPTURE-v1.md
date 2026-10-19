# Engineering capture records v1 — validation candidate

This is separate from the authored lesson. Normative schema: `authoring/v3/capture.schema.json`, ID `localis.cim/engineering-capture/v1`. Validate with `node tools/cim-author.mjs validate capture.json`, or validate the neighboring lesson for cross-reference and Diagram checks too.

Declare `id`, explicit `placeholder`, and an `archive` with ID, relative root and files. Each file has a unique ID, relative path, SHA-256 and provenance. Records have unique ID, beat, pane, host, service, artifact, action, previous location (`from`), resulting location/status (`result`), evidence file ID and provenance. Examples live beside each valid lesson fixture.

The archive root is confined to the capture folder. Files must resolve inside that root; absolute paths, traversal and escaping symlinks/junctions are refused. Linked capture files are JSON basenames confined to the lesson folder. Evidence must be regular files with matching hashes. Limits: 256 files, 512 records, 2 MiB per raw file and 16 MiB total, plus the JSON bounds in the authoring guide. Hashes establish byte identity, not authenticity.

The lesson declares the allowed hosts, services and artifacts. Every record reference must resolve, name the beat and Diagram pane that uses it, and be used exactly once. Records apply in authored beat order. `from` must match the prior location and resulting location must match the named service. Actions derive statuses: pin/pinned, fail/failed, complete/completed, publish/published, verify/verified, evaluate/reproduced. Observe preserves the prior state. Verification and evaluation cannot begin with an absent artifact. Each beat's complete claimed Diagram state must equal this derivation.

Both sample archives are visibly placeholder evidence. The custody beat verifies on INVENT; the following reproduction beat evaluates on INSPIRE. Media placement remains deferred; no clip-serving or archive-extraction implementation is included.
