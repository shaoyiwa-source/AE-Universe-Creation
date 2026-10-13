# Reviewed full-site source

Canonical complete 101-file site is under src/. Existing root and public historical layouts are preserved. Preview build settings: rootDirectory src, outputDirectory ., no build command/framework.

Candidate: dpl_6g5L3csU15S5aLoEAWrWH7vTmt76
https://ae-universe-creation-620o77gi1-ae-universe-creation.vercel.app/

Fixes: remove unshipped card-art paths and normalize restored art; explicit homepage lang query takes precedence over memory and updates document title. Artwork/audio/beat engine preserved.

Run: node --test qa/fullsite-20261013/repair.test.cjs

Language query and actual completed-card artwork passed bounded browser QA; PNG download failed in cloud browser and remains uncertified. See repair-builder.md and repair-independent.md.

This branch is source synchronization. No Production promotion is authorized by this README.

## GitHub web upload layout

Git CLI write credentials were unavailable, but the owner's existing GitHub browser session could write the approved branch. All43 top-level pages/scripts are stored directly in src/. To avoid slow per-file upload of58 nested files, original artwork, shop scripts and media are preserved as two ZIPs in this folder.

Before deploying, run `python3 qa/fullsite-20261013/restore-assets.py`. This restores assets/media/shop to their correct paths and verifies all101 source SHA256 values. Build settings remain rootDirectory=src, outputDirectory=".". No Production promotion is implied.
