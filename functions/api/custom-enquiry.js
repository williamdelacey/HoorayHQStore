// Cloudflare Pages Function: receives the Custom & Themed enquiry (and the
// Contact form) and creates a Lead in Zoho CRM via the direct REST API.
//
// Robustness by design: known fields are mapped to proper Lead fields, AND the
// full raw payload is written into the Lead Description. So if the website form
// gains/renames a field later, the data still lands on the lead (in Description)
// and this function never breaks — you just add an explicit mapping when ready.
//
// Required env (Cloudflare Pages → Settings → Environment variables, and
// .dev.vars for local `wrangler pages dev`):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_ACCOUNTS_DOMAIN  e.g. accounts.zoho.com.au
//   ZOHO_API_DOMAIN       e.g. www.zohoapis.com.au

async function getAccessToken(env) {
  const accountsDomain = env.ZOHO_ACCOUNTS_DOMAIN || 'accounts.zoho.com';
  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`https://${accountsDomain}/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Zoho token error: ${json.error || res.status}`);
  }
  return json.access_token;
}

function buildLead(data) {
  const name = (data.name || '').trim();
  // Zoho requires Last_Name; split a full name sensibly.
  const parts = name.split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : (name || 'Enquiry');
  const firstName = parts.length > 1 ? parts[0] : '';

  // Full payload dumped into Description so nothing is ever lost.
  const dump = Object.entries(data)
    .filter(([k]) => !['_subject'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const lead = {
    Last_Name: lastName,
    Company: data.company || name || 'Hooray HQ enquiry',
    Lead_Source: data.lead_source || 'Website — Custom enquiry',
    Description: dump,
  };
  if (firstName) lead.First_Name = firstName;
  if (data.email) lead.Email = data.email;
  if (data.phone) lead.Phone = data.phone;
  if (data.location) lead.City = data.location;
  // Budget tier → Zoho's standard Annual_Revenue-style field is unsuitable; keep
  // it in Description (above). Map only safe standard fields here.
  return lead;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) {
      throw new Error('Zoho is not configured yet');
    }
    const data = await request.json();
    if (!data || !data.email) throw new Error('Missing email');

    const accessToken = await getAccessToken(env);
    const apiDomain = env.ZOHO_API_DOMAIN || 'www.zohoapis.com';

    const res = await fetch(`https://${apiDomain}/crm/v2/Leads`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [buildLead(data)], trigger: ['workflow'] }),
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && json.data && json.data[0] && json.data[0].code === 'SUCCESS';
    if (!ok) {
      const detail = (json.data && json.data[0] && json.data[0].message) || json.message || res.status;
      throw new Error(`Zoho CRM error: ${detail}`);
    }

    return new Response(JSON.stringify({ ok: true, id: json.data[0].details && json.data[0].details.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
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
