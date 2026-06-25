/*
 * Hooray HQ — Meta (Facebook/Instagram) product catalogue feed.
 *
 * Generates a Meta Commerce "data feed" (CSV) live from the source-of-truth
 * catalogue (data/products.json), so the catalogue in Commerce Manager stays in
 * sync automatically — no manual re-uploads when prices/products change.
 *
 * Setup (once): Commerce Manager → Catalogue → Data sources → Add items →
 * "Scheduled feed" → URL: https://hoorayhq.co.nz/api/meta-feed → refresh Daily.
 *
 * Only the live "Grab & Go" line is published; hidden DIY kits are excluded.
 */

// Wrap a value for CSV: always quote, and double any embedded quotes. Newlines
// are flattened so a multi-line description stays inside one field.
function csv(value) {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return `"${s.replace(/"/g, '""')}"`;
}

export async function onRequestGet(context) {
  const { request } = context;

  const root = new URL(request.url).origin; // e.g. https://hoorayhq.co.nz
  const catalogueRes = await fetch(new URL('/data/products.json', root).toString());
  if (!catalogueRes.ok) {
    return new Response('Unable to load catalogue', { status: 502 });
  }
  const catalogue = await catalogueRes.json();
  const products = catalogue.grabAndGo || [];

  const columns = [
    'id', 'title', 'description', 'availability', 'condition',
    'price', 'link', 'image_link', 'brand', 'product_type',
  ];
  const rows = [columns.join(',')];

  for (const p of products) {
    // Use the base/"from" price (lowest variant) as the catalogue price.
    const price = `${Number(p.price).toFixed(2)} NZD`;
    // The store is a single-page app; deep-link to the Grab & Go view.
    const link = `${root}/?view=grab-and-go`;
    // Resolve the primary image to an absolute, percent-encoded URL.
    const imgPath = (p.images && p.images[0]) || p.image || '';
    const imageLink = imgPath ? new URL('/' + imgPath.replace(/^\/+/, ''), root).href : '';

    rows.push([
      csv(p.id),
      csv(p.name),
      csv(p.description || p.subtitle || p.name),
      csv('in stock'),
      csv('new'),
      csv(price),
      csv(link),
      csv(imageLink),
      csv('Hooray HQ'),
      csv('Balloon Garlands'),
    ].join(','));
  }

  return new Response(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Let Meta (and any CDN) cache for an hour; the feed only changes when
      // products.json is redeployed.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
