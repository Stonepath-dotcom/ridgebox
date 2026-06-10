import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded' }), {
      status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, ...rateLimitHeaders(rl) } });
  }

  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const clientSecret = url.searchParams.get('clientSecret');

    if (!clientId) {
      return new Response(JSON.stringify({ ok: false, error: 'Client ID is required. Configure it in Settings.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const origin = url.origin;
    const redirectUri = `${origin}/api/dropbox/callback`;
    const state = Buffer.from(JSON.stringify({ clientId, clientSecret: clientSecret || '', ts: Date.now() })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      state,
    });

    const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

    return new Response(null, {
      status: 302,
      headers: { Location: authUrl, ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
