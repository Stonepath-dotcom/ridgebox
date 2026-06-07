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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const body = await request.json();
    const { url, filename, bot_index } = body;
    const botIndex = bot_index || '0';

    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'URL tidak boleh kosong' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Validate URL format
    try { new URL(url); } catch { 
      return new Response(JSON.stringify({ ok: false, error: 'Format URL tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];
    const chatId = botIndex === '0'
      ? process.env.TG_CHAT_ID
      : process.env[`TG_BOT_${botIndex}_CHAT_ID`];

    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot belum dikonfigurasi di server' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Download file from URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let fileResponse;
    try {
      fileResponse = await fetch(url, { signal: controller.signal });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      return new Response(JSON.stringify({ ok: false, error: 'Gagal mengunduh dari URL: ' + (fetchErr.message || 'timeout') }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }
    clearTimeout(timeoutId);

    if (!fileResponse.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Gagal mengunduh (HTTP ${fileResponse.status}). Pastikan URL mengarah ke file yang bisa diunduh.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Check content length (max 50MB for URL uploads)
    const contentLength = parseInt(fileResponse.headers.get('Content-Length') || '0');
    if (contentLength > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ ok: false, error: `File terlalu besar (${Math.round(contentLength/1024/1024)} MB). Maksimal 50 MB untuk URL upload.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const blob = await fileResponse.blob();
    const name = filename || url.split('/').pop()?.split('?')[0] || 'download';
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });

    // Upload to Telegram
    const tgFormData = new FormData();
    tgFormData.append('chat_id', chatId);
    tgFormData.append('document', file);

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: tgFormData,
    });

    const data = await tgResponse.json();

    if (!data.ok) {
      return new Response(JSON.stringify({ ok: false, error: data.description || 'Telegram API menolak upload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    console.error('[URL Upload API Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
