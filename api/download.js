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

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const botIndex = searchParams.get('bot_index') || '0';

    if (!filePath) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing path parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const tgUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const response = await fetch(tgUrl);

    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Telegram download failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Stream the file through
    const headers = new Headers(CORS);
    const contentType = response.headers.get('Content-Type');
    const contentLength = response.headers.get('Content-Length');
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
