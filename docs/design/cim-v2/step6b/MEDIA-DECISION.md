# Step 6b media-source decisions

Approved by Johann: each clip may use a pack-local file or an explicit WordPress Media Library attachment ID. The author chooses per clip, and a lesson may mix both. This records requirements before Motion implementation; it enables no loading or serving route.

- Both sources require the recorded content fingerprint, captions, a text alternative and the same bounded recording-unavailable fallback. Arbitrary remote URLs are not accepted as attachment references.
- Verify the fingerprint before playback against the bytes actually served to the visitor, not just a database field, filename or earlier file read. The implementation must prevent verification of one byte sequence followed by playback of different bytes. Specify this mechanism before implementing it.
- For Media Library items, validate the fingerprint during Admin pack validation as well. A replaced file must be identified there, in addition to failing safely during playback. Deleted, inaccessible or mismatched items produce a lesson/clip-specific Admin reason and the learner fallback.
- Preflight must check anonymous visitor access to each referenced attachment, including attachment/parent privacy and the delivered media. A logged-in administrator's successful access is insufficient. Private, draft or otherwise visitor-inaccessible media must be rejected with an actionable explanation. Define the check for offloaded media explicitly; do not bypass the declared source boundary by following arbitrary URLs.
- Pack-local media is self-contained. Report total ZIP size and warn near the host's upload/request limit where known, suggesting Media Library storage for large clips.
- Attachment references are site-specific. Preflight must flag that the pack will not be portable to another site without rebinding and revalidation. Specify export, replacement/deletion, upgrade and rollback handling before admission.

The implementation, source policy, limits and verification mechanism remain subject to the step 6b review gates. No Motion code or WordPress behavior is introduced by this decision record.
