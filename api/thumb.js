import { checkRateLimit, rateLimitHeaders } from './_rateLimit.js';
import { getCORSHeaders } from './_cors.js';

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

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file_id');
    const botIndex = searchParams.get('bot_index') || '0';

    if (!fileId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing file_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Get file path first
    const infoRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );
    const infoData = await infoRes.json();

    if (!infoData.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const filePath = infoData.result.file_path;
    const tgUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const imgRes = await fetch(tgUrl);
    if (!imgRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Download failed' }), {
        status: imgRes.status,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const headers = new Headers({ ...CORS, ...rateLimitHeaders(rl) });
    const ct = imgRes.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(imgRes.body, { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
