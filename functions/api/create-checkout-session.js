import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const data = await request.json();
    const items = data.items || [];
    const customer = data.customer || {};
    const origin = data.origin || '';

    if (!items.length || !customer.email) {
      throw new Error('Missing items or customer email');
    }

    // Load the catalogue server-side so prices/names come from the source of
    // truth (data/products.json), NOT from the browser. This prevents a tampered
    // request from charging an arbitrary price.
    const catalogueUrl = new URL('/data/products.json', request.url);
    const catalogueRes = await fetch(catalogueUrl.toString());
    if (!catalogueRes.ok) throw new Error('Unable to load product catalogue');
    const catalogue = await catalogueRes.json();
    const productsById = {};
    for (const p of [...(catalogue.grabAndGo || []), ...(catalogue.diyKits || [])]) {
      productsById[p.id] = p;
    }

    const lineItems = items.map((item) => {
      const product = productsById[item.id];
      if (!product) {
        throw new Error(`Unknown product: ${item.id}`);
      }

      // Resolve the price server-side from the catalogue — never trust a price
      // sent by the browser. Start from the base price, then apply the chosen
      // size variant and any foil add-on.
      let unitPrice = Number(product.price);
      const nameParts = [product.name];

      if (Array.isArray(product.variants) && product.variants.length) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new Error(`Invalid size for ${product.name}`);
        }
        unitPrice = Number(variant.price);
        nameParts.push(variant.label);
      } else if (product.subtitle) {
        nameParts.push(product.subtitle);
      }

      const descParts = [];
      if (item.colours) descParts.push(String(item.colours).slice(0, 120));

      // Number/letter foil: +$10 unless this product includes it (read from the
      // catalogue server-side, never trusted from the browser).
      const nl = item.foilNumberLetter || {};
      if (nl.on) {
        const text = String(nl.text || '').trim().slice(0, 60);
        if (!product.numberLetterFoilIncluded) unitPrice += 10;
        descParts.push(`Foil: ${text || '(number/letter)'}`);
      }
      // Themed foil: +$10, sourced to the customer's request.
      const th = item.foilThemed || {};
      if (th.on) {
        const text = String(th.text || '').trim().slice(0, 120);
        unitPrice += 10;
        descParts.push(`Themed foil: ${text || 'as discussed'}`);
      }

      return {
        price_data: {
          currency: 'nzd',
          product_data: {
            name: nameParts.join(' ').trim(),
            description: descParts.join(' · ') || undefined,
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: Math.max(1, Math.min(Number(item.qty) || 1, 999)),
      };
    });

    const metadata = {
      customer_name: (customer.name || '').slice(0, 480),
      customer_phone: (customer.phone || '').slice(0, 480),
      fulfilment: (data.fulfilment || '').slice(0, 480),
      date: (data.date || '').slice(0, 480),
      address: (data.address || '').slice(0, 480),
      notes: (data.notes || '').slice(0, 480),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: customer.email,
      metadata,
      success_url: `${origin}/store.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store.html?canceled=1`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
