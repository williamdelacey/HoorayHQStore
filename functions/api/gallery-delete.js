// Cloudflare Pages Function: removes a photo from the gallery R2 bucket.
// Used by the private /upload page's manage view. Password-protected, same
// shared password as upload (env GALLERY_UPLOAD_PASSWORD).

const PREFIX = 'gallery/';

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
    if (!env.GALLERY_BUCKET) throw new Error('Gallery storage is not configured');

    const body = await request.json().catch(() => ({}));
    if (!passwordOk(body.password, env.GALLERY_UPLOAD_PASSWORD)) {
      return json({ ok: false, error: 'Wrong password' }, 401);
    }

    const key = String(body.key || '');
    // Only ever touch keys inside the gallery prefix.
    if (!key.startsWith(PREFIX)) return json({ ok: false, error: 'Invalid photo' }, 400);

    await env.GALLERY_BUCKET.delete(key);
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
