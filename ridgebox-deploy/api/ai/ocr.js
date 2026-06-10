import { getCORSHeaders } from '../_cors.js';
export const config = { runtime: 'edge' };
export default async function (request) {
  const CORS = getCORSHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  try {
    const { fileUrl } = await request.json();
    if (!fileUrl) return new Response(JSON.stringify({ ok: false, error: 'Missing fileUrl' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    const apiKey = process.env.ZAI_API_KEY || '';
    if (!apiKey) return new Response(JSON.stringify({ ok: false, error: 'AI API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'glm-4v-flash', messages: [
        { role: 'user', content: [
          { type: 'text', text: 'Extract all text from this image. Return JSON: {"text":"extracted text","confidence":"high/medium/low"}' },
          { type: 'image_url', image_url: { url: fileUrl } }
        ]}
      ]})
    });
    const data = await resp.json();
    let parsed;
    try { const c = data.choices?.[0]?.message?.content || ''; const m = c.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { text: c, confidence: 'medium' }; } catch { parsed = { text: data.choices?.[0]?.message?.content || '', confidence: 'low' }; }
    return new Response(JSON.stringify({ ok: true, ...parsed }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
