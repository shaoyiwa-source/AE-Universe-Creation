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
