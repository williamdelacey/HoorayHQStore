export async function onRequestPost(context) {
  const { request, env } = context;
  let email = '';
  try {
    const data = await request.json();
    email = (data.email || '').trim();
  } catch {
    email = '';
  }

  if (!email || !email.includes('@')) {
    return jsonResponse({ ok: false, error: 'Invalid email' }, 400);
  }

  const webhookUrl = env.Zoho_trigger_signup;
  if (webhookUrl) {
    const signedUpAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, signed_up_at: signedUpAt }),
      });
    } catch (e) {
      console.error('Zoho webhook failed:', e);
    }
  }

  return jsonResponse({ ok: true }, 200);
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

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
