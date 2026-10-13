# Independent repair QA

Exact candidate: https://ae-universe-creation-620o77gi1-ae-universe-creation.vercel.app/
Deployment supplied by owner: dpl_6g5L3csU15S5aLoEAWrWH7vTmt76
Review date: 2026-10-13. No source/deploy/lock mutations.

## Verdict

PASS for explicit homepage language override and sampled completed Soul Card artwork. PNG export is NOT certified: an actual Save Soul Card action emitted a download failure in this cloud browser. This is not a blanket all-state or physical-device pass.

## Actual UI evidence

- Same browser tab opened /?lang=en, then /?lang=zh, then /?lang=en. Chinese query overrode the preceding English preference and English query overrode the preceding Chinese preference. Hero, main links, lower-page content and title changed appropriately. Chinese title: AE Universe Creation — 手繪藝術。數位感官體驗。 English title: AE Universe Creation — Hand-painted Art. Digital Sensation.
- /color-moment?lang=en selected a four-question random variant (not three). Genuine clicks answered Gold on an old letter; Being lightly covered by a blanket; The soft gold of dusk; Amber that keeps warming. Questions progressed 1/4 → 2/4 → 3/4 → 4/4 → drawing stage.
- Genuine semantic #cmShell click left a visible glow on Love Embrace. Seal bar then appeared. This verifies a pointer mark, not a long dragged drawing.
- Native AX-index keyboard hold1900ms and pointer hold1900ms did not immediately yield a result. After verifying native screenshot target and using actual coordinate pointer hold2100ms, the later settled screenshot and DOM showed a completed card. The animation/coalescence requires settling; immediate snapshots were insufficient.
- Completed article title Warm Sun Hold / 暖陽之懷, original-art image assets/selected-works-v2/love-embrace.webp, complete=true, naturalWidth=1536, naturalHeight=1120. The visible artwork rendered; the generated light stamp image also had positive dimensions920×690. Status initially said Your Soul Card is ready to save or share.
- Documented waitForEvent('download') began before actual Save Soul Card click. A download emitted but failed: Download156d281b-a566-4968-8d47-9cdf5fb8b01c failed. This caused the CUA kernel to reset; tab38 was rebound and still showed the completed card and status This moment is softly kept. No valid saved PNG was obtained, so export bytes/signature/dimensions are not certified.

## Independent source verification

Ran node --test ae-repair/qa/repair.test.cjs:3 tests passed,0 failed. Tests cover every possible pool art file present, missing stored art resolving to a present pool art while retaining valid selections, and explicit homepage URL language precedence.

Separately extracted all18 unique assets from ART_BY_MOOD and decoded every image with Pillow. Every image decoded with positive dimensions. This checks shipped source files, not all18 remotely sampled UI outcomes. Stored-record migration is verified by the isolated source test, not by injecting browser storage.

## Scope limits and proof

No browser script injection, hidden-state mutation, headless browser, financial action, or production deployment was used. Physical Safari/iOS and every random question/art combination remain untested. Share was not invoked because it could transmit externally. Source tests and local decoding supplement the one genuinely completed remote UI card.

Exact-tab screenshot evidence: independent-lang-zh.jpg, independent-seal-stage.jpg (captured during result reveal), independent-completed-card.jpg. No screenshot archive created.
