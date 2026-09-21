# AE Website Release Control | Canonical Source & VI Guard v1.0 | 2026-09-21

Canonical document: https://docs.google.com/document/d/1XysUHn6Xy3asl7sB0oWRCkTUfk88FiWAu9qMNF1ti6o/edit

## Current verified code baseline
- repo: shaoyiwa-source/AE-Universe-Creation
- branch: main
- commit: fa70661fca29e19a1a29427a13b9c2a969bb4004
- deployment: dpl_FkniG6QpfDJYTT3vsSc4h5JMwpaf
- status: READY
- alias: https://ae-universe-creation.vercel.app/

## Current VI baseline
- AE Universe Creation｜VI v1.0 Working Master｜2026-09-20
- Drive ID: 1WiOW5wG-MHguOvw56n_ZrgNGah65qxJmEzXSlMy1VuQ
- v23.9.1 = visual baseline only, NOT code source to overwrite current main.
- display: Cormorant Garamond direction
- body/info: Noto Sans TC direction
- preserve whitespace, type hierarchy, theme/nav/header/footer/CTA consistency, approved Three Rings/wordmark behavior.

## Mandatory rules (from now on)
1. Fetch latest main before every edit.
2. Incremental patch only by default.
3. Old recovered HTML/ZIP = reference only, never production source.
4. Do not change VI-protected invariants unless Owner explicitly approves a VI change.
5. Before push: check fonts/header/logo/spacing/theme/nav/CTA/bilingual + desktop/mobile.
6. After Production: report commit SHA + deployment ID + READY + changed-files summary.
7. Rollback narrowly by reverting offending commit; never overwrite with a much older snapshot.

Use this guard for all future site changes.
