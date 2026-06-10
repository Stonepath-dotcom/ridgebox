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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const formData = await request.formData();
    const accessToken = formData.get('accessToken');
    const file = formData.get('file');
    const parentPath = formData.get('parentPath') || '';

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Access token is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const fileName = file.name || 'unnamed_file';
    const dropboxPath = parentPath ? `${parentPath}/${fileName}` : `/${fileName}`;

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true, mute: false }),
      },
      body: file,
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: result.error?.summary || result.error_summary || 'Upload failed',
        details: result,
      }), { status: response.status, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS } });
    }

    return new Response(JSON.stringify({
      ok: true,
      driveFileId: result.id,
      driveFileName: result.name,
      pathDisplay: result.path_display,
    }), { headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS } });
  } catch (error) {
    console.error('[Dropbox Upload Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
