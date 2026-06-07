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

async function signRequest(method, url, headers, accessKeyId, secretAccessKey, region) {
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dateStamp = amzDate.slice(0, 8);

  const urlObj = new URL(url);
  const canonicalUri = urlObj.pathname;
  const canonicalQuerystring = urlObj.searchParams.toString();
  const payloadHash = await sha256('');

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

  // Changed from GET to POST for security - credentials in body, not URL
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }

  try {
    // Read credentials from JSON body instead of URL searchParams
    const body = await request.json();
    const { endpoint, accessKeyId, secretAccessKey, bucket, region, key, name } = body;
    const downloadName = name || key?.split('/').pop() || 'download';

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !region || !key) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
      });
    }

    const s3Url = endpoint.replace(/\/+$/, '') + '/' + bucket + '/' + key.replace(/^\/+/, '');

    const headers = new Headers();
    await signRequest('GET', s3Url, headers, accessKeyId, secretAccessKey, region);

    const resp = await fetch(s3Url, { method: 'GET', headers });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({
        ok: false, error: 'S3 download failed: ' + resp.status, details: errText,
      }), { status: resp.status, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS } });
    }

    const contentType = resp.headers.get('Content-Type') || 'application/octet-stream';
    const respBody = await resp.arrayBuffer();

    return new Response(respBody, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="' + downloadName.replace(/"/g, '\\"') + '"',
        'Content-Length': respBody.byteLength.toString(),
        ...rateLimitHeaders(rl),
        ...CORS,
      },
    });
  } catch (error) {
    console.error('[S3 Download Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl), ...CORS },
    });
  }
}
