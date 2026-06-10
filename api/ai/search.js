import ZAI from 'z-ai-web-dev-sdk';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);

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
    const body = await request.json();
    const { query, files } = body;

    if (!query || !files || !Array.isArray(files)) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing query or files' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Build a concise file listing for the AI
    const fileList = files.map((f, i) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      folder: f.folder,
      uploadedAt: f.uploadedAt,
      tags: f.tags,
      category: f.category,
    }));

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a file search assistant. Given a natural language query and a list of file metadata, return the IDs of files that match the query. Consider file names, types, sizes, dates, folders, tags, and categories when matching. Be generous in matching — if the query could reasonably refer to a file, include it. Return JSON: {"fileIds": [...], "explanation": "brief explanation of why these files matched"}. Only return valid JSON, no markdown.`
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nFiles:\n${JSON.stringify(fileList, null, 2)}`
        }
      ]
    });

    let parsed;
    try {
      const content = result.choices?.[0]?.message?.content || '';
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { fileIds: [], explanation: content };
      }
    } catch (e) {
      parsed = { fileIds: [], explanation: 'Could not parse AI response' };
    }

    return new Response(JSON.stringify({
      ok: true,
      fileIds: parsed.fileIds || [],
      explanation: parsed.explanation || ''
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[AI Search Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
