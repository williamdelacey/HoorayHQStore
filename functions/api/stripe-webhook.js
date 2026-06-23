import Stripe from 'stripe';

// ---- Zoho helpers (kept local so this Function has no shared-module deps) ----
async function getAccessToken(env) {
  const accountsDomain = env.ZOHO_ACCOUNTS_DOMAIN || 'accounts.zoho.com';
  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`https://${accountsDomain}/oauth/v2/token?${params.toString()}`, { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Zoho token error: ${json.error || res.status}`);
  return json.access_token;
}

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
function toIsoDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return '';
  const mon = MONTHS[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
  if (!mon) return '';
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

// Create an Order (Deals module) record in Zoho CRM from a completed checkout.
async function createOrderInZoho(env, order, sessionId) {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) return; // not configured
  const token = await getAccessToken(env);
  const apiDomain = env.ZOHO_API_DOMAIN || 'www.zohoapis.com';

  const dump = Object.entries(order).map(([k, v]) => `${k}: ${v}`).join('\n');
  const deal = {
    Deal_Name: `${order.customer_name || 'Order'}${order.date ? ` — ${order.date}` : ''}`.slice(0, 255),
    Stage: env.ZOHO_ORDER_STAGE || 'Paid',                 // must exist in the Orders pipeline
    Closing_Date: toIsoDate(order.date) || new Date().toISOString().slice(0, 10), // "Pickup / Delivery Date"
    Amount: order.total,
    Customer_Email: order.customer_email || undefined,
    Customer_Phone: order.customer_phone || undefined,
    Fulfilment: order.fulfilment ? order.fulfilment.charAt(0).toUpperCase() + order.fulfilment.slice(1).toLowerCase() : undefined,
    Order_Details: order.items || undefined,
    Order_Notes: order.notes || undefined,
    Stripe_Session_ID: sessionId,
    Description: dump,
  };
  if (order.fulfilment === 'delivery' && order.address) deal.Delivery_Address_Street_Address = order.address;

  const res = await fetch(`https://${apiDomain}/crm/v2/Deals`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    // trigger workflow so the pickup-date → calendar event rule fires
    body: JSON.stringify({ data: [deal], trigger: ['workflow'] }),
  });
  const json = await res.json().catch(() => ({}));
  const ok = res.ok && json.data && json.data[0] && json.data[0].code === 'SUCCESS';
  if (!ok) throw new Error((json.data && json.data[0] && json.data[0].message) || json.message || `HTTP ${res.status}`);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  let stripe;
  let event;
  try {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });
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
      // Expand the product so we can read its description, which carries the
      // colours + foil chosen at checkout (set as product_data.description).
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ['data.price.product'],
      });
      itemsSummary = lineItems.data
        .map((li) => {
          const name = li.description || li.price?.product?.name || 'Item';
          const detail = li.price?.product?.description ? ` (${li.price.product.description})` : '';
          return `${name}${detail} ×${li.quantity}`;
        })
        .join('\n');
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

    // Create the Order in Zoho CRM. Failures are logged but we still return 200
    // so Stripe doesn't retry — the order is always recoverable from Stripe.
    try {
      await createOrderInZoho(env, order, session.id);
    } catch (e) {
      console.error('Zoho order create failed:', e);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
