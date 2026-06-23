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

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
// Convert the site's "d M Y" (flatpickr) date, e.g. "23 Jun 2026", to ISO for Zoho Date fields.
function toIsoDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return '';
  const mon = MONTHS[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
  if (!mon) return '';
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

function buildLead(data) {
  const name = (data.name || '').trim();
  // Zoho requires Last_Name; split a full name sensibly.
  const parts = name.split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : (name || 'Enquiry');
  const firstName = parts.length > 1 ? parts[0] : '';

  // Full payload dumped into Description so nothing is ever lost, even if a
  // field below isn't mapped or a picklist value doesn't match.
  const dump = Object.entries(data)
    .filter(([k]) => !['_subject'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const lead = {
    Last_Name: lastName,
    Company: data.company || name || 'Hooray HQ enquiry',
    Description: dump,
  };
  if (firstName) lead.First_Name = firstName;
  if (data.email) lead.Email = data.email;
  if (data.phone) lead.Phone = data.phone;
  if (data.location) lead.City = data.location;            // Address - City

  // Custom Enquiries fields (only set when present, so the Contact form's
  // shorter payload doesn't push empty values into picklists).
  const eventIso = toIsoDate(data.event_date);
  if (eventIso) lead.Event_Date = eventIso;
  if (data.event_time) lead.Event_Time = data.event_time;
  if (data.budget) lead.Budget_Range = data.budget;        // picklist — must match Zoho options
  if (data.referral) lead.How_Did_You_Hear = data.referral; // picklist — must match Zoho options
  const message = data.message || data.notes;
  if (message) lead.Message_Details = message;

  // NOTE: Lead_Source ("Enquiries Source") is intentionally not set — it's a
  // restricted picklist and the form-type values ("Website — Custom enquiry")
  // aren't default options, so writing them would reject the record. The form
  // type is preserved in Description. Add those picklist options in Zoho and we
  // can map data.lead_source → Lead_Source.
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
