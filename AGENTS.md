# AGENTS.md

Guidance for AI coding agents working in the Squared One repository.

## Project overview

Squared One is a multitool Discord bot with a web dashboard:

- **Bot** (discord.js v14): rules management, announcements, rule embeds,
  moderation (`ban`/`kick`/`timeout`/`purge`), and utility commands
  (`userinfo`, `serverinfo`, `avatar`, `ping`).
- **Web** (Express): a red/black neon dashboard behind Discord OAuth login,
  plus a public homepage and legal pages.
- **Frontend**: plain HTML/CSS/JS — no framework, no bundler, no build step.

## Stack & prerequisites

- Node.js 18+ (ESM — `"type": "module"`)
- `discord.js`, `express`, `dotenv` (see `package.json`; don't add dependencies
  without asking)
- No test runner, linter, or typechecker is configured

## Commands

```bash
npm install        # install dependencies
npm start          # run (node src/index.js)
npm run dev        # run with auto-reload (node --watch)
node --check <file>  # syntax-check a JS file
```

To run the web server without a bot token (e.g. to test the dashboard):

```bash
DISCORD_TOKEN= PORT=3000 node src/index.js
```

## Architecture

```
src/
  index.js      # entry point — loads env, starts web server + bot
  bot.js        # Discord client, slash commands, interaction handlers
  rules.js      # rule store (defaults + JSON persistence to data/rules.json)
  auth.js       # HMAC-signed session cookie + Discord OAuth helpers
  server.js     # Express server: OAuth routes, API, static pages
public/
  home.html       # public landing page
  dashboard.html  # authenticated dashboard (sidebar: overview/rules/servers/tools)
  login.html      # OAuth login page
  privacy.html    # privacy policy
  terms.html      # terms of service
  style.css       # shared stylesheet (red/black neon theme)
  app.js          # dashboard logic
  particles.js    # shared particle-canvas background
data/
  rules.json    # custom rules (created at runtime)
```

## Conventions

- **ES modules** with named exports; keep modules importable without side
  effects where possible.
- **No framework**: frontend changes go in the existing `public/*.html`,
  `style.css`, and `app.js` files.
- **Theme**: red-on-black (`--red: #ff0000`, near-black background), JetBrains
  Mono + Outfit fonts, corner-bracket panels, CRT scanlines. Reuse the existing
  CSS variables and utility classes (`.panel`, `.btn`, `.field`, `.tag`,
  `.status-pill`, etc.) instead of inventing new styling where possible.
- When editing dashboard markup, keep every ID/class that `app.js` references
  intact (`#stat-*`, `#rules-list`, `#add-rule-form`, `#toast`, etc.).
- Environment configuration lives in `.env` (see `.env.example`). Never
  hardcode secrets or tokens.

## Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | for the bot | Bot token |
| `CLIENT_ID` | for invite/OAuth | Application ID |
| `CLIENT_SECRET` | for OAuth | OAuth2 client secret (enables login) |
| `SESSION_SECRET` | recommended | Signs session cookies (falls back to `CLIENT_SECRET`) |
| `PORT` | no (3000) | Web server port |
| `COOKIE_SECURE` | no | `true` to send cookies over HTTPS only |

## Verification checklist

1. Run `node --check` on every changed JS file.
2. Boot with `DISCORD_TOKEN= PORT=3xxx node src/index.js` and check `/health`,
   `/`, and (when auth is configured) the `/login` redirect behavior.
3. If you changed the frontend, confirm all pages still load and that no stale
   CSS class or element IDs are referenced (grep for removed identifiers).

## Notes

- Do not commit `data/rules.json`, `.env`, or `node_modules`.
- Slash commands are registered globally on boot and can take up to an hour to
  propagate to Discord.
