import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

// AWS Signature V4 signing using Web Crypto API
async function sha256(data) {
  const encoded = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, data) {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return sig;
}

async function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

async function signRequest(method, url, headers, body, accessKeyId, secretAccessKey, region) {
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dateStamp = amzDate.slice(0, 8);

  const urlObj = new URL(url);
  const canonicalUri = urlObj.pathname;
  const canonicalQuerystring = urlObj.searchParams.toString();
  const payloadHash = await sha256(body || '');

  const signedHeadersList = ['host', 'x-amz-content-sha256', 'x-amz-date'];
  const host = urlObj.host;

  headers.set('host', host);
  headers.set('x-amz-content-sha256', payloadHash);
  headers.set('x-amz-date', amzDate);

  const canonicalHeaders = signedHeadersList.map(h => h + ':' + headers.get(h)?.trim()).join('\n') + '\n';
  const signedHeaders = signedHeadersList.join(';');

  const canonicalRequest = [
    method, canonicalUri, canonicalQuerystring,
    canonicalHeaders, signedHeaders, payloadHash
  ].join('\n');

  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256(canonicalRequest)].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const sigKey = await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', sigKey, new TextEncoder().encode(stringToSign));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  headers.set('Authorization', 'AWS4-HMAC-SHA256 Credential=' + accessKeyId + '/' + credentialScope +
    ', SignedHeaders=' + signedHeaders + ', Signature=' + signatureHex);

  return headers;
}

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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    const { endpoint, accessKeyId, secretAccessKey, bucket, region, method: s3Method, path: s3Path, body: reqBody, contentType } = await request.json();

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !region) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing required S3 configuration' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const method = s3Method || 'GET';
    const path = s3Path || '/';
    const url = endpoint.replace(/\/+$/, '') + '/' + bucket + path;

    const headers = new Headers();
    if (contentType) headers.set('Content-Type', contentType);

    const bodyStr = reqBody || '';
    await signRequest(method, url, headers, bodyStr, accessKeyId, secretAccessKey, region);

    const fetchOpts = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && bodyStr) {
      fetchOpts.body = bodyStr;
    }

    const resp = await fetch(url, fetchOpts);
    const respBody = await resp.text();

    return new Response(JSON.stringify({
      ok: resp.ok,
      status: resp.status,
      data: respBody,
      headers: Object.fromEntries(resp.headers.entries()),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  } catch (error) {
    console.error('[S3 Proxy Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
