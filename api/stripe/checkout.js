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
    const { priceId, userId, email } = body;

    if (!priceId) {
      return new Response(JSON.stringify({ ok: false, error: 'priceId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Stripe not configured on server. Set STRIPE_SECRET_KEY env var.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Create checkout session using Stripe API directly via fetch
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('price', priceId);
    params.append('payment_method_types[0]', 'card');
    params.append('success_url', `${new URL(request.url).origin}/#/dashboard?checkout=success`);
    params.append('cancel_url', `${new URL(request.url).origin}/#/dashboard?checkout=cancel`);

    if (email) {
      params.append('customer_email', email);
    }

    // Add metadata for user tracking
    if (userId) {
      params.append('metadata[userId]', userId);
    }

    params.append('subscription_data[metadata][userId]', userId || '');
    params.append('allow_promotion_codes', 'true');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
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
      sessionId: session.id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
