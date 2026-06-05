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
        token: defaultToken,
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

    return new Response(JSON.stringify({ ok: true, bots }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
