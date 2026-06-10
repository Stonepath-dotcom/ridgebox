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
    const { fileName, fileType, fileSize } = body;

    if (!fileName) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fileName' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a file organization assistant. Given file info, suggest: category (one of: Documents, Images, Videos, Music, Archives, Code, Spreadsheets, Presentations, Other), tags (3-5 relevant tags as an array of strings), suggestedFolder (name for a logical folder). Return JSON only: {"category": "...", "tags": ["..."], "suggestedFolder": "..."}. No markdown.`
        },
        {
          role: 'user',
          content: `FileName: "${fileName}"\nFileType: "${fileType || 'unknown'}"\nFileSize: ${fileSize || 0} bytes`
        }
      ]
    });

    let parsed;
    try {
      const content = result.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { category: 'Other', tags: [], suggestedFolder: 'Uncategorized' };
      }
    } catch (e) {
      parsed = { category: 'Other', tags: [], suggestedFolder: 'Uncategorized' };
    }

    // Validate category
    const validCategories = ['Documents', 'Images', 'Videos', 'Music', 'Archives', 'Code', 'Spreadsheets', 'Presentations', 'Other'];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'Other';
    }
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = [];
    }
    if (!parsed.suggestedFolder) {
      parsed.suggestedFolder = parsed.category;
    }

    return new Response(JSON.stringify({
      ok: true,
      category: parsed.category,
      tags: parsed.tags,
      suggestedFolder: parsed.suggestedFolder
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[AI Categorize Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
