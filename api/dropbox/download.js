import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

export default async function (request) {
  const CORS = getCORSHeaders(request);
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded' }), {
      status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, ...rateLimitHeaders(rl) } });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use GET.' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const url = new URL(request.url);
    const accessToken = url.searchParams.get('accessToken');
    const filePath = url.searchParams.get('path');

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Access token is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }
    if (!filePath) {
      return new Response(JSON.stringify({ ok: false, error: 'File path is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Get file metadata first
    const metaResponse = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    let fileName = filePath.split('/').pop() || 'download';
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      fileName = metaData.name || fileName;
    }

    // Download the file content
    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
      },
    });

    if (!downloadResponse.ok) {
      let errMsg = 'Download failed';
      try {
        const errData = await downloadResponse.json();
        errMsg = errData.error?.summary || errData.error_summary || errMsg;
      } catch {}
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: downloadResponse.status, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const responseHeaders = {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '\\"')}"`,
      ...rateLimitHeaders(rl), ...CORS,
    };

    return new Response(downloadResponse.body, { status: 200, headers: responseHeaders });
  } catch (error) {
    console.error('[Dropbox Download Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
