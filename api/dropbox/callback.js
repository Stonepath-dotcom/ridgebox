import { checkRateLimit, rateLimitHeaders } from '../_rateLimit.js';
import { getCORSHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

function htmlPage(title, body, script = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - RidgeBox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; padding: 2rem; max-width: 420px; }
    .logo { font-size: 1.8rem; font-weight: 700; color: #fff; margin-bottom: 1.5rem; letter-spacing: -0.02em; }
    .logo span { color: #e94560; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #0061ff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .message { font-size: 1.1rem; color: #b0b0b0; line-height: 1.6; }
    .error { color: #e94560; font-size: 0.95rem; margin-top: 1rem; padding: 0.75rem; background: rgba(233,69,96,0.1); border-radius: 8px; border: 1px solid rgba(233,69,96,0.2); word-break: break-word; }
    .success-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .hint { font-size: 0.85rem; color: #888; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Ridge<span>Box</span></div>
    ${body}
  </div>
  ${script}
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/</g,'\\x3c').replace(/>/g,'\\x3e');
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

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      const errorDesc = url.searchParams.get('error_description') || error;
      const html = htmlPage('Connection Failed', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Dropbox connection was denied.</div>
        <div class="error">${escapeHtml(errorDesc)}</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>if(window.opener){window.opener.postMessage({type:'dropbox_error',error:'${escapeJs(errorDesc)}'},'*');}</script>`);
      return new Response(html, { headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
    }

    if (!code) {
      const html = htmlPage('Connection Failed', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">No authorization code received from Dropbox.</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>if(window.opener){window.opener.postMessage({type:'dropbox_error',error:'No authorization code received'},'*');}</script>`);
      return new Response(html, { headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
    }

    let clientId = '', clientSecret = '';
    try {
      const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      clientId = stateData.clientId || '';
      clientSecret = stateData.clientSecret || '';
    } catch(e) {}

    if (!clientId) {
      const html = htmlPage('Configuration Error', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Dropbox Client ID not found.</div>
        <div class="hint">Configure it in Settings first.</div>
      `, `<script>if(window.opener){window.opener.postMessage({type:'dropbox_error',error:'Client ID not configured'},'*');}</script>`);
      return new Response(html, { headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
    }

    const origin = url.origin;
    const redirectUri = `${origin}/api/dropbox/callback`;

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (clientSecret) tokenBody.append('client_secret', clientSecret);

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      const errDesc = tokenData.error_description || tokenData.error;
      const html = htmlPage('Token Error', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Failed to obtain access token.</div>
        <div class="error">${escapeHtml(errDesc)}</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>if(window.opener){window.opener.postMessage({type:'dropbox_error',error:'${escapeJs(errDesc)}'},'*');}</script>`);
      return new Response(html, { headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 14400;
    const accountId = tokenData.account_id;

    // Fetch user info
    let userInfo = { id: accountId || '', email: '', name: '' };
    try {
      const userResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userInfo = {
          id: userData.account_id || accountId || '',
          email: userData.email || '',
          name: userData.name?.display_name || '',
        };
      }
    } catch(e) { console.error('[Dropbox Callback] Failed to fetch user info:', e); }

    // Fetch storage quota
    let quota = { limit: 0, usage: 0 };
    try {
      const spaceResponse = await fetch('https://api.dropboxapi.com/2/users/get_space_usage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (spaceResponse.ok) {
        const spaceData = await spaceResponse.json();
        quota = {
          usage: spaceData.used || 0,
          limit: spaceData.allocation?.individual?.allocated || 0,
        };
      }
    } catch(e) { console.error('[Dropbox Callback] Failed to fetch quota:', e); }

    const account = { id: userInfo.id, email: userInfo.email, name: userInfo.name, accessToken, refreshToken, expiresIn, quota, clientId };
    const accountJson = JSON.stringify(account);

    const html = htmlPage('Connecting...', `
      <div class="spinner" id="spinner"></div>
      <div class="message" id="status">Connecting to Dropbox...</div>
    `, `<script>
      (function() {
        var account = ${accountJson};
        var statusEl = document.getElementById('status');
        var spinnerEl = document.getElementById('spinner');
        function showSuccess() {
          if(spinnerEl) spinnerEl.style.display='none';
          if(statusEl) statusEl.innerHTML='<div class="success-icon">&#x2705;</div>Connected! You can close this window.';
        }
        try {
          if(window.opener) {
            window.opener.postMessage({ type:'dropbox_connected', account:account },'*');
            showSuccess();
          } else {
            if(statusEl) statusEl.textContent='Connected, but unable to notify the parent window. Please close this window and refresh RidgeBox.';
          }
        } catch(e) { if(statusEl) statusEl.textContent='Error: '+e.message; }
      })();
    </script>`);

    return new Response(html, { headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
  } catch (error) {
    console.error('[Dropbox Callback Error]', error);
    const html = htmlPage('Error', `
      <div class="success-icon">&#x274C;</div>
      <div class="message">An unexpected error occurred.</div>
      <div class="error">${escapeHtml(error.message)}</div>
      <div class="hint">You can close this window and try again.</div>
    `, `<script>if(window.opener){window.opener.postMessage({type:'dropbox_error',error:'${escapeJs(error.message)}'},'*');}</script>`);
    return new Response(html, { status: 500, headers: { 'Content-Type': 'text/html', ...rateLimitHeaders(rl), ...CORS } });
  }
}
