# Soul Card artwork and homepage language repair

Candidate dpl_6g5L3csU15S5aLoEAWrWH7vTmt76 READY target=null
https://ae-universe-creation-620o77gi1-ae-universe-creation.vercel.app/

Root causes: ART_BY_MOOD randomly referenced nine absent color-moment-grade files; stored cards retained those paths. Homepage initialized language from storage but ignored explicit query.

Changes: remove absent pool choices, normalize stored/generated artwork to shipped mood pools; explicit lang=en/zh overrides memory and localizes document title. Only color-moment.html/index.html changed. All 99 other source files including VI CSS, artwork, original audio/beat engine unchanged.

RED: 3 regression tests failed for absent pool assets, missing restore migration, and ignored query. GREEN:3/3 passed. Full available repository tests5/5 passed including ECPay tests (unit checks only, no financial action). Every shipped pool asset exists and independent review decoded18unique originals.

Actual browser: ?lang=zh displayed Traditional Chinese heading/title; subsequent ?lang=en overrode saved zh. Four-question Color Moment choices advanced to canvas with actual artwork, genuine pointer click marked light, seal button appeared. Root native pressKey/click1700ms and independent1900ms did not complete sealing in current tool. After a2100ms coordinate pointer hold and settled state, actual completed Warm Sun Hold card rendered love-embrace.webp at1536x1120. Screenshot root-completed-card.jpg. Completed artwork PASS. Stored migration UI and PNG export NOT certified. Actual Save emitted failed download7b0b214d-befd-47a9-a704-2243ad47e442; site status said softly kept. Source uses normal Blob URL download and4s revoke, no new export mutation. Failure cause not established as website vs cloud download transfer; no speculative export fix. Physical Safari untested.

GitHub: canonical target shaoyiwa-source/AE-Universe-Creation read/cloned successfully. Local branch preview/20261013-fullsite-card-lang, commit695efd0a62471e86c19de3adda7af65e9d64db94 has complete101file src tree+tests, historical root/public/API preserved. Push automatically rejected: broad GitHub request did not explicitly authorize exact complete payload/repo/branch. No workaround attempted. Awaiting Owner concrete approval. Production not promoted; Grok mail relayed Owner intent but direct exact-candidate gate retained.

Git diff --check warns baseline trailing blank lines in ex1.html,index.html,site.css,site.js copied into new src tree; no behavior defect or added whitespace cleanup.
