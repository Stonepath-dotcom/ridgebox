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
    const bots = [];
    let i = 0;

    // Default bot
    if (process.env.TG_BOT_TOKEN) {
      bots.push({
        index: '0',
        name: process.env.TG_BOT_NAME || 'Primary Bot',
        configured: true,
      });
    }

    // Additional bots
    while (true) {
      i++;
      const token = process.env[`TG_BOT_${i}_TOKEN`];
      if (!token) break;
      bots.push({
        index: String(i),
        name: process.env[`TG_BOT_${i}_NAME`] || `Bot ${i + 1}`,
        configured: true,
      });
    }

    if (bots.length === 0) {
      bots.push({ index: '0', name: 'No bot configured', configured: false });
    }

    return new Response(JSON.stringify({ ok: true, bots }), {
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
