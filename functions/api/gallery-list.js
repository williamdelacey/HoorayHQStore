// Cloudflare Pages Function: lists the gallery photos in R2 (binding
// GALLERY_BUCKET) for both the public store gallery and the private /upload page.
// Public — returns only image URLs + keys, no upload metadata that matters.

const PREFIX = 'gallery/';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    if (!env.GALLERY_BUCKET) return json({ ok: true, photos: [] });

    const objects = [];
    let cursor;
    do {
      const page = await env.GALLERY_BUCKET.list({ prefix: PREFIX, cursor, limit: 1000 });
      objects.push(...page.objects);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    // Newest first: most recent uploads lead, seeded curation trails behind.
    const photos = objects
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
      .map((o) => ({ url: `/img/${o.key}`, key: o.key }));

    return json({ ok: true, photos });
  } catch (e) {
    return json({ ok: false, error: e.message, photos: [] }, 200);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Short edge cache so new uploads show within a minute without hammering R2.
      'Cache-Control': 'public, max-age=60',
    },
  });
}
