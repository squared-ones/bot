import express from 'express';
import crypto from 'node:crypto';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getAllRules,
  getCustomRules,
  addCustomRule,
  removeCustomRule,
} from './rules.js';
import {
  botState,
  getGuildChannels,
  assignRole,
  isMemberVerified,
  isApplicationOwner,
} from './bot.js';
import {
  SESSION_TTL,
  sessionMiddleware,
  setSessionCookie,
  clearSessionCookie,
  exchangeCode,
  fetchDiscordUser,
  fetchDiscordGuilds,
} from './auth.js';
import {
  ACTION_PERMISSIONS,
  ACTION_LABELS,
  parseDuration,
  formatDuration,
  getMember,
  permissionError,
  hierarchyError,
  hasAnyModerationPermission,
  banUser,
  kickMember,
  timeoutMember,
  purgeMessages,
} from './moderation.js';
import { createCaptcha, verifyCaptcha } from './captcha.js';
import { getVoteStats, recordVote } from './voting.js';
import { flushDataSync } from './github-data.js';
import {
  addManualBlockedIp,
  getClientIp,
  getManualBlocklist,
  inspectIp,
  removeManualBlockedIp,
} from './network-detection.js';
import {
  getVerificationConfig,
  saveVerificationConfig,
  normalizeVerificationConfig,
  isVerificationConfigured,
} from './verification.js';
import { getAutoroleConfig, setAutoroleRoles } from './autoroles.js';
import { isRestoreEnabled, setRestoreEnabled } from './restore.js';
import { getTicketConfig, setTicketConfig } from './tickets.js';
import {
  createAppeal,
  listAppeals,
  getAppeal,
  reviewAppeal,
} from './appeals.js';
import { checkRateLimit } from './rate-limit.js';
import {
  getLevelConfig,
  setLevelConfig,
  getLeaderboard,
  resetGuildXp,
} from './levels.js';
import {
  CURRENCY,
  PLANS,
  getBalance,
  grantCredits,
  getGuildPlan,
  getGuildSubscription,
  getUserPlan,
  subscribeGuild,
  cancelSubscription,
  planRequiredError,
  FREE_CUSTOM_RULE_LIMIT,
  VOTE_CREDIT_REWARD,
} from './credits.js';
import {
  DISCORD_LOCALES,
  TRANSLATION_REWARD,
  getCatalog,
  getStringsForLocale,
  getUserLocale,
  setUserLocale,
  submitTranslation,
  approveTranslation,
  rejectTranslation,
  listPendingTranslations,
  listLocales,
} from './translations.js';
import {
  getAccount,
  getAccountByDiscordId,
  createAccount,
  verifyLogin,
  changeUsername,
  changePassword,
  linkDiscord,
  unlinkDiscord,
  isValidUsername,
  isValidPassword,
} from './accounts.js';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  authenticateApiKey,
} from './apikeys.js';

const APP_URL = 'https://squared-one.onrender.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Anti-spam limits for the public ban-appeal form.
const APPEAL_IP_LIMIT = 5; // appeals per IP address...
const APPEAL_IP_WINDOW_MS = 10 * 60 * 1000; // ...within 10 minutes
const APPEAL_USER_COOLDOWN_MS = 2 * 60 * 1000; // per (guild, user) cooldown

// Resolves the public directory in both dev (src/) and built (dist/) layouts.
function resolvePublicDir() {
  if (process.env.PUBLIC_DIR) return process.env.PUBLIC_DIR;
  if (fs.existsSync(path.join(__dirname, 'public'))) {
    return path.join(__dirname, 'public');
  }
  return path.join(__dirname, '..', 'public');
}

// Only allow same-origin relative redirects (prevents open redirects).
function safeNext(value) {
  if (typeof value !== 'string') return '';
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  return value.slice(0, 512);
}

const PUBLIC_DIR = resolvePublicDir();
const HOME_FILE = path.join(PUBLIC_DIR, 'home.html');
const DASHBOARD_FILE = path.join(PUBLIC_DIR, 'dashboard.html');

export function startServer(port = 3000) {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const discordAuthEnabled = Boolean(clientId && clientSecret);
  const localAuthEnabled = process.env.DISABLE_LOCAL_AUTH !== 'true';
  const authEnabled = discordAuthEnabled || localAuthEnabled;
  let sessionSecret = process.env.SESSION_SECRET || clientSecret;
  if (!sessionSecret) {
    // Local-only auth without a configured secret: use an ephemeral one so
    // sessions work for this process lifetime (cookies reset on restart).
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[web] SESSION_SECRET not set — using an ephemeral secret; sessions reset on restart.'
    );
  }

  const redirectUri = `${APP_URL}/auth/discord/callback`;

  // The id used for credits/plan/owner checks: the linked Discord id when one
  // exists, otherwise a local account's own id.
  function billingIdOf(req) {
    if (!req.user) return null;
    if (req.user.authType === 'local') {
      return req.user.id || req.user.accountId || null;
    }
    return req.user.id;
  }

  // Identity snapshot stored against a new API key so the key can later
  // impersonate the session it was created from.
  function apiKeyIdentity(req) {
    return {
      ownerId: billingIdOf(req),
      authType: req.user.authType || 'discord',
      accountId: req.user.accountId || null,
      username: req.user.username || null,
      guildIds: req.user.guildIds || [],
    };
  }

  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY === 'true');
  app.use(
    express.json({
      verify(req, res, buffer) {
        req.rawBody = Buffer.from(buffer);
      },
    })
  );
  app.use(sessionMiddleware(sessionSecret));

  // Resolves an Authorization: Bearer <key> header into the key owner's
  // identity snapshot (mirrors a session payload). The guard below decides
  // whether an API key can satisfy a route.
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match) req.apiKeyUser = authenticateApiKey(match[1].trim());
    next();
  });

  // Auth guard — a no-op when OAuth isn't configured, so the dashboard
  // still works out of the box until CLIENT_SECRET is set. Accepts either a
  // session or (for JSON API routes only) a valid API key.
  const guard = (req, res, next) => {
    if (!authEnabled) return next();
    if (req.user) return next();
    if (req.apiKeyUser && req.path.startsWith('/api/')) {
      req.user = req.apiKeyUser;
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return res.redirect('/login');
  };

  // Session-only guard — used for API-key management so a key can't mint or
  // revoke other keys. A valid Bearer key is deliberately not enough here.
  const sessionGuard = (req, res, next) => {
    if (!authEnabled) return next();
    if (!req.user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      return res.redirect('/login');
    }
    next();
  };

  // Whether the signed-in user can manage (Manage Server) a given guild.
  async function canManageGuild(req, guildId) {
    const client = botState.client;
    if (!req.user) return true; // OAuth disabled (dev mode).
    if (!client?.isReady()) return false;
    const guild = client.guilds.cache.get(String(guildId));
    if (!guild || !(req.user.guildIds || []).includes(guild.id)) return false;
    const member = await getMember(guild, req.user.id);
    if (!member) return false;
    return (
      guild.ownerId === req.user.id ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
  }

  // Returns a 402 error payload when the guild is on the Free plan and a paid
  // feature is requested. Skipped when OAuth is disabled (dev mode).
  function paidGate(req, guildId, featureLabel) {
    if (!req.user) return null;
    if (getGuildPlan(guildId) !== 'free') return null;
    return { status: 402, error: planRequiredError(featureLabel) };
  }

  // Plan shown to the dashboard. In dev mode (OAuth disabled) everything is
  // unlocked, so report enterprise rather than blocking on the Free plan.
  function guildPlanFor(req, guildId) {
    return req.user ? getGuildPlan(guildId) : 'enterprise';
  }

  // Guilds the signed-in user can manage (Manage Server or owner).
  async function listManageableGuilds(req) {
    const client = botState.client;
    if (!client?.isReady()) return [];
    const allowed = req.user ? new Set(req.user.guildIds || []) : null;
    const result = [];
    for (const guild of client.guilds.cache.values()) {
      if (allowed && !allowed.has(guild.id)) continue;
      if (req.user) {
        const member = await getMember(guild, req.user.id);
        const isOwner = guild.ownerId === req.user.id;
        if (
          !member ||
          (!isOwner && !member.permissions.has(PermissionFlagsBits.ManageGuild))
        ) {
          continue;
        }
      }
      result.push(guild);
    }
    return result;
  }

  // ---------- Authentication ----------
  app.get('/api/auth/methods', (req, res) => {
    res.json({ discord: discordAuthEnabled, local: localAuthEnabled });
  });

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    if (!authEnabled) {
      return res
        .status(503)
        .send(
          'Authentication is disabled. Set CLIENT_ID and CLIENT_SECRET for Discord OAuth, or leave local accounts enabled, then restart.'
        );
    }
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  });

  app.get('/signup', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    if (!authEnabled || !localAuthEnabled) return res.redirect('/login');
    res.sendFile(path.join(PUBLIC_DIR, 'signup.html'));
  });

  // Issues a session cookie for a local username/password account.
  function setLocalSession(res, account) {
    const now = Math.floor(Date.now() / 1000);
    setSessionCookie(
      res,
      {
        authType: 'local',
        accountId: account.id,
        id: account.discordId || null,
        username: account.username,
        avatar: account.avatar || null,
        guildIds: account.guildIds || [],
        exp: now + SESSION_TTL,
      },
      sessionSecret
    );
  }

  app.post('/api/auth/signup', (req, res) => {
    if (!localAuthEnabled) {
      return res.status(403).json({ error: 'Local account signup is disabled.' });
    }
    const limit = checkRateLimit(`signup:ip:${getClientIp(req)}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.ok) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many signup attempts. Please wait ${limit.retryAfterSeconds} seconds.`,
      });
    }

    const { username, password } = req.body ?? {};
    const result = createAccount(username, password);
    if (!result.ok) return res.status(400).json({ error: result.error });

    setLocalSession(res, result.account);
    res.status(201).json({ ok: true, user: result.account });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!localAuthEnabled) {
      return res.status(403).json({ error: 'Local account sign-in is disabled.' });
    }
    const limit = checkRateLimit(`login:ip:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.ok) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many sign-in attempts. Please wait ${limit.retryAfterSeconds} seconds.`,
      });
    }

    const { username, password } = req.body ?? {};
    const account = verifyLogin(username, password);
    if (!account) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    setLocalSession(res, account);
    res.json({ ok: true, user: account });
  });

  app.get('/auth/discord/login', (req, res) => {
    if (!discordAuthEnabled) {
      return res.redirect(
        '/login?error=' + encodeURIComponent('Discord OAuth is not configured.')
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
    });
    const next = safeNext(req.query.next);
    if (next) params.set('state', next);
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });

  // Link Discord to the signed-in local account.
  app.get('/auth/discord/link', (req, res) => {
    if (!discordAuthEnabled) {
      return res.redirect(
        '/login?error=' + encodeURIComponent('Discord OAuth is not configured.')
      );
    }
    if (!req.user || req.user.authType !== 'local' || !req.user.accountId) {
      return res.redirect(
        '/login?error=' +
          encodeURIComponent('Sign in to your account before linking Discord.')
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state: 'link',
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    if (!discordAuthEnabled) return res.redirect('/login');
    const { code, error } = req.query;
    if (error) return res.redirect('/login?error=' + encodeURIComponent(error));
    if (!code) return res.redirect('/login?error=missing_code');

    try {
      const tokens = await exchangeCode(code, {
        clientId,
        clientSecret,
        redirectUri,
      });
      const [user, guilds] = await Promise.all([
        fetchDiscordUser(tokens.access_token),
        fetchDiscordGuilds(tokens.access_token),
      ]);
      const guildIds = (guilds || []).map((g) => g.id).slice(0, 200);
      const now = Math.floor(Date.now() / 1000);

      // Linking flow: attach this Discord identity to the signed-in local account.
      if (String(req.query.state) === 'link') {
        if (!req.user || req.user.authType !== 'local' || !req.user.accountId) {
          return res.redirect(
            '/login?error=' +
              encodeURIComponent('Sign in to your account before linking Discord.')
          );
        }
        const result = linkDiscord(req.user.accountId, {
          discordId: user.id,
          username: user.username,
          avatar: user.avatar,
          guildIds,
        });
        if (!result.ok) {
          return res.redirect(
            '/dashboard?view=account&error=' + encodeURIComponent(result.error)
          );
        }
        setLocalSession(res, result.account);
        return res.redirect('/dashboard?view=account');
      }

      setSessionCookie(
        res,
        {
          authType: 'discord',
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          guildIds,
          exp: now + SESSION_TTL,
        },
        sessionSecret
      );
      res.redirect(safeNext(req.query.state) || '/dashboard');
    } catch (err) {
      console.error('[auth] oauth callback error:', err.message);
      res.redirect('/login?error=' + encodeURIComponent('Failed to sign in.'));
    }
  });

  app.get('/logout', (req, res) => {
    clearSessionCookie(res);
    res.redirect('/');
  });

  // ---------- Vote webhooks and tracking ----------
  function timingSafeMatch(received, expected) {
    const a = Buffer.from(String(received || ''));
    const b = Buffer.from(String(expected || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function verifyTopggWebhook(req) {
    const secret = process.env.TOPGG_WEBHOOK_SECRET;
    if (!secret) return false;
    const signature = String(req.headers['x-topgg-signature'] || '');
    if (signature) {
      const parts = Object.fromEntries(
        signature.split(',').map((part) => {
          const index = part.indexOf('=');
          return index === -1
            ? [part, '']
            : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
        })
      );
      const timestamp = Number(parts.t);
      if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
        return false;
      }
      const rawBody = String(req.rawBody || '');
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
      return timingSafeMatch(parts.v1, expected);
    }
    // Legacy Top.gg webhooks use the Authorization header.
    return timingSafeMatch(req.headers.authorization, secret);
  }

  function topggVote(body) {
    if (body?.type === 'webhook.test' || body?.type === 'test') return null;
    const data = body?.data || body || {};
    const user = data.user || {};
    return {
      provider: 'topgg',
      userId: user.platform_id || body?.user || user.id,
      username: user.name || null,
      eventId: data.id || body?.id || null,
      weight: data.weight || (body?.isWeekend ? 2 : 1),
      createdAt: data.created_at || body?.createdAt || Date.now(),
      expiresAt: data.expires_at || null,
    };
  }

  app.post('/webhooks/topgg', async (req, res) => {
    if (!process.env.TOPGG_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Top.gg webhook secret is not configured' });
    }
    if (!verifyTopggWebhook(req)) return res.status(401).json({ error: 'invalid webhook signature' });
    const vote = topggVote(req.body);
    if (!vote) return res.json({ ok: true, test: true });
    try {
      const result = recordVote(vote);
      let balance = null;
      if (!result.duplicate && VOTE_CREDIT_REWARD > 0) {
        balance = grantCredits(vote.userId, VOTE_CREDIT_REWARD);
      }
      await flushDataSync();
      console.log(
        `[vote] Top.gg vote recorded for ${vote.userId}${result.duplicate ? ' (duplicate)' : ''}.` +
          (balance == null
            ? ''
            : ` Awarded ${VOTE_CREDIT_REWARD} ${CURRENCY.code} (balance ${balance} ${CURRENCY.code}).`)
      );
      res.json({ ok: true, duplicate: result.duplicate, rewarded: balance != null });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/webhooks/discordbotlist', async (req, res) => {
    const secret = process.env.DBL_WEBHOOK_TOKEN;
    if (!secret) return res.status(503).json({ error: 'Discord Bot List webhook token is not configured' });
    const authorization = req.headers.authorization || req.headers['x-webhook-token'];
    if (!timingSafeMatch(authorization, secret)) return res.status(401).json({ error: 'invalid webhook token' });
    const body = req.body || {};
    if (body.type === 'test') return res.json({ ok: true, test: true });
    try {
      const result = recordVote({
        provider: 'discordbotlist',
        userId: body.id,
        username: body.username || null,
        eventId: body.voteId || null,
        weight: 1,
      });
      let balance = null;
      if (!result.duplicate && VOTE_CREDIT_REWARD > 0) {
        balance = grantCredits(body.id, VOTE_CREDIT_REWARD);
      }
      await flushDataSync();
      console.log(
        `[vote] Discord Bot List vote recorded for ${body.id}${result.duplicate ? ' (duplicate)' : ''}.` +
          (balance == null
            ? ''
            : ` Awarded ${VOTE_CREDIT_REWARD} ${CURRENCY.code} (balance ${balance} ${CURRENCY.code}).`)
      );
      res.json({ ok: true, duplicate: result.duplicate, rewarded: balance != null });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/votes', guard, (req, res) => {
    res.json(getVoteStats());
  });

  // ---------- i18n / translations ----------
  app.get('/api/i18n/locales', (req, res) => {
    res.json({
      locales: listLocales(),
      discord: DISCORD_LOCALES,
      reward: TRANSLATION_REWARD,
    });
  });

  // All strings for a locale (English fallback). Public — used by the
  // client-side i18n loader on any page.
  app.get('/api/i18n/strings', (req, res) => {
    const locale = String(req.query.locale || '').trim() || 'en';
    res.json({ locale, strings: getStringsForLocale(locale) });
  });

  // Full catalog + pending list for the translation contribution page.
  app.get('/api/i18n/catalog', guard, async (req, res) => {
    const userId = billingIdOf(req);
    res.json({
      catalog: getCatalog(),
      pending: listPendingTranslations(),
      locales: listLocales(),
      reward: TRANSLATION_REWARD,
      locale: userId ? getUserLocale(userId) : null,
      isOwner: userId ? await isApplicationOwner(userId) : false,
      signedIn: Boolean(req.user),
    });
  });

  app.post('/api/i18n/locale', guard, (req, res) => {
    try {
      const userId = billingIdOf(req);
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      res.json({ locale: setUserLocale(userId, req.body?.locale) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/i18n/submit', guard, (req, res) => {
    try {
      const contributorId = billingIdOf(req);
      if (!contributorId) return res.status(401).json({ error: 'unauthorized' });
      const result = submitTranslation({
        locale: req.body?.locale,
        key: req.body?.key,
        value: req.body?.value,
        contributorId,
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/i18n/approve', guard, async (req, res) => {
    if (!(await isApplicationOwner(billingIdOf(req)))) {
      return res
        .status(403)
        .json({ error: 'only the application owner can approve translations' });
    }
    try {
      res.json(approveTranslation(req.body?.id));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/i18n/reject', guard, async (req, res) => {
    if (!(await isApplicationOwner(billingIdOf(req)))) {
      return res
        .status(403)
        .json({ error: 'only the application owner can reject translations' });
    }
    try {
      res.json(rejectTranslation(req.body?.id));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ---------- Public ----------
  app.get('/api/invite', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    if (!clientId) return res.json({ url: null });
    res.json({
      url: `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`,
    });
  });

  // Page metadata for the support page (invite, support server, repo links).
  app.get('/api/meta', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    res.json({
      invite: clientId
        ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`
        : null,
      support: process.env.SUPPORT_SERVER || null,
      github: process.env.GITHUB_URL || null,
    });
  });

  // Public ban-appeal submission (no login — banned users aren't in the server).
  app.post('/api/appeals', (req, res) => {
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit(`appeal:ip:${ip}`, {
      limit: APPEAL_IP_LIMIT,
      windowMs: APPEAL_IP_WINDOW_MS,
    });
    if (!ipLimit.ok) {
      res.set('Retry-After', String(ipLimit.retryAfterSeconds));
      return res.status(429).json({
        error: `Too many appeals from your address. Please wait ${ipLimit.retryAfterSeconds} seconds and try again.`,
      });
    }

    const { guildId, userId, username, reason } = req.body ?? {};
    if (typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }
    if (typeof guildId !== 'string' || !guildId.trim()) {
      return res.status(400).json({ error: 'guild is required' });
    }
    const guild = botState.client?.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild not found' });

    // Per (guild, user) cooldown so a single user can't flood one server with
    // appeals, even from different addresses.
    if (typeof userId === 'string' && userId.trim()) {
      const userLimit = checkRateLimit(
        `appeal:user:${guildId}:${userId.trim()}`,
        { limit: 1, windowMs: APPEAL_USER_COOLDOWN_MS }
      );
      if (!userLimit.ok) {
        res.set('Retry-After', String(userLimit.retryAfterSeconds));
        return res.status(429).json({
          error: `You already submitted an appeal for that server recently. Please wait ${userLimit.retryAfterSeconds} seconds and try again.`,
        });
      }
    }

    const appeal = createAppeal({
      guildId: guild.id,
      guildName: guild.name,
      userId,
      username,
      reason,
    });
    res.status(201).json(appeal);
  });

  // Servers the bot is in (name + icon). Scoped to the logged-in user's
  // guilds when a session is present; public (all bot guilds) for the homepage.
  app.get('/api/servers', (req, res) => {
    const client = botState.client;
    const connected = Boolean(client?.isReady());
    const allowed = req.user ? new Set(req.user.guildIds || []) : null;
    const servers = connected
      ? client.guilds.cache
          .filter((g) => !allowed || allowed.has(g.id))
          .map((g) => ({
            id: g.id,
            name: g.name,
            icon: g.icon ? `/icons/${g.id}/${g.icon}` : null,
          }))
      : [];
    res.json({ connected, servers });
  });

  // Proxies Discord CDN server icons so the homepage and dashboard don't set a
  // third-party Cloudflare (`__cf_bm`) cookie, which Chrome flags. The hash in
  // the URL identifies the icon content, so responses can be cached immutably.
  app.get('/icons/:guildId/:iconHash', async (req, res) => {
    const guildId = String(req.params.guildId || '');
    const iconHash = String(req.params.iconHash || '');
    if (!/^\d{16,22}$/.test(guildId) || !/^a?[0-9a-f]+$/i.test(iconHash)) {
      return res.status(404).end();
    }
    const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=64`;
    try {
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(upstream.status).end();
      res.set('Content-Type', `image/${ext === 'gif' ? 'gif' : 'png'}`);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).end();
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      bot: {
        connected: Boolean(botState.client?.isReady()),
        username: botState.username,
        startedAt: botState.startedAt,
        guildCount: botState.guildCount,
        memberCount: botState.memberCount,
      },
    });
  });

  // ---------- Homepage (public) ----------
  app.get('/', (req, res) => res.sendFile(HOME_FILE));
  app.get('/index.html', (req, res) => res.redirect('/dashboard'));

  // ---------- Legal pages (public) ----------
  app.get('/privacy', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'privacy.html'))
  );
  app.get('/terms', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'terms.html'))
  );
  app.get('/support', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'support.html'))
  );
  app.get('/pricing', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'pricing.html'))
  );
  app.get('/appeal', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'appeal.html'))
  );
  app.get('/translate', checkRateLimit, (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'translate.html'))
  );

  // ---------- Dashboard (protected) ----------
  app.get('/dashboard', guard, (req, res) => res.sendFile(DASHBOARD_FILE));

  app.get('/api/session', guard, (req, res) => {
    if (!req.user) {
      // Auth disabled — the dashboard runs unprotected.
      return res.json({ user: null });
    }
    res.json({
      user: {
        authType: req.user.authType || 'discord',
        id: req.user.id,
        accountId: req.user.accountId || null,
        username: req.user.username,
        avatar: req.user.avatar,
        guildCount: (req.user.guildIds || []).length,
      },
    });
  });

  // ---------- Account management ----------
  app.get('/api/account', guard, (req, res) => {
    if (!req.user) return res.json({ account: null });

    if (req.user.authType === 'local' && req.user.accountId) {
      const account = getAccount(req.user.accountId);
      if (!account) return res.status(401).json({ error: 'account not found' });
      return res.json({
        account: {
          authType: 'local',
          id: account.discordId || null,
          accountId: account.id,
          username: account.username,
          discordUsername: account.discordUsername || null,
          avatar: account.avatar || null,
          discordLinked: Boolean(account.discordId),
          createdAt: account.createdAt || null,
        },
      });
    }

    const linked = getAccountByDiscordId(req.user.id);
    res.json({
      account: {
        authType: 'discord',
        id: req.user.id,
        accountId: linked ? linked.id : null,
        username: req.user.username,
        discordUsername: req.user.username,
        avatar: req.user.avatar || null,
        discordLinked: true,
        localLinked: Boolean(linked),
        createdAt: linked ? linked.createdAt : null,
      },
    });
  });

  // Returns the signed-in local account, or responds with an error and null.
  function requireLocalAccount(req, res) {
    if (!req.user) {
      res.status(401).json({ error: 'sign in first' });
      return null;
    }
    if (req.user.authType !== 'local' || !req.user.accountId) {
      res.status(403).json({ error: 'this requires a username/password account' });
      return null;
    }
    const account = getAccount(req.user.accountId);
    if (!account) {
      res.status(401).json({ error: 'account not found' });
      return null;
    }
    return account;
  }

  app.post('/api/account/username', guard, (req, res) => {
    const account = requireLocalAccount(req, res);
    if (!account) return;
    const { username } = req.body ?? {};
    const result = changeUsername(account.id, username);
    if (!result.ok) return res.status(400).json({ error: result.error });
    setLocalSession(res, result.account);
    res.json({ ok: true, account: result.account });
  });

  app.post('/api/account/password', guard, (req, res) => {
    const account = requireLocalAccount(req, res);
    if (!account) return;
    const { currentPassword, newPassword } = req.body ?? {};
    const result = changePassword(account.id, currentPassword, newPassword);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  app.post('/api/account/unlink', guard, (req, res) => {
    const account = requireLocalAccount(req, res);
    if (!account) return;
    const result = unlinkDiscord(account.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    setLocalSession(res, result.account);
    res.json({ ok: true, account: result.account });
  });

  // Create a username/password for a Discord-signed-in session.
  app.post('/api/account/setup', guard, async (req, res) => {
    if (!req.user || req.user.authType !== 'discord' || !req.user.id) {
      return res.status(403).json({ error: 'this requires a Discord session' });
    }
    const { username, password } = req.body ?? {};
    if (getAccountByDiscordId(req.user.id)) {
      return res
        .status(409)
        .json({ error: 'This Discord account already has a local account linked.' });
    }
    const result = createAccount(username, password);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const linked = linkDiscord(result.account.id, {
      discordId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      guildIds: req.user.guildIds || [],
    });
    if (!linked.ok) return res.status(400).json({ error: linked.error });
    setLocalSession(res, linked.account);
    await flushDataSync();
    res.json({ ok: true, account: linked.account });
  });

  // ---------- API keys (developer access) ----------
  // Management is session-only so a leaked key can't mint more keys. The keys
  // themselves can authenticate the operational /api/* routes via the guard.
  app.get('/api/apikeys', sessionGuard, (req, res) => {
    res.json({ keys: listApiKeys(billingIdOf(req)) });
  });

  app.post('/api/apikeys', sessionGuard, (req, res) => {
    const name = String((req.body ?? {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { key, record } = createApiKey({ name, identity: apiKeyIdentity(req) });
    res.status(201).json({ key, record });
  });

  app.delete('/api/apikeys/:id', sessionGuard, (req, res) => {
    const ok = revokeApiKey(billingIdOf(req), req.params.id);
    if (!ok) return res.status(404).json({ error: 'key not found' });
    res.json({ ok: true });
  });

  // ---------- Rules API (protected) ----------
  app.get('/api/rules', guard, (req, res) => {
    res.json(getAllRules());
  });

  app.post('/api/rules', guard, async (req, res) => {
    const { title, description } = req.body ?? {};
    if (
      typeof title !== 'string' ||
      typeof description !== 'string' ||
      !title.trim() ||
      !description.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'title and description are required' });
    }
    if (
      req.user &&
      getUserPlan(billingIdOf(req)) === 'free' &&
      getCustomRules().length >= FREE_CUSTOM_RULE_LIMIT
    ) {
      return res.status(402).json({
        error: `The Free plan is limited to ${FREE_CUSTOM_RULE_LIMIT} custom rules. Subscribe to Pro for unlimited rules.`,
      });
    }
    const rule = addCustomRule(title, description);
    await flushDataSync();
    res.status(201).json(rule);
  });

  app.delete('/api/rules/:id', guard, async (req, res) => {
    const ok = removeCustomRule(req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ error: 'rule not found or is a default rule' });
    }
    await flushDataSync();
    res.json({ ok: true });
  });

  // ---------- Channels (scoped to the logged-in user's guilds) ----------
  app.get('/api/channels', guard, (req, res) => {
    const all = getGuildChannels();
    const selectedGuildId = String(req.query.guildId || '');
    // When OAuth is active, scope to the guilds the user belongs to.
    let guilds = req.user
      ? all.filter((g) => (req.user.guildIds || []).includes(g.id))
      : all;
    if (selectedGuildId) guilds = guilds.filter((g) => g.id === selectedGuildId);
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds,
    });
  });

  // ---------- Moderation (scoped to the logged-in user's guilds) ----------

  // Guilds the user can moderate, with per-action permission flags.
  app.get('/api/moderation/guilds', guard, async (req, res) => {
    const client = botState.client;
    if (!client || !client.isReady()) {
      return res.json({ connected: false, guilds: [] });
    }
    const userId = req.user?.id;
    const allowed = req.user ? new Set(req.user.guildIds || []) : null;
    const guilds = [];

    for (const guild of client.guilds.cache.values()) {
      if (allowed && !allowed.has(guild.id)) continue;

      let permissions = null;
      if (!req.user) {
        // OAuth disabled (dev mode) — grant full access.
        permissions = { ban: true, kick: true, timeout: true, purge: true };
      } else {
        const member = await getMember(guild, userId);
        if (!member) continue;
        const owner = guild.ownerId === userId;
        permissions = {
          ban: owner || member.permissions.has(ACTION_PERMISSIONS.ban),
          kick: owner || member.permissions.has(ACTION_PERMISSIONS.kick),
          timeout: owner || member.permissions.has(ACTION_PERMISSIONS.timeout),
          purge: owner || member.permissions.has(ACTION_PERMISSIONS.purge),
        };
      }

      if (
        !permissions.ban &&
        !permissions.kick &&
        !permissions.timeout &&
        !permissions.purge
      ) {
        continue;
      }

      const ext = guild.icon?.startsWith('a_') ? 'gif' : 'png';
      guilds.push({
        id: guild.id,
        name: guild.name,
        icon: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`
          : null,
        plan: guildPlanFor(req, guild.id),
        permissions,
      });
    }

    res.json({ connected: true, guilds });
  });

  // Search members of a guild the user can moderate.
  app.get('/api/moderation/members', guard, async (req, res) => {
    const client = botState.client;
    if (!client || !client.isReady()) {
      return res.status(503).json({ error: 'bot is not connected' });
    }

    const guild = client.guilds.cache.get(String(req.query.guildId || ''));
    if (!guild) return res.status(404).json({ error: 'guild not found' });

    if (req.user) {
      if (!(req.user.guildIds || []).includes(guild.id)) {
        return res
          .status(403)
          .json({ error: 'you do not have access to that server' });
      }
      const actor = await getMember(guild, req.user.id);
      if (!actor) {
        return res
          .status(403)
          .json({ error: 'you are not a member of that server' });
      }
      if (!hasAnyModerationPermission(guild, actor)) {
        return res
          .status(403)
          .json({ error: 'you need moderation permissions in that server' });
      }
    }

    const gate = paidGate(req, guild.id, 'Dashboard moderation');
    if (gate) return res.status(gate.status).json({ error: gate.error });

    const query = String(req.query.query || '').trim().toLowerCase();
    let members;
    try {
      members = query
        ? [...(await guild.members.search({ query, limit: 25 })).values()]
        : [...guild.members.cache.values()];
    } catch {
      members = [...guild.members.cache.values()];
    }

    if (query) {
      members = members.filter(
        (m) =>
          m.user.username.toLowerCase().includes(query) ||
          (m.displayName || '').toLowerCase().includes(query) ||
          m.user.tag.toLowerCase().includes(query)
      );
    }

    members = members.slice(0, 50);
    res.json({
      members: members.map((m) => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName,
        tag: m.user.tag,
        bot: m.user.bot,
        avatar: m.user.displayAvatarURL({ size: 64 }),
      })),
    });
  });

  // Perform a moderation action in a guild the user can moderate.
  app.post('/api/moderation/action', guard, async (req, res) => {
    const { guildId, action, userId, duration, reason, channelId, amount } =
      req.body ?? {};
    const client = botState.client;

    if (!client || !client.isReady()) {
      return res.status(503).json({ error: 'bot is not connected' });
    }
    if (!ACTION_PERMISSIONS[action]) {
      return res
        .status(400)
        .json({ error: 'invalid action (ban, kick, timeout, or purge)' });
    }

    const guild = client.guilds.cache.get(String(guildId || ''));
    if (!guild) return res.status(404).json({ error: 'guild not found' });

    if (req.user && !(req.user.guildIds || []).includes(guild.id)) {
      return res
        .status(403)
        .json({ error: 'you do not have access to that server' });
    }

    const actor = req.user?.id ? await getMember(guild, req.user.id) : null;
    if (req.user) {
      if (!actor) {
        return res
          .status(403)
          .json({ error: 'you are not a member of that server' });
      }
      const permErr = permissionError(
        guild,
        actor,
        ACTION_PERMISSIONS[action],
        ACTION_LABELS[action]
      );
      if (permErr) return res.status(403).json({ error: permErr });
    }

    const gate = paidGate(req, guild.id, 'Dashboard moderation');
    if (gate) return res.status(gate.status).json({ error: gate.error });

    const by = req.user?.username || 'dashboard';
    const reasonText = String(reason || `Action via dashboard by ${by}`);

    try {
      if (action === 'purge') {
        if (!channelId || !Number.isInteger(amount) || amount < 1 || amount > 100) {
          return res
            .status(400)
            .json({ error: 'channelId and amount (1-100) are required' });
        }
        const channel = await guild.channels.fetch(String(channelId));
        if (!channel?.isTextBased()) {
          return res.status(400).json({ error: 'invalid channel' });
        }
        const deleted = await purgeMessages(channel, amount, null);
        return res.json({ ok: true, deleted });
      }

      if (typeof userId !== 'string' || !userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const target = await getMember(guild, userId);
      if (action === 'ban') {
        // Banning by ID is allowed even when the target isn't a member.
        const hier = target ? hierarchyError(guild, actor, target) : null;
        if (hier) return res.status(403).json({ error: hier });
        await banUser(guild, userId, `Banned by ${by} — ${reasonText}`);
        return res.json({ ok: true });
      }

      if (!target) {
        return res
          .status(400)
          .json({ error: 'that user is not in this server' });
      }
      const hier = hierarchyError(guild, actor, target);
      if (hier) return res.status(403).json({ error: hier });

      if (action === 'kick') {
        await kickMember(target, `Kicked by ${by} — ${reasonText}`);
        return res.json({ ok: true });
      }

      const ms = parseDuration(duration);
      if (ms == null || ms <= 0) {
        return res
          .status(400)
          .json({ error: 'invalid duration — use e.g. 30s, 10m, 1h, or 2d' });
      }
      if (ms > 28 * 24 * 60 * 60 * 1000) {
        return res
          .status(400)
          .json({ error: 'timeouts can be at most 28 days' });
      }
      await timeoutMember(
        target,
        ms,
        `Timed out by ${by} — ${reasonText}`
      );
      res.json({ ok: true, duration: formatDuration(ms) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------- Global VPN blocklist ----------
  async function requireApplicationOwner(req, res) {
    if (!req.user) {
      res.status(403).json({ error: 'dashboard owner access is required' });
      return false;
    }
    if (!botState.client?.isReady()) {
      res.status(503).json({ error: 'bot is not connected' });
      return false;
    }
    if (!(await isApplicationOwner(billingIdOf(req)))) {
      res.status(403).json({ error: 'only the Discord application owner can manage the VPN blocklist' });
      return false;
    }
    return true;
  }

  app.get('/api/vpn-blocklist', guard, async (req, res) => {
    if (!(await requireApplicationOwner(req, res))) return;
    res.json({ entries: getManualBlocklist() });
  });

  app.post('/api/vpn-blocklist', guard, async (req, res) => {
    if (!(await requireApplicationOwner(req, res))) return;
    const { ip } = req.body ?? {};
    if (typeof ip !== 'string' || !ip.trim()) {
      return res.status(400).json({ error: 'ip is required' });
    }
    try {
      const entry = addManualBlockedIp(ip, req.user.username || req.user.id);
      await flushDataSync();
      res.status(201).json({ entry });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/vpn-blocklist', guard, async (req, res) => {
    if (!(await requireApplicationOwner(req, res))) return;
    const { ip } = req.body ?? {};
    if (typeof ip !== 'string' || !ip.trim()) {
      return res.status(400).json({ error: 'ip is required' });
    }
    const removed = removeManualBlockedIp(ip);
    await flushDataSync();
    res.json({ ok: removed });
  });

  // ---------- Verification (captcha + verified role) ----------
  async function getVerificationGuild(req, res, guildId, requireManager = false) {
    const client = botState.client;
    if (!client || !client.isReady()) {
      res.status(503).json({ error: 'bot is not connected' });
      return null;
    }

    const guild = client.guilds.cache.get(String(guildId || ''));
    if (!guild) {
      res.status(404).json({ error: 'guild not found' });
      return null;
    }

    if (!req.user) return guild;
    if (!(req.user.guildIds || []).includes(guild.id)) {
      res.status(403).json({ error: 'you do not have access to that server' });
      return null;
    }

    if (requireManager) {
      const member = await getMember(guild, req.user.id);
      const isOwner = guild.ownerId === req.user.id;
      if (!member || (!isOwner && !member.permissions.has(PermissionFlagsBits.ManageGuild))) {
        res.status(403).json({ error: 'you need the Manage Server permission in that server' });
        return null;
      }
    }
    return guild;
  }

  async function rejectBlockedNetwork(req, res, config) {
    const result = await inspectIp(getClientIp(req), config.blockVpn);
    if (!result.blocked) return false;
    res.status(403).json({
      error: 'verification is blocked from VPN, proxy, Tor, or known datacenter networks',
      networkReason: result.reason,
    });
    return true;
  }

  // Servers where the signed-in user can configure verification, including
  // the roles/channels available to that server's configuration.
  app.get('/api/verification/guilds', guard, async (req, res) => {
    const client = botState.client;
    if (!client || !client.isReady()) {
      return res.json({ connected: false, guilds: [] });
    }

    const allowed = req.user ? new Set(req.user.guildIds || []) : null;
    const guilds = [];
    for (const guild of client.guilds.cache.values()) {
      if (allowed && !allowed.has(guild.id)) continue;
      if (req.user) {
        const member = await getMember(guild, req.user.id);
        const isOwner = guild.ownerId === req.user.id;
        if (!member || (!isOwner && !member.permissions.has(PermissionFlagsBits.ManageGuild))) {
          continue;
        }
      }

      const me = guild.members.me;
      const roles = [...guild.roles.cache.values()]
        .filter((role) => role.id !== guild.id && !role.managed)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({ id: role.id, name: role.name, position: role.position }));
      const channels = [...guild.channels.cache.values()]
        .filter(
          (channel) =>
            channel.isTextBased() &&
            (!me || channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages))
        )
        .map((channel) => ({ id: channel.id, name: channel.name }));
      const ext = guild.icon?.startsWith('a_') ? 'gif' : 'png';
      guilds.push({
        id: guild.id,
        name: guild.name,
        icon: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`
          : null,
        plan: guildPlanFor(req, guild.id),
        config: getVerificationConfig(guild.id),
        configured: isVerificationConfigured(getVerificationConfig(guild.id)),
        roles,
        channels,
      });
    }

    res.json({ connected: true, guilds });
  });

  app.put('/api/verification/config/:guildId', guard, async (req, res) => {
    const guild = await getVerificationGuild(req, res, req.params.guildId, true);
    if (!guild) return;

    const config = normalizeVerificationConfig(req.body ?? {});

    const advanced =
      config.blockVpn ||
      config.minAccountAgeDays > 0 ||
      config.requireAvatar ||
      config.joinBurst > 0 ||
      config.action !== 'none';
    if (advanced) {
      const gate = paidGate(req, guild.id, 'Advanced verification');
      if (gate) return res.status(gate.status).json({ error: gate.error });
    }

    if (config.roleId) {
      const role = guild.roles.cache.get(config.roleId);
      if (!role || role.id === guild.id || role.managed) {
        return res.status(400).json({ error: 'select a valid, non-managed verification role' });
      }
      const me = guild.members.me;
      if (me && role.position >= me.roles.highest.position) {
        return res.status(400).json({ error: 'the bot role must be higher than the verification role' });
      }
    }

    if (config.logChannelId) {
      const channel = guild.channels.cache.get(config.logChannelId);
      const me = guild.members.me;
      if (
        !channel?.isTextBased() ||
        (me && !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages))
      ) {
        return res.status(400).json({ error: 'select a text channel the bot can send messages in' });
      }
    }

    try {
      const saved = saveVerificationConfig(guild.id, config);
      await flushDataSync();
      res.json({ config: saved, configured: isVerificationConfigured(saved) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/verify', (req, res) =>
    res.sendFile(path.join(PUBLIC_DIR, 'verify.html'))
  );

  app.get('/api/verify/status', guard, async (req, res) => {
    const guildId = String(req.query.guild || '');
    if (!req.user) return res.json({ signedIn: false });

    const client = botState.client;
    const guild = client?.guilds.cache.get(guildId);
    const config = getVerificationConfig(guildId);
    const inGuild = (req.user.guildIds || []).includes(guildId);

    let verified = null;
    if (inGuild && config.roleId) {
      verified = await isMemberVerified(guildId, req.user.id, config.roleId);
    }
    const network = inGuild && verified !== true
      ? await inspectIp(getClientIp(req), config.blockVpn)
      : null;

    res.json({
      signedIn: true,
      member: inGuild,
      verified,
      roleRequired: Boolean(config.roleId),
      configured: isVerificationConfigured(config),
      networkBlocked: Boolean(network?.blocked),
      networkReason: network?.reason || null,
      guildName: guild?.name || null,
      botConnected: Boolean(client?.isReady()),
    });
  });

  app.get('/api/verify/captcha', guard, async (req, res) => {
    const guildId = String(req.query.guild || '');
    if (!req.user) return res.status(401).json({ error: 'not signed in' });
    if (!(req.user.guildIds || []).includes(guildId)) {
      return res.status(403).json({ error: 'you are not a member of this server' });
    }
    const config = getVerificationConfig(guildId);
    if (!isVerificationConfigured(config)) {
      return res.status(503).json({ error: 'verification is not configured for this server' });
    }
    if (await rejectBlockedNetwork(req, res, config)) return;
    const captcha = createCaptcha();
    res.json({ id: captcha.id, svg: captcha.svg });
  });

  app.post('/api/verify/complete', guard, async (req, res) => {
    const { guild, captchaId, answer } = req.body ?? {};
    const guildId = String(guild || '');
    const config = getVerificationConfig(guildId);

    if (!req.user) return res.status(401).json({ error: 'not signed in' });
    if (!isVerificationConfigured(config)) {
      return res.status(500).json({ error: 'verification is not configured for this server' });
    }
    if (await rejectBlockedNetwork(req, res, config)) return;
    if (!(req.user.guildIds || []).includes(guildId)) {
      return res.status(403).json({ error: 'you are not a member of this server' });
    }
    if (!verifyCaptcha(captchaId, answer)) {
      return res.status(400).json({ error: 'incorrect captcha, please try again' });
    }

    try {
      await assignRole(guildId, req.user.id, config.roleId);
      res.json({ ok: true });
    } catch (e) {
      res.status(503).json({ error: e.message });
    }
  });

  // ---------- Automation (autorole + role restore) ----------
  app.get('/api/automation/guilds', guard, async (req, res) => {
    const guilds = await listManageableGuilds(req);
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds: guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        roles: [...guild.roles.cache.values()]
          .filter((role) => role.id !== guild.id && !role.managed)
          .sort((a, b) => b.position - a.position)
          .map((role) => ({
            id: role.id,
            name: role.name,
            position: role.position,
          })),
        plan: guildPlanFor(req, guild.id),
        autoroles: getAutoroleConfig(guild.id).roleIds,
        restoreEnabled: isRestoreEnabled(guild.id),
      })),
    });
  });

  app.put('/api/automation/:guildId', guard, async (req, res) => {
    const guildId = String(req.params.guildId || '');
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, guildId, 'Automation');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    const body = req.body ?? {};
    if (Array.isArray(body.autoroles)) {
      setAutoroleRoles(guildId, body.autoroles.map(String).filter(Boolean));
    }
    if (typeof body.restoreEnabled === 'boolean') {
      setRestoreEnabled(guildId, body.restoreEnabled);
    }
    res.json({
      ok: true,
      autoroles: getAutoroleConfig(guildId).roleIds,
      restoreEnabled: isRestoreEnabled(guildId),
    });
  });

  // ---------- Tickets ----------
  app.get('/api/tickets/guilds', guard, async (req, res) => {
    const guilds = await listManageableGuilds(req);
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds: guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        categories: [...guild.channels.cache.values()]
          .filter((channel) => channel.type === ChannelType.GuildCategory)
          .map((channel) => ({ id: channel.id, name: channel.name })),
        roles: [...guild.roles.cache.values()]
          .filter((role) => role.id !== guild.id && !role.managed)
          .sort((a, b) => b.position - a.position)
          .map((role) => ({ id: role.id, name: role.name })),
        plan: guildPlanFor(req, guild.id),
        config: getTicketConfig(guild.id),
      })),
    });
  });

  app.put('/api/tickets/:guildId', guard, async (req, res) => {
    const guildId = String(req.params.guildId || '');
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, guildId, 'Tickets');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    const config = setTicketConfig(guildId, {
      categoryId: req.body?.categoryId || null,
      staffRoleId: req.body?.staffRoleId || null,
    });
    res.json({ config });
  });

  // ---------- Appeals (review) ----------
  app.get('/api/appeals/guilds', guard, async (req, res) => {
    const guilds = await listManageableGuilds(req);
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds: guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        plan: guildPlanFor(req, guild.id),
      })),
    });
  });

  app.get('/api/appeals', guard, async (req, res) => {
    const guildId = String(req.query.guildId || '');
    if (!guildId) return res.status(400).json({ error: 'guildId is required' });
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, guildId, 'Appeals');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    res.json({ appeals: listAppeals({ guildId }) });
  });

  app.post('/api/appeals/:id/review', guard, async (req, res) => {
    const appeal = getAppeal(req.params.id);
    if (!appeal) return res.status(404).json({ error: 'appeal not found' });
    if (!(await canManageGuild(req, appeal.guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, appeal.guildId, 'Appeals');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    const { decision, note } = req.body ?? {};
    if (decision !== 'approve' && decision !== 'deny') {
      return res.status(400).json({ error: 'decision must be approve or deny' });
    }
    if (appeal.status !== 'pending') {
      return res.status(400).json({ error: 'appeal already reviewed' });
    }
    if (decision === 'approve' && appeal.userId) {
      const guild = botState.client?.guilds.cache.get(appeal.guildId);
      try {
        await guild?.bans.remove(
          appeal.userId,
          `Appeal approved by ${req.user?.username || 'dashboard'}`
        );
      } catch {
        // The user may already be unbanned; the review still proceeds.
      }
    }
    const updated = reviewAppeal(appeal.id, {
      status: decision === 'approve' ? 'approved' : 'denied',
      reviewedBy: req.user?.username || 'dashboard',
      note,
    });
    res.json(updated);
  });

  // ---------- Leveling ----------
  app.get('/api/leveling/guilds', guard, async (req, res) => {
    const guilds = await listManageableGuilds(req);
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds: guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        channels: [...guild.channels.cache.values()]
          .filter((channel) => channel.isTextBased())
          .map((channel) => ({ id: channel.id, name: channel.name })),
        plan: guildPlanFor(req, guild.id),
        config: getLevelConfig(guild.id),
        leaderboard: getLeaderboard(guild.id, 10).map((entry) => {
          const member = guild.members.cache.get(entry.userId);
          return {
            ...entry,
            username: member
              ? member.displayName || member.user.username
              : entry.userId,
          };
        }),
      })),
    });
  });

  app.put('/api/leveling/:guildId', guard, async (req, res) => {
    const guildId = String(req.params.guildId || '');
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, guildId, 'Leveling');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    const body = req.body ?? {};
    const input = {};
    if (body.levelUpChannelId !== undefined) {
      input.levelUpChannelId =
        typeof body.levelUpChannelId === 'string' && body.levelUpChannelId.trim()
          ? body.levelUpChannelId.trim()
          : null;
    }
    if (typeof body.announce === 'boolean') input.announce = body.announce;
    if (body.voiceXpPerMinute !== undefined) {
      input.voiceXpPerMinute = body.voiceXpPerMinute;
    }
    const config = setLevelConfig(guildId, input);
    res.json({ config });
  });

  app.post('/api/leveling/:guildId/reset', guard, async (req, res) => {
    const guildId = String(req.params.guildId || '');
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const gate = paidGate(req, guildId, 'Leveling');
    if (gate) return res.status(gate.status).json({ error: gate.error });
    resetGuildXp(guildId);
    res.json({ ok: true });
  });

  // ---------- Billing (internal credits + subscriptions) ----------
  app.get('/api/billing', guard, async (req, res) => {
    const userId = billingIdOf(req);
    const guilds = req.user ? await listManageableGuilds(req) : [];
    let isOwner = false;
    if (userId) isOwner = await isApplicationOwner(userId);
    res.json({
      currency: CURRENCY,
      balance: userId ? getBalance(userId) : 0,
      plan: userId ? getUserPlan(userId) : 'free',
      isOwner,
      plans: Object.fromEntries(
        Object.entries(PLANS).map(([key, plan]) => [key, { ...plan }])
      ),
      guilds: guilds.map((guild) => {
        const sub = getGuildSubscription(guild.id);
        return {
          id: guild.id,
          name: guild.name,
          plan: guildPlanFor(req, guild.id),
          expiresAt: sub ? sub.expiresAt : null,
        };
      }),
    });
  });

  app.post('/api/billing/subscribe', guard, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'sign in to subscribe' });
    const { guildId, plan = 'pro', months = 1 } = req.body ?? {};
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    try {
      const result = subscribeGuild({
        userId: billingIdOf(req),
        guildId: String(guildId || ''),
        plan,
        months,
      });
      if (!result.ok) return res.status(402).json({ error: result.error });
      await flushDataSync();
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/billing/cancel', guard, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'sign in to cancel' });
    const { guildId } = req.body ?? {};
    if (!(await canManageGuild(req, guildId))) {
      return res
        .status(403)
        .json({ error: 'you need the Manage Server permission in that server' });
    }
    const ok = cancelSubscription(String(guildId || ''));
    await flushDataSync();
    res.json({ ok });
  });

  app.post('/api/billing/grant', guard, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'sign in to grant' });
    if (!(await isApplicationOwner(billingIdOf(req)))) {
      return res
        .status(403)
        .json({ error: 'only the application owner can grant credits' });
    }
    const { userId, amount } = req.body ?? {};
    try {
      const balance = grantCredits(userId, amount);
      await flushDataSync();
      res.json({ balance });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ---------- Static (public, but never auto-serve index.html) ----------
  app.use(express.static(PUBLIC_DIR, { index: false }));

  // 404 fallback — JSON for API routes, themed page for everything else.
  app.use((req, res) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  });

  app.listen(port, () => {
    console.log(`[web] dashboard listening on http://localhost:${port}`);
    if (discordAuthEnabled) {
      console.log(`[web] Discord OAuth enabled — redirect URI: ${redirectUri}`);
    }
    if (localAuthEnabled) {
      console.log('[web] Local accounts (username/password) enabled.');
    }
    if (!authEnabled) {
      console.warn('[web] No auth methods configured — dashboard is UNPROTECTED.');
    }
  });

  return app;
}
