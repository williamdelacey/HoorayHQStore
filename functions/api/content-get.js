// Cloudflare Pages Function: returns the site text overrides Hannah saved from the
// private /admin editor. Stored as a single JSON object in R2 (binding GALLERY_BUCKET)
// under content/site.json. The homepage and product loader layer these overrides on
// top of the hardcoded defaults — so if this is empty or errors, the site simply shows
// its original copy. Public, edge-cached briefly so edits show within a minute.

const KEY = 'content/site.json';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    if (!env.GALLERY_BUCKET) return json({ ok: true, content: {} });

    const obj = await env.GALLERY_BUCKET.get(KEY);
    if (!obj) return json({ ok: true, content: {} });

    const content = await obj.json().catch(() => ({}));
    return json({ ok: true, content: content && typeof content === 'object' ? content : {} });
  } catch (e) {
    // Never break the homepage — fall back to defaults.
    return json({ ok: true, content: {} });
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Short edge cache so saved edits show within a minute without hammering R2.
      'Cache-Control': 'public, max-age=60',
    },
  });
}
