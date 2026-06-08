// Simple in-memory rate limiter for Vercel Edge Runtime
// Uses a Map to track requests per IP
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 30; // 30 requests per minute per IP

export function checkRateLimit(request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.start > WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }
  
  record.count++;
  if (record.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((WINDOW_MS - (now - record.start)) / 1000) };
  }
  
  // Cleanup old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.start > WINDOW_MS) rateLimitMap.delete(key);
    }
  }
  
  return { allowed: true, remaining: MAX_REQUESTS - record.count };
}

export function rateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': String(MAX_REQUESTS),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': result.retryAfter ? String(result.retryAfter) : '60',
  };
}
