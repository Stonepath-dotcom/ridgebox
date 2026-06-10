import { getCORSHeaders } from '../_cors.js';
export const config = { runtime: 'edge' };
export default async function (request) {
  const CORS = getCORSHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  try {
    const { fileName, fileType, fileSize } = await request.json();
    if (!fileName) return new Response(JSON.stringify({ ok: false, error: 'Missing fileName' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    const apiKey = process.env.ZAI_API_KEY || '';
    if (!apiKey) return new Response(JSON.stringify({ ok: false, error: 'AI API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'glm-4-flash', messages: [
        { role: 'system', content: 'You are a file organization assistant. Given file info, suggest: category (one of: Documents, Images, Videos, Music, Archives, Code, Spreadsheets, Presentations, Other), tags (3-5 tags array), suggestedFolder (name). Return JSON only.' },
        { role: 'user', content: JSON.stringify({ fileName, fileType, fileSize }) }
      ]})
    });
    const data = await resp.json();
    let parsed;
    try { const c = data.choices?.[0]?.message?.content || ''; const m = c.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { category: 'Other', tags: [], suggestedFolder: 'Uncategorized' }; } catch { parsed = { category: 'Other', tags: [], suggestedFolder: 'Uncategorized' }; }
    return new Response(JSON.stringify({ ok: true, ...parsed }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
