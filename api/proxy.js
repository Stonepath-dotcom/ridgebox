import { checkRateLimit, rateLimitHeaders } from './_rateLimit.js';
import { getCORSHeaders } from './_cors.js';

export const config = { runtime: 'edge' };

// Allowed Telegram API methods for security
const ALLOWED_METHODS = [
  'deleteMessage',
  'getFileInfo',
  'getFile',
  'sendMessage',
];

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
    const url = new URL(request.url);
    const method = url.searchParams.get('method');

    if (!method || !ALLOWED_METHODS.includes(method)) {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Get bot token from environment
    const botIndex = url.searchParams.get('bot_index') || '0';
    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Build Telegram API URL with all query params except our internal ones
    const tgParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (!['method', 'bot_index'].includes(key)) {
        tgParams.append(key, value);
      }
    }

    const tgUrl = `https://api.telegram.org/bot${token}/${method}?${tgParams.toString()}`;

    const response = await fetch(tgUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
