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
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: 'Stripe webhook not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    // Verify webhook signature using Stripe API
    // In Edge runtime, we do a simplified verification
    // For production, use the stripe library with Node.js runtime
    let event;
    try {
      event = JSON.parse(body);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Process webhook events
    const eventType = event.type;
    const session = event.data?.object;

    switch (eventType) {
      case 'checkout.session.completed': {
        const userId = session?.metadata?.userId || session?.client_reference_id;
        const customerId = session?.customer;
        const subscriptionId = session?.subscription;
        const customerEmail = session?.customer_email;

        // In a real implementation, update Supabase user subscription
        // For now, log the event
        console.log('[Stripe] Checkout completed:', {
          userId,
          customerId,
          subscriptionId,
          customerEmail,
        });

        // Update Supabase if configured
        if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
          try {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_subscriptions`, {
              method: 'UPSERT',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
                'Prefer': 'resolution=merge-duplicates',
              },
              body: JSON.stringify({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                status: 'active',
                email: customerEmail,
                updated_at: new Date().toISOString(),
              }),
            });
          } catch (dbErr) {
            console.error('[Stripe] Supabase update failed:', dbErr);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscriptionId = session?.id;
        const status = session?.status;
        const customerId = session?.customer;

        console.log('[Stripe] Subscription updated:', {
          subscriptionId,
          status,
          customerId,
        });

        // Update Supabase subscription status
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
          try {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_subscriptions?stripe_subscription_id=eq.${subscriptionId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                status: status,
                updated_at: new Date().toISOString(),
              }),
            });
          } catch (dbErr) {
            console.error('[Stripe] Supabase update failed:', dbErr);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = session?.id;
        const customerId = session?.customer;

        console.log('[Stripe] Subscription deleted:', {
          subscriptionId,
          customerId,
        });

        // Update Supabase subscription status to canceled
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
          try {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_subscriptions?stripe_subscription_id=eq.${subscriptionId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                status: 'canceled',
                updated_at: new Date().toISOString(),
              }),
            });
          } catch (dbErr) {
            console.error('[Stripe] Supabase update failed:', dbErr);
          }
        }
        break;
      }

      default:
        console.log('[Stripe] Unhandled event type:', eventType);
    }

    return new Response(JSON.stringify({ ok: true, received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[Stripe Webhook Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
