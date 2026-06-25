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

## ⚠️ Editing brand assets in place (logos, `/brand/*`, `/images/*`) — bump the version

Anything under `/brand/*` and `/images/*` is served with a **1-year `immutable` cache**
(see [`_headers`](_headers)). That's great for performance but means **editing a file in place
will NOT show up live** — Cloudflare's edge and every returning visitor's browser keep serving
the old bytes for a year and never revalidate, because the filename (URL) is unchanged.

If you change the *contents* of a logo or image without renaming it, you must change the URL so
caches treat it as a new asset. Append/bump a version query string everywhere it's referenced:

```html
<img src="brand/Logo/Hooray-Logo-white.svg?v=3" ...>   <!-- was ?v=2 -->
```

`index.html` itself is uncached (`max-age=0, must-revalidate`), so the new reference propagates
immediately once the build finishes — no dashboard purge needed.

The logos are referenced in `index.html` (header `<img>`, footer `<img>`, and the schema.org
`"logo"` URL in the JSON-LD `<head>` block). Current version: **`?v=2`**. Renaming the file to a
brand-new filename works too, and avoids the issue entirely. New visitors are unaffected either
way; this only matters for making an *in-place edit* visible.

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

## Website text editor (Hannah's copy editor)

Hannah can edit the site's marketing copy and product text at **`/admin`** (a private, no-index
page). It reuses the **same password** as the photo manager (`GALLERY_UPLOAD_PASSWORD`) and the
**same R2 bucket** (`GALLERY_BUCKET`) — no new infrastructure.

How it works (override model — defaults can never be lost):

- Editable copy stays hardcoded in `index.html` as the fallback; product text stays in
  `data/products.json`. Hannah's edits are saved as a small JSON object in R2 at
  **`content/site.json`** and layered over those defaults on page load. Empty/failed fetch →
  the original copy shows.
- Only values she changes from the default are stored. So a `git push` that updates the default
  wording of a field she *hasn't* touched will show through; a field she *has* edited keeps her
  version until she changes it again (or resets the box back to the default text).
- **Prices, variants, FAQ and SEO structured data are never editable here** — those remain code edits.
- **Functions:** `functions/api/content-get.js` (public, edge-cached 60s) and
  `functions/api/content-save.js` (password-gated write).
- **Editable homepage fields** are registered in `data/editable.json` (each has a `key` matching a
  `data-edit="…"` attribute in `index.html`). Add a field by tagging the element and adding a
  registry entry.

Like the gallery, saved text appears on the live site within ~1 minute. Local development needs
the R2 binding, so use `npx wrangler pages dev --port 8788` (not `serve.mjs`).
