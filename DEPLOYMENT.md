# Deployment / GitHub push guide

This repo pushes to **two different GitHub repos**, each wired to its own Cloudflare Pages
project. They are NOT the same site. Pick the wrong one and you can deploy store code
(or break it) on the wrong domain.

## The two remotes

Run `git remote -v` to confirm these are still accurate before pushing.

| Remote | GitHub repo | What it deploys | Contains |
|---|---|---|---|
| `origin` | `williamdelacey/hooray_hq` | The 1-page holding site | `index.html` only |
| `cloudflare` | `williamdelacey/HoorayHQStore` | The full store site | `index.html`, `store.html`, Stripe checkout functions (`functions/`), product images |

## Why this matters

Both remotes share the same local commit history up to commit `9e560e9`
("Update copy: balloon garlands → balloon styling"). After that point, the store/ecommerce
work (Stripe checkout, `store.html`, product photos, etc.) was only ever pushed to
`cloudflare`. `origin` was never updated past `9e560e9`.

The local `main` branch contains all of that store history. **If you `git push origin main`,
you will push every store-related commit and file into the holding-site repo** — which would
also change what Cloudflare deploys on that domain. Don't do this by default.

## Rules for future pushes

1. **Changes to `store.html`, `functions/`, Stripe code, or product/store images** → push to
   `cloudflare` only:
   ```
   git push cloudflare main
   ```
2. **Changes to `index.html` (the holding page) that should also appear on the holding site**
   → this is not a simple `git push origin main` (see warning above). Stop and ask the user
   how they want it synced (e.g. cherry-pick the specific commit onto a branch based on
   `origin/main`) rather than pushing local `main` wholesale.
3. **If unsure which remote a change belongs to**, check what each remote currently has before
   pushing:
   ```
   git ls-tree -r origin/main --name-only
   git ls-tree -r cloudflare/main --name-only
   ```
4. Never assume `git push` with no remote argument is safe — check the current branch's
   tracking remote first (`git status` shows it), since it may default to `cloudflare`.
5. Don't try to "fix" the divergence (e.g. force-pushing one remote's history onto the other,
   rebasing, or merging the two) without asking the user first — that's a structural decision
   about how the two sites should relate, not a routine push.
