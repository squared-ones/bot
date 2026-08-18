# Squared One Worker

Run a Discord shard of the Squared One bot from your own machine and earn SQ
credits for every hour of uptime.

## Quick start (standalone app)

1. Create a worker token in the dashboard: **Settings → Workers → Create worker**.
   The full token is shown only once — copy it.
2. Download the app for your platform from the dashboard (or the latest
   [GitHub release](https://github.com/squared-ones/bot/releases/latest)):
   - **Windows** → `squared-one-worker-windows-x64.zip`
   - **Linux x64** → `squared-one-worker-linux-x64.tar.gz`
   - **Linux ARM** → `squared-one-worker-linux-arm64.tar.gz`
   - **macOS Apple Silicon** → `squared-one-worker-macos-arm64.tar.gz`
   - **macOS Intel** → `squared-one-worker-macos-x64.tar.gz`
3. Extract the archive anywhere (e.g. a folder called `squared-one-worker`).
4. Open the `.env` file that's inside and set your token:
   ```env
   WORKER_TOKEN=your-worker-token
   ```
   (If the `.env` file isn't there yet, it is created automatically the first
   time you run the app — edit it and run again.)
5. Run the app:
   - **Windows**: double-click `squared-one-worker.exe`, or run it from a
     terminal to see its logs.
   - **Linux/macOS**: `./squared-one-worker` from a terminal (you may need
     `chmod +x squared-one-worker` first).

The app connects to the server, claims a shard, and starts earning credits
immediately. Leave it running to keep earning. It keeps its data in a `data/`
folder next to the executable.

## Running from source (developers)

```bash
npm install
cp worker/.env.example worker/.env   # set WORKER_TOKEN
node worker/index.js
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `WORKER_TOKEN` | yes | Your worker token from the dashboard (Settings → Workers) |
| `WORKER_URL` | no | Server base URL (defaults to `https://squared-one.onrender.com`) |

## How it works

- The server runs shard 0. When a worker comes online, the network expands to
  a second shard; as workers join and leave, the shard count grows and shrinks
  and the server bot reconnects to stay in sync.
- The worker pulls the current data snapshot (rules, configs, levels, …) from
  the server on startup and every few minutes, and pushes its guild-scoped
  changes back, so data stays consistent across shards.
- Credits are accrued on the server based on verified uptime (heartbeats) and
  paid out to your SQ balance.
- Stop the app with `Ctrl+C` — it releases its shard cleanly. If it crashes or
  loses connection, the server marks it offline after a timeout and shrinks the
  network back down.
