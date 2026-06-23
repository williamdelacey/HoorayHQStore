# Deployment / GitHub push guide

This repo has a **single remote**, `origin`, wired to its Cloudflare Pages project.

## The remote

Run `git remote -v` to confirm this is still accurate before pushing.

| Remote | GitHub repo | What it deploys | Contains |
|---|---|---|---|
| `origin` | `williamdelacey/HoorayHQStore` | The full store site | `index.html`, `store.html`, Stripe checkout functions (`functions/`), product images |

## Pushing

The local `main` branch tracks `origin/main`. Normal flow:

```
git push origin main
```

Pushing `main` to `origin` deploys the store via Cloudflare Pages.

> Note: there used to be a second remote (`origin` → `williamdelacey/hooray_hq`) for a 1-page
> holding site. That has been removed and the store remote (formerly `cloudflare`) was renamed
> to `origin`. There is no longer any holding-site remote to push to or worry about.

## Gallery uploads (Hannah's photo manager)

The store gallery is managed at **`/upload`** (a private, no-index page). Photos are
stored in a Cloudflare **R2 bucket** (`hooray-gallery`) and served via `/img/*`. The store
gallery in `store.html` fetches `/api/gallery-list` and falls back to its hardcoded list if
that ever fails.

One-time infrastructure (already set up; documented here for re-creation / new environments):

- **R2 bucket:** `npx wrangler r2 bucket create hooray-gallery`. Bound in `wrangler.toml` as
  `GALLERY_BUCKET`. Requires R2 to be enabled on the account (dashboard → R2 → Enable).
- **Password:** set `GALLERY_UPLOAD_PASSWORD` in the Pages dashboard (Settings → Environment
  variables) and in `.dev.vars` for local dev. This single shared password gates upload + delete.
- **Functions:** `functions/api/gallery-upload.js`, `gallery-list.js`, `gallery-delete.js`,
  and `functions/img/[[path]].js`.

Seeding the existing curated photos into the bucket (one-off):

```
# Local bucket (against `wrangler pages dev`):
node tools/seed-gallery.mjs
# Remote bucket is seeded directly with `wrangler r2 object put` — see git history.
```

Local development of the gallery needs the R2 binding, so use Pages dev (not `serve.mjs`):

```
npx wrangler pages dev --port 8788
```

Photos Hannah adds appear on the live site within ~1 minute (the list response is edge-cached
for 60s); individual images are cached for a year and never need busting (keys are unique).
