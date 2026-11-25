# Production integration branch

This branch is a review copy. It is not Production, and it is not `main`.

## Baseline

- Vercel project: `prj_wheDLqvIFWgXnRPWW8k7KC6Umw2B`
- Production deployment: `dpl_7X4Pugsfh7h3tYf7NGq8NsrgQN86` (file deploy, 2026-11-24 16:36 Taipei)
- Production aliases at the time of this note: `ae-universe-creation.vercel.app`, `ae-universe-creation-one.vercel.app`
- Git snapshot of that deployment: `4c924aa1954ae27129c8c810b5c57b56ea735560` on `preview/20261124-price-sync`
- Static output directory: `src` (see root `vercel.json`)
- This first commit does not change site files.

Do not merge this branch into `main`, do not promote its Preview to Production, and do not change the Vercel Ignored Build Step. Only Preview deployments should build from git (`[ "$VERCEL_ENV" != "preview" ]`).

## Ported onto this branch

- `/13th-light/` — 《第13道光》, copied from `main` into `src/13th-light`. No link was added on existing pages, because `main` does not design one.
- `/game/` — 暗棋, latest `main` build (`a35a776`), copied into `src/game`. Same: no existing page was edited.
- `/gallery` and `/showcase` — AE 耀盛 / AE Shinity, from `claude/digital-art-gallery-platform-0cg114`. New rewrites only. Homepage gains one activity card and one menu link, using the existing card and drawer styles. The theme track is the file already at `src/media/aurelia-techno-eternal-148bpm.m4a` (same blob as the gallery branch). Studio login needs `LUMINA_STUDIO_PASSWORD`. Device licences should get `LUMINA_LICENSE_SECRET`. Cloud library needs the existing Blob store (`BLOB_READ_WRITE_TOKEN`). None of those values are in git. `/showcase` plays from files in the repo and does not need Blob.
- `/wallpaper/` — AE Live Wallpaper web app, from `claude/ae-dynamic-wallpaper-app-sgzrap`, served from `src/wallpaper` plus `src/modules/audio-record`. Collections page gains one category card and one section, using the existing collections styles. The iOS project is in `ios/` for review; it is not part of the static site. Prices, ECPay amounts, and environment variables are unchanged.
