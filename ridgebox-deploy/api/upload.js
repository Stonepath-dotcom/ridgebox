export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('document');
    const botIndex = formData.get('bot_index') || '0';

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];
    const chatId = botIndex === '0'
      ? process.env.TG_CHAT_ID
      : process.env[`TG_BOT_${botIndex}_CHAT_ID`];

    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured on server' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const tgFormData = new FormData();
    tgFormData.append('chat_id', chatId);
    tgFormData.append('document', file);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: tgFormData,
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
