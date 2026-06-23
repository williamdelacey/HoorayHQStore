// Cloudflare Pages Function: receives photo uploads from the private /upload page
// and stores them in the R2 bucket (binding GALLERY_BUCKET). Photos are served
// back out via functions/img/[[path]].js and listed via gallery-list.js.
//
// Auth: a single shared password (env GALLERY_UPLOAD_PASSWORD), sent as the
// "password" field of the multipart form. Set it in the Cloudflare Pages
// dashboard (Settings -> Environment variables) and in .dev.vars for local dev.
//
// The page already shrinks images client-side, but we re-check size/type here so
// the bucket can't be filled with junk even if someone hits the endpoint directly.

const PREFIX = 'gallery/';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB ceiling per image (post client-side resize)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Length-independent string compare so a wrong password can't be timed.
function passwordOk(given, expected) {
  if (!expected) return false;
  const a = String(given || '');
  if (a.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= a.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function safeName(name) {
  return String(name || 'photo')
    .replace(/\.[^.]+$/, '')          // drop original extension
    .replace(/[^a-zA-Z0-9-_]+/g, '-') // keep keys URL-safe
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GALLERY_BUCKET) throw new Error('Gallery storage is not configured');

    const form = await request.formData();
    if (!passwordOk(form.get('password'), env.GALLERY_UPLOAD_PASSWORD)) {
      return json({ ok: false, error: 'Wrong password' }, 401);
    }

    const files = form.getAll('photos').filter((f) => f && typeof f.arrayBuffer === 'function');
    if (files.length === 0) return json({ ok: false, error: 'No photos received' }, 400);

    const uploaded = [];
    for (const file of files) {
      const type = file.type || 'image/jpeg';
      if (!ALLOWED.includes(type)) throw new Error(`Unsupported file type: ${type}`);
      if (file.size > MAX_BYTES) throw new Error(`"${file.name}" is too large (max 15 MB)`);

      const ext = EXT[type] || 'jpg';
      const key = `${PREFIX}${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}.${ext}`;
      await env.GALLERY_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { originalName: String(file.name || ''), uploadedAt: new Date().toISOString() },
      });
      uploaded.push(key);
    }

    return json({ ok: true, count: uploaded.length, keys: uploaded });
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
