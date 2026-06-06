export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ');

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Google Drive is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Build redirect URI from request origin
    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/gdrive/callback`;

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();

    // Build Google OAuth2 consent URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Redirect to Google OAuth2 consent screen
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        ...CORS,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
