import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const body = await request.json();
    const { customerId, userId } = body;

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Stripe not configured on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // If we have userId but no customerId, look up the customer
    let stripeCustomerId = customerId;
    if (!stripeCustomerId && userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        const resp = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/user_subscriptions?user_id=eq.${userId}&select=stripe_customer_id`,
          {
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        const rows = await resp.json();
        if (rows.length > 0 && rows[0].stripe_customer_id) {
          stripeCustomerId = rows[0].stripe_customer_id;
        }
      } catch (e) {
        console.warn('[Stripe Portal] Customer lookup failed:', e);
      }
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ ok: false, error: 'No Stripe customer ID found. Subscribe first.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Create Customer Portal session
    const params = new URLSearchParams();
    params.append('customer', stripeCustomerId);
    params.append('return_url', `${new URL(request.url).origin}/#/dashboard`);

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (session.error) {
      return new Response(JSON.stringify({ ok: false, error: session.error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      url: session.url,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[Stripe Portal Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
