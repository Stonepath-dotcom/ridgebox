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
    const formData = await request.formData();
    const file = formData.get('document');
    let botIndex = formData.get('bot_index') || '0';
    let chatId = formData.get('chat_id') || '';

    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];
    
    // F76/F79: If chat_id is provided via form (proxy mode), use it; otherwise use env var
    if (!chatId) {
      chatId = botIndex === '0'
        ? process.env.TG_CHAT_ID
        : process.env[`TG_BOT_${botIndex}_CHAT_ID`];
    }

    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured on server' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Determine the best API method based on file type
    const fileName = file.name || 'file';
    const fileType = file.type || 'application/octet-stream';
    let apiMethod = 'sendDocument'; // default for all files

    const tgFormData = new FormData();
    tgFormData.append('chat_id', chatId);

    // Use appropriate Telegram API method based on file type
    if (fileType.startsWith('image/') && file.size < 10 * 1024 * 1024) {
      apiMethod = 'sendPhoto';
      tgFormData.append('photo', file);
    } else if (fileType.startsWith('video/') && file.size < 50 * 1024 * 1024) {
      apiMethod = 'sendVideo';
      tgFormData.append('video', file);
    } else if (fileType.startsWith('audio/') && file.size < 50 * 1024 * 1024) {
      apiMethod = 'sendAudio';
      tgFormData.append('audio', file);
    } else {
      tgFormData.append('document', file);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${apiMethod}`, {
      method: 'POST',
      body: tgFormData,
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    console.error('[Upload API Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
