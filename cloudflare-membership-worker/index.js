// Membership Worker — Cloudflare Workers + D1 + Resend
//
// Endpoints:
//   POST /subscribe       — Public: submit a membership request
//   GET  /approve?token=  — Admin link: approve a pending member
//   GET  /reject?token=   — Admin link: reject a pending member
//   POST /newsletter      — Requires X-Newsletter-Secret header: send to approved members
//
// Required environment variables (set in Cloudflare dashboard):
//   RESEND_API_KEY       (encrypted) Resend API key
//   ADMIN_EMAIL          (plain)     Where admin notifications go
//   FROM_EMAIL           (plain)     Sender address — use "onboarding@resend.dev" for sandbox
//   SITE_URL             (plain)     Your site origin for CORS, e.g. https://anand-raj.github.io
//   WORKER_URL           (plain)     This worker's URL, e.g. https://cms-membership.xxx.workers.dev
//   NEWSLETTER_SECRET    (encrypted) Secret header value for /newsletter
//
// D1 database binding: DB

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Timing-safe string comparison via HMAC */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode('cmp'),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const [ha, hb] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(String(a))),
    crypto.subtle.sign('HMAC', key, enc.encode(String(b))),
  ]);
  const ua = new Uint8Array(ha);
  const ub = new Uint8Array(hb);
  if (ua.length !== ub.length) return false;
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.SITE_URL,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonOk(data, env) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function jsonErr(message, status, env) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function htmlPage(title, body) {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; border-radius: 8px; padding: 2.5rem 2rem;
            max-width: 420px; width: 90%; text-align: center;
            box-shadow: 0 2px 12px rgba(0,0,0,.1); }
    h1 { margin: 0 0 1rem; font-size: 1.4rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
  );
}

async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error(`Resend error ${res.status}:`, await res.text());
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonErr('Invalid request body.', 400, env);
  }

  const name     = String(body.name    || '').trim().slice(0, 100);
  const email    = String(body.email   || '').trim().toLowerCase().slice(0, 254);
  const honeypot = String(body.website || '').trim();

  // Silently accept bots without saving
  if (honeypot) return jsonOk({ ok: true }, env);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !email || !emailRegex.test(email)) {
    return jsonErr('Name and a valid email are required.', 400, env);
  }

  const token     = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO members (name, email, status, token, created_at)
       VALUES (?, ?, 'pending', ?, ?)`
    ).bind(name, email, token, createdAt).run();
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return jsonErr('This email is already registered.', 409, env);
    }
    console.error('DB insert error:', e);
    return jsonErr('Could not save your request. Please try again.', 500, env);
  }

  const approveUrl = `${env.WORKER_URL}/approve?token=${token}`;
  const rejectUrl  = `${env.WORKER_URL}/reject?token=${token}`;

  await sendEmail(env, {
    to: env.ADMIN_EMAIL,
    subject: `New membership request from ${name}`,
    html: `
      <p><strong>${name}</strong> (<a href="mailto:${email}">${email}</a>) has requested membership.</p>
      <p style="margin-top:1.5rem">
        <a href="${approveUrl}"
           style="background:#16a34a;color:#fff;padding:10px 22px;border-radius:5px;
                  text-decoration:none;margin-right:12px;display:inline-block;font-weight:600">
          ✓ Approve
        </a>
        <a href="${rejectUrl}"
           style="background:#dc2626;color:#fff;padding:10px 22px;border-radius:5px;
                  text-decoration:none;display:inline-block;font-weight:600">
          ✗ Reject
        </a>
      </p>
      <p style="color:#999;font-size:.8rem">Submitted: ${createdAt}</p>
    `,
  });

  return jsonOk({ ok: true }, env);
}

async function handleApprove(url, env) {
  const token = url.searchParams.get('token') || '';
  if (!token) return htmlPage('Invalid Link', '<p>This approval link is not valid.</p>');

  const row = await env.DB.prepare(
    `SELECT id, name, email, status FROM members WHERE token = ?`
  ).bind(token).first();

  if (!row) return htmlPage('Not Found', '<p>This link has expired or is invalid.</p>');
  if (row.status === 'approved') {
    return htmlPage('Already Approved', `<p><strong>${row.name}</strong> is already a member.</p>`);
  }

  await env.DB.prepare(
    `UPDATE members SET status = 'approved', approved_at = ? WHERE token = ?`
  ).bind(new Date().toISOString(), token).run();

  await sendEmail(env, {
    to: row.email,
    subject: 'Your membership has been approved!',
    html: `
      <p>Hi <strong>${row.name}</strong>,</p>
      <p>Your membership request has been approved. Welcome aboard!</p>
      <p>You will now receive newsletters and updates from us.</p>
    `,
  });

  return htmlPage(
    'Approved ✓',
    `<p><strong>${row.name}</strong> has been approved and notified by email.</p>`
  );
}

async function handleReject(url, env) {
  const token = url.searchParams.get('token') || '';
  if (!token) return htmlPage('Invalid Link', '<p>This link is not valid.</p>');

  const row = await env.DB.prepare(
    `SELECT id, name, status FROM members WHERE token = ?`
  ).bind(token).first();

  if (!row) return htmlPage('Not Found', '<p>This link has expired or is invalid.</p>');
  if (row.status === 'rejected') {
    return htmlPage('Already Rejected', `<p><strong>${row.name}</strong> has already been rejected.</p>`);
  }

  await env.DB.prepare(
    `UPDATE members SET status = 'rejected' WHERE token = ?`
  ).bind(token).run();

  return htmlPage(
    'Rejected',
    `<p>Membership request from <strong>${row.name}</strong> has been rejected.</p>`
  );
}

async function handleNewsletter(request, env) {
  const secret = request.headers.get('X-Newsletter-Secret') || '';
  if (!await safeEqual(secret, env.NEWSLETTER_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { subject, html } = body;
  if (!subject || !html) {
    return new Response(
      JSON.stringify({ error: 'subject and html are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { results } = await env.DB.prepare(
    `SELECT name, email FROM members WHERE status = 'approved'`
  ).all();

  if (!results.length) {
    return new Response(
      JSON.stringify({ sent: 0, total: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Resend batch API — max 100 per call
  const BATCH = 100;
  let sent = 0;

  for (let i = 0; i < results.length; i += BATCH) {
    const emails = results.slice(i, i + BATCH).map(m => ({
      from: env.FROM_EMAIL,
      to: m.email,
      subject,
      html: html.replace(/\{\{name\}\}/g, m.name),
    }));

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    });

    if (res.ok) {
      sent += emails.length;
    } else {
      console.error(`Resend batch error ${res.status}:`, await res.text());
    }
  }

  return new Response(
    JSON.stringify({ sent, total: results.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    switch (`${request.method} ${url.pathname}`) {
      case 'POST /subscribe':  return handleSubscribe(request, env);
      case 'GET /approve':     return handleApprove(url, env);
      case 'GET /reject':      return handleReject(url, env);
      case 'POST /newsletter': return handleNewsletter(request, env);
      default:                 return new Response('Not found', { status: 404 });
    }
  },
};
