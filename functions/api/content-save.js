// Cloudflare Pages Function: saves the site text overrides from the private /admin editor
// to R2 (binding GALLERY_BUCKET) as content/site.json. Served back to the site via
// content-get.js. Prices/variants are never touched here — only marketing copy and the
// editable product text fields the editor sends.
//
// Auth: the same single shared password as the photo manager (env GALLERY_UPLOAD_PASSWORD),
// sent as the "password" field of the JSON body. Set it in the Cloudflare Pages dashboard
// (Settings -> Environment variables) and in .dev.vars for local dev.

const KEY = 'content/site.json';
const MAX_BYTES = 256 * 1024; // generous ceiling for a text-only overrides blob

// Length-independent string compare so a wrong password can't be timed.
function passwordOk(given, expected) {
  if (!expected) return false;
  const a = String(given || '');
  if (a.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= a.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GALLERY_BUCKET) throw new Error('Content storage is not configured');

    const body = await request.json().catch(() => ({}));
    if (!passwordOk(body.password, env.GALLERY_UPLOAD_PASSWORD)) {
      return json({ ok: false, error: 'Wrong password' }, 401);
    }

    const content = body.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return json({ ok: false, error: 'Invalid content' }, 400);
    }

    const serialized = JSON.stringify(content);
    if (serialized.length > MAX_BYTES) {
      return json({ ok: false, error: 'Content is too large' }, 400);
    }

    await env.GALLERY_BUCKET.put(KEY, serialized, {
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      customMetadata: { savedAt: new Date().toISOString() },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
