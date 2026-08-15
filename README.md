# Squared One

A Discord bot that manages your server's rules for you, plus a neon web
dashboard to view and edit them. Ships with a sensible set of default rules
that you can extend with your own.

## Features

- **Default rules out of the box** — respect, no spam, no NSFW, no ads, ToS,
  listen to mods. Default rules can't be removed.
- **Custom rules** — add and remove your own via slash commands or the web
  dashboard. Persisted to `data/rules.json`.
- **Posts rules for you** — DM new members the rules on join, or post them to
  any channel with `/postrules`.
- **Markdown formatting** — rule titles/descriptions and announcements support
  Discord markdown (**bold**, *italic*, `code`, links, blockquotes, etc.).
- **Rich embeds** — build custom embeds (title, description, color, fields,
  author, footer, thumbnail, image) via `/embed` in Discord or the dashboard's
  live embed builder.
- **Web dashboard** — red/black neon UI with live bot stats, markdown preview,
  and an embed builder.
- **Discord OAuth login** — sign in with Discord; channel listing and embed
  posting are scoped to servers you actually belong to.
- **`/health` endpoint** — JSON health/status check.
- **Plain HTML/CSS/JS frontend**, **Node.js + Express** backend.

## Requirements

- Node.js 18+
- A Discord application + bot token
  ([discord.com/developers/applications](https://discord.com/developers/applications))
- **Enable the "Server Members" privileged intent** (used to DM new members
  and count members) under *Bot → Privileged Gateway Intents*.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
CLIENT_SECRET=your-oauth2-client-secret
SESSION_SECRET=a-long-random-secret
PORT=3000
```

Run it:

```bash
npm start          # or: npm run dev (auto-reload)
```

On boot the console prints an invite link (if `CLIENT_ID` is set) — open it to
add the bot to your server. The homepage is at <http://localhost:3000> and the
dashboard at <http://localhost:3000/dashboard>.

### Discord OAuth login

Setting `CLIENT_SECRET` enables login. Configure your Discord application:

1. Go to **OAuth2** in the [developer portal](https://discord.com/developers/applications).
2. Add a **Redirect** URL pointing at your dashboard, e.g.
   `http://localhost:3000/auth/discord/callback`. Use the `REDIRECT_URI` env
   var to change it (or `PUBLIC_URL` for a hosted setup).
3. Copy the **Client Secret** into `CLIENT_SECRET`.

With OAuth enabled the dashboard redirects unauthenticated visitors to
`/login`, and `/api/channels` + `/api/embed` are restricted to servers the
logged-in user is a member of — so nobody can post to channels in servers they
don't belong to. If `CLIENT_SECRET` is not set, the dashboard runs unprotected
(handy for local dev).

## Slash commands

| Command        | Who         | What it does                                   |
| -------------- | ----------- | ---------------------------------------------- |
| `/rules`       | everyone    | Shows all rules (default + custom)             |
| `/addrule`     | moderators  | Adds a custom rule (title + description)       |
| `/removerule`  | moderators  | Removes a custom rule (autocomplete list)      |
| `/postrules`   | moderators  | Posts the rules embed to a channel             |
| `/announce`    | moderators  | Posts a markdown announcement (optionally as an embed) |
| `/embed`       | moderators  | Builds and posts a rich embed                  |

> "Moderators" means anyone with the **Manage Server** permission.
> Slash commands are registered globally on boot (may take up to an hour to
> propagate; restart Discord to see them immediately).
>
> `/embed` accepts a `fields` option as a JSON array, e.g.
> `[{"name":"Info","value":"hi","inline":true}]`. `color` takes a hex value
> like `#5865F2`.

## Web endpoints

| Method | Path                    | Description                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| GET    | `/`                     | Public homepage                                    |
| GET    | `/dashboard`            | Dashboard (requires login when OAuth is enabled)   |
| GET    | `/health`               | JSON health + bot status (public)                  |
| GET    | `/api/invite`           | Bot invite URL (public)                            |
| GET    | `/api/servers`          | Servers the bot is in — name + icon (public)       |
| GET    | `/login`                | Discord OAuth login page                           |
| GET    | `/auth/discord/login`   | Redirects to Discord OAuth                         |
| GET    | `/auth/discord/callback`| OAuth callback                                     |
| GET    | `/logout`               | Clears the session                                 |
| GET    | `/api/session`          | Current user (null when OAuth is disabled)         |
| GET    | `/api/rules`            | List all rules                                     |
| POST   | `/api/rules`            | Add a custom rule `{ title, description }`         |
| DELETE | `/api/rules/:id`        | Remove a custom rule                               |
| GET    | `/api/channels`         | Guilds/channels the bot can post in (scoped to you) |
| POST   | `/api/embed`            | Post an embed `{ channelId, embed }` (scoped to you) |

> All `/api/*` routes and `/dashboard` require a valid session when
> `CLIENT_SECRET` is set. The homepage, `/health`, `/api/invite`, `/login`,
> and the OAuth routes are public.

## Project structure

```
src/
  index.js    # entry point — starts web server + bot
  bot.js      # Discord client, slash commands, join DM
  rules.js    # rule store (defaults + JSON persistence)
  embed.js    # embed validation + builder helper
  auth.js     # Discord OAuth + signed session cookie
  server.js   # Express server, /health, rules + embed API
public/
  home.html      # public homepage
  dashboard.html # dashboard markup
  login.html     # Discord OAuth login page
  style.css      # red/black neon theme
  app.js         # dashboard logic, markdown preview, embed builder
data/
  rules.json  # custom rules (created at runtime)
```
