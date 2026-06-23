// Cloudflare Pages Function: streams a gallery photo out of the R2 bucket
// (binding GALLERY_BUCKET) at /img/<key>, e.g. /img/gallery/1700000000-ab12-party.jpg.
// Responses are cached at the edge so repeat views don't re-hit R2.

export async function onRequestGet(context) {
  const { params, env, request } = context;
  if (!env.GALLERY_BUCKET) return new Response('Not found', { status: 404 });

  // [[path]] gives the segments after /img/ — rebuild the R2 key.
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!key.startsWith('gallery/')) return new Response('Not found', { status: 404 });

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const object = await env.GALLERY_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  if (!headers.has('content-type')) headers.set('content-type', 'image/jpeg');
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  const response = new Response(object.body, { headers });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
