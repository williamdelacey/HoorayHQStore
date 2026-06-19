import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  let event;
  try {
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      payload,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    let itemsSummary = '';
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      itemsSummary = lineItems.data.map((li) => `${li.description} x${li.quantity}`).join(', ');
    } catch (e) {
      console.error('Failed to list line items:', e);
    }

    const metadata = session.metadata || {};
    const order = {
      customer_name: metadata.customer_name || '',
      customer_email: session.customer_details?.email || '',
      customer_phone: metadata.customer_phone || '',
      fulfilment: metadata.fulfilment || '',
      date: metadata.date || '',
      address: metadata.address || '',
      notes: metadata.notes || '',
      items: itemsSummary,
      total: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
    };

    const zohoWebhook = env.Zoho_trigger_order;
    if (zohoWebhook) {
      try {
        await fetch(zohoWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        });
      } catch (e) {
        console.error('Zoho order webhook failed:', e);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
