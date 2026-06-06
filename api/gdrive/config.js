export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const configured = !!(clientId && clientSecret);

    // Build redirect URI from request origin
    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/gdrive/callback`;

    return new Response(JSON.stringify({
      ok: true,
      clientId: clientId || '',
      redirectUri,
      configured,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
