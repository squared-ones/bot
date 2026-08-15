import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAllRules,
  addCustomRule,
  removeCustomRule,
} from './rules.js';
import { botState, getGuildChannels } from './bot.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const HOME_FILE = path.join(PUBLIC_DIR, 'home.html');
const DASHBOARD_FILE = path.join(PUBLIC_DIR, 'dashboard.html');

export function startServer(port = 3000) {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET || clientSecret;
  const authEnabled = Boolean(clientId && clientSecret);

  const redirectUri =
    process.env.REDIRECT_URI ||
    (process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL.replace(/\/$/, '')}/auth/discord/callback`
      : `http://localhost:${port}/auth/discord/callback`);

  const app = express();
  app.use(express.json());
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
      res.redirect('/dashboard');
    } catch (err) {
      console.error('[auth] oauth callback error:', err.message);
      res.redirect('/login?error=' + encodeURIComponent('Failed to sign in.'));
    }
  });

  app.get('/logout', (req, res) => {
    clearSessionCookie(res);
    res.redirect('/');
  });

  // ---------- Public ----------
  app.get('/api/invite', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    if (!clientId) return res.json({ url: null });
    res.json({
      url: `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`,
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
