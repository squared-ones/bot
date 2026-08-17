# Squared One Worker App

Run one of the Squared One bot's Discord shards from your own machine and earn
**SQ credits** for every hour it stays online.

The main server runs its own shard; community members like you run the rest.
Each worker is a full shard of the bot — it handles commands, verification,
leveling, tickets, and everything else for the guilds assigned to it — which
lets Squared One keep growing without a single server doing all the work.

## How it works

1. You create a **worker token** in the dashboard (Settings → Workers).
2. You download and run this app (`node worker/index.js`).
3. The app claims a free shard from the server, pulls a data snapshot, and
   connects to Discord as that shard.
4. It sends a heartbeat every 30 seconds. For every hour of continuous uptime
   you earn credits at the configured rate (default **5 SQ/hour**).
5. The worker pushes its guild-scoped data (levels, verification, tickets,
   stickies, role restore, autoroles) back to the server so nothing is lost.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer.
- A worker token from the Squared One dashboard.

## Setup

```bash
# 1. Get the worker app (this folder plus the src/ folder it needs)
git clone https://github.com/squared-ones/bot.git
cd bot/worker

# 2. Install dependencies
npm install

# 3. Configure your token
cp .env.example .env
#   edit .env and set WORKER_TOKEN=<your token from the dashboard>

# 4. Run it
npm start
```

The worker will connect, claim a shard, and start earning credits immediately.
Keep the terminal (or a process manager like `pm2`) running to keep earning.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `WORKER_TOKEN` | — | Your worker token from the dashboard (required). |
| `WORKER_URL` | `https://squared-one.onrender.com` | Base URL of the Squared One server. |

## Notes

- **Keep your worker token secret.** Anyone with it can run a shard as you and
  claim your credits.
- The worker needs the server to be reachable (it pulls data and heartbeats).
- If the server changes the total shard count, the worker reconnects
  automatically.
- To stop earning, revoke the worker in the dashboard or just stop the app.
