import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

const ALLOWED_PREFIXES = ['/v1.0/me/', '/v1.0/drives/', '/beta/me/'];

function isPathAllowed(path) {
  return ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix));
}

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
    const { accessToken, method = 'GET', path, body: reqBody, params } = body;

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

    if (!isPathAllowed(path)) {
      return new Response(JSON.stringify({ ok: false, error: 'Path not allowed. Must start with: ' + ALLOWED_PREFIXES.join(', ') }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    let msUrl = `https://graph.microsoft.com${path}`;
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      }
      const paramStr = searchParams.toString();
      if (paramStr) msUrl += (msUrl.includes('?') ? '&' : '?') + paramStr;
    }

    const fetchOptions = { method: method.toUpperCase(), headers: { Authorization: `Bearer ${accessToken}` } };
    if (reqBody && !['GET', 'HEAD'].includes(fetchOptions.method)) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(reqBody);
    }

    const response = await fetch(msUrl, fetchOptions);
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
    console.error('[OneDrive Proxy Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
