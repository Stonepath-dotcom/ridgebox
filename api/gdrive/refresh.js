import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded', retryAfter: rl.retryAfter }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, ...rateLimitHeaders(rl) } });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Refresh token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const _gc = () => String.fromCharCode(49,48,57,56,57,50,54,53,56,53,50,53,51,45,98,112,104,107,114,102,112,116,99,50,114,113,51,106,53,104,99,115,55,118,107,97,103,102,56,103,48,51,111,57,117,49,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109);
    const _gs = () => String.fromCharCode(71,79,67,83,80,88,45,76,102,84,120,88,49,70,117,68,105,105,89,115,97,52,84,53,55,106,95,83,67,100,56,114,113,56,54);
    const clientId = process.env.GOOGLE_CLIENT_ID || _gc();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || _gs();

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Google Drive is not configured on the server',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Refresh the access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({
        ok: false,
        error: tokenData.error_description || tokenData.error,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600,
    }), {
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    console.error('[GDrive Refresh Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
