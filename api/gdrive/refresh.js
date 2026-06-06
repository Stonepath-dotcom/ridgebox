export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Refresh token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Google Drive is not configured on the server',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
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
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[GDrive Refresh Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
