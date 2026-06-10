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
    const { fileUrl } = body;

    if (!fileUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fileUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const zai = await ZAI.create();
    const result = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content: 'Extract all text from this image/document. Return the extracted text preserving the layout as much as possible. Return JSON: {"text": "extracted text here", "confidence": "high/medium/low"}. If no text is found, return {"text": "", "confidence": "none"}. Only return valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: fileUrl }
            }
          ]
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
        parsed = { text: content, confidence: 'medium' };
      }
    } catch (e) {
      parsed = { text: '', confidence: 'none' };
    }

    return new Response(JSON.stringify({
      ok: true,
      text: parsed.text || '',
      confidence: parsed.confidence || 'medium'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[AI OCR Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
