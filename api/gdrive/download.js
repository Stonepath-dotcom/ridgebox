import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

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
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use GET.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const url = new URL(request.url);
    const accessToken = url.searchParams.get('accessToken');
    const fileId = url.searchParams.get('fileId');

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Access token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    if (!fileId) {
      return new Response(JSON.stringify({ ok: false, error: 'File ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // First, get file metadata to retrieve the filename and MIME type
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaResponse.ok) {
      const metaError = await metaResponse.json();
      return new Response(JSON.stringify({
        ok: false,
        error: metaError.error?.message || 'Failed to get file metadata',
      }), {
        status: metaResponse.status,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const metadata = await metaResponse.json();

    // Download the file content
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const downloadResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadResponse.ok) {
      const dlError = await downloadResponse.json();
      return new Response(JSON.stringify({
        ok: false,
        error: dlError.error?.message || 'Failed to download file',
      }), {
        status: downloadResponse.status,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Build response headers for file download
    const responseHeaders = {
      'Content-Type': metadata.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${(metadata.name || fileId).replace(/"/g, '\\"')}"`,
      ...rateLimitHeaders(rl),
      ...CORS,
    };

    if (metadata.size) {
      responseHeaders['Content-Length'] = metadata.size;
    }

    // Stream the response back
    return new Response(downloadResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[GDrive Download Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
