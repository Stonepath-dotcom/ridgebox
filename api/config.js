import { checkRateLimit, rateLimitHeaders } from './_rateLimit.js';
import { getCORSHeaders } from './_cors.js';

export const config = { runtime: 'edge' };

// F76: Mask bot tokens before sending to client
function maskToken(token) {
  if (!token || token.length <= 5) return '***';
  return token.substring(0, 5) + '***';
}

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
    // Collect all bot configs
    const bots = [];
    let i = 0;

    // Default bot
    const defaultToken = process.env.TG_BOT_TOKEN;
    const defaultChatId = process.env.TG_CHAT_ID;
    if (defaultToken && defaultChatId) {
      bots.push({
        index: '0',
        name: process.env.TG_BOT_NAME || 'Primary Bot',
        token: defaultToken, // Full token for proxy mode, client masks it
        chatId: defaultChatId,
      });
    }

    // Additional bots
    while (true) {
      i++;
      const token = process.env[`TG_BOT_${i}_TOKEN`];
      const chatId = process.env[`TG_BOT_${i}_CHAT_ID`];
      if (!token || !chatId) break;
      bots.push({
        index: String(i),
        name: process.env[`TG_BOT_${i}_NAME`] || `Bot ${i + 1}`,
        token,
        chatId,
      });
    }

    // F76: Return masked tokens by default, full tokens only in proxy mode
    const url = new URL(request.url);
    const proxyMode = url.searchParams.get('proxy') !== 'false';

    const safeBots = bots.map(b => ({
      ...b,
      token: proxyMode ? maskToken(b.token) : b.token,
      masked: proxyMode,
    }));

    // Supabase Auth config - only use env vars, no hardcoded fallbacks
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

    const responseBody = {
      ok: true,
      bots: safeBots,
      proxyMode,
      supabaseConfigured,
      ...(supabaseConfigured ? { supabaseUrl, supabaseAnonKey } : {}),
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
