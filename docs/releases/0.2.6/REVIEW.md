# 0.2.6 fixes-only candidate

This candidate contains only the two fixes deferred from 0.2.5: the Explanation scrollbar track uses its own background, and one unit test protects the approved Before copying sentences in all three lesson copies. Lesson JSON, commands, Copy values and frozen formats are unchanged. ADR 0059 records the decisions.

The existing GA layout browser test checks each pane's track against its own background in Localis, High Contrast and Light. Only the scrollbar-color assertion is omitted, with an annotation, when the engine cannot expose that computed property. The CSS regression has one mutation guard, and removing either sentence from each of the three lesson copies has six guards, raising the Player guard count from 97 to 104.

Release version: plugin 0.2.6; engine localis.cim/engine@1.0.1. Build twice using pinned Node 22.23.2, compare ZIP bytes and retain SHA-256. Run full verification, all 54 Player cases in Chromium, Firefox and Linux WebKit, and all 104 mutation guards. Every protected workflow and sub-job must pass on the exact candidate head. Installed and upgrade ZIPs must match delivery. Upgrade coverage includes live 0.2.5; every rollback rehearsal restores exact 0.2.5.

Primary rollback is the exact live 0.2.5 ZIP from tag 0.2.5 at f8651ede895b2e61369f684f50b0c1096afbd282, SHA-256 f08e299c1295e26244f282b21390fa70d9ec79d3192233d25b9338460f967a50. The private rollback kit contains a fresh authenticated page 3227 capture, checksums, restore/capture helpers and the retained secondary 0.1.10 hosting backup. None enters the plugin ZIP. Re-check live page content before any later installation. Normal rollback replaces the plugin with exact 0.2.5 and clears hosting caches; restore page content only if edited. Hosting cache clearing is excluded from CI's measured rollback time.

The 0.2.5 post-merge CI and production acceptance have passed. Preparation of this patch proceeds from its tagged merge. Merge, tag and installation of 0.2.6 remain held for Daisy's independent exact-head rebuild/review and Johann's approval. The local delivery packet will record the full candidate head/tree, ZIP and kit checksums, test results and CI links; passing checks alone do not lift the hold.

After separately approved installation, clear hosting caches and verify each pane's track in all themes, both Before copying sentences, unchanged playback/beat stops/Copy/pane heights/navigation, mobile notice and zero CiM requests on home, journey-of-a-token and localis-articles. Production acceptance remains pending installation.

Out of scope: per-phrase limn, author palettes, Match device and SSH rollback.
