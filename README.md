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
- **Rule embeds** — `/rules` and `/postrules` present the server rules in
  consistent Discord embeds.
- **Web dashboard** — red/black neon UI with live bot stats, rules, moderation,
  verification, voting, and server management.
- **Discord OAuth login** — sign in with Discord; channel listing is scoped
  to servers you actually belong to.
- **Dashboard moderation** — ban, kick, timeout, and purge members from the
  dashboard, scoped to servers where you hold the matching permission.
- **Verification** — a self-hosted CAPTCHA gate that grants a "Verified" role
  after passing, plus anti-alt/anti-raid detections (account age, default
  avatar, and join bursts).
- **Voting system** — clickable `/vote` buttons for Top.gg and Discord Bot List,
  signed webhook tracking, vote statistics, and private-DM cooldown reminders.
- **Private GitHub data storage** — runtime files in `data/` are loaded from and
  committed to the private `squared-ones/data` repository.
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

# Private GitHub data repository
GITHUB_TOKEN=your-github-token
GITHUB_DATA_REPO=squared-ones/data
GITHUB_DATA_BRANCH=main

# Voting webhook secrets
TOPGG_WEBHOOK_SECRET=whs_your-topgg-webhook-secret
DBL_WEBHOOK_TOKEN=your-discord-bot-list-webhook-token

# Optional — links shown on the /support page
# SUPPORT_SERVER=https://discord.gg/your-invite
# GITHUB_URL=https://github.com/you/squared-one
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
2. Add this **Redirect** URL exactly:
   `https://squared-one.onrender.com/auth/discord/callback`.
3. Copy the **Client Secret** into `CLIENT_SECRET`.

With OAuth enabled the dashboard redirects unauthenticated visitors to
`/login`, and `/api/channels` are restricted to servers the
logged-in user is a member of — so nobody can post to channels in servers they
don't belong to. If `CLIENT_SECRET` is not set, the dashboard runs unprotected
(handy for local dev).

### Verification

Squared One can gate a "Verified" role behind a self-hosted CAPTCHA. Open the
**Verification** section of the dashboard to configure each server separately:

- Choose the role granted after a successful CAPTCHA.
- Enable self-hosted VPN, proxy, Tor, and known datacenter blocking.
- Configure account-age and default-avatar detection.
- Configure join-burst detection, the action for flagged joins (`none`, `kick`, or `ban`), and an optional log channel.

Configurations are saved in `data/verification.json`, keyed by Discord server ID.
A server manager can configure any server they manage without editing `.env` or
restarting the bot. Users run `/verify` or click a panel posted with
`/verification-panel`, sign in with Discord, and solve the CAPTCHA; on success
the configured role is added. Verification links use the
fixed application URL `https://squared-one.onrender.com`, not a per-server URL
setting.

VPN blocking is self-hosted: the server evaluates the verifier's IP against
Tor exit-node and VPN/datacenter CIDR lists refreshed in memory every hour. The
Discord application owner can also use the dashboard's **VPN Blocklist** page
to flag exact IPv4/IPv6 addresses manually; those entries are saved in
`data/vpn-blocklist.json` and synced to the private data repository. It does not
require a paid IP-detection API. Detection only applies to the web verification
flow because Discord does not provide member IP addresses. If the public lists
cannot be refreshed, manually flagged addresses still work and automatic list
detection fails open. When running behind a trusted reverse proxy, set
`TRUST_PROXY=true` so Express can obtain the original client IP.

### Voting

`/vote` sends clickable buttons for both listing sites. Configure the following
webhook URLs in the respective bot dashboards:

- Top.gg: `https://your-domain.example/webhooks/topgg`
- Discord Bot List: `https://your-domain.example/webhooks/discordbotlist`

Store the Top.gg v1 secret in `TOPGG_WEBHOOK_SECRET` and the Discord Bot List
Authorization token in `DBL_WEBHOOK_TOKEN`. Incoming webhooks are authenticated
before they are recorded in `data/votes.json`. The dashboard's **Voting** page
shows totals and recent votes. The bot checks for due votes every ten minutes
and privately DMs voters after the 12-hour cooldown with fresh vote links.
Vote rewards are currently disabled.

### GitHub data storage

Set `GITHUB_TOKEN` to a fine-grained GitHub token with **Contents: read and write**
access to the private `squared-ones/data` repository. On startup, the repository
root is loaded into the local `data/` directory. Every change to a data file is
then committed back to that repository. This includes `rules.json`,
`verification.json`, `vpn-blocklist.json`, and future files added under `data/`.

The token must stay in `.env` or the hosting provider's secret store; never commit
it to this repository. If GitHub is unavailable at startup, the app logs the
failure and falls back to the local data directory.

## Slash commands

| Command        | Who         | What it does                                   |
| -------------- | ----------- | ---------------------------------------------- |
| `/rules`       | everyone    | Shows all rules (default + custom)             |
| `/addrule`     | moderators  | Adds a custom rule (title + description)       |
| `/removerule`  | moderators  | Removes a custom rule (autocomplete list)      |
| `/postrules`   | moderators  | Posts the rules embed to a channel             |
| `/announce`    | moderators  | Posts a markdown announcement                    |
| `/ban`         | moderators  | Bans a member (Ban Members permission)         |
| `/kick`        | moderators  | Kicks a member (Kick Members permission)       |
| `/timeout`     | moderators  | Times out a member, e.g. `10m` (Moderate Members) |
| `/purge`       | moderators  | Deletes recent messages, optionally from one user (Manage Messages) |
| `/userinfo`    | everyone    | Shows info about a user                       |
| `/serverinfo`  | everyone    | Shows info about the server                   |
| `/avatar`      | everyone    | Shows a user's avatar                        |
| `/ping`        | everyone    | Checks bot latency                           |
| `/vote`        | everyone    | Vote links for top.gg and Discord Bot List   |
| `/help`        | everyone    | Shows all Squared One commands               |
| `/verify`      | everyone    | Sends a link to complete verification        |
| `/verification-panel` | moderators | Posts a button-based verification panel   |

> "Moderators" means anyone with the **Manage Server** permission.
> Slash commands are registered globally on boot (may take up to an hour to
> propagate; restart Discord to see them immediately).
>

## Web endpoints

| Method | Path                    | Description                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| GET    | `/`                     | Public homepage                                    |
| GET    | `/privacy`              | Privacy policy (public)                            |
| GET    | `/terms`                | Terms of service (public)                          |
| GET    | `/support`              | Support / help-center page (public)                |
| GET    | `/dashboard`            | Dashboard (requires login when OAuth is enabled)   |
| GET    | `/health`               | JSON health + bot status (public)                  |
| GET    | `/api/invite`           | Bot invite URL (public)                            |
| GET    | `/api/meta`             | Invite + support/repo links for the support page   |
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
| POST   | `/webhooks/topgg`       | Receive authenticated Top.gg vote events            |
| POST   | `/webhooks/discordbotlist` | Receive authenticated Discord Bot List vote events |
| GET    | `/api/votes`            | Vote totals and recent vote history                 |
| GET    | `/api/moderation/guilds` | Servers you can moderate + per-action permissions |
| GET    | `/api/moderation/members`| Search members (`?guildId=&query=`)                 || POST   | `/api/moderation/action` | Ban / kick / timeout / purge (scoped + permission-checked) |
| GET    | `/api/verification/guilds` | Servers manageable for verification + saved configs |
| PUT    | `/api/verification/config/:guildId` | Save one server's verification config |
| GET    | `/api/vpn-blocklist`     | List manually flagged IPs (application owner)      |
| POST   | `/api/vpn-blocklist`     | Flag an exact IP as VPN (application owner)        |
| DELETE | `/api/vpn-blocklist`     | Remove an exact flagged IP (application owner)     |
| GET    | `/verify`                | Verification page (public)                         |

| GET    | `/api/verify/status`    | Verification status for the signed-in user         |
| GET    | `/api/verify/captcha`   | Fresh captcha image                                |
| POST   | `/api/verify/complete`  | Submit captcha + grant the verified role           |

> All `/api/*` routes and `/dashboard` require a valid session when
> `CLIENT_SECRET` is set. The homepage, `/privacy`, `/terms`, `/health`,
> `/api/invite`, `/login`, and the OAuth routes are public.

## Building

`npm run build` bundles the server into `dist/index.js` without obfuscating it,
then obfuscates the browser JavaScript and inline frontend scripts with
[javascript-obfuscator](https://www.npmjs.com/package/javascript-obfuscator)
and copies the web assets into `dist/`:

```bash
npm run build        # bundle server + obfuscate frontend → dist/
npm run start:dist   # run the built bundle (from the project root)
```

The `dist/` folder is self-contained and deployable:

```bash
cd dist
npm install --omit=dev
cp .env.example .env   # then fill it in
npm start
```

`dist/index.js` is bundled to readable CommonJS (dependencies stay external)
and is not obfuscated. Browser `.js` files and inline scripts inside the copied
HTML files receive control-flow flattening, dead-code injection, a
base64-encoded string array, and identifier renaming. `public/` and an empty
`data/` folder are copied alongside it.

## Project structure

```
src/
  index.js    # entry point — starts web server + bot
  bot.js      # Discord client, slash commands, join DM
  rules.js    # rule store (defaults + JSON persistence)
  moderation.js # shared moderation helpers (permissions, ban/kick/timeout/purge)
  auth.js     # Discord OAuth + signed session cookie
  captcha.js  # self-hosted SVG captcha
  network-detection.js # self-hosted VPN/proxy/Tor CIDR detection
  verification.js # per-server config store + anti-alt / anti-raid detection
  voting.js   # vote tracking, deduplication, and reminder state
  server.js   # Express server, /health, rules + moderation + verification API
scripts/
  build.js    # bundle server + obfuscate frontend → dist/
public/
  home.html      # public homepage
  dashboard.html # dashboard markup
  login.html     # Discord OAuth login page
  privacy.html   # privacy policy
  terms.html     # terms of service
  support.html   # support / help-center page
  verify.html    # verification page
  style.css      # red/black neon theme
  app.js         # dashboard logic, server picker, voting, and moderation
  particles.js   # shared particle-canvas background
dist/
  index.js    # readable bundled server build (generated by npm run build)
  public/     # copied static assets
  data/       # runtime rules store
  package.json
data/
  rules.json        # custom rules (created at runtime)
  verification.json # per-server verification settings (synced to GitHub)
  vpn-blocklist.json # manually flagged exact IPs (synced to GitHub)
  votes.json        # vote events and reminder state (synced to GitHub)
```
