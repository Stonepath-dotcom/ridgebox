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
    const filePath = parentPath ? `${parentPath}/${fileName}` : `/${fileName}`;
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(filePath)}:/content`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: result.error?.message || 'Upload failed',
        details: result,
      }), { status: response.status, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS } });
    }

    return new Response(JSON.stringify({
      ok: true,
      driveFileId: result.id,
      driveFileName: result.name,
    }), { headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS } });
  } catch (error) {
    console.error('[OneDrive Upload Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
