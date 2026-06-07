import { checkRateLimit, rateLimitHeaders } from './_rateLimit.js';
import { getCORSHeaders } from './_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded', retryAfter: rl.retryAfter }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, ...rateLimitHeaders(rl) } });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    let filePath = searchParams.get('path');
    const fileId = searchParams.get('file_id');
    const botIndex = searchParams.get('bot_index') || '0';
    const fileName = searchParams.get('name') || '';

    const token = botIndex === '0'
      ? process.env.TG_BOT_TOKEN
      : process.env[`TG_BOT_${botIndex}_TOKEN`];

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // If filePath is empty but file_id is provided, resolve it via getFile API
    if (!filePath && fileId) {
      const getFileResp = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
      );
      const getFileData = await getFileResp.json();
      if (getFileData.ok && getFileData.result && getFileData.result.file_path) {
        filePath = getFileData.result.file_path;
      } else {
        return new Response(JSON.stringify({ ok: false, error: 'Could not resolve file_path from file_id', details: getFileData }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
        });
      }
    }

    if (!filePath) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing path or file_id parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const tgUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const response = await fetch(tgUrl);

    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Telegram download failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Stream the file through with Content-Disposition for proper phone storage saving
    const headers = new Headers({ ...CORS, ...rateLimitHeaders(rl) });
    const contentType = response.headers.get('Content-Type');
    const contentLength = response.headers.get('Content-Length');
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);

    // Determine filename: use provided name, or extract from filePath
    let downloadName = fileName;
    if (!downloadName && filePath) {
      // Extract filename from path like "photos/file_123.jpg"
      const parts = filePath.split('/');
      downloadName = parts[parts.length - 1] || 'download';
    }
    if (!downloadName) downloadName = 'download';

    // Content-Disposition: attachment forces browser to SAVE the file to phone storage
    // instead of opening/playing it in the browser
    headers.set('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '\\"')}"`);

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
