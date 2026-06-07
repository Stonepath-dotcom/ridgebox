export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// F76: Mask bot tokens before sending to client
function maskToken(token) {
  if (!token || token.length <= 5) return '***';
  return token.substring(0, 5) + '***';
}

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
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

    // Supabase Auth config (safe to expose - anon key is public)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://tztpwbasrajvkjbrvwfu.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6dHB3YmFzcmFqdmtqYnJ2d2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzQ1OTMsImV4cCI6MjA5NjM1MDU5M30.3O4-5PbSlRC8cro8hbbIgkxdnUOIXmWHa2mA5NVnhxc';

    return new Response(JSON.stringify({ ok: true, bots: safeBots, proxyMode, supabaseUrl, supabaseAnonKey }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
