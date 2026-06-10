import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = ['api.dropboxapi.com', 'content.dropboxapi.com'];
const ALLOWED_API_PREFIXES = ['/2/files/', '/2/users/', '/2/sharing/'];

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
    const body = await request.json();
    const { accessToken, apiHost = 'api.dropboxapi.com', path, body: reqBody } = body;

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Access token is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }
    if (!path) {
      return new Response(JSON.stringify({ ok: false, error: 'API path is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Validate host
    if (!ALLOWED_HOSTS.includes(apiHost)) {
      return new Response(JSON.stringify({ ok: false, error: 'API host not allowed' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    // Validate path
    const isAllowed = ALLOWED_API_PREFIXES.some(prefix => path.startsWith(prefix));
    if (!isAllowed) {
      return new Response(JSON.stringify({ ok: false, error: 'Path not allowed. Must start with: ' + ALLOWED_API_PREFIXES.join(', ') }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const dropboxUrl = `https://${apiHost}${path}`;
    const fetchOptions = {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    };

    if (apiHost === 'content.dropboxapi.com') {
      fetchOptions.headers['Content-Type'] = 'application/octet-stream';
      if (reqBody && reqBody.dropboxApiArg) {
        fetchOptions.headers['Dropbox-API-Arg'] = typeof reqBody.dropboxApiArg === 'string' ? reqBody.dropboxApiArg : JSON.stringify(reqBody.dropboxApiArg);
      }
      if (reqBody && reqBody.rawBody) {
        fetchOptions.body = reqBody.rawBody;
      }
    } else {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(reqBody || {});
    }

    const response = await fetch(dropboxUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    return new Response(JSON.stringify({ ok: response.ok, status: response.status, data }), {
      status: response.status, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    console.error('[Dropbox Proxy Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
