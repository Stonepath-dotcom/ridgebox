export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function htmlPage(title, body, script = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - RidgeBox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 420px;
    }
    .logo {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }
    .logo span { color: #e94560; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #e94560;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .message {
      font-size: 1.1rem;
      color: #b0b0b0;
      line-height: 1.6;
    }
    .error {
      color: #e94560;
      font-size: 0.95rem;
      margin-top: 1rem;
      padding: 0.75rem;
      background: rgba(233, 69, 96, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(233, 69, 96, 0.2);
      word-break: break-word;
    }
    .success-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .hint {
      font-size: 0.85rem;
      color: #888;
      margin-top: 1rem;
    }
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

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth error from Google
    if (error) {
      const errorDesc = url.searchParams.get('error_description') || error;
      const html = htmlPage('Connection Failed', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Google Drive connection was denied.</div>
        <div class="error">${escapeHtml(errorDesc)}</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>
        if (window.opener) {
          window.opener.postMessage({ type: 'gdrive_error', error: '${escapeJs(errorDesc)}' }, '*');
        }
      </script>`);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...CORS },
      });
    }

    if (!code) {
      const html = htmlPage('Connection Failed', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">No authorization code received from Google.</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>
        if (window.opener) {
          window.opener.postMessage({ type: 'gdrive_error', error: 'No authorization code received' }, '*');
        }
      </script>`);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...CORS },
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const html = htmlPage('Configuration Error', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Google Drive is not configured on the server.</div>
        <div class="hint">Please contact the administrator.</div>
      `, `<script>
        if (window.opener) {
          window.opener.postMessage({ type: 'gdrive_error', error: 'Google Drive not configured' }, '*');
        }
      </script>`);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...CORS },
      });
    }

    // Build redirect URI from request origin
    const origin = url.origin;
    const redirectUri = `${origin}/api/gdrive/callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      const errDesc = tokenData.error_description || tokenData.error;
      const html = htmlPage('Token Error', `
        <div class="success-icon">&#x274C;</div>
        <div class="message">Failed to obtain access token.</div>
        <div class="error">${escapeHtml(errDesc)}</div>
        <div class="hint">You can close this window and try again.</div>
      `, `<script>
        if (window.opener) {
          window.opener.postMessage({ type: 'gdrive_error', error: '${escapeJs(errDesc)}' }, '*');
        }
      </script>`);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...CORS },
      });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Fetch user info from Google
    let userInfo = { id: '', email: '', name: '' };
    try {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userInfo = {
          id: userData.id || '',
          email: userData.email || '',
          name: userData.name || '',
        };
      }
    } catch (e) {
      console.error('[GDrive Callback] Failed to fetch user info:', e);
    }

    // Fetch storage quota from Google Drive
    let quota = { limit: 0, usage: 0 };
    try {
      const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (aboutResponse.ok) {
        const aboutData = await aboutResponse.json();
        if (aboutData.storageQuota) {
          quota = {
            limit: aboutData.storageQuota.limit || 0,
            usage: aboutData.storageQuota.usage || 0,
          };
        }
      }
    } catch (e) {
      console.error('[GDrive Callback] Failed to fetch quota:', e);
    }

    // Build the account data
    const account = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      accessToken,
      refreshToken,
      expiresIn,
      quota,
    };

    const accountJson = JSON.stringify(account);

    // Return HTML page that sends data to parent window and closes itself
    const html = htmlPage('Connecting...', `
      <div class="spinner" id="spinner"></div>
      <div class="message" id="status">Connecting to Google Drive...</div>
    `, `<script>
      (function() {
        var account = ${accountJson};
        var statusEl = document.getElementById('status');
        var spinnerEl = document.getElementById('spinner');

        function showSuccess() {
          if (spinnerEl) spinnerEl.style.display = 'none';
          if (statusEl) {
            statusEl.innerHTML = '<div class="success-icon">&#x2705;</div>Connected! You can close this window.';
          }
        }

        try {
          if (window.opener) {
            window.opener.postMessage({
              type: 'gdrive_connected',
              account: account
            }, '*');
            showSuccess();
          } else {
            if (statusEl) {
              statusEl.textContent = 'Connected, but unable to notify the parent window. Please close this window and refresh RidgeBox.';
            }
          }
        } catch (e) {
          if (statusEl) {
            statusEl.textContent = 'Error: ' + e.message;
          }
        }
      })();
    </script>`);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html', ...CORS },
    });
  } catch (error) {
    console.error('[GDrive Callback Error]', error);
    const html = htmlPage('Error', `
      <div class="success-icon">&#x274C;</div>
      <div class="message">An unexpected error occurred.</div>
      <div class="error">${escapeHtml(error.message)}</div>
      <div class="hint">You can close this window and try again.</div>
    `, `<script>
      if (window.opener) {
        window.opener.postMessage({ type: 'gdrive_error', error: '${escapeJs(error.message)}' }, '*');
      }
    </script>`);
    return new Response(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html', ...CORS },
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e');
}
