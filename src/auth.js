import crypto from 'node:crypto';

const COOKIE_NAME = 'rulesbot_session';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days, in seconds

export { COOKIE_NAME, SESSION_TTL };

// Minimal cookie header parser (avoids a cookie-parser dependency).
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  }
  return out;
}

// HMAC-signed, base64url JSON token: "payload.signature".
export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;

  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(body).digest('base64url')
  );
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp && Date.now() > data.exp * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

// Express middleware: attaches the verified session payload (or null) to req.user.
export function sessionMiddleware(secret) {
  return (req, res, next) => {
    req.user = verifySession(parseCookies(req.headers.cookie)[COOKIE_NAME], secret);
    next();
  };
}

export function setSessionCookie(res, payload, secret) {
  const token = signSession(payload, secret);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Set to true when running behind HTTPS.
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: payload.exp * 1000 - Date.now(),
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// ---- Discord OAuth API calls (Node 18+ global fetch) ----

export async function exchangeCode(code, { clientId, clientSecret, redirectUri }) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`failed to fetch user (${res.status})`);
  return res.json();
}

export async function fetchDiscordGuilds(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`failed to fetch guilds (${res.status})`);
  return res.json();
}
