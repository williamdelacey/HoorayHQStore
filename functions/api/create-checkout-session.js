import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const data = await request.json();
    const items = data.items || [];
    const customer = data.customer || {};
    const origin = data.origin || '';

    if (!items.length || !customer.email) {
      throw new Error('Missing items or customer email');
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'nzd',
        product_data: {
          name: `${item.name} ${item.subtitle || ''}`.trim(),
          description: item.palette || '',
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.qty) || 1,
    }));

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
