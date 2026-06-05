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
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
