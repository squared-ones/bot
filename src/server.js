import express from 'express';
import crypto from 'node:crypto';
import { PermissionFlagsBits } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getAllRules,
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
import { buildEmbedFromSpec, validateEmbedSpec } from './embed.js';
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

const APP_URL = 'https://squared-one.onrender.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const sessionSecret = process.env.SESSION_SECRET || clientSecret;
  const authEnabled = Boolean(clientId && clientSecret);

  const redirectUri = `${APP_URL}/auth/discord/callback`;

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

  // Auth guard — a no-op when OAuth isn't configured, so the dashboard
  // still works out of the box until CLIENT_SECRET is set.
  const guard = (req, res, next) => {
    if (!authEnabled) return next();
    if (!req.user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      return res.redirect('/login');
    }
    next();
  };

  // ---------- OAuth ----------
  app.get('/login', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    if (!authEnabled) {
      return res
        .status(503)
        .send(
          'Discord OAuth is not configured. Set CLIENT_ID and CLIENT_SECRET (and optionally SESSION_SECRET) in .env, then restart.'
        );
    }
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  });

  app.get('/auth/discord/login', (req, res) => {
    if (!authEnabled) return res.redirect('/login');
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

  app.get('/auth/discord/callback', async (req, res) => {
    if (!authEnabled) return res.redirect('/login');
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

      const now = Math.floor(Date.now() / 1000);
      setSessionCookie(
        res,
        {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          guildIds: (guilds || []).map((g) => g.id).slice(0, 200),
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

  app.post('/webhooks/topgg', (req, res) => {
    if (!process.env.TOPGG_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Top.gg webhook secret is not configured' });
    }
    if (!verifyTopggWebhook(req)) return res.status(401).json({ error: 'invalid webhook signature' });
    const vote = topggVote(req.body);
    if (!vote) return res.json({ ok: true, test: true });
    try {
      const result = recordVote(vote);
      console.log(`[vote] Top.gg vote recorded for ${vote.userId}${result.duplicate ? ' (duplicate)' : ''}.`);
      res.json({ ok: true, duplicate: result.duplicate });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/webhooks/discordbotlist', (req, res) => {
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
      console.log(`[vote] Discord Bot List vote recorded for ${body.id}${result.duplicate ? ' (duplicate)' : ''}.`);
      res.json({ ok: true, duplicate: result.duplicate });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/votes', guard, (req, res) => {
    res.json(getVoteStats());
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

  // Servers the bot is in (name + icon). Scoped to the logged-in user's
  // guilds when a session is present; public (all bot guilds) for the homepage.
  app.get('/api/servers', (req, res) => {
    const client = botState.client;
    const connected = Boolean(client?.isReady());
    const allowed = req.user ? new Set(req.user.guildIds || []) : null;
    const servers = connected
      ? client.guilds.cache
          .filter((g) => !allowed || allowed.has(g.id))
          .map((g) => {
            const ext = g.icon?.startsWith('a_') ? 'gif' : 'png';
            return {
              id: g.id,
              name: g.name,
              icon: g.icon
                ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=64`
                : null,
            };
          })
      : [];
    res.json({ connected, servers });
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

  // ---------- Dashboard (protected) ----------
  app.get('/dashboard', guard, (req, res) => res.sendFile(DASHBOARD_FILE));

  app.get('/api/session', guard, (req, res) => {
    if (!req.user) {
      // OAuth not configured — the dashboard runs unprotected.
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar,
        guildCount: (req.user.guildIds || []).length,
      },
    });
  });

  // ---------- Rules API (protected) ----------
  app.get('/api/rules', guard, (req, res) => {
    res.json(getAllRules());
  });

  app.post('/api/rules', guard, (req, res) => {
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
    const rule = addCustomRule(title, description);
    res.status(201).json(rule);
  });

  app.delete('/api/rules/:id', guard, (req, res) => {
    const ok = removeCustomRule(req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ error: 'rule not found or is a default rule' });
    }
    res.json({ ok: true });
  });

  // ---------- Channels (scoped to the logged-in user's guilds) ----------
  app.get('/api/channels', guard, (req, res) => {
    const all = getGuildChannels();
    // When OAuth is active, scope to the guilds the user belongs to.
    const guilds = req.user
      ? all.filter((g) => (req.user.guildIds || []).includes(g.id))
      : all;
    res.json({
      connected: Boolean(botState.client?.isReady()),
      guilds,
    });
  });

  // ---------- Embed posting (scoped to the logged-in user's guilds) ----------
  app.post('/api/embed', guard, async (req, res) => {
    const { channelId, embed } = req.body ?? {};
    const client = botState.client;

    if (!client || !client.isReady()) {
      return res.status(503).json({ error: 'bot is not connected' });
    }
    if (typeof channelId !== 'string' || !channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }

    const spec = embed && typeof embed === 'object' ? embed : {};
    const err = validateEmbedSpec(spec);
    if (err) return res.status(400).json({ error: err });

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        return res
          .status(400)
          .json({ error: 'channel not found or is not text-based' });
      }

      // Only allow posting to channels in guilds the user belongs to.
      if (req.user && !(req.user.guildIds || []).includes(channel.guildId)) {
        return res
          .status(403)
          .json({ error: 'you do not have access to that channel' });
      }

      await channel.send({ embeds: [buildEmbedFromSpec(spec)] });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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
    if (!(await isApplicationOwner(req.user.id))) {
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
    res.json({ ok: removeManualBlockedIp(ip) });
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
    if (authEnabled) {
      console.log(
        `[web] Discord OAuth enabled — redirect URI: ${redirectUri}`
      );
    } else {
      console.warn(
        '[web] Discord OAuth not configured (set CLIENT_SECRET) — dashboard is UNPROTECTED.'
      );
    }
  });

  return app;
}
