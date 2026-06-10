import { getCORSHeaders } from '../_cors.js';
export const config = { runtime: 'edge' };
export default async function (request) {
  const CORS = getCORSHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  try {
    const { query, files } = await request.json();
    if (!query || !files || !Array.isArray(files)) return new Response(JSON.stringify({ ok: false, error: 'Missing query or files' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    const fileList = files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type, folder: f.folder, uploadedAt: f.uploadedAt, tags: f.tags, category: f.category }));
    const apiKey = process.env.ZAI_API_KEY || '';
    if (!apiKey) return new Response(JSON.stringify({ ok: false, error: 'AI API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'glm-4-flash', messages: [
        { role: 'system', content: 'You are a file search assistant. Given a natural language query and file metadata, return matching file IDs. Return JSON: {"fileIds":[...],"explanation":"brief explanation"}. Only valid JSON.' },
        { role: 'user', content: `Query: "${query}"\n\nFiles:\n${JSON.stringify(fileList, null, 2)}` }
      ]})
    });
    const data = await resp.json();
    let parsed;
    try { const c = data.choices?.[0]?.message?.content || ''; const m = c.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { fileIds: [], explanation: c }; } catch { parsed = { fileIds: [], explanation: 'Parse error' }; }
    return new Response(JSON.stringify({ ok: true, fileIds: parsed.fileIds || [], explanation: parsed.explanation || '' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
